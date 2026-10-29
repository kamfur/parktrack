import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarageOptimizationSuggestionDto } from "../../types";
import { GARAGE_BUFFER_MS } from "./garage-allocation.service";

export interface OptimizationAssignmentWindow {
  reservationLastName: string;
  checkIn: Date;
  checkOut: Date;
}

export interface OptimizationSpot {
  spotId: string;
  spotName: string;
  /** Active assignments for this spot, in any order. */
  assignments: OptimizationAssignmentWindow[];
}

interface Gap {
  start: Date;
  end: Date;
  durationMs: number;
}

/** The largest idle gap between two consecutive assignments on a spot, or null if fewer than 2. */
function largestGap(assignments: OptimizationAssignmentWindow[]): Gap | null {
  const sorted = [...assignments].sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  let best: Gap | null = null;

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i].checkOut;
    const end = sorted[i + 1].checkIn;
    const durationMs = end.getTime() - start.getTime();
    if (!best || durationMs > best.durationMs) {
      best = { start, end, durationMs };
    }
  }

  return best;
}

/** True when moving `assignment` into `gap` would still keep the 10h buffer on both sides. */
function fitsWithBuffer(assignment: OptimizationAssignmentWindow, gap: Gap): boolean {
  const earliestCheckIn = gap.start.getTime() + GARAGE_BUFFER_MS;
  const latestCheckOut = gap.end.getTime() - GARAGE_BUFFER_MS;
  return assignment.checkIn.getTime() >= earliestCheckIn && assignment.checkOut.getTime() <= latestCheckOut;
}

function formatDurationHours(durationMs: number): string {
  return `${Math.round(durationMs / (60 * 60 * 1000))}h`;
}

function formatTime(date: Date): string {
  return date.toISOString();
}

/**
 * Pure idle-gap heuristic: for each spot, find its largest idle gap; if another
 * spot has a reservation that would fit inside that gap (keeping the buffer),
 * describe moving it there. No auto-apply — descriptions only.
 */
export function computeGarageOptimizationSuggestions(spots: OptimizationSpot[]): GarageOptimizationSuggestionDto[] {
  const suggestions: GarageOptimizationSuggestionDto[] = [];

  for (const targetSpot of spots) {
    const gap = largestGap(targetSpot.assignments);
    // A gap no larger than the mandatory buffer isn't "downtime" — it's the buffer itself.
    if (!gap || gap.durationMs <= GARAGE_BUFFER_MS) continue;

    let movable: { fromSpotName: string; assignment: OptimizationAssignmentWindow } | null = null;
    for (const otherSpot of spots) {
      if (otherSpot.spotId === targetSpot.spotId) continue;
      const candidate = otherSpot.assignments.find((assignment) => fitsWithBuffer(assignment, gap));
      if (candidate) {
        movable = { fromSpotName: otherSpot.spotName, assignment: candidate };
        break;
      }
    }

    if (!movable) continue;

    suggestions.push({
      garageSpotId: targetSpot.spotId,
      description:
        `Spot "${targetSpot.spotName}" is idle for ${formatDurationHours(gap.durationMs)} between ` +
        `${formatTime(gap.start)} and ${formatTime(gap.end)}. Consider moving ` +
        `${movable.assignment.reservationLastName}'s reservation from "${movable.fromSpotName}" here to reduce downtime.`,
    });
  }

  return suggestions;
}

interface ActiveAssignmentJoinRow {
  garage_spot_id: string;
  reservations: { last_name: string; planned_check_in: string; planned_check_out: string } | null;
}

/** Fetches garage spots and their active assignments, then applies the pure heuristic. */
export class GarageOptimizationService {
  constructor(private readonly supabase: SupabaseClient) {}

  async suggestOptimizations(): Promise<GarageOptimizationSuggestionDto[]> {
    const { data: spots, error: spotsError } = await this.supabase
      .from("garage_spots")
      .select("id, name")
      .order("name", { ascending: true });

    if (spotsError) {
      throw new Error(`Failed to fetch garage spots: ${spotsError.message}`);
    }

    const { data: assignments, error: assignmentsError } = await this.supabase
      .from("garage_assignments")
      .select("garage_spot_id, reservations!inner(last_name, planned_check_in, planned_check_out)")
      .is("superseded_at", null);

    if (assignmentsError) {
      throw new Error(`Failed to fetch garage assignments: ${assignmentsError.message}`);
    }

    const rows = (assignments ?? []) as unknown as ActiveAssignmentJoinRow[];

    const optimizationSpots: OptimizationSpot[] = (spots ?? []).map((spot) => ({
      spotId: spot.id,
      spotName: spot.name,
      assignments: rows
        .filter((row) => row.garage_spot_id === spot.id && row.reservations !== null)
        .map((row) => ({
          reservationLastName: row.reservations?.last_name ?? "",
          checkIn: new Date(row.reservations?.planned_check_in ?? 0),
          checkOut: new Date(row.reservations?.planned_check_out ?? 0),
        })),
    }));

    return computeGarageOptimizationSuggestions(optimizationSpots);
  }
}
