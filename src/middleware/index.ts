import { sequence } from "astro:middleware";
import { createRateLimiter } from "./rate-limit";
import { supabaseMiddleware } from "./supabase";

// Create rate limiter middleware with configuration
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

// Export the middleware sequence
// Note: supabaseMiddleware must run before other middleware that use locals.supabase
export const onRequest = sequence(supabaseMiddleware, rateLimiter);
