import { describe, expect, it, vi } from "vitest";
import { GET } from "./available";
import { GarageAllocationService } from "../../../../lib/services/garage-allocation.service";

vi.mock("../../../../lib/services/garage-allocation.service", () => ({
  GarageAllocationService: vi.fn(),
}));

const RESERVATION_ID = "11111111-1111-4111-8111-111111111111";

function makeCtx(query: string, locals: Record<string, unknown> = { user: { id: "d1", role: "driver" } }) {
  return {
    locals,
    url: new URL(`http://localhost/api/driver/garage-spots/available?${query}`),
  } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/driver/garage-spots/available", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await GET(makeCtx("", {}));
    expect(res.status).toBe(401);
  });

  it("rejects an open-air type or a reversed window", async () => {
    expect(
      (await GET(makeCtx("type=open_air&check_in=2026-10-01T10:00:00Z&check_out=2026-10-03T10:00:00Z"))).status
    ).toBe(400);
    expect(
      (await GET(makeCtx("type=garage&check_in=2026-10-03T10:00:00Z&check_out=2026-10-01T10:00:00Z"))).status
    ).toBe(400);
  });

  it("lists free spots for the window, ignoring the edited reservation's own assignment", async () => {
    const listAvailableSpots = vi.fn().mockResolvedValue([{ id: "s1", name: "Wiata 1" }]);
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots };
    } as never);

    const res = await GET(
      makeCtx(
        `type=carport&check_in=2026-10-01T10:00:00Z&check_out=2026-10-03T10:00:00Z&reservation_id=${RESERVATION_ID}`
      )
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "s1", name: "Wiata 1" }]);
    expect(listAvailableSpots).toHaveBeenCalledWith(
      "2026-10-01T10:00:00Z",
      "2026-10-03T10:00:00Z",
      "carport",
      RESERVATION_ID
    );
  });
});
