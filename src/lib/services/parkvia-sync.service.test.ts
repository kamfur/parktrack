import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBooking } from "../parkvia/booking.fixture";
import { ParkCloudError, type ParkCloudBooking, type ParkCloudPort } from "../parkvia/parkcloud.port";
import { BOOTSTRAP_ARRIVAL_DAYS, BOOTSTRAP_EVENT_HOURS, ParkViaSyncService } from "./parkvia-sync.service";

const updateReservation = vi.fn();
vi.mock("./reservation.service", () => ({
  ReservationService: vi.fn().mockImplementation(function () {
    return { updateReservation };
  }),
}));

type Row = Record<string, unknown>;

/** In-memory stand-in for the service-role client: just the query shapes the sync uses. */
function fakeAdmin(tables: { reservations?: Row[]; parkvia_sync_state?: Row[] } = {}) {
  const db: Record<string, Row[]> = {
    reservations: tables.reservations ?? [],
    parkvia_sync_state: tables.parkvia_sync_state ?? [],
  };
  const inserted: Row[] = [];
  const updates: { id: unknown; values: Row }[] = [];
  let insertError: { code: string; message: string } | null = null;

  function query(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    const rows = () => db[table].filter((row) => filters.every((f) => f(row)));
    let pendingUpdate: Row | null = null;
    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => {
        filters.push((row) => row[col] === value);
        if (pendingUpdate) {
          const values = pendingUpdate;
          rows().forEach((row) => Object.assign(row, values));
          updates.push({ id: value, values });
          return Promise.resolve({ error: null });
        }
        return builder;
      },
      is: (col: string, value: unknown) => {
        filters.push((row) => (row[col] ?? null) === value);
        return builder;
      },
      gte: (col: string, value: string) => {
        filters.push((row) => Date.parse(String(row[col])) >= Date.parse(value));
        return builder;
      },
      lt: (col: string, value: string) => {
        filters.push((row) => Date.parse(String(row[col])) < Date.parse(value));
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null }),
      update: (values: Row) => {
        pendingUpdate = values;
        return builder;
      },
      insert: (values: Row) => {
        if (insertError) return Promise.resolve({ error: insertError });
        inserted.push(values);
        db[table].push({ id: `new-${inserted.length}`, status: "confirmed", ...values });
        return Promise.resolve({ error: null });
      },
      upsert: (values: Row) => {
        const existing = db[table].find((row) => row.operator_id === values.operator_id);
        if (existing) Object.assign(existing, values);
        else db[table].push({ ...values });
        return Promise.resolve({ error: null });
      },
    };
    return builder;
  }

  const client = {
    from: (table: string) => query(table),
    rpc: vi.fn().mockResolvedValue({ data: "system-user", error: null }),
  };
  return {
    client: client as never,
    db,
    inserted,
    updates,
    failInsertsWith: (error: { code: string; message: string }) => {
      insertError = error;
    },
  };
}

function fakeParkCloud(bookings: ParkCloudBooking[], overrides: Partial<ParkCloudPort> = {}) {
  const byRef = new Map(bookings.map((b) => [b.Reference, b]));
  const port: ParkCloudPort = {
    getOperators: vi.fn().mockResolvedValue([{ Id: "1500", Name: "Test" }]),
    getEventsByAge: vi.fn().mockResolvedValue([]),
    getEventsSince: vi.fn().mockResolvedValue([]),
    getArrivalReferences: vi.fn().mockResolvedValue([]),
    getBooking: vi.fn(async (_op: string, ref: string) => {
      const booking = byRef.get(ref);
      if (!booking) throw new ParkCloudError("Booking not found", 403);
      return booking;
    }),
    ...overrides,
  };
  return port;
}

const event = (Id: number, BookingReference: string, Type = "NEW") => ({
  Id,
  Date: "2026-10-06T07:15:58.137",
  Type,
  BookingReference,
});

