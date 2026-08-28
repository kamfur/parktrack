import type { MiddlewareHandler } from "astro";

const PUBLIC_PAGE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];

const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health", "/api/reservations/external"];

const PUBLIC_ASSET_PREFIXES = ["/_astro/", "/favicon", "/sitemap"];

function isPublicPath(pathname: string): boolean {
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

function isAuthPage(pathname: string): boolean {
  return ["/login", "/register", "/forgot-password", "/reset-password"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Protects staff pages and APIs. Public auth/health/external routes stay open.
 */
export const authMiddleware: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;
  const user = context.locals.user;

  if (isPublicPath(pathname)) {
    if (user && isAuthPage(pathname)) {
      return context.redirect("/", 302);
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

  return next();
};
