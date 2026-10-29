import { describe, expect, it } from "vitest";
import { GET } from "./events";

describe("GET /api/calendar/events", () => {
  it("rejects an invalid range before querying data", async () => {
    const context = {
      url: new URL(
        "http://localhost/api/calendar/events?from=2026-09-15T00%3A00%3A00%2B02%3A00&to=2026-09-14T00%3A00%3A00%2B02%3A00&view=day"
      ),
      locals: { user: { id: "staff-1", email: "staff@example.com", role: "staff" } },
    } as unknown as Parameters<typeof GET>[0];

    const response = await GET(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Validation failed" });
  });
});
