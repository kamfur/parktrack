import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateGarageSpotCommand, GarageSpotDto, UpdateGarageSpotCommand } from "../../types";
import { createGarageSpotSchema, updateGarageSpotSchema } from "../schemas/garage-spot.schema";

/**
 * CRUD for garage/carport spot inventory (the configurator).
 * Single/double is a capacity label on one assignable unit, not a sub-spot hierarchy.
 */
export class GarageSpotService {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(): Promise<GarageSpotDto[]> {
    const { data, error } = await this.supabase.from("garage_spots").select("*").order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch garage spots: ${error.message}`);
    }

    return data ?? [];
  }

  async create(command: CreateGarageSpotCommand): Promise<GarageSpotDto> {
    const validatedData = await createGarageSpotSchema.parseAsync(command);

    const { data, error } = await this.supabase.from("garage_spots").insert(validatedData).select().single();

    if (error) {
      throw new Error(`Failed to create garage spot: ${error.message}`);
    }

    return data;
  }

  async update(id: string, command: UpdateGarageSpotCommand): Promise<GarageSpotDto> {
    const validatedData = await updateGarageSpotSchema.parseAsync(command);

    const { data, error } = await this.supabase
      .from("garage_spots")
      .update(validatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error(`Garage spot with ID ${id} not found`);
      }
      throw new Error(`Failed to update garage spot: ${error.message}`);
    }

    return data;
  }
}
