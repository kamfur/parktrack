import { describe, expect, it } from "vitest";
import {
  buildImportNotes,
  decideSyncAction,
  mapBookingFields,
  parkCloudLocalToIso,
  type ExistingReservation,
} from "./booking-mapper";
import type { ParkCloudBooking } from "./parkcloud.port";
import { makeBooking } from "./booking.fixture";

function existingFrom(booking: ParkCloudBooking, overrides: Partial<ExistingReservation> = {}): ExistingReservation {
  return { id: "res-1", status: "confirmed", ...mapBookingFields(booking), ...overrides };
}

describe("parkCloudLocalToIso", () => {
  it("reads ParkCloud dates as Warsaw wall clock", () => {
    expect(parkCloudLocalToIso("2026-10-11T03:15:00")).toBe("2026-10-11T01:15:00.000Z"); // CEST
    expect(parkCloudLocalToIso("2026-12-01T10:00:00")).toBe("2026-12-01T09:00:00.000Z"); // CET
  });

  it("rejects an unexpected format", () => {
    expect(() => parkCloudLocalToIso("11/10/2026")).toThrow(/Unexpected ParkCloud date/);
  });
});

describe("mapBookingFields", () => {
  it("maps customer, plate, stay, passengers and the ParkVia price", () => {
    expect(mapBookingFields(makeBooking({ AmountDue: 20.5 }))).toEqual({
      last_name: "Testowy",
      first_name: "Jan",
      email: "jan@example.com",
      phone: "+48500100200",
      license_plate: "SK 12345",
      planned_check_in: "2026-10-11T01:15:00.000Z",
      planned_check_out: "2026-10-22T18:00:00.000Z",
      passenger_count: 3,
      flight_direction: "Londyn",
      total_cost: 180.5,
    });
  });

  it("falls back to the lead passenger, then to the reference, for the last name", () => {
    const lead = makeBooking({
      Customer: { FirstName: null, Surname: " ", Mobile: null, Email: null },
      PassengerNames: [
        { FirstName: "Ola", Surname: "Druga", Lead: false },
        { FirstName: "Ewa", Surname: "Wiodąca", Lead: true },
      ],
    });
    expect(mapBookingFields(lead)).toMatchObject({ last_name: "Wiodąca", first_name: "Ewa", email: null });

    const nobody = makeBooking({ Customer: null, PassengerNames: null });
    expect(mapBookingFields(nobody).last_name).toBe("ParkVia PC90000001");
  });

  it("leaves empty plate and passengers as null", () => {
    const fields = mapBookingFields(
      makeBooking({ Vehicle: null, Passengers: 0, PassengersChild: null, PassengersInfant: null })
    );
    expect(fields.license_plate).toBeNull();
    expect(fields.passenger_count).toBeNull();
  });
});

describe("buildImportNotes", () => {
  it("lists the reference, vehicle, flights, paid extras and customer requests", () => {
    const notes = buildImportNotes(
      makeBooking({
        OutboundFlight: "FR 1234",
        OutboundTerminal: "A",
        Options: [
          { Quantity: 1, Description: "parking" },
          { Quantity: 2, Description: "Mycie" },
        ],
      })
    );
    expect(notes.split("\n")).toEqual([
      "ParkVia: PC90000001",
      "Pojazd: Octavia szary",
      "Wylot: FR 1234, A",
      "Opcje: 2× Mycie",
      "Uwagi klienta: Fotelik w aucie",
    ]);
  });

  it("flags a non-PLN currency", () => {
    expect(buildImportNotes(makeBooking({ Currency: "EUR" }))).toContain("Waluta ParkVia: EUR");
  });
});

describe("decideSyncAction", () => {
  const NOW = new Date("2026-10-07T10:00:00Z");

  it("imports a new confirmed booking", () => {
    const action = decideSyncAction(makeBooking(), null, NOW);
    expect(action.kind).toBe("insert");
  });

  it("imports a stay that started earlier but departs today or later", () => {
    const booking = makeBooking({ ArrivalDate: "2026-10-01T08:00:00", DepartureDate: "2026-10-07T00:30:00" });
    expect(decideSyncAction(booking, null, NOW).kind).toBe("insert");
  });

  it("does not import a stay that departed before today (Warsaw)", () => {
    const booking = makeBooking({ ArrivalDate: "2026-10-01T08:00:00", DepartureDate: "2026-10-06T23:59:00" });
    expect(decideSyncAction(booking, null, NOW)).toEqual({
      kind: "skip",
      reason: "not imported, departure before today",
    });
  });

  it.each([
    ["ENQUIRY", false],
    ["CANCELLED", false],
    ["CONFIRMED", true],
  ])("does not import a %s booking that is unknown locally (no-show=%s)", (Status, IsNoShow) => {
    expect(decideSyncAction(makeBooking({ Status, IsNoShow }), null).kind).toBe("skip");
  });

  it("cancels a confirmed stay cancelled on ParkVia", () => {
    const booking = makeBooking({ Status: "CANCELLED" });
    expect(decideSyncAction(booking, existingFrom(booking))).toEqual({
      kind: "status",
      id: "res-1",
      status: "cancelled",
    });
  });

  it("marks a no-show reported by ParkVia", () => {
    const booking = makeBooking({ IsNoShow: true });
    expect(decideSyncAction(booking, existingFrom(booking))).toMatchObject({ kind: "status", status: "no_show" });
  });

  it("updates only the fields an AMEND changed", () => {
    const before = makeBooking();
    const amended = makeBooking({ DepartureDate: "2026-10-23T09:00:00", AmountPaid: 190 });
    expect(decideSyncAction(amended, existingFrom(before))).toEqual({
      kind: "update",
      id: "res-1",
      changes: { planned_check_out: "2026-10-23T07:00:00.000Z", total_cost: 190 },
    });
  });

  it("treats equal instants in another ISO spelling and numeric strings as unchanged", () => {
    const booking = makeBooking();
    const existing = existingFrom(booking, {
      planned_check_in: "2026-10-11T01:15:00+00:00",
      total_cost: "160.00" as unknown as number,
    });
    expect(decideSyncAction(booking, existing)).toEqual({ kind: "skip", reason: "unchanged" });
  });

  it.each(["in_progress", "completed", "cancelled", "no_show"])(
    "leaves a local %s stay alone, whatever ParkVia says",
    (status) => {
      const booking = makeBooking({ Status: "CANCELLED" });
      expect(decideSyncAction(booking, existingFrom(booking, { status })).kind).toBe("skip");
    }
  );
});
