import { sequence } from "astro:middleware";
import { createRateLimiter } from "./rate-limit";

// Create rate limiter middleware with configuration
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

// Export the middleware sequence
export const onRequest = sequence(rateLimiter);
