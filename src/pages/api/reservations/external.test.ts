import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createExternalReservation = vi.fn();

vi.mock("../../../lib/services/reservation.service", () => ({
  ReservationService: class {
    createExternalReservation = createExternalReservation;
  },
}));

import { POST } from "./external";

const VALID_BODY = {
  lastName: "Kowalski",
  firstName: "Jan",
  email: "jan@example.com",
  phone: "500600700",
  licensePlate: "SK 12345",
  checkInDate: "2026-10-01T08:00:00.000Z",
  checkOutDate: "2026-10-05T18:00:00.000Z",
};

function makeCtx(opts: { key?: string; body?: unknown; badJson?: boolean } = {}) {
  const headers = new Headers();
  if (opts.key !== undefined) headers.set("x-api-key", opts.key);
  return {
    locals: { supabase: {} },
    request: {
      headers,
      json: async () => {
        if (opts.badJson) throw new SyntaxError("Unexpected token");
        return opts.body ?? VALID_BODY;
      },
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/reservations/external", () => {
  beforeEach(() => {
    vi.stubEnv("API_SECRET_KEY", "test-secret");
    createExternalReservation.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when API_SECRET_KEY is not configured", async () => {
    vi.stubEnv("API_SECRET_KEY", "");
    const res = await POST(makeCtx({ key: "test-secret" }));
    expect(res.status).toBe(503);
    expect(createExternalReservation).not.toHaveBeenCalled();
  });

  it("returns 401 without an API key", async () => {
    const res = await POST(makeCtx());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(createExternalReservation).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong API key", async () => {
    const res = await POST(makeCtx({ key: "nope" }));
    expect(res.status).toBe(401);
    expect(createExternalReservation).not.toHaveBeenCalled();
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await POST(makeCtx({ key: "test-secret", badJson: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with details for an invalid payload", async () => {
    const res = await POST(makeCtx({ key: "test-secret", body: { ...VALID_BODY, email: "not-an-email" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details.fieldErrors.email).toBeDefined();
    expect(createExternalReservation).not.toHaveBeenCalled();
  });

  it("creates the reservation with a valid key and payload", async () => {
    createExternalReservation.mockResolvedValue("res-123");
    const res = await POST(makeCtx({ key: "test-secret" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ reservationId: "res-123" });
    expect(createExternalReservation).toHaveBeenCalledWith(VALID_BODY);
  });

  it("maps capacity errors to 409", async () => {
    createExternalReservation.mockRejectedValue(new Error("No available parking spots for date 2026-10-02"));
    const res = await POST(makeCtx({ key: "test-secret" }));
    expect(res.status).toBe(409);
  });
});
