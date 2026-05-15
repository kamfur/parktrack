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
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set. Some operations may fail due to RLS policies."
    );
    // Fallback to anon key if service role key is not available
    const anonKey = import.meta.env.SUPABASE_KEY;
    if (!anonKey) {
      console.error("Missing SUPABASE_KEY environment variable");
      return null;
    }
    return createClient<Database>(supabaseUrl, anonKey);
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

