import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const authFile = "playwright/.auth/user.json";
// Override to target an already-running server, e.g. the voice-fake dev server on :3100.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: authFile },
      dependencies: ["setup"],
      testIgnore: [/.*\.setup\.ts/, /.*\.unauthenticated\.spec\.ts/],
    },
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*\.unauthenticated\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Voice reservations E2E: show the "Dyktuj" button and use the scripted transcript source
    // (no microphone, no Soniox). A reused dev server must be started with the same flags.
    env: { PUBLIC_VOICE_ENABLED: "true", PUBLIC_VOICE_FAKE: "true" },
  },
});
