import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { AuthUserDTO } from "../../types";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export type SignUpResult =
  | { status: "session"; user: AuthUserDTO }
  | { status: "confirmation_required"; message: string };

function mapAuthError(error: { message: string; code?: string; status?: number }): AuthServiceError {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return new AuthServiceError("Nieprawidłowy e-mail lub hasło", 401);
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return new AuthServiceError("Potwierdź adres e-mail przed logowaniem", 401);
  }

  if (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("user already registered")
  ) {
    return new AuthServiceError("Konto z tym adresem e-mail już istnieje", 409);
  }

  if (code === "otp_expired" || code === "token_expired" || message.includes("expired")) {
    return new AuthServiceError("Link wygasł. Poproś o nowy link resetujący.", 400);
  }

  return new AuthServiceError(
    "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
    error.status && error.status >= 400 ? error.status : 400
  );
}

export class AuthService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async signIn(email: string, password: string): Promise<AuthUserDTO> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw mapAuthError(error);
    }

    if (!data.user) {
      throw new AuthServiceError("Nieprawidłowy e-mail lub hasło", 401);
    }

    return {
      id: data.user.id,
      email: data.user.email ?? email,
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw mapAuthError(error);
    }
  }

  async signUp(email: string, password: string, redirectTo: string): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      throw mapAuthError(error);
    }

    if (data.session && data.user) {
      return {
        status: "session",
        user: {
          id: data.user.id,
          email: data.user.email ?? email,
        },
      };
    }

    return {
      status: "confirmation_required",
      message: "Sprawdź skrzynkę e-mail i potwierdź rejestrację.",
    };
  }

  async resetPasswordForEmail(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw mapAuthError(error);
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });

    if (error) {
      throw mapAuthError(error);
    }
  }

  async getSession(): Promise<AuthUserDTO | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email ?? "",
    };
  }
}
