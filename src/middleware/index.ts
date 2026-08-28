import { sequence } from "astro:middleware";
import { createRateLimiter } from "./rate-limit";
import { supabaseMiddleware } from "./supabase";
import { authMiddleware } from "./auth";

const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

export const onRequest = sequence(supabaseMiddleware, authMiddleware, rateLimiter);
