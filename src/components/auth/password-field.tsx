import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PasswordFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function PasswordField<TFieldValues extends FieldValues>({
  control,
  name,
  label = "Hasło",
  autoComplete = "current-password",
  disabled = false,
}: PasswordFieldProps<TFieldValues>) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={visible ? "text" : "password"}
                autoComplete={autoComplete}
                disabled={disabled}
                className="pr-10"
                {...field}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-muted-foreground"
                onClick={() => setVisible((prev) => !prev)}
                aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
                tabIndex={-1}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
