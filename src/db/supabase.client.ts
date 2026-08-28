import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * @deprecated Prefer `locals.supabase` (SSR cookie client) in Astro routes.
 * Kept for legacy module-level usage outside request context.
 */
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
