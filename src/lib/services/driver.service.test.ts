import { describe, expect, it, vi } from "vitest";
import { DriverService, DriverServiceError, syncIsPaid } from "./driver.service";

type Row = Record<string, unknown>;

function mockSupabase(current: Row, updateResult: Row = { id: "r1", status: "in_progress" }) {
  const update = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: updateResult, error: null }),
      }),
    }),
  }));

  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        single: vi.fn().mockResolvedValue({ data: current, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
    update,
  });

  return { from, update };
}

describe("syncIsPaid", () => {
  it("is true when either flag is true", () => {
    expect(syncIsPaid(true, false)).toBe(true);
    expect(syncIsPaid(false, true)).toBe(true);
    expect(syncIsPaid(false, false)).toBe(false);
  });
});

describe("DriverService status guards", () => {
  it("rejects arrival when status is not confirmed", async () => {
    const client = mockSupabase({
      id: "r1",
      status: "in_progress",
      paid_at_arrival: false,
      paid_at_departure: false,
      planned_check_out: "2026-09-10T10:00:00.000Z",
    });
    const service = new DriverService(client as never);
    await expect(service.confirmArrival("r1", { paid_at_arrival: true })).rejects.toBeInstanceOf(DriverServiceError);
    expect(client.update).not.toHaveBeenCalled();
  });

  it("rejects departure when status is not in_progress", async () => {
    const client = mockSupabase({
      id: "r1",
      status: "confirmed",
      paid_at_arrival: false,
      paid_at_departure: false,
      planned_check_out: "2026-09-10T10:00:00.000Z",
    });
    const service = new DriverService(client as never);
    await expect(service.completeDeparture("r1", { paid_at_departure: true })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(client.update).not.toHaveBeenCalled();
  });

  it("confirmArrival writes in_progress and syncs is_paid", async () => {
    const client = mockSupabase({
      id: "r1",
      status: "confirmed",
      paid_at_arrival: false,
      paid_at_departure: false,
      planned_check_out: "2026-09-10T10:00:00.000Z",
      flight_direction: null,
      passenger_count: null,
      parking_sector: null,
    });
    const service = new DriverService(client as never);
    await service.confirmArrival("r1", {
      paid_at_arrival: true,
      passenger_count: 2,
      parking_sector: "A1",
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "in_progress",
        is_paid: true,
        passenger_count: 2,
        parking_sector: "A1",
      })
    );
  });
});

function mockListClient() {
  const result = { data: [{ id: "h1" }], error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(builder),
    builder,
    result,
  };
}

describe("DriverService handled lists", () => {
  it("listHandledArrivals filters actual_check_in from the handled window", async () => {
    const client = mockListClient();
    const service = new DriverService(client as never);
    const now = new Date("2026-09-09T18:00:00Z");
    const rows = await service.listHandledArrivals(now);

    expect(client.builder.not).toHaveBeenCalledWith("actual_check_in", "is", null);
    expect(client.builder.gte).toHaveBeenCalledWith("actual_check_in", "2026-09-08T22:00:00.000Z");
    expect(client.builder.in).toHaveBeenCalledWith("status", ["in_progress", "completed"]);
    expect(rows).toEqual([{ id: "h1" }]);
  });

  it("listHandledDepartures filters completed actual_check_out from the handled window", async () => {
    const client = mockListClient();
    const service = new DriverService(client as never);
    const now = new Date("2026-09-09T00:00:00Z");
    await service.listHandledDepartures(now);

    expect(client.builder.not).toHaveBeenCalledWith("actual_check_out", "is", null);
    expect(client.builder.gte).toHaveBeenCalledWith("actual_check_out", "2026-09-08T12:00:00.000Z");
    expect(client.builder.eq).toHaveBeenCalledWith("status", "completed");
  });
});