const NOW = () => new Date("2026-10-07T10:00:00Z");
const CURSOR = { operator_id: "1500", last_event_id: 100, last_run_at: "2026-10-07T09:00:00Z" };

beforeEach(() => {
  updateReservation.mockReset().mockResolvedValue({});
});

describe("ParkViaSyncService", () => {
  it("bootstraps from 30 days of events plus future arrivals, then stores the cursor", async () => {
    const admin = fakeAdmin();
    const parkCloud = fakeParkCloud([makeBooking({ Reference: "A1" }), makeBooking({ Reference: "B2" })], {
      getEventsByAge: vi.fn().mockResolvedValue([event(205, "A1"), event(201, "A1", "AMEND")]),
      getArrivalReferences: vi.fn(async (_op: string, day: string) => (day === "2026-12-24" ? ["B2"] : [])),
    });

    const summary = await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(parkCloud.getEventsByAge).toHaveBeenCalledWith("1500", BOOTSTRAP_EVENT_HOURS);
    expect(parkCloud.getArrivalReferences).toHaveBeenCalledTimes(BOOTSTRAP_ARRIVAL_DAYS);
    expect(parkCloud.getArrivalReferences).toHaveBeenCalledWith("1500", "2026-10-07");
    expect(summary).toMatchObject({ operators: ["1500"], bookings: 2, inserted: 2, failed: 0 });
    expect(admin.inserted.map((r) => r.external_reference).sort()).toEqual(["A1", "B2"]);
    expect(admin.inserted[0]).toMatchObject({
      source: "parkvia",
      external_source: "parkvia",
      is_paid: true,
      total_cost: 160,
      created_by: "system-user",
      last_modified_by: "system-user",
    });
    expect(admin.db.parkvia_sync_state).toEqual([
      expect.objectContaining({ operator_id: "1500", last_event_id: 205, last_error: null }),
    ]);
  });

  it("continues from the stored event id and applies amend + cancel", async () => {
    const amended = makeBooking({ Reference: "A1", DepartureDate: "2026-10-23T09:00:00", AmountPaid: 190 });
    const cancelled = makeBooking({ Reference: "C3", Status: "CANCELLED" });
    const admin = fakeAdmin({
      parkvia_sync_state: [{ ...CURSOR }],
      reservations: [
        {
          id: "res-a",
          status: "confirmed",
          external_source: "parkvia",
          external_reference: "A1",
          last_name: "Testowy",
          first_name: "Jan",
          email: "jan@example.com",
          phone: "+48500100200",
          license_plate: "SK 12345",
          planned_check_in: "2026-10-11T01:15:00.000Z",
          planned_check_out: "2026-10-22T18:00:00.000Z",
          passenger_count: 3,
          flight_direction: "Londyn",
          total_cost: 160,
        },
        { id: "res-c", status: "confirmed", external_source: "parkvia", external_reference: "C3" },
      ],
    });
    const parkCloud = fakeParkCloud([amended, cancelled], {
      getEventsSince: vi.fn().mockResolvedValue([event(101, "A1", "AMEND"), event(102, "C3", "CANCEL")]),
    });

    const summary = await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(parkCloud.getEventsSince).toHaveBeenCalledWith("1500", 100);
    expect(parkCloud.getArrivalReferences).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ updated: 1, cancelled: 1, inserted: 0 });
    expect(updateReservation).toHaveBeenCalledWith("res-a", {
      planned_check_in: undefined,
      planned_check_out: "2026-10-23T07:00:00.000Z",
    });
    expect(admin.updates).toContainEqual({ id: "res-a", values: { total_cost: 190 } });
    expect(updateReservation).toHaveBeenCalledWith("res-c", { status: "cancelled" });
    expect(admin.db.parkvia_sync_state[0]).toMatchObject({ last_event_id: 102 });
  });

  it("adopts a reservation staff typed in by hand (same plate, same Warsaw day) instead of duplicating it", async () => {
    const admin = fakeAdmin({
      parkvia_sync_state: [{ ...CURSOR }],
      reservations: [
        {
          id: "manual-1",
          status: "confirmed",
          external_reference: null,
          license_plate: "SK12345",
          last_name: "Testowy",
          planned_check_in: "2026-10-11T06:00:00.000Z",
          planned_check_out: "2026-10-22T18:00:00.000Z",
          total_cost: 200,
        },
      ],
    });
    const parkCloud = fakeParkCloud([makeBooking({ Reference: "A1" })], {
      getEventsSince: vi.fn().mockResolvedValue([event(101, "A1")]),
    });

    const summary = await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(summary).toMatchObject({ linked: 1, inserted: 0, updated: 1 });
    expect(admin.inserted).toEqual([]);
    expect(admin.db.reservations[0]).toMatchObject({
      source: "parkvia",
      external_source: "parkvia",
      external_reference: "A1",
      is_paid: true,
      total_cost: 160,
    });
  });

  it("skips a booking the DB rejects, records it, and still advances the cursor", async () => {
    const admin = fakeAdmin({ parkvia_sync_state: [{ ...CURSOR }] });
    admin.failInsertsWith({ code: "P0001", message: "boom" });
    const parkCloud = fakeParkCloud([makeBooking({ Reference: "A1" })], {
      getEventsSince: vi.fn().mockResolvedValue([event(101, "A1"), event(102, "GONE")]),
    });

    const summary = await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(summary.failed).toBe(2);
    expect(summary.errors).toEqual(["A1: Failed to import ParkVia booking: boom", "GONE: Booking not found"]);
    expect(admin.db.parkvia_sync_state[0]).toMatchObject({ last_event_id: 102, last_error: "2 booking(s) failed" });
  });

  it("treats a concurrent import of the same booking (unique violation) as already done", async () => {
    const admin = fakeAdmin({ parkvia_sync_state: [{ ...CURSOR }] });
    admin.failInsertsWith({ code: "23505", message: "duplicate key" });
    const parkCloud = fakeParkCloud([makeBooking({ Reference: "A1" })], {
      getEventsSince: vi.fn().mockResolvedValue([event(101, "A1")]),
    });

    const summary = await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(summary).toMatchObject({ inserted: 0, skipped: 1, failed: 0 });
  });

  it("keeps the cursor when ParkCloud fails mid-run, so the window is retried", async () => {
    const admin = fakeAdmin({ parkvia_sync_state: [{ ...CURSOR }] });
    const parkCloud = fakeParkCloud([], {
      getEventsSince: vi.fn().mockResolvedValue([event(101, "A1")]),
      getBooking: vi.fn().mockRejectedValue(new ParkCloudError("ParkCloud answered 503", 503)),
    });

    await expect(new ParkViaSyncService(admin.client, parkCloud, NOW).run()).rejects.toThrow(/503/);
    expect(admin.db.parkvia_sync_state[0]).toMatchObject({ last_event_id: 100, last_error: "ParkCloud answered 503" });
  });

  it("does not create a state row when the bootstrap fails, so the next run bootstraps again", async () => {
    const admin = fakeAdmin();
    const parkCloud = fakeParkCloud([], {
      getEventsByAge: vi.fn().mockRejectedValue(new ParkCloudError("ParkCloud answered 401", 401)),
    });

    await expect(new ParkViaSyncService(admin.client, parkCloud, NOW).run()).rejects.toThrow(/401/);
    expect(admin.db.parkvia_sync_state).toEqual([]);
  });

  it("without an event id uses the time since the last run (+2h margin)", async () => {
    const admin = fakeAdmin({
      parkvia_sync_state: [{ operator_id: "1500", last_event_id: null, last_run_at: "2026-10-07T07:00:00Z" }],
    });
    const parkCloud = fakeParkCloud([]);

    await new ParkViaSyncService(admin.client, parkCloud, NOW).run();

    expect(parkCloud.getEventsByAge).toHaveBeenCalledWith("1500", 5);
  });
});
