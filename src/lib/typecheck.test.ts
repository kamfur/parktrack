import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

/**
 * Regression guard (m3l5): resolver/schema/type drift must fail CI, not only the post-edit hook.
 */
describe("TypeScript project", () => {
  it(
    "compiles without errors — form types align with Zod schemas",
    { timeout: 30_000 },
    () => {
      expect(() => execSync("npm run typecheck", { stdio: "pipe" })).not.toThrow();
    },
  );
});
