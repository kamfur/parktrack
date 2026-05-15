import type { MiddlewareHandler } from "astro";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";

/**
 * Middleware that initializes Supabase client and adds it to context.locals.
 * This ensures every API route has access to a properly configured Supabase client.
 */
export const supabaseMiddleware: MiddlewareHandler = async ({ locals }, next) => {
  // Get Supabase credentials from environment variables
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

  // Validate environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_KEY.");
    
    // Create a mock client to prevent crashes, but log the error
    locals.supabase = null as any;
    return next();
  }

  // Create Supabase client and attach to locals
  locals.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

  return next();
};


