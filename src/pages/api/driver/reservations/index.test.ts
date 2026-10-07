import { beforeEach, describe, expect, it, vi } from "vitest";

const createReservation = vi.fn();

vi.mock("../../../../lib/services/reservation.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/services/reservation.service")>();
  return {
    ...actual,
    ReservationService: class {
      createReservation = createReservation;
    },
  };
});

const { POST } = await import("./index");
const { NoPriceListError } = await import("../../../../lib/services/reservation.service");

function makeCtx(body: unknown, user: { id: string } | null = { id: "driver-1" }) {
  return {
    request: new Request("http://localhost/api/driver/reservations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    locals: { user, supabase: {} },
  } as unknown as Parameters<typeof POST>[0];
}

const VALID = {
  last_name: "Kowalski",
  planned_check_in: "2026-09-12T10:00:00.000Z",
  planned_check_out: "2026-09-15T10:00:00.000Z",
};

describe("POST /api/driver/reservations", () => {
  beforeEach(() => {
    createReservation.mockReset();
  });

  it("returns 401 without a user", async () => {
    expect((await POST(makeCtx(VALID, null))).status).toBe(401);
  });

  it("creates a walk-in reservation audited as the driver, ignoring price fields", async () => {
    createReservation.mockResolvedValue({ id: "r1" });
    const res = await POST(makeCtx({ ...VALID, total_cost: 1 }));
    expect(res.status).toBe(201);
    expect(createReservation).toHaveBeenCalledWith(
      expect.objectContaining({ last_name: "Kowalski", source: "walk_in", parking_type: "open_air" }),
      "driver-1"
    );
    expect(createReservation.mock.calls[0][0]).not.toHaveProperty("total_cost");
  });

  it("returns 400 for an invalid payload", async () => {
    expect((await POST(makeCtx({ ...VALID, last_name: "" }))).status).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("returns 422 when no price list covers the stay", async () => {
    createReservation.mockRejectedValue(new NoPriceListError());
    expect((await POST(makeCtx(VALID))).status).toBe(422);
  });
});
