import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Podaj adres e-mail" })
    .min(1, "Podaj adres e-mail")
    .email("Nieprawidłowy adres e-mail"),
  password: z.string({ required_error: "Podaj hasło" }).min(8, "Hasło musi mieć co najmniej 8 znaków"),
});

export const registerSchema = z
  .object({
    email: z
      .string({ required_error: "Podaj adres e-mail" })
      .min(1, "Podaj adres e-mail")
      .email("Nieprawidłowy adres e-mail"),
    password: z.string({ required_error: "Podaj hasło" }).min(8, "Hasło musi mieć co najmniej 8 znaków"),
    confirmPassword: z.string({ required_error: "Potwierdź hasło" }).min(1, "Potwierdź hasło"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Podaj adres e-mail" })
    .min(1, "Podaj adres e-mail")
    .email("Nieprawidłowy adres e-mail"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string({ required_error: "Podaj nowe hasło" }).min(8, "Hasło musi mieć co najmniej 8 znaków"),
    confirmPassword: z.string({ required_error: "Potwierdź hasło" }).min(1, "Potwierdź hasło"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne",
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
