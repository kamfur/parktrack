import type { APIContext, MiddlewareNext } from "astro";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

// In-memory store for rate limiting
// In production, consider using Redis or similar for distributed systems
const ipRequestStore = new Map<string, { count: number; resetTime: number }>();

export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimiter(context: APIContext, next: MiddlewareNext) {
    // Skip rate limiting for non-API routes
    if (!context.url.pathname.startsWith("/api/")) {
      return await next();
    }

    const clientIp = context.request.headers.get("x-forwarded-for") || context.clientAddress || "unknown";

    const now = Date.now();
    const requestData = ipRequestStore.get(clientIp);

    // Clean up expired entries
    if (requestData && now > requestData.resetTime) {
      ipRequestStore.delete(clientIp);
    }

    // Initialize or get current request count
    const currentData = ipRequestStore.get(clientIp) || {
      count: 0,
      resetTime: now + config.windowMs,
    };

    // Check if limit is exceeded
    if (currentData.count >= config.maxRequests) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Too many requests, please try again later",
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil((currentData.resetTime - now) / 1000).toString(),
          },
        }
      );
    }

    // Update request count
    ipRequestStore.set(clientIp, {
      count: currentData.count + 1,
      resetTime: currentData.resetTime,
    });

    // Add rate limit headers
    const response = await next();
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    newResponse.headers.set("X-RateLimit-Remaining", (config.maxRequests - (currentData.count + 1)).toString());
    newResponse.headers.set("X-RateLimit-Reset", Math.ceil((currentData.resetTime - now) / 1000).toString());

    return newResponse;
  };
}
