import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ParkingType, ReservationDto } from "@/types";
import {
  driverArrivalFormSchema,
  datetimeLocalToIso,
  isoToDatetimeLocal,
  type DriverArrivalFormData,
} from "@/lib/schemas/driver-form.schema";
import { driverWalkInArrivalSchema, type DriverWalkInArrival } from "@/lib/schemas/driver.schema";
import { driverDisplayName, isAgencyPaid } from "@/lib/driver/display";
import { joinLicensePlates, platesForInputs } from "@/lib/vehicles";
import { VehicleCountInput } from "@/components/shared/VehicleCountInput";
import { PARKING_TYPES, PARKING_TYPE_LABELS } from "@/lib/pricing/parking-type";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, KeyRound, Loader2 } from "lucide-react";
import { useCheckoutQuote, useNewStayQuote } from "@/hooks/useCheckoutQuote";
import { PaymentQuote } from "@/components/driver/PaymentQuote";
import { FlightDirectionInput } from "@/components/reservations/FlightDirectionInput";
import { GarageSpotSelect } from "@/components/reservations/GarageSpotSelect";
import { MOBILE_FULLSCREEN_DIALOG } from "@/components/common/dialog-layout";
import { cn } from "@/lib/utils";

interface CommonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isProcessing: boolean;
}

/** Accepting a booked reservation from the arrivals list. */
interface ReservationArrivalProps extends CommonProps {
  mode?: "reservation";
  reservation: ReservationDto | null;
  onSubmit: (id: string, body: Record<string, unknown>) => Promise<void>;
}

/** Client arrived without a reservation: same form plus client details; creates and accepts the stay. */
interface WalkInArrivalProps extends CommonProps {
  mode: "walk-in";
  onSubmit: (body: DriverWalkInArrival) => Promise<void>;
}

type DriverArrivalDialogProps = ReservationArrivalProps | WalkInArrivalProps;

type ArrivalFormValues = DriverArrivalFormData & {
  last_name: string;
  first_name: string;
  phone: string;
  parking_type: ParkingType;
  /** Walk-in garage/carport spot; "" = auto-assign the first free one. */
  garage_spot_id: string;
};

/** Walk-in validation issues shown under their field; anything else goes to the form-level error. */
const WALK_IN_FIELDS = ["last_name", "planned_check_out", "parking_sector", "license_plate"] as const;

