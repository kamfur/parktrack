import { describe, expect, it } from "vitest";
import { resolveAppRole } from "./resolve-app-role";

describe("resolveAppRole", () => {
  it("returns driver when app_metadata.role is driver", () => {
    expect(resolveAppRole({ role: "driver" })).toBe("driver");
  });

  it("returns staff when app_metadata.role is staff", () => {
    expect(resolveAppRole({ role: "staff" })).toBe("staff");
  });

  it("defaults to staff when role is missing", () => {
    expect(resolveAppRole({})).toBe("staff");
    expect(resolveAppRole(undefined)).toBe("staff");
    expect(resolveAppRole(null)).toBe("staff");
  });

  it("defaults to staff for unknown role values", () => {
    expect(resolveAppRole({ role: "admin" })).toBe("staff");
    expect(resolveAppRole({ role: 1 })).toBe("staff");
  });
});
