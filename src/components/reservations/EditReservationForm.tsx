import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EditReservationFormProps, EditReservationFormData } from "@/types";
import { editReservationSchema } from "@/lib/schemas/reservation.schema";
import { formatPhone } from "@/lib/utils/reservation.formatters";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { CostPreview } from "./CostPreview";
import { FlightDirectionInput } from "./FlightDirectionInput";
import { Loader2 } from "lucide-react";

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Formularz edycji istniejącej rezerwacji. Pola blokowane są wg statusu.
 */
export function EditReservationForm({
  reservation,
  editRules,
  onSubmit,
  onCancel,
  isSubmitting,
}: EditReservationFormProps) {
  const form = useForm<EditReservationFormData>({
    resolver: zodResolver(editReservationSchema),
    defaultValues: {
      lastName: reservation.last_name || "",
      firstName: reservation.first_name || "",
      email: reservation.email || "",
      phone: formatPhone(reservation.phone) === "—" ? "" : formatPhone(reservation.phone),
      licensePlate: reservation.license_plate || "",
      checkInDate: parseDate(reservation.planned_check_in),
      checkOutDate: parseDate(reservation.planned_check_out),
      flightDirection: reservation.flight_direction || "",
      notes: reservation.notes || "",
    },
  });

  const { checkInDate, checkOutDate, notes } = form.watch();

  const capitalizeFirst = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handleSubmit = async (data: EditReservationFormData) => {
    await onSubmit({
      ...data,
      phone: data.phone ? data.phone.replace(/\s/g, "") : "",
    });
  };

  const handleCancel = () => {
    if (form.formState.isDirty) {
      const confirmed = window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz anulować edycję?");
      if (!confirmed) return;
    }
    onCancel();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                      disabled={!editRules.canEditPersonalInfo}
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
                      disabled={!editRules.canEditPersonalInfo}
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
                    <Input
                      {...field}
                      type="email"
                      placeholder="jan.kowalski@example.com"
                      autoComplete="email"
                      disabled={!editRules.canEditPersonalInfo}
                    />
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
                      disabled={!editRules.canEditPersonalInfo}
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
                      disabled={!editRules.canEditCheckIn}
                      error={!!form.formState.errors.checkInDate}
                    />
                  </FormControl>
                  {!editRules.canEditCheckIn ? (
                    <FormDescription>Data przyjazdu jest zablokowana po check-in</FormDescription>
                  ) : null}
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
                      disabled={!editRules.canEditCheckOut}
                      minDate={checkInDate || undefined}
                      error={!!form.formState.errors.checkOutDate}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

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
                    disabled={!editRules.canEditVehicleInfo}
                    onChange={(e) => {
                      field.onChange(e.target.value.toUpperCase());
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  disabled={!editRules.canEditPersonalInfo}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-700">Notatki</h3>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dodatkowe informacje</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Dodatkowe informacje o rezerwacji..."
                    rows={4}
                    maxLength={1000}
                    disabled={!editRules.canEditNotes}
                  />
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

        <CostPreview checkInDate={checkInDate} checkOutDate={checkOutDate} isCalculating={false} />

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Anuluj
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </Button>
        </div>
      </form>
    </Form>
  );
}
