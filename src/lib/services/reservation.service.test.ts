import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("./garage-allocation.service", () => ({
  GarageAllocationService: vi.fn(),
}));

import { ReservationService, NoGarageAvailableError } from "./reservation.service";
import { createSupabaseAdminClient } from "../supabase-admin";
import { GarageAllocationService } from "./garage-allocation.service";

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
    return {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedReservation, error: null }),
      }),
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
      insertedReservation.planned_check_out
    );
    expect(assign).toHaveBeenCalledWith("r1", "spot-1", "system");
    expect(result).toEqual(insertedReservation);
  });

  it("throws NoGarageAvailableError when no spot is available within the buffer", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

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
