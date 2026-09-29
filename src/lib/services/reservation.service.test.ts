import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("./garage-allocation.service", () => ({
  GarageAllocationService: vi.fn(),
  GarageBufferViolationError: class GarageBufferViolationError extends Error {},
}));

import {
  ReservationService,
  NoGarageAvailableError,
  NoPriceListError,
  TravelAgencyUnavailableError,
} from "./reservation.service";
import { createSupabaseAdminClient } from "../supabase-admin";
import { GarageAllocationService, GarageBufferViolationError } from "./garage-allocation.service";

function mockListClient() {
  const result = { data: [{ id: "r1" }], error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(builder),
    builder,
  };
}

describe("ReservationService dashboard lists", () => {
  it("getTodaysArrivals includes overdue plus Warsaw today confirmed arrivals", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    const now = new Date("2026-09-09T10:00:00Z");
    const rows = await service.getTodaysArrivals(now);

    expect(client.from).toHaveBeenCalledWith("reservations");
    expect(client.builder.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_in", "2026-09-09T22:00:00.000Z");
    expect(client.builder.order).toHaveBeenCalledWith("planned_check_in", { ascending: true });
    expect(rows).toEqual([{ id: "r1" }]);
  });

  it("getTodaysArrivals looks 12h ahead in the evening (customers after midnight)", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    await service.getTodaysArrivals(new Date("2026-09-09T18:00:00Z"));

    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_in", "2026-09-10T06:00:00.000Z");
  });

  it("getTodaysDepartures includes delayed plus Warsaw today in-progress returns", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    const now = new Date("2026-09-09T10:00:00Z");
    await service.getTodaysDepartures(now);

    expect(client.builder.eq).toHaveBeenCalledWith("status", "in_progress");
    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_out", "2026-09-09T22:00:00.000Z");
    expect(client.builder.order).toHaveBeenCalledWith("planned_check_out", { ascending: true });
  });
});

describe("ReservationService.listFlightDirections", () => {
  it("returns unique saved destinations", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { flight_direction: "Londyn" },
        { flight_direction: "londyn" },
        { flight_direction: "Dortmund" },
        { flight_direction: "departure" },
      ],
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({ limit }),
          }),
        }),
      }),
    };
    const service = new ReservationService(client as never);

    await expect(service.listFlightDirections()).resolves.toEqual(["Dortmund", "Londyn"]);
    expect(client.from).toHaveBeenCalledWith("reservations");
  });
});

describe("ReservationService.createReservation — garage auto-assign", () => {
  const insertedReservation = {
    id: "r1",
    planned_check_in: "2026-09-02T00:00:00Z",
    planned_check_out: "2026-09-02T08:00:00Z",
    parking_type: "garage",
  };

  function mockAdminClient() {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    return {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedReservation, error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: deleteEq,
      }),
      deleteEq,
    };
  }

  beforeEach(() => {
    vi.mocked(GarageAllocationService).mockClear();
  });

  it("auto-assigns a garage spot when parking_type is 'garage'", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const findAvailableSpot = vi.fn().mockResolvedValue({ id: "spot-1" });
    const assign = vi.fn().mockResolvedValue({ id: "assignment-1" });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { findAvailableSpot, assign };
    } as never);

    const service = new ReservationService({} as never);
    const result = await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "garage",
      },
      "user-1"
    );

    expect(findAvailableSpot).toHaveBeenCalledWith(
      insertedReservation.planned_check_in,
      insertedReservation.planned_check_out,
      "garage"
    );
    expect(assign).toHaveBeenCalledWith("r1", "spot-1", "system");
    expect(result).toEqual(insertedReservation);
  });

  it("auto-assigns only a carport spot when parking_type is 'carport'", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const findAvailableSpot = vi.fn().mockResolvedValue({ id: "spot-2" });
    const assign = vi.fn().mockResolvedValue({ id: "assignment-2" });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { findAvailableSpot, assign };
    } as never);

    const service = new ReservationService({} as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "carport",
      },
      "user-1"
    );

    expect(findAvailableSpot).toHaveBeenCalledWith(expect.any(String), expect.any(String), "carport");
    expect(assign).toHaveBeenCalledWith("r1", "spot-2", "system");
  });

  it("throws NoGarageAvailableError when no spot is available within the buffer, and deletes the orphaned reservation", async () => {
    const adminClient = mockAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminClient as never);

    const findAvailableSpot = vi.fn().mockResolvedValue(null);
    const assign = vi.fn();
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { findAvailableSpot, assign };
    } as never);

    const service = new ReservationService({} as never);

    await expect(
      service.createReservation(
        {
          last_name: "Kowalski",
          planned_check_in: "2026-09-02T00:00:00Z",
          planned_check_out: "2026-09-02T08:00:00Z",
          source: "phone",
          total_cost: 100,
          parking_type: "garage",
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(NoGarageAvailableError);

    expect(assign).not.toHaveBeenCalled();
    expect(adminClient.deleteEq).toHaveBeenCalledWith("id", "r1");
  });

  it("does not touch garage allocation for a regular (open_air) reservation", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const service = new ReservationService({} as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "open_air",
      },
      "user-1"
    );

    expect(GarageAllocationService).not.toHaveBeenCalled();
  });
});

