import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { QuickReservationFormProps, QuickReservationFormData } from "@/types";
import { quickReservationSchema } from "@/lib/schemas/reservation.schema";

type QuickReservationFormSchema = z.infer<typeof quickReservationSchema>;
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { CostPreview } from "./CostPreview";
import { AvailabilityIndicator } from "./AvailabilityIndicator";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";
import { Loader2 } from "lucide-react";
import { VoiceCaptureButton } from "@/components/voice/VoiceCaptureButton";

/**
 * Formularz szybkiego tworzenia rezerwacji z trzema wymaganymi polami.
 * Zoptymalizowany pod kątem szybkości wprowadzania danych (cel: <30 sekund).
 */
export function QuickReservationForm({
  onSubmit,
  onSwitchToFull,
  onStartVoice,
  isSubmitting,
}: QuickReservationFormProps) {
  // Ustaw domyślne daty: dzisiaj i jutro
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const form = useForm<QuickReservationFormSchema>({
    resolver: zodResolver(quickReservationSchema),
    defaultValues: {
      lastName: "",
      checkInDate: today,
      checkOutDate: tomorrow,
    },
  });

  const { checkInDate, checkOutDate } = form.watch();
  const { isAvailable, isChecking } = useAvailabilityCheck(checkInDate, checkOutDate);

  // Auto-capitalize pierwszej litery nazwiska
  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length === 1) {
      e.target.value = value.charAt(0).toUpperCase();
    }
  };

  // Ustaw minimalną datę dla date pickerów
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);

  // Submit handler
  const handleSubmit = async (data: QuickReservationFormSchema) => {
    if (!isAvailable) {
      return;
    }
    await onSubmit(data as QuickReservationFormData);
  };

  // Submit and expand handler
  const handleSubmitAndExpand = async () => {
    const isValid = await form.trigger();
    if (isValid && isAvailable) {
      const currentData = form.getValues();
      onSwitchToFull(currentData as QuickReservationFormData);
    }
  };

  // Dyktowanie: przejście do trybu pełnego z bieżącymi wartościami; pola zmienione ręcznie nie są nadpisywane głosem.
  const handleStartVoice = () => {
    if (!onStartVoice) return;
    const manual = (
      [
        ["lastName", "lastName"],
        ["checkInDate", "checkIn"],
        ["checkOutDate", "checkOut"],
      ] as const
    )
      .filter(([field]) => form.getFieldState(field).isDirty)
      .map(([, key]) => key);
    onStartVoice(form.getValues() as Partial<QuickReservationFormData>, manual);
  };

  // Auto-focus na pole nazwisko
  useEffect(() => {
    const timer = setTimeout(() => {
      const lastNameInput = document.querySelector<HTMLInputElement>('input[name="lastName"]');
      if (lastNameInput) {
        lastNameInput.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {onStartVoice ? <VoiceCaptureButton state="idle" onStart={handleStartVoice} onStop={handleStartVoice} /> : null}
        {/* Nazwisko */}
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nazwisko <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Kowalski"
                  autoComplete="family-name"
                  onChange={(e) => {
                    handleLastNameChange(e);
                    field.onChange(e);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data i godzina przyjazdu */}
        <FormField
          control={form.control}
          name="checkInDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Data i godzina przyjazdu <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <DateTimePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Wybierz datę i godzinę przyjazdu"
                  minDate={minDate}
                  error={!!form.formState.errors.checkInDate}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data i godzina wyjazdu */}
        <FormField
          control={form.control}
          name="checkOutDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Data i godzina wyjazdu <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <DateTimePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Wybierz datę i godzinę wyjazdu"
                  minDate={checkInDate || minDate}
                  error={!!form.formState.errors.checkOutDate}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cost Preview */}
        <CostPreview checkInDate={checkInDate} checkOutDate={checkOutDate} isCalculating={false} />

        {/* Availability Indicator */}
        <AvailabilityIndicator checkInDate={checkInDate} checkOutDate={checkOutDate} isChecking={false} />

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleSubmitAndExpand} disabled={isSubmitting || isChecking}>
            Zapisz i dodaj szczegóły
          </Button>
          <Button type="submit" disabled={isSubmitting || !isAvailable || isChecking}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zapisz szybko
          </Button>
        </div>
      </form>
    </Form>
  );
}
