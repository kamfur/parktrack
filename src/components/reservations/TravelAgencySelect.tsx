import { useTravelAgencies, useTravelAgency } from "@/hooks/useTravelAgencies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Radix Select cannot use "" as an item value. */
const NONE = "__none__";

interface TravelAgencySelectProps {
  id?: string;
  /** "" = no agency (individual client) */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Active travel agencies + "brak" (individual client). */
export function TravelAgencySelect({ id, value, onChange, disabled }: TravelAgencySelectProps) {
  const { agencies, isLoading } = useTravelAgencies();
  // An already-assigned agency may be archived (not in the active list) — keep it visible and selected.
  const isInactiveValue = !isLoading && value !== "" && !agencies.some((agency) => agency.id === value);
  const currentAgency = useTravelAgency(isInactiveValue ? value : null);

  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={isLoading ? "Ładowanie…" : "— brak (klient indywidualny) —"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— brak (klient indywidualny) —</SelectItem>
        {isInactiveValue && (
          <SelectItem value={value}>
            {currentAgency ? `${currentAgency.name} (zarchiwizowane)` : "Biuro (zarchiwizowane)"}
          </SelectItem>
        )}
        {agencies.map((agency) => (
          <SelectItem key={agency.id} value={agency.id}>
            {agency.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
