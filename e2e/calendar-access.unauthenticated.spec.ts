import { test, expect } from "@playwright/test";

const eventsUrl = "/api/calendar/events?from=2026-09-14T00:00:00%2B02:00&to=2026-09-15T00:00:00%2B02:00&view=day";
const shiftsUrl = "/api/shifts?from=2026-09-14T00:00:00%2B02:00&to=2026-09-15T00:00:00%2B02:00";

test.describe("calendar unauthenticated access", () => {
  test("GET /kalendarz redirects to login", async ({ page }) => {
    await page.goto("/kalendarz");
    await expect(page).toHaveURL(/\/login/);
  });

  test("calendar APIs return 401 without a session", async ({ request }) => {
    expect((await request.get(eventsUrl)).status()).toBe(401);
    expect((await request.get(shiftsUrl)).status()).toBe(401);
    expect((await request.get("/api/drivers")).status()).toBe(401);
  });
});

test.describe("driver denied calendar", () => {
  test("driver cannot open /kalendarz or calendar APIs", async ({ page, request }, testInfo) => {
    const email = process.env.E2E_DRIVER_EMAIL;
    const password = process.env.E2E_DRIVER_PASSWORD;
    if (!email || !password) {
      testInfo.skip(true, "E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD not set");
      return;
    }

    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok()).toBeTruthy();

    await page.goto("/kalendarz");
    await expect(page).toHaveURL(/\/kierowca/);

    expect((await request.get(eventsUrl)).status()).toBe(403);
    expect((await request.get(shiftsUrl)).status()).toBe(403);
    expect((await request.get("/api/drivers")).status()).toBe(403);
  });
});
