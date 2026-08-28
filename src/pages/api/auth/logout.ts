import type { APIRoute } from "astro";
import { AuthService, AuthServiceError } from "../../../lib/services/auth.service";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  try {
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authService = new AuthService(locals.supabase);
    await authService.signOut();

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error during logout:", error);

    if (error instanceof AuthServiceError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
