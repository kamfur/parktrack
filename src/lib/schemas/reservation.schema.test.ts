import { describe, it, expect } from "vitest";
import type { CreateExternalReservationResponseDto } from "@/types";
import {
  createExternalReservationSchema,
  createLegacyDepartureSchema,
  createReservationSchema,
  changeReturnDateFormSchema,
  editReservationSchema,
  fullReservationSchema,
  updateReservationSchema,
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

  it("accepts a missing licensePlate", () => {
    expect(createExternalReservationSchema.safeParse(omit(GOLDEN, "licensePlate")).success).toBe(true);
  });

  it("treats an empty licensePlate as missing", () => {
    const parsed = createExternalReservationSchema.safeParse({ ...GOLDEN, licensePlate: "  " });
    expect(parsed.success && parsed.data.licensePlate).toBeUndefined();
  });

  it("rejects an overlong lastName", () => {
    expect(createExternalReservationSchema.safeParse({ ...GOLDEN, lastName: "x".repeat(101) }).success).toBe(false);
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
    parkingType: "open_air" as const,
    keysLeft: false,
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

  it("accepts every parking type and rejects an unknown one", () => {
    for (const parkingType of ["open_air", "carport", "garage"]) {
      expect(editReservationSchema.safeParse({ ...validEdit, parkingType }).success).toBe(true);
    }
    expect(editReservationSchema.safeParse({ ...validEdit, parkingType: "roof" }).success).toBe(false);
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
  it("accepts a car returning later with flight direction, sector and passengers", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_out: hoursFromNow(5),
      flight_direction: "Londyn",
      parking_sector: "A12",
      passenger_count: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a return in the past", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_out: hoursFromNow(-1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range passenger count", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: "Kowalski",
      planned_check_out: hoursFromNow(5),
      passenger_count: 100,
    });
    expect(result.success).toBe(false);
  });

  it("treats the stay as paid unless marked unpaid", () => {
    const base = { last_name: "Kowalski", planned_check_out: hoursFromNow(5) };
    const paid = createLegacyDepartureSchema.parse(base);
    const unpaid = createLegacyDepartureSchema.parse({ ...base, unpaid: true });
    expect(paid.unpaid).toBe(false);
    expect(unpaid.unpaid).toBe(true);
  });

  it("rejects a missing last name and non-positive cost", () => {
    const result = createLegacyDepartureSchema.safeParse({
      last_name: " ",
      planned_check_out: hoursFromNow(5),
      total_cost: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("travel agency fields", () => {
  const AGENCY_ID = "11111111-1111-4111-8111-111111111111";
  const base = {
    last_name: "Kowalski",
    planned_check_in: "2026-09-10T14:00:00.000Z",
    planned_check_out: "2026-09-12T12:00:00.000Z",
    source: "phone" as const,
  };

  it("createReservationSchema accepts an agency UUID or null and rejects garbage", () => {
    expect(createReservationSchema.safeParse({ ...base, travel_agency_id: AGENCY_ID }).success).toBe(true);
    expect(createReservationSchema.safeParse({ ...base, travel_agency_id: null }).success).toBe(true);
    expect(createReservationSchema.safeParse({ ...base, travel_agency_id: "biuro" }).success).toBe(false);
  });

  it("updateReservationSchema allows no_show and clearing the agency", () => {
    expect(updateReservationSchema.parse({ status: "no_show" }).status).toBe("no_show");
    expect(updateReservationSchema.parse({ travel_agency_id: null }).travel_agency_id).toBeNull();
  });

  it("form schemas treat an empty agency as none", () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const later = new Date(Date.now() + 3 * 86_400_000);
    const form = { lastName: "Kowalski", checkInDate: tomorrow, checkOutDate: later };
    expect(fullReservationSchema.safeParse({ ...form, travelAgencyId: "" }).success).toBe(true);
    const editForm = { ...form, parkingType: "open_air", keysLeft: false };
    expect(editReservationSchema.safeParse({ ...editForm, travelAgencyId: AGENCY_ID }).success).toBe(true);
    expect(editReservationSchema.safeParse({ ...editForm, travelAgencyId: "x" }).success).toBe(false);
  });
});
