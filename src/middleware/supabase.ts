import type { MiddlewareHandler } from "astro";
import { createSupabaseServerClient } from "../db/supabase.server";

/**
 * Initializes an SSR Supabase client from request cookies and populates locals.user.
 */
export const supabaseMiddleware: MiddlewareHandler = async (context, next) => {
  try {
    const supabase = createSupabaseServerClient(context.request, context.cookies);
    context.locals.supabase = supabase;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      context.locals.user = {
        id: user.id,
        email: user.email ?? "",
      };
    } else {
      context.locals.user = undefined;
    }
  } catch (error) {
    console.error("Failed to initialize Supabase SSR client:", error);
    // Keep request flowing; authMiddleware will deny protected routes without a session.
    context.locals.supabase = null as unknown as App.Locals["supabase"];
    context.locals.user = undefined;
  }

  return next();
};
