import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceListDto } from "../../types";
import { PARKING_TYPES, type ParkingType } from "../pricing/parking-type";
import { emptyPriceListRates } from "../pricing/price-list";
import type { SavePriceListCommand } from "../schemas/price-list.schema";

export class PriceListNotFoundError extends Error {
  constructor(id: string) {
    super(`Price list with ID ${id} not found`);
    this.name = "PriceListNotFoundError";
  }
}

export class DuplicatePriceListStartError extends Error {
  constructor(validFrom: string) {
    super(`A price list starting on ${validFrom} already exists`);
    this.name = "DuplicatePriceListStartError";
  }
}

interface PriceListRow {
  id: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  price_list_rates: { parking_type: string; day_prices: (number | string)[]; extra_day_price: number | string }[];
}

function toDto(row: PriceListRow): PriceListDto {
  const rates = emptyPriceListRates();
  for (const rate of row.price_list_rates ?? []) {
    if (!(PARKING_TYPES as readonly string[]).includes(rate.parking_type)) continue;
    rates[rate.parking_type as ParkingType] = {
      day_prices: rate.day_prices.map(Number),
      extra_day_price: Number(rate.extra_day_price),
    };
  }
  return {
    id: row.id,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
    rates,
  };
}

/**
 * Period-based price lists. Pricing itself happens in `public.calculate_total_cost`;
 * this service only manages the lists staff edit in settings.
 */
export class PriceListService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** All lists, newest period first. */
  async list(): Promise<PriceListDto[]> {
    const { data, error } = await this.supabase
      .from("price_lists")
      .select(
        "id, valid_from, valid_to, created_at, updated_at, price_list_rates(parking_type, day_prices, extra_day_price)"
      )
      .order("valid_from", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch price lists: ${error.message}`);
    }

    return ((data ?? []) as unknown as PriceListRow[]).map(toDto);
  }

  /** Creates (no id) or replaces a list and its three rate rows atomically. Returns the list id. */
  async save(command: SavePriceListCommand, id?: string): Promise<string> {
    const { data, error } = await this.supabase.rpc("save_price_list", {
      p_id: id ?? null,
      p_valid_from: command.valid_from,
      p_valid_to: command.valid_to,
      p_rates: PARKING_TYPES.map((parking_type) => ({ parking_type, ...command.rates[parking_type] })),
    });

    if (error) {
      if (error.code === "23505") throw new DuplicatePriceListStartError(command.valid_from);
      if (error.message.includes("PRICE_LIST_NOT_FOUND")) throw new PriceListNotFoundError(id ?? "");
      throw new Error(`Failed to save price list: ${error.message}`);
    }

    return data as string;
  }

  async delete(id: string): Promise<void> {
    const { data, error } = await this.supabase.from("price_lists").delete().eq("id", id).select("id");

    if (error) {
      throw new Error(`Failed to delete price list: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new PriceListNotFoundError(id);
    }
  }
}
