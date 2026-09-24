import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";

const authFile = path.join("playwright", ".auth", "user.json");

setup("authenticate", async ({ request }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env (Supabase user with staff access).",
    );
  }

  mkdirSync(path.dirname(authFile), { recursive: true });

  const response = await request.post("/api/auth/login", {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();

  await request.storageState({ path: authFile });
});
