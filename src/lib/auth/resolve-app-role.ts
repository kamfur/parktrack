/**
 * Resolves the app role from Supabase Auth app_metadata.
 * Missing/unknown roles default to staff so existing users keep full access.
 * Never read user_metadata for authorization — clients can modify it.
 */
export type AppRole = "staff" | "driver";

export function resolveAppRole(appMetadata: Record<string, unknown> | undefined | null): AppRole {
  const role = appMetadata?.role;
  if (role === "driver") {
    return "driver";
  }
  return "staff";
}
