import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settingsSchema, type SettingsFormData } from "@/lib/schemas/settings.schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SettingsFormProps {
  initialDailyRate: number;
  initialTotalSpots: number;
}

export function SettingsForm({ initialDailyRate, initialTotalSpots }: SettingsFormProps) {
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      daily_rate: initialDailyRate,
      total_parking_spots: initialTotalSpots,
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const [rateRes, spotsRes] = await Promise.all([
        fetch("/api/settings?key=eq.daily_rate", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: data.daily_rate }),
        }),
        fetch("/api/settings?key=eq.total_parking_spots", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: data.total_parking_spots }),
        }),
      ]);

      if (!rateRes.ok || !spotsRes.ok) throw new Error("Błąd zapisu ustawień");
      toast.success("Ustawienia zapisane");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd zapisu ustawień");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
        <FormField
          control={form.control}
          name="daily_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stawka dobowa (PLN)</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                  <span className="text-sm text-neutral-500 shrink-0">PLN</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="total_parking_spots"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pojemność parkingu (miejsc)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Zapisywanie…" : "Zapisz ustawienia"}
        </Button>
      </form>
    </Form>
  );
}
