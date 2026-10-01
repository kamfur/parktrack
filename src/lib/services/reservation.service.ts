import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateExternalReservationCommand,
  CreateReservationCommand,
  DepartureListItem,
  ReservationDto,
  UpdateReservationCommand,
} from "../../types";
import {
  createExternalReservationSchema,
  createLegacyDepartureSchema,
  createReservationSchema,
  updateReservationSchema,
  type CreateLegacyDepartureCommand,
} from "../schemas/reservation.schema";
import { createSupabaseAdminClient } from "../supabase-admin";
import { pendingWindowEndIso } from "../driver/operating-window";
import { uniqueFlightDirections } from "../reservations/flight-directions";
import { enrichDepartures } from "./ktw-arrival-hours.service";
import { GarageAllocationService } from "./garage-allocation.service";
import { isCoveredParkingType, type CoveredParkingType, type ParkingType } from "../pricing/parking-type";
import { applyAgencyDiscount } from "../pricing/agency-discount";

/** Statuses whose stay still needs a physical spot (a garage/carport assignment). */
const ACTIVE_STAY_STATUSES: readonly string[] = ["pending", "confirmed", "in_progress"];

export class NoGarageAvailableError extends Error {
  constructor(message = "No garage/carport spot is available within the required buffer") {
    super(message);
    this.name = "NoGarageAvailableError";
  }
}

export class NoPriceListError extends Error {
  constructor(message = "No price list covers the reservation's check-in date") {
    super(message);
    this.name = "NoPriceListError";
  }
}

/** Travel agency is archived (cannot be newly assigned) or does not exist. */
export class TravelAgencyUnavailableError extends Error {
  constructor(message = "Biuro podróży jest zarchiwizowane lub nie istnieje") {
    super(message);
    this.name = "TravelAgencyUnavailableError";
  }
}

/** "Zostawił kluczyki" changed on a reservation whose car is not on the parking. */
export class KeysLeftNotEditableError extends Error {
  constructor(message = "Kluczyki można oznaczyć tylko dla auta stojącego na parkingu") {
    super(message);
    this.name = "KeysLeftNotEditableError";
  }
}

/** Reservation is on an issued invoice (billing fields locked) or would enter an invoiced agency-month. */
export class ReservationInvoicedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationInvoicedError";
  }
}

/**
 * The spot to assign for a covered stay: the requested one if it is free for the window
 * (and of the right type), otherwise — when none was requested — the first free one.
 */
async function pickGarageSpot(
  allocationService: GarageAllocationService,
  parkingType: CoveredParkingType,
  checkIn: string,
  checkOut: string,
  requestedSpotId?: string,
  excludeReservationId?: string
): Promise<string> {
  const available = await allocationService.listAvailableSpots(checkIn, checkOut, parkingType, excludeReservationId);
  if (requestedSpotId) {
    if (!available.some((spot) => spot.id === requestedSpotId)) {
      throw new NoGarageAvailableError(
        parkingType === "garage"
          ? "Wybrany garaż jest zajęty w tym terminie"
          : "Wybrana wiata jest zajęta w tym terminie"
      );
    }
    return requestedSpotId;
  }
  if (available.length === 0) {
    throw new NoGarageAvailableError(
      parkingType === "garage" ? "Brak wolnego garażu w tym terminie" : "Brak wolnej wiaty w tym terminie"
    );
  }
  return available[0].id;
}

/** Translates the DB's NO_PRICE_LIST exception (calculate_total_cost / cost trigger) into a typed error. */
function asPriceListError(message: string | undefined): NoPriceListError | null {
  return message?.includes("NO_PRICE_LIST") ? new NoPriceListError() : null;
}

/** Typed error for DB exceptions raised by the pricing trigger (price list, agency). */
function asPricingError(message: string | undefined): Error | null {
  const invoiced = message?.match(/RESERVATION_INVOICED: (\S+)/);
  if (invoiced) {
    return new ReservationInvoicedError(
      `Rezerwacja jest na fakturze ${invoiced[1]} — nie można zmienić biura, dat, typu miejsca, ceny ani jej anulować`
    );
  }
  const month = message?.match(/AGENCY_MONTH_INVOICED: (\S+)/);
  if (month) {
    return new ReservationInvoicedError(
      `Biuro ma już wystawioną fakturę za ${month[1]} — wybierz inny termin lub biuro`
    );
  }
  if (message?.includes("AGENCY_ARCHIVED") || message?.includes("AGENCY_NOT_FOUND")) {
    return new TravelAgencyUnavailableError();
  }
  return asPriceListError(message);
}

