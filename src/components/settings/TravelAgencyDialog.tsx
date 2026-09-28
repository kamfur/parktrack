import { useEffect, useState } from "react";
import type { SaveTravelAgencyCommand, TravelAgencyDto } from "@/types";
import { saveTravelAgencySchema } from "@/lib/schemas/travel-agency.schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TravelAgencyDialogState = { mode: "create" } | { mode: "edit"; agency: TravelAgencyDto };

interface TravelAgencyDialogProps {
  state: TravelAgencyDialogState | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (command: SaveTravelAgencyCommand, id?: string) => Promise<void>;
}

type Draft = Record<
  "name" | "nip" | "address" | "email" | "phone" | "contact_person" | "notes" | "discount_pct" | "payment_term_days",
  string
>;

const EMPTY_DRAFT: Draft = {
  name: "",
  nip: "",
  address: "",
  email: "",
  phone: "",
  contact_person: "",
  notes: "",
  discount_pct: "0",
  payment_term_days: "14",
};

function toDraft(agency: TravelAgencyDto): Draft {
  return {
    name: agency.name,
    nip: agency.nip,
    address: agency.address,
    email: agency.email ?? "",
    phone: agency.phone ?? "",
    contact_person: agency.contact_person ?? "",
    notes: agency.notes ?? "",
    discount_pct: String(agency.discount_pct),
    payment_term_days: String(agency.payment_term_days),
  };
}

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value.replace(",", ".")));

export function TravelAgencyDialog({ state, isSaving, onOpenChange, onSave }: TravelAgencyDialogProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  useEffect(() => {
    if (!state) return;
    setErrors({});
    setDraft(state.mode === "edit" ? toDraft(state.agency) : EMPTY_DRAFT);
  }, [state]);

  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = saveTravelAgencySchema.safeParse({
      ...draft,
      discount_pct: toNumber(draft.discount_pct),
      payment_term_days: toNumber(draft.payment_term_days),
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]])) as Partial<
          Record<keyof Draft, string>
        >
      );
      return;
    }

    setErrors({});
    try {
      await onSave(parsed.data, state?.mode === "edit" ? state.agency.id : undefined);
      onOpenChange(false);
    } catch {
      // Toast already shown by the hook; keep the dialog open for correction.
    }
  };

  const field = (name: keyof Draft, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`agency-${name}`}>{label}</Label>
      <Input
        id={`agency-${name}`}
        value={draft[name]}
        onChange={set(name)}
        disabled={isSaving}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `agency-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`agency-${name}-error`} className="text-sm text-red-600">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Edytuj biuro podróży" : "Nowe biuro podróży"}</DialogTitle>
          <DialogDescription>
            Dane nabywcy na miesięcznej fakturze VAT. Rabat obniża cenę z cennika dla nowych rezerwacji tego biura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("name", "Nazwa biura")}</div>
            {field("nip", "NIP", { inputMode: "numeric", placeholder: "np. 123-456-32-18" })}
            {field("email", "E-mail", { type: "email" })}
            <div className="sm:col-span-2">{field("address", "Adres")}</div>
            {field("phone", "Telefon", { type: "tel" })}
            {field("contact_person", "Osoba kontaktowa")}
            {field("discount_pct", "Rabat (%)", { type: "number", min: 0, max: 100, step: 0.01 })}
            {field("payment_term_days", "Termin płatności (dni)", { type: "number", min: 0, max: 365, step: 1 })}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="agency-notes">Uwagi</Label>
              <Textarea id="agency-notes" value={draft.notes} onChange={set("notes")} disabled={isSaving} rows={3} />
              {errors.notes && <p className="text-sm text-red-600">{errors.notes}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Zapisywanie…" : "Zapisz biuro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
