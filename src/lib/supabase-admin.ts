import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";

/**
 * Creates a Supabase client with service role key that bypasses RLS.
 * Use this for server-side operations that need to bypass Row Level Security.
 *
 * @returns Supabase client with service role key, or null if not configured
 */
export function createSupabaseAdminClient(): ReturnType<typeof createClient<Database>> | null {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error("Missing SUPABASE_URL environment variable");
    return null;
  }

  if (!serviceRoleKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin operations require the service role key to bypass RLS."
    );
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
