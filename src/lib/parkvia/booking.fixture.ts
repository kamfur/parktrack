import type { ParkCloudBooking } from "./parkcloud.port";

/** Fake ParkCloud booking (shape taken from a real Get Booking Details response). */
export function makeBooking(overrides: Partial<ParkCloudBooking> = {}): ParkCloudBooking {
  return {
    Reference: "PC90000001",
    Status: "CONFIRMED",
    AmountPaid: 160,
    AmountDue: 0,
    Currency: "PLN",
    ArrivalDate: "2026-10-11T03:15:00",
    DepartureDate: "2026-10-22T20:00:00",
    Customer: { FirstName: "Jan", Surname: "Testowy", Mobile: "+48500100200", Email: "jan@example.com" },
    Vehicle: { Registration: "sk 12345", Make: null, Model: "Octavia", Colour: "szary" },
    Passengers: 2,
    PassengersChild: 1,
    PassengersInfant: 0,
    PassengerNames: [],
    Options: [{ Quantity: 1, Description: "parking" }],
    ReturningFrom: "Londyn",
    SpecialRequests: "Fotelik w aucie",
    IsNoShow: false,
    ...overrides,
  };
}
