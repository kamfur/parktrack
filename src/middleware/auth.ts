import type { MiddlewareHandler } from "astro";
import type { AppRole } from "../lib/auth/resolve-app-role";

const PUBLIC_PAGE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];

const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health", "/api/reservations/external"];

const PUBLIC_ASSET_PREFIXES = ["/_astro/", "/favicon", "/sitemap"];

/** Staff-only page prefixes. Drivers are redirected to /kierowca. Exact `/` is handled separately. */
const STAFF_ONLY_PAGE_PREFIXES = ["/ustawienia", "/faktury", "/rezerwacje", "/kalendarz"];

/** Staff-only API prefixes. Drivers receive 403. */
const STAFF_ONLY_API_PREFIXES = [
  "/api/stats",
  "/api/invoices",
  "/api/settings",
  "/api/rpc/",
  "/api/availability",
  "/api/calculate-cost",
  "/api/reservations",
  "/api/calendar/",
  "/api/shifts",
  "/api/drivers",
  "/api/garage-spots",
  "/api/garage-assignments",
];

export const DRIVER_HOME = "/kierowca";

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }

  if (PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return false;
}

export function isStaffOnlyPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") {
    return true;
  }

  if (STAFF_ONLY_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (STAFF_ONLY_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }

  return false;
}

export function isDriverHomePath(pathname: string): boolean {
  return pathname === DRIVER_HOME || pathname.startsWith(`${DRIVER_HOME}/`);
}

function isAuthPage(pathname: string): boolean {
  return ["/login", "/register", "/forgot-password", "/reset-password"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function homeForRole(role: AppRole | undefined): string {
  return role === "driver" ? DRIVER_HOME : "/";
}

/**
 * Protects staff pages and APIs. Public auth/health/external routes stay open.
 * Drivers are limited to /kierowca and /api/driver/* (plus auth).
 */
export const authMiddleware: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;
  const user = context.locals.user;

  if (isPublicPath(pathname)) {
    if (user && isAuthPage(pathname)) {
      return context.redirect(homeForRole(user.role), 302);
    }
    return next();
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const redirectTo = encodeURIComponent(`${pathname}${context.url.search}`);
    return context.redirect(`/login?redirectTo=${redirectTo}`, 302);
  }

  if (user.role === "driver" && isStaffOnlyPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect(DRIVER_HOME, 302);
  }

  return next();
};
