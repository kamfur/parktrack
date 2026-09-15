import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { toDriverDtos } from "./driver-directory.service";

function user(overrides: Partial<User> & { app_metadata?: User["app_metadata"] }): User {
  return {
    id: "user-1",
    email: "driver@example.com",
    app_metadata: { role: "driver" },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-14T00:00:00Z",
    ...overrides,
  } as User;
}

describe("toDriverDtos", () => {
  it("keeps only Auth users with the driver role and an email", () => {
    const result = toDriverDtos([
      user({ id: "d2", email: "beta@example.com" }),
      user({ id: "staff", email: "staff@example.com", app_metadata: { role: "staff" } }),
      user({ id: "d1", email: "alpha@example.com" }),
      user({ id: "blank", email: undefined }),
    ]);

    expect(result).toEqual([
      { id: "d1", email: "alpha@example.com" },
      { id: "d2", email: "beta@example.com" },
    ]);
  });
});
