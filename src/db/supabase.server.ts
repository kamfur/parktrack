import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "./database.types";

interface CookieToSet {
  name: string;
  value: string;
  options?: Parameters<AstroCookies["set"]>[2];
}

/**
 * Creates a Supabase SSR client bound to the current request cookies.
 * Used by middleware and API routes that mutate auth session.
 */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map((cookie) => ({
          name: cookie.name,
          value: cookie.value ?? "",
        }));
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
