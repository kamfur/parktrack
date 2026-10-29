import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/lib/schemas/auth.schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordField } from "@/components/auth/password-field";

interface LoginFormProps {
  redirectTo?: string;
}

function safeRedirectTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function navigateTo(url: string) {
  globalThis.location.assign(url);
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: LoginFormData) => {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; user?: { role?: string } } | null;

      if (!response.ok) {
        if (response.status === 429) {
          setFormError("Zbyt wiele prób. Spróbuj ponownie za chwilę.");
          return;
        }

        setFormError(payload?.error ?? "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
        return;
      }

      const requested = safeRedirectTo(redirectTo);
      if (payload?.user?.role === "driver") {
        const driverTarget = requested === "/kierowca" || requested.startsWith("/kierowca/") ? requested : "/kierowca";
        navigateTo(driverTarget);
        return;
      }

      navigateTo(requested);
    } catch {
      setFormError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  placeholder="jan.kowalski@parking.pl"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PasswordField control={form.control} name="password" disabled={isSubmitting} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Logowanie…
            </>
          ) : (
            "Zaloguj się"
          )}
        </Button>

        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>
            Nie masz konta?{" "}
            <a href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Zarejestruj się
            </a>
          </p>
          <p>
            <a href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
              Zapomniałeś hasła?
            </a>
          </p>
        </div>
      </form>
    </Form>
  );
}
