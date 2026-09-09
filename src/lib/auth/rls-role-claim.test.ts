/**
 * Documents the JWT claim contract mirrored by SQL helpers in
 * `20260909140000_harden_rls_by_app_role.sql` (`current_app_role` / `is_driver_role`).
 * App code uses the same rule via resolveAppRole — keep these in sync.
 */
import { describe, expect, it } from "vitest";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";

describe("RLS role claim contract", () => {
  it("treats missing role as staff (full RLS access)", () => {
    expect(resolveAppRole(undefined)).toBe("staff");
    expect(resolveAppRole({})).toBe("staff");
  });

  it("only app_metadata.role=driver is the driver JWT claim", () => {
    expect(resolveAppRole({ role: "driver" })).toBe("driver");
    expect(resolveAppRole({ role: "staff" })).toBe("staff");
    expect(resolveAppRole({ role: "admin" })).toBe("staff");
  });
});
