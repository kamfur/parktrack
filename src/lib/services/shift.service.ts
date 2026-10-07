import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { DriverShiftDto } from "../../types";
import type { DriverShiftWrite } from "../schemas/calendar.schema";

export class ShiftServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = "ShiftServiceError";
  }
}

export class ShiftService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async list(from: string, to: string): Promise<DriverShiftDto[]> {
    const { data, error } = await this.supabase
      .from("driver_shifts")
      .select("*")
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at", { ascending: true });

    if (error) throw new ShiftServiceError(`Failed to fetch shifts: ${error.message}`);
    return data ?? [];
  }

  async create(command: DriverShiftWrite): Promise<DriverShiftDto> {
    const { data, error } = await this.supabase.from("driver_shifts").insert(command).select().single();
    if (error) throw new ShiftServiceError(`Failed to create shift: ${error.message}`);
    return data;
  }

  async update(id: string, command: DriverShiftWrite): Promise<DriverShiftDto> {
    const { data, error } = await this.supabase.from("driver_shifts").update(command).eq("id", id).select().single();
    if (error) {
      throw new ShiftServiceError(
        error.code === "PGRST116" ? `Shift with ID ${id} not found` : `Failed to update shift: ${error.message}`,
        error.code === "PGRST116" ? 404 : 500
      );
    }
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error, count } = await this.supabase.from("driver_shifts").delete({ count: "exact" }).eq("id", id);
    if (error) throw new ShiftServiceError(`Failed to delete shift: ${error.message}`);
    if (count === 0) throw new ShiftServiceError(`Shift with ID ${id} not found`, 404);
  }
}
