import type { APIRoute } from "astro";
import {
  NoGarageAvailableError,
  NoPriceListError,
  ReservationService,
  TravelAgencyUnavailableError,
} from "../../lib/services/reservation.service";
import { GarageBufferViolationError } from "../../lib/services/garage-allocation.service";
import type { CreateReservationCommand, UpdateReservationCommand, ReservationsListResponse } from "../../types";
import { createReservationSchema, updateReservationSchema } from "../../lib/schemas/reservation.schema";
import type { Database } from "../../db/database.types";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts raw UUID or PostgREST-style `eq.<uuid>` (used by the UI). */
function parseReservationId(raw: string | null): string | null {
  if (!raw) return null;
  const id = raw.startsWith("eq.") ? raw.slice(3) : raw;
  return UUID_REGEX.test(id) ? id : null;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const searchParams = url.searchParams;

    // Single reservation: GET /api/reservations?id=eq.<uuid>
    const idParam = searchParams.get("id");
    if (idParam) {
      const reservationId = parseReservationId(idParam);
      if (!reservationId) {
        return new Response(JSON.stringify({ error: "Invalid reservation ID format. Must be a valid UUID." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data, error } = await locals.supabase
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch reservation: ${error.message}`);
      }

      if (!data) {
        return new Response(JSON.stringify({ error: "Reservation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Budowanie zapytania Supabase
    let query = locals.supabase.from("reservations").select("*", { count: "exact" });

    // Filtrowanie po nazwisku (ilike)
    const search = searchParams.get("search");
    if (search && search.trim()) {
      query = query.ilike("last_name", `%${search.trim()}%`);
    }

    // Filtrowanie po statusie (in) - obsługa wielu wartości
    const statuses = searchParams.getAll("status");
    if (statuses.length > 0) {
      // Walidacja statusów przed użyciem
      const validStatuses: Database["public"]["Enums"]["reservation_status"][] = [];
      const allowedStatuses: Database["public"]["Enums"]["reservation_status"][] = [
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ];
      statuses.forEach((status) => {
        if (allowedStatuses.includes(status as Database["public"]["Enums"]["reservation_status"])) {
          validStatuses.push(status as Database["public"]["Enums"]["reservation_status"]);
        }
      });
      if (validStatuses.length > 0) {
        query = query.in("status", validStatuses);
      }
    }

    // Filtrowanie po źródle (eq)
    const source = searchParams.get("source");
    if (source) {
      const allowedSources: Database["public"]["Enums"]["reservation_source"][] = ["phone", "walk_in", "api"];
      if (allowedSources.includes(source as Database["public"]["Enums"]["reservation_source"])) {
        query = query.eq("source", source as Database["public"]["Enums"]["reservation_source"]);
      }
    }

    // Filtrowanie po biurze podróży (eq, UUID)
    const travelAgencyId = searchParams.get("travel_agency_id");
    if (travelAgencyId && UUID_REGEX.test(travelAgencyId)) {
      query = query.eq("travel_agency_id", travelAgencyId);
    }

    // Filtrowanie po datach
    const dateFrom = searchParams.get("date_from");
    if (dateFrom) {
      query = query.gte("planned_check_in", dateFrom);
    }

    const dateTo = searchParams.get("date_to");
    if (dateTo) {
      query = query.lte("planned_check_out", dateTo);
    }

    // Sortowanie
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";

    // Walidacja kolumny sortowania
    const allowedSortColumns = [
      "created_at",
      "last_name",
      "planned_check_in",
      "planned_check_out",
      "status",
      "total_cost",
    ];
    if (!allowedSortColumns.includes(sortBy)) {
      return new Response(JSON.stringify({ error: `Invalid sort column. Allowed: ${allowedSortColumns.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Walidacja kierunku sortowania
    if (sortOrder !== "asc" && sortOrder !== "desc") {
      return new Response(JSON.stringify({ error: "Invalid sort order. Must be 'asc' or 'desc'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Paginacja
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    // Walidacja paginacji
    if (page < 1) {
      return new Response(JSON.stringify({ error: "Page must be greater than 0" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowedLimits = [10, 25, 50, 100];
    if (!allowedLimits.includes(limit)) {
      return new Response(JSON.stringify({ error: `Invalid limit. Allowed: ${allowedLimits.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Wykonanie zapytania
    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch reservations: ${error.message}`);
    }

    // Zwrócenie odpowiedzi z metadanymi paginacji
    const response: ReservationsListResponse = {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Parse request body
    const body: CreateReservationCommand = await request.json();

    // Validate request data
    const validationResult = await createReservationSchema.safeParseAsync(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationResult.error.format(),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create reservation
    const service = new ReservationService(locals.supabase);
    const reservation = await service.createReservation(body);

    // Return success response
    return new Response(JSON.stringify(reservation), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating reservation:", error);

    // No price list covers the check-in date — staff must configure pricing in settings
    if (error instanceof NoPriceListError) {
      return new Response(JSON.stringify({ error: "Brak cennika obejmującego datę przyjazdu" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Travel agency archived or missing — pick an active agency
    if (error instanceof TravelAgencyUnavailableError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // No garage/carport spot available within the buffer, or a manual swap would violate it
    if (error instanceof NoGarageAvailableError || error instanceof GarageBufferViolationError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle database constraint violations (e.g., overbooking)
    if (
      (error instanceof Error && error.message.includes("duplicate key")) ||
      (error instanceof Error && error.message.includes("constraint"))
    ) {
      return new Response(JSON.stringify({ error: "Overbooking conflict or data constraint violation" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle other database errors
    if (error instanceof Error && error.message.includes("Failed to create reservation")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals, url }) => {
  try {
    // Parse and validate reservation ID from query parameters (supports id=eq.<uuid>)
    const reservationId = parseReservationId(url.searchParams.get("id"));
    if (!reservationId) {
      return new Response(
        JSON.stringify({
          error: url.searchParams.get("id")
            ? "Invalid reservation ID format. Must be a valid UUID."
            : "Reservation ID is required as query parameter 'id'",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: UpdateReservationCommand = await request.json();

    // Validate request data
    const validationResult = await updateReservationSchema.safeParseAsync(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationResult.error.format(),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update reservation
    const service = new ReservationService(locals.supabase);
    const reservation = await service.updateReservation(reservationId, body);

    // Return success response
    return new Response(JSON.stringify(reservation), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating reservation:", error);

    // No price list covers the check-in date — staff must configure pricing in settings
    if (error instanceof NoPriceListError) {
      return new Response(JSON.stringify({ error: "Brak cennika obejmującego datę przyjazdu" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Travel agency archived or missing — pick an active agency
    if (error instanceof TravelAgencyUnavailableError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Editing planned dates would violate the assigned garage's 10h buffer
    if (error instanceof GarageBufferViolationError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle reservation not found
    if (error instanceof Error && error.message.includes("not found")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle database constraint violations
    if (
      (error instanceof Error && error.message.includes("constraint")) ||
      (error instanceof Error && error.message.includes("duplicate key"))
    ) {
      return new Response(JSON.stringify({ error: "Update violates database constraints" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle validation errors from service
    if (error instanceof Error && error.message.includes("validation")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle database errors
    if (error instanceof Error && error.message.includes("Failed to update reservation")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ locals, url }) => {
  try {
    // Parse and validate reservation ID from query parameters (supports id=eq.<uuid>)
    const reservationId = parseReservationId(url.searchParams.get("id"));
    if (!reservationId) {
      return new Response(
        JSON.stringify({
          error: url.searchParams.get("id") ? "Invalid reservation ID format" : "Reservation ID is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Delete reservation
    const service = new ReservationService(locals.supabase);
    const result = await service.deleteReservation(reservationId);

    // Handle service response
    if (!result.success) {
      if (result.error === "Not Found") {
        return new Response(JSON.stringify({ error: "Reservation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Return success response - No Content
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting reservation:", error);

    // Handle database errors
    if (error instanceof Error && error.message.includes("Failed to delete reservation")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
