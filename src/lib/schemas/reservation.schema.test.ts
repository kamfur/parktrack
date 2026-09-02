import { describe, it, expect } from "vitest";
import type { CreateExternalReservationResponseDto } from "@/types";
import { createExternalReservationSchema } from "@/lib/schemas/reservation.schema";

// ---------------------------------------------------------------------------
// createExternalReservationSchema — external API payload contract (Risk #7)
// ---------------------------------------------------------------------------

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== (key as string))) as Omit<T, K>;
}

const GOLDEN = {
  lastName: "Kowalski",
  firstName: "Jan",
  email: "jan@example.com",
  phone: "123456789",
  licensePlate: "WA12345",
  checkInDate: "2026-09-10T14:00:00.000Z",
  checkOutDate: "2026-09-12T12:00:00.000Z",
};

describe("createExternalReservationSchema", () => {
  it("accepts a valid golden payload", () => {
    expect(createExternalReservationSchema.safeParse(GOLDEN).success).toBe(true);
  });

  it("rejects when lastName is missing", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "lastName")).success).toBe(false);
  });

  it("rejects when firstName is missing", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "firstName")).success).toBe(false);
  });

  it("rejects when email is missing", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "email")).success).toBe(false);
  });

  it("rejects when email has an invalid format", () => {
    expect(createExternalReservationSchema.safeParse({ ...GOLDEN, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects when phone is missing", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "phone")).success).toBe(false);
  });

  it("rejects when licensePlate is missing", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "licensePlate")).success).toBe(false);
  });

  it("rejects when checkOutDate is before checkInDate", () => {
    expect(
      createExternalReservationSchema.safeParse({
        ...GOLDEN,
        checkInDate: "2026-09-12T12:00:00.000Z",
        checkOutDate: "2026-09-10T14:00:00.000Z",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreateExternalReservationResponseDto — compile-time shape assertion (Risk #7)
// ---------------------------------------------------------------------------

describe("CreateExternalReservationResponseDto", () => {
  it("shape is { reservationId: string, message: string }", () => {
    const _check: CreateExternalReservationResponseDto = { reservationId: "r-1", message: "ok" };
    expect(_check).toBeDefined();
  });
});
