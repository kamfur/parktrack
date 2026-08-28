import type { APIRoute } from "astro";
import { AuthService } from "../../../lib/services/auth.service";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (locals.user) {
      return new Response(JSON.stringify({ user: locals.user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authService = new AuthService(locals.supabase);
    const user = await authService.getSession();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error reading session:", error);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};
