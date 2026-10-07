import { beforeEach, describe, expect, it, vi } from "vitest";

const createWalkInArrival = vi.fn();

vi.mock("../../../lib/services/walk-in-arrival.service", () => ({ createWalkInArrival }));

const { POST } = await import("./walk-in-arrivals");
const { NoPriceListError } = await import("../../../lib/services/reservation.service");

function makeCtx(body: unknown, user: { id: string } | null = { id: "driver-1" }) {
  return {
    request: new Request("http://localhost/api/driver/walk-in-arrivals", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    locals: { user, supabase: {} },
  } as unknown as Parameters<typeof POST>[0];
}

const VALID = { last_name: "Kowalski", planned_check_out: "2099-10-05T10:00:00.000Z" };

describe("POST /api/driver/walk-in-arrivals", () => {
  beforeEach(() => {
    createWalkInArrival.mockReset();
  });

  it("returns 401 without a user", async () => {
    expect((await POST(makeCtx(VALID, null))).status).toBe(401);
  });

  it("creates and accepts the stay as the signed-in user, ignoring price and payment-state fields", async () => {
    createWalkInArrival.mockResolvedValue({ id: "r1", status: "in_progress" });
    const res = await POST(
      makeCtx({ ...VALID, total_cost: 1, is_paid: true, planned_check_in: "2020-01-01T00:00:00Z" })
    );
    expect(res.status).toBe(201);
    const [, command, userId] = createWalkInArrival.mock.calls[0];
    expect(userId).toBe("driver-1");
    expect(command).toMatchObject({ last_name: "Kowalski", parking_type: "open_air", paid_at_arrival: false });
    expect(command).not.toHaveProperty("total_cost");
    expect(command).not.toHaveProperty("is_paid");
    expect(command).not.toHaveProperty("planned_check_in");
  });

  it("returns 400 without a last name or planned departure", async () => {
    expect((await POST(makeCtx({ ...VALID, last_name: "" }))).status).toBe(400);
    expect((await POST(makeCtx({ last_name: "Kowalski" }))).status).toBe(400);
    expect(createWalkInArrival).not.toHaveBeenCalled();
  });

  it("returns 422 when no price list covers the stay", async () => {
    createWalkInArrival.mockRejectedValue(new NoPriceListError());
    expect((await POST(makeCtx(VALID))).status).toBe(422);
  });
});
