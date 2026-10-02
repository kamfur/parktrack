import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EditReservationFormProps, EditReservationFormData } from "@/types";
import { editReservationSchema } from "@/lib/schemas/reservation.schema";
import { formatPhone } from "@/lib/utils/reservation.formatters";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { CostPreview } from "./CostPreview";
import { PARKING_TYPES, PARKING_TYPE_LABELS, type ParkingType } from "@/lib/pricing/parking-type";
import { FlightDirectionInput } from "./FlightDirectionInput";
import { TravelAgencySelect } from "./TravelAgencySelect";
import { GarageSpotSelect } from "./GarageSpotSelect";
import { Banknote, KeyRound, Loader2 } from "lucide-react";

function toParkingType(value: string | null | undefined): ParkingType {
  return (PARKING_TYPES as readonly string[]).includes(value ?? "") ? (value as ParkingType) : "open_air";
}

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function PaidCheckbox({
  control,
  name,
  label,
}: {
  control: Control<EditReservationFormData>;
  name: "paidAtArrival" | "paidAtDeparture";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-4 shadow-sm">
          <FormControl>
            <Checkbox
              className="h-7 w-7 border-emerald-600 data-[state=checked]:bg-emerald-600"
              checked={field.value ?? false}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          </FormControl>
          <FormLabel className="flex flex-1 cursor-pointer items-center gap-2 text-base font-semibold text-emerald-900">
            <Banknote className="h-5 w-5 text-emerald-700" aria-hidden />
            {label}
          </FormLabel>
        </FormItem>
      )}
    />
  );
}

/**
 * Formularz edycji istniejącej rezerwacji. Pola blokowane są wg statusu.
 */
export function EditReservationForm({
  reservation,
  editRules,
  currentGarageSpotId,
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
      travelAgencyId: reservation.travel_agency_id ?? "",
      parkingType: toParkingType(reservation.parking_type),
      garageSpotId: currentGarageSpotId ?? "",
      keysLeft: reservation.keys_left ?? false,
      paidAtArrival: reservation.paid_at_arrival ?? false,
      paidAtDeparture: reservation.paid_at_departure ?? false,
    },
  });

  const { checkInDate, checkOutDate, notes, travelAgencyId, parkingType } = form.watch();

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
      {editRules.lockedByInvoiceNumber && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          Rezerwacja jest na fakturze {editRules.lockedByInvoiceNumber} — daty, typ miejsca i biuro podróży są
          zablokowane.
        </p>
      )}
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
                      placeholder="Wybierz datę"
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
                      placeholder="Wybierz datę"
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

          <FormField
            control={form.control}
            name="parkingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ miejsca</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!editRules.canEditParkingType}>
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
                <FormDescription>Zmiana typu przelicza cenę.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {parkingType === "garage" || parkingType === "carport" ? (
            <FormField
              control={form.control}
              name="garageSpotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{parkingType === "garage" ? "Garaż" : "Wiata"}</FormLabel>
                  <GarageSpotSelect
                    parkingType={parkingType}
                    checkIn={checkInDate}
                    checkOut={checkOutDate}
                    reservationId={reservation.id}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    emptyLabel={
                      parkingType === reservation.parking_type && currentGarageSpotId
                        ? "Bez zmian"
                        : "Automatycznie (pierwsze wolne)"
                    }
                    disabled={!editRules.canEditParkingType}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>

        {editRules.canEditKeysLeft ? (
          <FormField
            control={form.control}
            name="keysLeft"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="flex items-center gap-2 font-normal">
                  <KeyRound className="h-4 w-4 text-amber-600" aria-hidden />
                  Zostawił kluczyki
                </FormLabel>
              </FormItem>
            )}
          />
        ) : null}

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
          <h3 className="text-sm font-medium text-neutral-700">Płatnik</h3>

          <FormField
            control={form.control}
            name="travelAgencyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Biuro podróży</FormLabel>
                <FormControl>
                  <TravelAgencySelect
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={!editRules.canEditTravelAgency}
                  />
                </FormControl>
                <FormDescription>
                  Zmiana biura przelicza cenę; rezerwacja biura jest opłacona, klient nie płaci na parkingu.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {editRules.canEditPayment && !travelAgencyId ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-700">Płatność</h3>
            <PaidCheckbox control={form.control} name="paidAtArrival" label="Opłacono przy przyjeździe" />
            {reservation.status === "in_progress" || reservation.status === "completed" ? (
              <PaidCheckbox control={form.control} name="paidAtDeparture" label="Opłacono przy wyjeździe" />
            ) : null}
          </div>
        ) : null}

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

        <CostPreview
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          parkingType={parkingType}
          travelAgencyId={travelAgencyId || null}
          isCalculating={false}
        />

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
