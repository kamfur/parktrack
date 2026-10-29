import { sequence } from "astro:middleware";
import { createRateLimiter } from "./rate-limit";
import { supabaseMiddleware } from "./supabase";
import { authMiddleware } from "./auth";
import { startParkViaScheduler } from "../lib/parkvia/scheduler";

// Hourly ParkVia import (opt-in via PARKVIA_SYNC_ENABLED); starts once per server process.
startParkViaScheduler();

// Dashboard alone issues 4 parallel calls; settings page issues 6+.
// 10/min blocked normal UI usage — keep abuse protection without starving the app.
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

export const onRequest = sequence(supabaseMiddleware, authMiddleware, rateLimiter);
