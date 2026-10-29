import { describe, expect, it } from "vitest";
import type { ReservationDto } from "../types";
import { buildViewModel } from "./useReservationDetails";

function reservation(overrides: Partial<ReservationDto>): ReservationDto {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    first_name: "Jan",
    last_name: "Kowalski",
    email: null,
    phone: null,
    license_plate: null,
    flight_direction: null,
    parking_type: "open_air",
    status: "confirmed",
    source: "phone",
    total_cost: 100,
    is_paid: false,
    notes: null,
    planned_check_in: "2026-09-14T21:30:00Z",
    planned_check_out: "2026-09-15T06:00:00Z",
    actual_check_in: null,
    actual_check_out: null,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  } as ReservationDto;
}

describe("buildViewModel — garage assignment fields", () => {
  it("leaves garageSpotLabel/Icon null for a regular (open_air) reservation", () => {
    const vm = buildViewModel(reservation({ parking_type: "open_air" }), null);
    expect(vm.garageSpotLabel).toBeNull();
    expect(vm.garageSpotIcon).toBeNull();
  });

  it("surfaces a formatted garage spot label and an icon for a garage reservation", () => {
    const vm = buildViewModel(reservation({ parking_type: "garage" }), "Garaż 1");
    expect(vm.garageSpotLabel).toBe("Garaż: Garaż 1");
    expect(vm.garageSpotIcon).not.toBeNull();
  });
});
