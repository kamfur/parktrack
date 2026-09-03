import { sequence } from "astro:middleware";
import { createRateLimiter } from "./rate-limit";
import { supabaseMiddleware } from "./supabase";
import { authMiddleware } from "./auth";

// Dashboard alone issues 4 parallel calls; settings page issues 6+.
// 10/min blocked normal UI usage — keep abuse protection without starving the app.
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

export const onRequest = sequence(supabaseMiddleware, authMiddleware, rateLimiter);