describe("ReservationService pricing", () => {
  it("prices a reservation without total_cost from the price list row for its parking type", async () => {
    const insert = vi.fn().mockReturnThis();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
      }),
    } as never);
    const rpc = vi.fn().mockResolvedValue({ data: 180, error: null });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { findAvailableSpot: vi.fn().mockResolvedValue({ id: "spot-1" }), assign: vi.fn() };
    } as never);

    const service = new ReservationService({ rpc } as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-05T00:00:00Z",
        source: "phone",
        parking_type: "carport",
      },
      "user-1"
    );

    expect(rpc).toHaveBeenCalledWith("calculate_total_cost", {
      p_check_in: "2026-09-02T00:00:00Z",
      p_check_out: "2026-09-05T00:00:00Z",
      p_parking_type: "carport",
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ total_cost: 180, parking_type: "carport" }));
  });

  it("throws NoPriceListError when no price list covers the check-in date", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "NO_PRICE_LIST: no price list for open_air on 2030-01-01" },
    });
    const service = new ReservationService({ rpc } as never);

    await expect(service.calculateCost("2030-01-01T10:00:00Z", "2030-01-03T10:00:00Z")).rejects.toBeInstanceOf(
      NoPriceListError
    );
  });
});

describe("ReservationService.updateReservation — garage buffer revalidation", () => {
  function mockClient(currentReservation: unknown, updatedReservation: unknown) {
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: currentReservation, error: null }) // fetch current dates
      .mockResolvedValueOnce({ data: updatedReservation, error: null }); // update().select().single()
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };
  }

  beforeEach(() => {
    vi.mocked(GarageAllocationService).mockClear();
  });

  it("re-validates the buffer when planned dates change, and proceeds when it passes", async () => {
    const current = { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" };
    const updated = { id: "r1", planned_check_out: "2026-09-02T10:00:00Z" };
    const client = mockClient(current, updated);

    const revalidateAssignment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { revalidateAssignment };
    } as never);

    const service = new ReservationService(client as never);
    const result = await service.updateReservation("r1", { planned_check_out: "2026-09-02T10:00:00Z" });

    expect(revalidateAssignment).toHaveBeenCalledWith("r1", current.planned_check_in, "2026-09-02T10:00:00Z");
    expect(result).toEqual(updated);
  });

  it("propagates GarageBufferViolationError when the new dates would break the buffer", async () => {
    const current = { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" };
    const client = mockClient(current, {});

    const revalidateAssignment = vi.fn().mockRejectedValue(new GarageBufferViolationError());
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { revalidateAssignment };
    } as never);

    const service = new ReservationService(client as never);

    await expect(service.updateReservation("r1", { planned_check_out: "2026-09-02T10:00:00Z" })).rejects.toBeInstanceOf(
      GarageBufferViolationError
    );
  });

  it("does not touch garage allocation when planned dates are not part of the update", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1", notes: "updated" }, error: null }),
      }),
    };

    const service = new ReservationService(client as never);
    await service.updateReservation("r1", { notes: "updated" });

    expect(GarageAllocationService).not.toHaveBeenCalled();
  });
});

describe("ReservationService — travel agency pricing", () => {
  const AGENCY_ID = "11111111-1111-4111-8111-111111111111";

  function agencyClient(agency: { discount_pct: number; archived_at: string | null } | null) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: 50, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: agency, error: null }),
      }),
    };
  }

  it("quoteCost applies the agency discount to the price-list total", async () => {
    const service = new ReservationService(agencyClient({ discount_pct: 15, archived_at: null }) as never);
    await expect(
      service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z", "open_air", AGENCY_ID)
    ).resolves.toEqual({ baseCost: 50, discountPct: 15, totalCost: 42.5 });
  });

  it("quoteCost without an agency returns the full price", async () => {
    const service = new ReservationService(agencyClient(null) as never);
    await expect(service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z")).resolves.toEqual({
      baseCost: 50,
      discountPct: 0,
      totalCost: 50,
    });
  });

  it("quoteCost rejects an archived agency", async () => {
    const service = new ReservationService(agencyClient({ discount_pct: 15, archived_at: "2026-09-01" }) as never);
    await expect(
      service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z", "open_air", AGENCY_ID)
    ).rejects.toBeInstanceOf(TravelAgencyUnavailableError);
  });

  it("createReservation ignores a client total for agency reservations (DB prices it)", async () => {
    const insert = vi.fn().mockReturnThis();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
      }),
    } as never);
    const rpc = vi.fn().mockResolvedValue({ data: 180, error: null });

    const service = new ReservationService({ rpc } as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-05T00:00:00Z",
        source: "phone",
        total_cost: 1,
        travel_agency_id: AGENCY_ID,
      },
      "user-1"
    );

    expect(rpc).toHaveBeenCalledWith("calculate_total_cost", expect.anything());
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ total_cost: 180, travel_agency_id: AGENCY_ID }));
  });

  it("maps the AGENCY_ARCHIVED trigger error on create", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "AGENCY_ARCHIVED: x" } }),
      }),
    } as never);
    const service = new ReservationService({ rpc: vi.fn().mockResolvedValue({ data: 180, error: null }) } as never);

    await expect(
      service.createReservation(
        {
          last_name: "Kowalski",
          planned_check_in: "2026-09-02T00:00:00Z",
          planned_check_out: "2026-09-05T00:00:00Z",
          source: "phone",
          travel_agency_id: AGENCY_ID,
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(TravelAgencyUnavailableError);
  });
});
