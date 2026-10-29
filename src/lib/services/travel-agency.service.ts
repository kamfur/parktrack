import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaveTravelAgencyCommand, TravelAgencyDto } from "../../types";

export class TravelAgencyNotFoundError extends Error {
  constructor(id: string) {
    super(`Travel agency with ID ${id} not found`);
    this.name = "TravelAgencyNotFoundError";
  }
}

export class DuplicateNipError extends Error {
  constructor(nip: string) {
    super(`Biuro z NIP ${nip} już istnieje`);
    this.name = "DuplicateNipError";
  }
}

export class TravelAgencyInUseError extends Error {
  constructor() {
    super("Biuro ma rezerwacje lub faktury — możesz je zarchiwizować");
    this.name = "TravelAgencyInUseError";
  }
}

/** Staff-managed travel agencies (Settings). Billing lives in the agency billing service. */
export class TravelAgencyService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Active agencies by name; archived ones appended (also by name) when requested. */
  async list(includeArchived = false): Promise<TravelAgencyDto[]> {
    let query = this.supabase.from("travel_agencies").select("*");
    if (!includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query.order("name", { ascending: true });
    if (error) throw new Error(`Failed to fetch travel agencies: ${error.message}`);

    const rows = (data ?? []) as TravelAgencyDto[];
    return [...rows.filter((a) => a.archived_at === null), ...rows.filter((a) => a.archived_at !== null)];
  }

  async getById(id: string): Promise<TravelAgencyDto | null> {
    const { data, error } = await this.supabase.from("travel_agencies").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Failed to fetch travel agency: ${error.message}`);
    return data as TravelAgencyDto | null;
  }

  async create(command: SaveTravelAgencyCommand): Promise<TravelAgencyDto> {
    const { data, error } = await this.supabase.from("travel_agencies").insert(command).select("*").single();
    if (error) {
      if (error.code === "23505") throw new DuplicateNipError(command.nip);
      throw new Error(`Failed to create travel agency: ${error.message}`);
    }
    return data as TravelAgencyDto;
  }

  async update(id: string, command: SaveTravelAgencyCommand): Promise<TravelAgencyDto> {
    const { data, error } = await this.supabase
      .from("travel_agencies")
      .update(command)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") throw new DuplicateNipError(command.nip);
      throw new Error(`Failed to update travel agency: ${error.message}`);
    }
    if (!data) throw new TravelAgencyNotFoundError(id);
    return data as TravelAgencyDto;
  }

  async setArchived(id: string, archived: boolean): Promise<TravelAgencyDto> {
    const { data, error } = await this.supabase
      .from("travel_agencies")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Failed to archive travel agency: ${error.message}`);
    if (!data) throw new TravelAgencyNotFoundError(id);
    return data as TravelAgencyDto;
  }

  /** Hard delete; blocked by FKs once reservations or invoices reference the agency. */
  async delete(id: string): Promise<void> {
    const { data, error } = await this.supabase.from("travel_agencies").delete().eq("id", id).select("id");
    if (error) {
      if (error.code === "23503") throw new TravelAgencyInUseError();
      throw new Error(`Failed to delete travel agency: ${error.message}`);
    }
    if (!data || data.length === 0) throw new TravelAgencyNotFoundError(id);
  }
}
