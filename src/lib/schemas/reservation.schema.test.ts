import { describe, it, expect } from "vitest";
import type { CreateExternalReservationResponseDto } from "@/types";
import {
  createExternalReservationSchema,
  createLegacyDepartureSchema,
  createReservationSchema,
  changeReturnDateFormSchema,
  editReservationSchema,
  fullReservationSchema,
} from "@/lib/schemas/reservation.schema";

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

describe("createReservationSchema", () => {
  it("accepts payload without total_cost — server calculates cost", () => {
    expect(
      createReservationSchema.safeParse({
        last_name: "Kowalski",
        planned_check_in: "2026-09-10T14:00:00.000Z",
        planned_check_out: "2026-09-12T12:00:00.000Z",
        source: "phone",
      }).success
    ).toBe(true);
  });

  it("accepts free-text flight_direction", () => {
    expect(
      createReservationSchema.safeParse({
        last_name: "Kowalski",
        planned_check_in: "2026-09-10T14:00:00.000Z",
        planned_check_out: "2026-09-12T12:00:00.000Z",
        source: "phone",
        flight_direction: "Londyn LO 392",
      }).success
    ).toBe(true);
  });

  it("rejects flight_direction longer than 100 characters", () => {
    expect(
      createReservationSchema.safeParse({
        last_name: "Kowalski",
        planned_check_in: "2026-09-10T14:00:00.000Z",
        planned_check_out: "2026-09-12T12:00:00.000Z",
        source: "phone",
        flight_direction: "x".repeat(101),
      }).success
    ).toBe(false);
  });
});

describe("fullReservationSchema phone", () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const validFull = {
    lastName: "Kowalski",
    checkInDate: today,
    checkOutDate: tomorrow,
    phone: "",
  };

  it("accepts a formatted 9-digit phone with spaces", () => {
    expect(fullReservationSchema.safeParse({ ...validFull, phone: "123 456 789" }).success).toBe(true);
  });

  it("accepts a raw 9-digit phone", () => {
    expect(fullReservationSchema.safeParse({ ...validFull, phone: "123456789" }).success).toBe(true);
  });

  it("accepts an empty phone", () => {
    expect(fullReservationSchema.safeParse({ ...validFull, phone: "" }).success).toBe(true);
  });

  it("rejects a phone that is not exactly 9 digits", () => {
    expect(fullReservationSchema.safeParse({ ...validFull, phone: "123 45" }).success).toBe(false);
  });
});

describe("editReservationSchema", () => {
  const validEdit = {
    lastName: "Kowalski",
    firstName: "Jan",
    email: "jan@example.com",
    phone: "123 456 789",
    licensePlate: "WX 12345",
    checkInDate: new Date("2025-01-10T14:00:00.000Z"),
    checkOutDate: new Date("2025-01-12T12:00:00.000Z"),
    flightDirection: "Londyn",
    notes: "Uwagi",
  };

  it("accepts a past check-in date for an existing reservation", () => {
    expect(editReservationSchema.safeParse(validEdit).success).toBe(true);
  });

  it("rejects when check-out is before check-in", () => {
    expect(
      editReservationSchema.safeParse({
        ...validEdit,
        checkInDate: new Date("2025-01-12T12:00:00.000Z"),
        checkOutDate: new Date("2025-01-10T14:00:00.000Z"),
      }).success
    ).toBe(false);
  });

  it("rejects a last name shorter than 2 characters", () => {
    expect(editReservationSchema.safeParse({ ...validEdit, lastName: "K" }).success).toBe(false);
  });
});

describe("changeReturnDateFormSchema", () => {
  it("accepts a datetime-local value", () => {
    expect(changeReturnDateFormSchema.safeParse({ planned_check_out: "2026-09-16T14:30" }).success).toBe(true);
  });

  it("rejects an empty return date", () => {
    expect(changeReturnDateFormSchema.safeParse({ planned_check_out: "" }).success).toBe(false);
  });
});

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("createLegacyDepartureSchema", () => {
  it("accepts a car parked in the past returning later", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_in: hoursFromNow(-72),
      planned_check_out: hoursFromNow(5),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an arrival in the future", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_in: hoursFromNow(2),
      planned_check_out: hoursFromNow(5),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a return before the arrival", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_in: hoursFromNow(-2),
      planned_check_out: hoursFromNow(-5),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing last name and non-positive cost", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: " ",
      planned_check_in: hoursFromNow(-2),
      planned_check_out: hoursFromNow(5),
      total_cost: 0,
    });
    expect(result.success).toBe(false);
  });
});
