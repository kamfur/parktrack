import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FullReservationFormProps, FullReservationFormData } from "@/types";
import { fullReservationSchema } from "@/lib/schemas/reservation.schema";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARKING_TYPES, PARKING_TYPE_LABELS } from "@/lib/pricing/parking-type";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { CostPreview } from "./CostPreview";
import { AvailabilityIndicator } from "./AvailabilityIndicator";
import { FlightDirectionInput } from "./FlightDirectionInput";
import { TravelAgencySelect } from "./TravelAgencySelect";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";
import { Loader2 } from "lucide-react";

/**
 * Rozszerzony formularz z wszystkimi polami rezerwacji.
 * Zawiera sekcje: dane osobowe, daty, pojazd, lot, notatki.
 */
export function FullReservationForm({
  initialData,
  onSubmit,
  onSwitchToQuick,
  isSubmitting,
}: FullReservationFormProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const form = useForm<FullReservationFormData>({
    resolver: zodResolver(fullReservationSchema),
    defaultValues: {
      lastName: initialData?.lastName || "",
      firstName: initialData?.firstName || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      licensePlate: initialData?.licensePlate || "",
      checkInDate: initialData?.checkInDate || today,
      checkOutDate: initialData?.checkOutDate || tomorrow,
      flightDirection: initialData?.flightDirection || "",
      notes: initialData?.notes || "",
      parkingType: initialData?.parkingType ?? "open_air",
      travelAgencyId: initialData?.travelAgencyId ?? "",
    },
  });

  const { checkInDate, checkOutDate, notes, parkingType, travelAgencyId } = form.watch();
  const { isAvailable, isChecking } = useAvailabilityCheck(checkInDate, checkOutDate);

  // Auto-capitalize first letter
  const capitalizeFirst = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  // Format phone number: add spaces (xxx xxx xxx)
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  };

  // Ustaw minimalną datę
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);

  // Submit handler
  const handleSubmit = async (data: FullReservationFormData) => {
    if (!isAvailable) {
      return;
    }
    // Clean phone number (remove spaces)
    const cleanedData = {
      ...data,
      phone: data.phone ? data.phone.replace(/\s/g, "") : "",
    };
    await onSubmit(cleanedData);
  };

  // Auto-focus na pierwsze nowe pole (Imię)
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstNameInput = document.querySelector<HTMLInputElement>('input[name="firstName"]');
      if (firstNameInput) {
        firstNameInput.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Personal Info Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Dane osobowe</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imię</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Jan"
                      autoComplete="given-name"
                      onChange={(e) => {
                        field.onChange(capitalizeFirst(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        field.onChange(capitalizeFirst(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="jan.kowalski@example.com" autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="123 456 789"
                      autoComplete="tel"
                      maxLength={11}
                      onChange={(e) => {
                        field.onChange(formatPhoneNumber(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Dates Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Daty rezerwacji</h3>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </div>

        {/* Vehicle Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Pojazd</h3>

          <FormField
            control={form.control}
            name="licensePlate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numer rejestracyjny</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="WX 12345"
                    maxLength={15}
                    onChange={(e) => {
                      field.onChange(e.target.value.toUpperCase());
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="parkingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ miejsca</FormLabel>
                <Select value={field.value ?? "open_air"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PARKING_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PARKING_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Wiata i garaż są przydzielane automatycznie; cena wg cennika dla typu.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="travelAgencyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Biuro podróży</FormLabel>
                <FormControl>
                  <TravelAgencySelect value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormDescription>Rezerwację opłaca biuro — cena z cennika minus rabat biura.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Flight Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Informacje o locie</h3>

          <FormField
            control={form.control}
            name="flightDirection"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kierunek lotu</FormLabel>
                <FlightDirectionInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  placeholder="np. Londyn, LO 392"
                  maxLength={100}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Notatki</h3>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dodatkowe informacje</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Dodatkowe informacje o rezerwacji..." rows={4} maxLength={1000} />
                </FormControl>
                <FormDescription className="flex justify-between">
                  <span>Opcjonalne notatki widoczne tylko dla personelu</span>
                  <span className={notes && notes.length > 900 ? "text-amber-600 font-medium" : ""}>
                    {notes?.length || 0}/1000
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Cost Preview */}
        <CostPreview
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          parkingType={parkingType ?? "open_air"}
          travelAgencyId={travelAgencyId || null}
          isCalculating={false}
        />

        {/* Availability Indicator */}
        <AvailabilityIndicator checkInDate={checkInDate} checkOutDate={checkOutDate} isChecking={false} />

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onSwitchToQuick} disabled={isSubmitting}>
            Wróć do trybu szybkiego
          </Button>
          <Button type="submit" disabled={isSubmitting || !isAvailable || isChecking}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zapisz rezerwację
          </Button>
        </div>
      </form>
    </Form>
  );
}