function formatClock(date: Date): string {
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function emptyValues(): ArrivalFormValues {
  return {
    last_name: "",
    first_name: "",
    phone: "",
    parking_type: "open_air",
    garage_spot_id: "",
    planned_check_out: "",
    flight_direction: "",
    passenger_count: null,
    parking_sector: "",
    license_plate: "",
    vehicle_count: 1,
    extra_license_plates: [],
    paid_at_arrival: true,
    keys_left: false,
  };
}

export function DriverArrivalDialog(props: DriverArrivalDialogProps) {
  const { open, onOpenChange, isProcessing } = props;
  const walkIn = props.mode === "walk-in";
  const reservation = props.mode === "walk-in" ? null : props.reservation;
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Walk-in check-in time: fixed when the dialog opens so the price preview does not refetch every render.
  const [openedAt, setOpenedAt] = useState(() => new Date());

  const form = useForm<ArrivalFormValues>({
    // raw: keep the walk-in-only fields (client details, parking type, spot) that the schema would strip.
    resolver: zodResolver(driverArrivalFormSchema, undefined, { raw: true }) as unknown as Resolver<ArrivalFormValues>,
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    if (walkIn) {
      form.reset(emptyValues());
      setOpenedAt(new Date());
    } else if (reservation) {
      form.reset({
        ...emptyValues(),
        planned_check_out: isoToDatetimeLocal(reservation.planned_check_out),
        flight_direction: reservation.flight_direction ?? "",
        passenger_count: reservation.passenger_count,
        parking_sector: reservation.parking_sector ?? "",
        license_plate: reservation.license_plate ?? "",
        vehicle_count: reservation.vehicle_count ?? 1,
        extra_license_plates: platesForInputs(reservation, reservation.vehicle_count ?? 1).slice(1),
        paid_at_arrival: true,
        keys_left: reservation.keys_left ?? false,
      });
    }
    setSubmitError(null);
  }, [walkIn, reservation, open, form]);

  const agencyPaid = reservation ? isAgencyPaid(reservation) : false;
  const paymentDue = walkIn || (reservation ? !reservation.is_paid : false);
  const checkoutIso = datetimeLocalToIso(form.watch("planned_check_out") ?? "") ?? null;
  const openedAtIso = useMemo(() => openedAt.toISOString(), [openedAt]);
  const vehicleCount = form.watch("vehicle_count") ?? 1;
  const reservationQuote = useCheckoutQuote(
    reservation?.id ?? null,
    checkoutIso,
    open && !walkIn && paymentDue,
    vehicleCount
  );
  const parkingType = form.watch("parking_type");
  const walkInQuote = useNewStayQuote(open && walkIn ? openedAtIso : null, checkoutIso, parkingType, vehicleCount);
  const quote = walkIn ? walkInQuote : reservationQuote;

  // One plate input per extra car; existing entries survive a count change.
  const changeVehicleCount = (next: number) => {
    const current = form.getValues("extra_license_plates") ?? [];
    form.setValue(
      "extra_license_plates",
      Array.from({ length: next - 1 }, (_, i) => current[i] ?? ""),
      { shouldDirty: true }
    );
    form.setValue("vehicle_count", next, { shouldDirty: true });
  };

  const sectorField = (
    <FormField
      control={form.control}
      name="parking_sector"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Sektor</FormLabel>
          <FormControl>
            <Input className="min-h-11" placeholder="np. A12" {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    setSubmitError(null);
    const trimmed = {
      parking_sector: data.parking_sector?.trim() ? data.parking_sector.trim() : null,
      license_plate: data.license_plate?.trim() ? data.license_plate.trim().toUpperCase() : null,
      flight_direction: data.flight_direction?.trim() ? data.flight_direction.trim() : null,
    };
    const count = data.vehicle_count ?? 1;
    const extraPlates = (data.extra_license_plates ?? []).slice(0, count - 1).map((p) => p.trim().toUpperCase());

    if (props.mode === "walk-in") {
      const parsed = driverWalkInArrivalSchema.safeParse({
        last_name: data.last_name,
        first_name: data.first_name.trim() || undefined,
        phone: data.phone.replace(/\s/g, "") || undefined,
        license_plate: trimmed.license_plate ?? undefined,
        vehicle_count: count,
        extra_license_plates: extraPlates,
        flight_direction: trimmed.flight_direction ?? undefined,
        planned_check_out: checkoutIso ?? "",
        parking_type: data.parking_type,
        ...(data.parking_type === "open_air"
          ? { parking_sector: trimmed.parking_sector ?? undefined }
          : { garage_spot_id: data.garage_spot_id || undefined }),
        passenger_count: data.passenger_count ?? null,
        paid_at_arrival: data.paid_at_arrival,
        keys_left: data.keys_left,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = WALK_IN_FIELDS.find((name) => name === issue?.path[0]);
        if (field && issue) form.setError(field, { message: issue.message });
        else setSubmitError(issue?.message ?? "Nieprawidłowe dane");
        return;
      }
      try {
        await props.onSubmit(parsed.data);
        onOpenChange(false);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Nie udało się dodać przyjazdu");
      }
      return;
    }

    if (!reservation) return;
    try {
      const body: Record<string, unknown> = {
        ...(agencyPaid ? {} : { paid_at_arrival: data.paid_at_arrival }),
        passenger_count: data.passenger_count ?? null,
        keys_left: data.keys_left,
        vehicle_count: count,
        extra_license_plates: extraPlates,
        ...trimmed,
      };
      if (checkoutIso) body.planned_check_out = checkoutIso;
      await props.onSubmit(reservation.id, body);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nie udało się potwierdzić przyjazdu");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(MOBILE_FULLSCREEN_DIALOG, "flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-hidden p-0")}
      >
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle>{walkIn ? "Przyjazd bez rezerwacji" : "Potwierdź przyjazd"}</DialogTitle>
          {walkIn ? (
            <DialogDescription>
              Klient przyjechał teraz ({formatClock(openedAt)}) i nie ma go na liście przyjazdów. Zapisanie utworzy
              rezerwację i od razu potwierdzi przyjazd. Jeśli klient ma rezerwację, zamknij to okno i przyjmij go z
              listy.
            </DialogDescription>
          ) : reservation ? (
            <p className="text-sm text-muted-foreground">
              {driverDisplayName(reservation)}
              {joinLicensePlates(reservation) ? ` · ${joinLicensePlates(reservation)}` : ""}
            </p>
          ) : null}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
              {walkIn ? (
                <>
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nazwisko *</FormLabel>
                        <FormControl>
                          <Input className="min-h-11" maxLength={100} autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imię</FormLabel>
                        <FormControl>
                          <Input className="min-h-11" maxLength={100} autoComplete="off" {...field} />
                        </FormControl>
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
                          <Input type="tel" className="min-h-11" maxLength={20} autoComplete="off" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              ) : null}
              <FormField
                control={form.control}
                name="vehicle_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liczba aut</FormLabel>
                    <FormControl>
                      <VehicleCountInput value={field.value ?? 1} onChange={changeVehicleCount} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="license_plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{vehicleCount > 1 ? "Numer rejestracyjny – auto 1" : "Numer rejestracyjny"}</FormLabel>
                    <FormControl>
                      <Input
                        className="min-h-11"
                        placeholder="np. WX 12345"
                        maxLength={15}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {Array.from({ length: vehicleCount - 1 }, (_, i) => (
                <FormField
                  key={i}
                  control={form.control}
                  name={`extra_license_plates.${i}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numer rejestracyjny – auto {i + 2}</FormLabel>
                      <FormControl>
                        <Input
                          className="min-h-11"
                          placeholder="np. WX 12345"
                          maxLength={15}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="planned_check_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{walkIn ? "Planowany wyjazd *" : "Planowany wyjazd"}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="min-h-11" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {walkIn ? (
                <>
                  <FormField
                    control={form.control}
                    name="parking_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typ miejsca</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="min-h-11 w-full">
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
                      </FormItem>
                    )}
                  />
                  {/* Where the car stands depends on the type: a sector on open-air parking, a spot in a garage or carport. */}
                  {parkingType === "open_air" ? (
                    sectorField
                  ) : (
                    <FormField
                      control={form.control}
                      name="garage_spot_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{parkingType === "garage" ? "Miejsce w garażu" : "Miejsce pod wiatą"}</FormLabel>
                          <GarageSpotSelect
                            parkingType={parkingType}
                            checkIn={openedAtIso}
                            checkOut={checkoutIso}
                            value={field.value}
                            onChange={field.onChange}
                            emptyLabel="Automatycznie (pierwsze wolne)"
                          />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              ) : null}
              <FormField
                control={form.control}
                name="flight_direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kierunek lotu</FormLabel>
                    <FlightDirectionInput
                      className="min-h-11"
                      placeholder="np. Londyn, LO 392"
                      maxLength={100}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passenger_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liczba pasażerów</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        className="min-h-11"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {walkIn ? null : sectorField}
              <FormField
                control={form.control}
                name="keys_left"
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
              {agencyPaid ? (
                <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                  Biuro podróży – opłacone. Nie pobieraj płatności od klienta.
                </p>
              ) : (
                <>
                  {paymentDue && (!walkIn || checkoutIso) ? <PaymentQuote {...quote} /> : null}
                  <FormField
                    control={form.control}
                    name="paid_at_arrival"
                    render={({ field }) => (
                      <FormItem
                        className={cn(
                          "flex flex-row items-center gap-3 space-y-0 rounded-lg border-2 p-4 shadow-sm",
                          field.value ? "border-emerald-500 bg-emerald-50" : "border-amber-500 bg-amber-50"
                        )}
                      >
                        <FormControl>
                          <Checkbox
                            className="h-7 w-7 border-amber-600 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(v === true)}
                          />
                        </FormControl>
                        <FormLabel
                          className={cn(
                            "flex flex-1 cursor-pointer items-center gap-2 text-base font-semibold",
                            field.value ? "text-emerald-900" : "text-amber-900"
                          )}
                        >
                          <Banknote
                            className={cn("h-5 w-5", field.value ? "text-emerald-700" : "text-amber-700")}
                            aria-hidden
                          />
                          Opłacono przy przyjeździe
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </>
              )}
              {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            </div>
            <DialogFooter className="shrink-0 flex-row gap-2 border-t bg-white px-6 py-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => onOpenChange(false)}
              >
                Anuluj
              </Button>
              <Button type="submit" className="min-h-11 flex-[2] sm:flex-none" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {walkIn ? "Dodaj przyjazd" : "Potwierdź przyjazd"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