export interface CostQuote {
  /** Price-list total before any discount */
  baseCost: number;
  /** Agency discount in % (0 when no agency) */
  discountPct: number;
  /** Price to pay (after the discount) */
  totalCost: number;
}

export class ReservationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Total price from the price list covering the check-in date, for the given parking type. */
  async calculateCost(checkIn: string, checkOut: string, parkingType: ParkingType = "open_air"): Promise<number> {
    // Parameter names must match the DB function definition exactly.
    const { data, error } = await this.supabase.rpc("calculate_total_cost", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_parking_type: parkingType,
    });

    if (error) {
      throw asPriceListError(error.message) ?? new Error(`Failed to calculate reservation cost: ${error.message}`);
    }
    if (data === null || data === undefined) {
      throw new Error("Failed to calculate reservation cost");
    }

    return Number(data);
  }

  /**
   * Preview price including the travel agency discount (current agency value — the DB
   * snapshots it on assignment and stays authoritative).
   */
  async quoteCost(
    checkIn: string,
    checkOut: string,
    parkingType: ParkingType = "open_air",
    travelAgencyId?: string | null
  ): Promise<CostQuote> {
    const baseCost = await this.calculateCost(checkIn, checkOut, parkingType);
    if (!travelAgencyId) return { baseCost, discountPct: 0, totalCost: baseCost };

    const { data: agency, error } = await this.supabase
      .from("travel_agencies")
      .select("discount_pct, archived_at")
      .eq("id", travelAgencyId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch travel agency: ${error.message}`);
    if (!agency || agency.archived_at) throw new TravelAgencyUnavailableError();

    const discountPct = Number(agency.discount_pct);
    return { baseCost, discountPct, totalCost: applyAgencyDiscount(baseCost, discountPct) };
  }

  /**
   * Creates a new reservation from an external source (e.g. public website).
   * Validates input, checks parking availability, and calculates total cost.
   *
   * @param command - The reservation details from external source
   * @returns The ID of the created reservation
   * @throws Error if parking is full or other business rules are violated
   */
  async createExternalReservation(command: CreateExternalReservationCommand): Promise<string> {
    // Parse and validate input
    const validatedData = await createExternalReservationSchema.parseAsync(command);

    // Check parking availability
    const checkIn = new Date(validatedData.checkInDate);
    const checkOut = new Date(validatedData.checkOutDate);

    // Get total parking spots from settings table
    const { data: settings, error: settingsError } = await this.supabase
      .from("settings")
      .select("value")
      .eq("key", "total_parking_spots")
      .maybeSingle();

    // Default value if setting doesn't exist or error occurs
    let totalSpots = 100;

    if (settingsError) {
      console.warn("Error fetching total_parking_spots setting:", settingsError.message);
      // Use default value instead of throwing error
    } else if (settings && settings.value !== null && settings.value !== undefined) {
      // Parse value from JSONB (value is stored as JSONB, e.g. "100" or 100)
      const parsedValue = typeof settings.value === "string" ? parseInt(settings.value, 10) : Number(settings.value);

      if (!isNaN(parsedValue) && parsedValue > 0) {
        totalSpots = parsedValue;
      } else {
        console.warn("Invalid total_parking_spots setting value, using default 100");
      }
    } else {
      console.warn("total_parking_spots setting not found, using default 100");
    }

    // Check occupancy for each day in the range
    const { data: occupancy } = await this.supabase
      .from("daily_occupancy")
      .select("date, occupied_spots")
      .gte("date", checkIn.toISOString().split("T")[0])
      .lte("date", checkOut.toISOString().split("T")[0])
      .order("date");

    if (occupancy) {
      for (const day of occupancy) {
        if (day.occupied_spots >= totalSpots) {
          throw new Error(`No available parking spots for date ${day.date}`);
        }
      }
    }

    // External (website) reservations are always regular open-air parking.
    const costData = await this.calculateCost(validatedData.checkInDate, validatedData.checkOutDate, "open_air");

    // Admin client: external requests are anonymous, and both get_system_user
    // (not executable by anon) and the INSERT must bypass RLS.
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new Error("Admin client not available. Please configure SUPABASE_SERVICE_ROLE_KEY.");
    }

    // Get system user ID for audit fields
    const { data: systemUserId, error: systemUserError } = await adminClient.rpc("get_system_user");
    if (systemUserError || !systemUserId) {
      throw new Error(`Failed to get system user: ${systemUserError?.message || "Unknown error"}`);
    }

    // Map command to database schema
    const reservationData = {
      last_name: validatedData.lastName,
      first_name: validatedData.firstName,
      email: validatedData.email,
      phone: validatedData.phone,
      license_plate: validatedData.licensePlate ?? null,
      planned_check_in: validatedData.checkInDate,
      planned_check_out: validatedData.checkOutDate,
      source: "api" as const,
      total_cost: costData,
      created_by: systemUserId,
      last_modified_by: systemUserId,
    };

    // Insert reservation using admin client (bypasses RLS)
    const { data: reservation, error } = await adminClient
      .from("reservations")
      .insert(reservationData)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create reservation: ${error.message}`);
    }

    return reservation.id;
  }

  /**
   * Creates a new reservation through internal API endpoints (staff use).
   * Validates input data and creates reservation with audit fields.
   *
   * @param command - The reservation details from internal API
   * @returns The created reservation object
   * @throws Error if validation fails or database operation fails
   */
  async createReservation(command: CreateReservationCommand, userId?: string): Promise<ReservationDto> {
    // Validate input data
    const { garage_spot_id: requestedSpotId, ...validatedData } = await createReservationSchema.parseAsync(command);

    // Calculate total cost if not provided — the price list row follows the requested parking type.
    // Agency reservations are always priced by the DB (price list − agency discount), so a
    // client total is ignored; the base price is computed here only to surface NO_PRICE_LIST early.
    let totalCost = validatedData.travel_agency_id ? undefined : validatedData.total_cost;
    if (!totalCost) {
      totalCost = await this.calculateCost(
        validatedData.planned_check_in,
        validatedData.planned_check_out,
        validatedData.parking_type
      );
    }

    // Get user ID for audit fields (use provided userId or system user)
    let auditUserId: string;
    if (userId) {
      auditUserId = userId;
    } else {
      const { data: systemUserId, error: systemUserError } = await this.supabase.rpc("get_system_user");
      if (systemUserError || !systemUserId) {
        throw new Error(`Failed to get system user: ${systemUserError?.message || "Unknown error"}`);
      }
      auditUserId = systemUserId;
    }

    // Prepare reservation data for database insertion
    const reservationData = {
      ...validatedData,
      total_cost: totalCost as number, // Always calculated or provided
      created_by: auditUserId,
      last_modified_by: auditUserId,
    };

    // Use admin client for INSERT operation to bypass RLS
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new Error("Admin client not available. Please configure SUPABASE_SERVICE_ROLE_KEY.");
    }

    // Insert reservation into database using admin client (bypasses RLS)
    const { data: reservation, error } = await adminClient
      .from("reservations")
      .insert(reservationData)
      .select()
      .single();

    if (error) {
      throw asPricingError(error.message) ?? new Error(`Failed to create reservation: ${error.message}`);
    }

    if (isCoveredParkingType(validatedData.parking_type)) {
      try {
        const allocationService = new GarageAllocationService(adminClient);
        const spotId = await pickGarageSpot(
          allocationService,
          validatedData.parking_type,
          reservation.planned_check_in,
          reservation.planned_check_out,
          requestedSpotId
        );
        await allocationService.assign(reservation.id, spotId, requestedSpotId ? "staff" : "system");
      } catch (allocationError) {
        // Roll back the reservation — a garage request that can't be fulfilled must not leave an orphaned row.
        await adminClient.from("reservations").delete().eq("id", reservation.id);
        throw allocationError;
      }
    }

    return reservation;
  }

  /**
   * TEMPORARY (go-live migration): registers a car that was parked before ParkTrack
   * went live. The real arrival date is unknown/irrelevant, so check-in is set to now.
   * Inserted straight as `in_progress` so it appears on the departures list and can be
   * checked out normally. Open-air only — no garage allocation.
   */
  async createLegacyDeparture(command: CreateLegacyDepartureCommand, userId?: string): Promise<ReservationDto> {
    const data = await createLegacyDepartureSchema.parseAsync(command);
    const checkIn = new Date().toISOString();

    const totalCost = data.total_cost ?? (await this.calculateCost(checkIn, data.planned_check_out));

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new Error("Admin client not available. Please configure SUPABASE_SERVICE_ROLE_KEY.");
    }

    let auditUserId = userId;
    if (!auditUserId) {
      const { data: systemUserId, error: systemUserError } = await adminClient.rpc("get_system_user");
      if (systemUserError || !systemUserId) {
        throw new Error(`Failed to get system user: ${systemUserError?.message || "Unknown error"}`);
      }
      auditUserId = systemUserId as string;
    }

    const marker = "[Migracja] Samochód na parkingu przed wdrożeniem systemu";
    const { data: reservation, error } = await adminClient
      .from("reservations")
      .insert({
        last_name: data.last_name,
        first_name: data.first_name || null,
        phone: data.phone || null,
        license_plate: data.license_plate || null,
        notes: data.notes
          ? `${marker}
${data.notes}`
          : marker,
        flight_direction: data.flight_direction || null,
        parking_sector: data.parking_sector || null,
        passenger_count: data.passenger_count ?? null,
        planned_check_in: checkIn,
        planned_check_out: data.planned_check_out,
        actual_check_in: checkIn,
        status: "in_progress" as const,
        source: "walk_in" as const,
        parking_type: "open_air" as const,
        total_cost: totalCost,
        // Paid unless marked otherwise — flag survives the is_paid sync at departure.
        paid_at_arrival: !data.unpaid,
        is_paid: !data.unpaid,
        created_by: auditUserId,
        last_modified_by: auditUserId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create reservation: ${error.message}`);
    }

    return reservation;
  }

  /**
   * Updates an existing reservation with partial data.
   * Validates input data and performs an update operation on the database.
   *
   * @param id - The UUID of the reservation to update
   * @param command - The partial update data for the reservation
   * @returns The updated reservation object
   * @throws Error if validation fails, reservation not found, or database operation fails
   */
  async updateReservation(id: string, command: UpdateReservationCommand): Promise<ReservationDto> {
    // Validate input data
    const { garage_spot_id: requestedSpotId, ...validatedData } = await updateReservationSchema.parseAsync(command);
    let allocationService: GarageAllocationService | null = null;

    // Spot change, decided up front before anything is written:
    // - parking type change (allowed in any status): the old garage/carport spot no longer
    //   matches, so it is released and — for a stay that still needs a spot — the requested
    //   (or first free) spot of the new type is assigned;
    // - same covered type, another spot requested: the reservation moves to that spot.
    // - status leaves / re-enters the active set (cancel, no-show, restore): the spot is released,
    //   or a free one is assigned again.
    let spotChange: { previousType: ParkingType | null; previousStatus: string; spotId: string | null } | null = null;

    if (
      validatedData.status ||
      validatedData.planned_check_in ||
      validatedData.planned_check_out ||
      validatedData.parking_type ||
      requestedSpotId ||
      validatedData.keys_left !== undefined
    ) {
      allocationService = new GarageAllocationService(this.supabase);
      const { data: current, error: currentError } = await this.supabase
        .from("reservations")
        .select("planned_check_in, planned_check_out, parking_type, status, keys_left")
        .eq("id", id)
        .single();

      if (currentError || !current) {
        throw new Error(`Reservation with ID ${id} not found`);
      }

      // Keys are physically handed over at arrival, so the flag only changes while the car is parked.
      if (
        validatedData.keys_left !== undefined &&
        validatedData.keys_left !== current.keys_left &&
        current.status !== "in_progress"
      ) {
        throw new KeysLeftNotEditableError();
      }

      const nextCheckIn = validatedData.planned_check_in ?? current.planned_check_in;
      const nextCheckOut = validatedData.planned_check_out ?? current.planned_check_out;
      const nextStatus = validatedData.status ?? current.status;
      const nextType = validatedData.parking_type ?? current.parking_type;
      const needsSpot = isCoveredParkingType(nextType) && ACTIVE_STAY_STATUSES.includes(nextStatus);

      const wasActive = ACTIVE_STAY_STATUSES.includes(current.status);
      const willBeActive = ACTIVE_STAY_STATUSES.includes(nextStatus);

      if (nextType !== current.parking_type) {
        const spotId = needsSpot
          ? await pickGarageSpot(allocationService, nextType, nextCheckIn, nextCheckOut, requestedSpotId, id)
          : null;
        spotChange = { previousType: current.parking_type as ParkingType, previousStatus: current.status, spotId };
      } else if (wasActive && !willBeActive) {
        spotChange = { previousType: null, previousStatus: current.status, spotId: null };
      } else if (!wasActive && willBeActive && needsSpot) {
        const spotId = await pickGarageSpot(
          allocationService,
          nextType,
          nextCheckIn,
          nextCheckOut,
          requestedSpotId,
          id
        );
        spotChange = { previousType: null, previousStatus: current.status, spotId };
      } else if (requestedSpotId && needsSpot && requestedSpotId !== (await allocationService.activeSpotId(id))) {
        const spotId = await pickGarageSpot(
          allocationService,
          nextType,
          nextCheckIn,
          nextCheckOut,
          requestedSpotId,
          id
        );
        spotChange = { previousType: null, previousStatus: current.status, spotId };
      } else if (validatedData.planned_check_in || validatedData.planned_check_out) {
        // If planned dates are changing, re-validate the 10h garage buffer before writing —
        // an edit must not be able to silently break the invariant `assign`/`swap` enforce.
        await allocationService.revalidateAssignment(id, nextCheckIn, nextCheckOut);
      }
    }

    // Perform update operation
    const { data: reservation, error } = await this.supabase
      .from("reservations")
      .update(validatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found/updated
        throw new Error(`Reservation with ID ${id} not found`);
      }
      // The cost trigger re-prices on date/parking type changes and raises when no list covers the date.
      throw asPricingError(error.message) ?? new Error(`Failed to update reservation: ${error.message}`);
    }

    if (spotChange && allocationService) {
      const releasedSpotId = await allocationService.release(id);
      if (spotChange.spotId) {
        try {
          await allocationService.assign(id, spotChange.spotId, "staff");
        } catch (allocationError) {
          // Spot was taken in the meantime — restore the previous type (the trigger re-prices back)
          // and the previous spot.
          if (spotChange.previousType) {
            await this.supabase.from("reservations").update({ parking_type: spotChange.previousType }).eq("id", id);
          }
          // A failed restore must not leave the reservation active without a spot.
          if (!ACTIVE_STAY_STATUSES.includes(spotChange.previousStatus)) {
            await this.supabase.from("reservations").update({ status: spotChange.previousStatus }).eq("id", id);
          }
          if (releasedSpotId) await allocationService.assign(id, releasedSpotId, "staff").catch(() => undefined);
          throw allocationError;
        }
      }
    }

    return reservation;
  }

  /**
   * Staff dashboard arrivals: Warsaw today (or the next 12h, whichever reaches further)
   * plus any earlier confirmed arrivals that have not been checked in yet.
   */
  async getTodaysArrivals(now: Date = new Date()): Promise<ReservationDto[]> {
    const upper = pendingWindowEndIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select("*")
      .eq("status", "confirmed")
      .lt("planned_check_in", upper)
      .order("planned_check_in", { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to fetch today's arrivals: ${error.message}`);
    }

    return (data as ReservationDto[]) || [];
  }

  /**
   * Staff dashboard departures: Warsaw today (or the next 12h, whichever reaches further)
   * plus delayed in-progress returns that have not been checked out yet.
   */
  async getTodaysDepartures(now: Date = new Date()): Promise<DepartureListItem[]> {
    const upper = pendingWindowEndIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select("*")
      .eq("status", "in_progress")
      .lt("planned_check_out", upper)
      .order("planned_check_out", { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to fetch today's departures: ${error.message}`);
    }

    return enrichDepartures((data as ReservationDto[]) || [], now);
  }

  /**
   * Distinct free-text flight directions already stored on reservations.
   * Used as suggestions while still allowing a new value to be typed.
   */
  async listFlightDirections(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("reservations")
      .select("flight_direction")
      .not("flight_direction", "is", null)
      .neq("flight_direction", "")
      .limit(5000);

    if (error) {
      throw new Error(`Failed to fetch flight directions: ${error.message}`);
    }

    return uniqueFlightDirections((data ?? []).map((row) => row.flight_direction));
  }

  /**
   * Deletes an existing reservation by its ID.
   * Performs a delete operation on the database.
   *
   * @param id - The UUID of the reservation to delete
   * @returns Object indicating success or failure of the operation
   * @throws Error if database operation fails
   */
  async deleteReservation(id: string): Promise<{ success: boolean; error?: string }> {
    // Perform delete operation and select the deleted row to check if it existed
    const { error } = await this.supabase.from("reservations").delete().eq("id", id).select().single();

    if (error) {
      // Check for "not found" error (PGRST116 is the code for no rows found)
      if (error.code === "PGRST116") {
        return { success: false, error: "Not Found" };
      }
      throw new Error(`Failed to delete reservation: ${error.message}`);
    }

    return { success: true };
  }
}
