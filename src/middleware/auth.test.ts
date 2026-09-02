import { describe, it, expect } from "vitest";
import { isPublicPath, authMiddleware } from "@/middleware/auth";

// ---------------------------------------------------------------------------
// isPublicPath — auth protection policy contract
// ---------------------------------------------------------------------------

describe("isPublicPath", () => {
  describe("protected routes (must return false)", () => {
    it("protects /faktury/nowy", () => {
      expect(isPublicPath("/faktury/nowy")).toBe(false);
    });

    it("protects /faktury/some-id/druk", () => {
      expect(isPublicPath("/faktury/some-id/druk")).toBe(false);
    });

    it("protects /api/invoices", () => {
      expect(isPublicPath("/api/invoices")).toBe(false);
    });

    it("protects /api/invoices/some-uuid", () => {
      expect(isPublicPath("/api/invoices/some-uuid")).toBe(false);
    });

    it("protects /api/stats", () => {
      expect(isPublicPath("/api/stats")).toBe(false);
    });

    it("protects / (root)", () => {
      expect(isPublicPath("/")).toBe(false);
    });

    it("protects /rezerwacje", () => {
      expect(isPublicPath("/rezerwacje")).toBe(false);
    });
  });

  describe("public routes (must return true)", () => {
    it("allows /login", () => {
      expect(isPublicPath("/login")).toBe(true);
    });

    it("allows /login/ (trailing slash)", () => {
      expect(isPublicPath("/login/")).toBe(true);
    });

    it("allows /api/auth/login", () => {
      expect(isPublicPath("/api/auth/login")).toBe(true);
    });

    it("allows /api/auth/logout", () => {
      expect(isPublicPath("/api/auth/logout")).toBe(true);
    });

    it("allows /api/health", () => {
      expect(isPublicPath("/api/health")).toBe(true);
    });

    it("allows /api/reservations/external", () => {
      expect(isPublicPath("/api/reservations/external")).toBe(true);
    });

    it("allows /_astro/chunk.abc123.js", () => {
      expect(isPublicPath("/_astro/chunk.abc123.js")).toBe(true);
    });

    it("allows /favicon.ico", () => {
      expect(isPublicPath("/favicon.ico")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// authMiddleware — handler branch logic
// ---------------------------------------------------------------------------

function makeCtx(pathname: string, user?: { id: string; email: string }) {
  return {
    url: { pathname, search: "" },
    locals: { user },
    redirect: (url: string, status: number) => new Response(null, { status, headers: { Location: url } }),
  } as unknown as Parameters<typeof authMiddleware>[0];
}

const next = async () => new Response("ok", { status: 200 });

describe("authMiddleware", () => {
  it("returns 401 JSON for unauthenticated GET /api/invoices", async () => {
    const res = (await authMiddleware(makeCtx("/api/invoices"), next)) as Response;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 for unauthenticated GET /api/stats", async () => {
    const res = (await authMiddleware(makeCtx("/api/stats"), next)) as Response;
    expect(res.status).toBe(401);
  });

  it("returns 302 to /login for unauthenticated GET /faktury/nowy", async () => {
    const res = (await authMiddleware(makeCtx("/faktury/nowy"), next)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toMatch(/^\/login/);
  });

  it("calls next() (200) for authenticated GET /faktury/nowy", async () => {
    const user = { id: "user-1", email: "test@example.com" };
    const res = (await authMiddleware(makeCtx("/faktury/nowy", user), next)) as Response;
    expect(res.status).toBe(200);
  });

  it("redirects authenticated user away from /login to /", async () => {
    const user = { id: "user-1", email: "test@example.com" };
    const res = (await authMiddleware(makeCtx("/login", user), next)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("calls next() (200) for unauthenticated GET /login (public page)", async () => {
    const res = (await authMiddleware(makeCtx("/login"), next)) as Response;
    expect(res.status).toBe(200);
  });
});
