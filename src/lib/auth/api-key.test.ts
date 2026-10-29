import { describe, expect, it } from "vitest";
import { verifyApiKey } from "./api-key";

describe("verifyApiKey", () => {
  it("returns missing_secret when no secret is configured", () => {
    expect(verifyApiKey("anything", undefined)).toBe("missing_secret");
    expect(verifyApiKey("anything", "")).toBe("missing_secret");
  });

  it("rejects a missing header", () => {
    expect(verifyApiKey(null, "s3cret")).toBe("invalid");
    expect(verifyApiKey("", "s3cret")).toBe("invalid");
  });

  it("rejects a wrong key, including different lengths", () => {
    expect(verifyApiKey("s3cre", "s3cret")).toBe("invalid");
    expect(verifyApiKey("s3cret-but-longer", "s3cret")).toBe("invalid");
  });

  it("accepts the matching key", () => {
    expect(verifyApiKey("s3cret", "s3cret")).toBe("ok");
  });
});
