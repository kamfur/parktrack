import { z } from "zod";

/**
 * ParkCloud Operator API (ParkVia) — response shapes we rely on.
 * Spec: context/changes/parkvia-integration/parkcloud-openapi.yaml. Dates come without an offset
 * and are the car park's local time (Europe/Warsaw), e.g. "2026-10-11T03:15:00".
 */

export const parkCloudOperatorSchema = z.object({
  Id: z.union([z.string(), z.number()]).transform(String),
  Name: z.string().nullable().optional(),
});

export const parkCloudEventSchema = z.object({
  Id: z.number().int(),
  Date: z.string(),
  /** NEW | AMEND | CANCEL | NOSHOW */
  Type: z.string(),
  BookingReference: z.string().min(1),
});

export const parkCloudArrivalSchema = z.object({
  BookingReference: z.string().min(1),
});

const nullableString = z.string().nullable().optional();

export const parkCloudBookingSchema = z.object({
  Reference: z.string().min(1),
  /** ENQUIRY | CONFIRMED | CANCELLED */
  Status: z.string(),
  AmountPaid: z.number().nullable().optional(),
  AmountDue: z.number().nullable().optional(),
  Currency: nullableString,
  ArrivalDate: z.string(),
  DepartureDate: z.string(),
  Customer: z
    .object({
      FirstName: nullableString,
      Surname: nullableString,
      Mobile: nullableString,
      Email: nullableString,
    })
    .nullable()
    .optional(),
  Vehicle: z
    .object({
      Registration: nullableString,
      Make: nullableString,
      Model: nullableString,
      Colour: nullableString,
    })
    .nullable()
    .optional(),
  Passengers: z.number().int().nullable().optional(),
  PassengersChild: z.number().int().nullable().optional(),
  PassengersInfant: z.number().int().nullable().optional(),
  PassengerNames: z
    .array(z.object({ FirstName: nullableString, Surname: nullableString, Lead: z.boolean().nullable().optional() }))
    .nullable()
    .optional(),
  Options: z
    .array(z.object({ Quantity: z.number().nullable().optional(), Description: nullableString }))
    .nullable()
    .optional(),
  OutboundTerminal: nullableString,
  OutboundFlight: nullableString,
  ReturningFrom: nullableString,
  ReturnTerminal: nullableString,
  ReturnFlight: nullableString,
  SpecialRequests: nullableString,
  IsNoShow: z.boolean().nullable().optional(),
});

export type ParkCloudOperator = z.output<typeof parkCloudOperatorSchema>;
export type ParkCloudEvent = z.output<typeof parkCloudEventSchema>;
export type ParkCloudBooking = z.output<typeof parkCloudBookingSchema>;

/** ParkCloud is unreachable or answered with an error — the sync run must not advance its cursor. */
export class ParkCloudError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ParkCloudError";
  }
}

export interface ParkCloudPort {
  getOperators(): Promise<ParkCloudOperator[]>;
  /** Events younger than `hours` (ParkCloud keeps a rolling history). */
  getEventsByAge(operatorId: string, hours: number): Promise<ParkCloudEvent[]>;
  /** Events after `eventId`, oldest first. */
  getEventsSince(operatorId: string, eventId: number): Promise<ParkCloudEvent[]>;
  /** Booking references arriving on a Warsaw date (YYYY-MM-DD). */
  getArrivalReferences(operatorId: string, dateKey: string): Promise<string[]>;
  getBooking(operatorId: string, reference: string): Promise<ParkCloudBooking>;
}
