import type { PriceListRates } from "@/types";
import { PARKING_TYPES, PARKING_TYPE_LABELS, type ParkingType } from "@/lib/pricing/parking-type";
import { PRICED_DAYS } from "@/lib/pricing/price-list";
import { Input } from "@/components/ui/input";

const DAY_COLUMNS = Array.from({ length: PRICED_DAYS }, (_, index) => index + 1);

/** Editable cell values are kept as strings so a field can be cleared while typing. */
export type PriceListDraftRates = Record<ParkingType, { day_prices: string[]; extra_day_price: string }>;

function formatPrice(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

type PriceListTableProps =
  | { mode: "view"; rates: PriceListRates }
  | {
      mode: "edit";
      rates: PriceListDraftRates;
      onChange: (type: ParkingType, column: number | "extra", value: string) => void;
      disabled?: boolean;
    };

/**
 * Rows: parking / wiata / garaż. Columns: total price for a 1..14 day stay,
 * then the per-day price for every day beyond 14.
 */
export function PriceListTable(props: PriceListTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-50 text-neutral-600">
            <th scope="col" className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium">
              Typ miejsca
            </th>
            {DAY_COLUMNS.map((day) => (
              <th key={day} scope="col" className="px-1.5 py-2 text-center font-medium whitespace-nowrap">
                {day} {day === 1 ? "dzień" : "dni"}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 text-center font-medium whitespace-nowrap">
              &gt; {PRICED_DAYS} dni
              <span className="block text-xs font-normal">za dobę</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {PARKING_TYPES.map((type) => {
            const label = PARKING_TYPE_LABELS[type];
            return (
              <tr key={type} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium">
                  {label}
                </th>
                {DAY_COLUMNS.map((day) => (
                  <td key={day} className="px-1 py-1.5 text-center">
                    {props.mode === "view" ? (
                      formatPrice(props.rates[type].day_prices[day - 1])
                    ) : (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="h-8 w-[4.75rem] px-1.5 text-right"
                        aria-label={`${label}, ${day} ${day === 1 ? "dzień" : "dni"} (PLN)`}
                        value={props.rates[type].day_prices[day - 1]}
                        disabled={props.disabled}
                        onChange={(event) => props.onChange(type, day, event.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td className="bg-neutral-50/60 px-1 py-1.5 text-center">
                  {props.mode === "view" ? (
                    formatPrice(props.rates[type].extra_day_price)
                  ) : (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="h-8 w-[4.75rem] px-1.5 text-right"
                      aria-label={`${label}, każda doba powyżej ${PRICED_DAYS} dni (PLN)`}
                      value={props.rates[type].extra_day_price}
                      disabled={props.disabled}
                      onChange={(event) => props.onChange(type, "extra", event.target.value)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
