import { describe, expect, it } from "vitest";
import { GET } from "./flight-directions";

describe("GET /api/flight-directions", () => {
  it("rejects unauthenticated requests", async () => {
    const context = {
      locals: {},
    } as unknown as Parameters<typeof GET>[0];

    const response = await GET(context);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
  });
});
