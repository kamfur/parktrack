import type { APIRoute } from "astro";
import { loginSchema } from "../../../lib/schemas/auth.schema";
import { AuthService, AuthServiceError } from "../../../lib/services/auth.service";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.supabase) {
      return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validationResult = await loginSchema.safeParseAsync(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationResult.error.format(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const authService = new AuthService(locals.supabase);
    const user = await authService.signIn(validationResult.data.email, validationResult.data.password);

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error during login:", error);

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
