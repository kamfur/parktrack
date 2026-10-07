import { beforeEach, describe, expect, it, vi } from "vitest";

const createReservation = vi.fn();
const confirmArrival = vi.fn();

vi.mock("./reservation.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reservation.service")>();
  return {
    ...actual,
    ReservationService: class {
      createReservation = createReservation;
    },
  };
});

vi.mock("./driver.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./driver.service")>();
  return {
    ...actual,
    DriverService: class {
      confirmArrival = confirmArrival;
    },
  };
});

const { createWalkInArrival } = await import("./walk-in-arrival.service");
const { DriverServiceError } = await import("./driver.service");

const NOW = new Date("2026-09-30T08:00:00.000Z");
const supabase = {} as Parameters<typeof createWalkInArrival>[0];
const VALID = {
  last_name: "Kowalski",
  license_plate: "WX12345",
  planned_check_out: "2026-10-05T10:00:00.000Z",
  parking_type: "open_air" as const,
  passenger_count: 2,
  parking_sector: "A12",
  paid_at_arrival: true,
  keys_left: true,
};

describe("createWalkInArrival", () => {
  beforeEach(() => {
    createReservation.mockReset();
    confirmArrival.mockReset();
  });

  it("creates a walk-in reservation starting now and confirms the arrival at the same instant", async () => {
    createReservation.mockResolvedValue({ id: "r1" });
    confirmArrival.mockResolvedValue({ id: "r1", status: "in_progress" });

    const result = await createWalkInArrival(supabase, VALID, "driver-1", NOW);

    expect(result).toEqual({ id: "r1", status: "in_progress" });
    expect(createReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        last_name: "Kowalski",
        license_plate: "WX12345",
        planned_check_in: NOW.toISOString(),
        planned_check_out: VALID.planned_check_out,
        source: "walk_in",
      }),
      "driver-1"
    );
    expect(confirmArrival).toHaveBeenCalledWith("r1", {
      actual_check_in: NOW.toISOString(),
      passenger_count: 2,
      parking_sector: "A12",
      paid_at_arrival: true,
      keys_left: true,
    });
  });

  it("books the chosen garage spot for covered parking and drops the open-air sector", async () => {
    createReservation.mockResolvedValue({ id: "r1" });
    confirmArrival.mockResolvedValue({ id: "r1", status: "in_progress" });
    const spotId = "7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b";

    await createWalkInArrival(supabase, { ...VALID, parking_type: "garage", garage_spot_id: spotId }, "driver-1", NOW);

    expect(createReservation).toHaveBeenCalledWith(
      expect.objectContaining({ parking_type: "garage", garage_spot_id: spotId }),
      "driver-1"
    );
    expect(confirmArrival).toHaveBeenCalledWith("r1", expect.objectContaining({ parking_sector: null }));
  });

  it("ignores a garage spot sent for open-air parking", async () => {
    createReservation.mockResolvedValue({ id: "r1" });
    confirmArrival.mockResolvedValue({ id: "r1", status: "in_progress" });

    await createWalkInArrival(
      supabase,
      { ...VALID, garage_spot_id: "7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b" },
      "driver-1",
      NOW
    );

    expect(createReservation).toHaveBeenCalledWith(expect.objectContaining({ garage_spot_id: undefined }), "driver-1");
  });

  it("rejects a planned departure that is not in the future, before creating anything", async () => {
    await expect(
      createWalkInArrival(supabase, { ...VALID, planned_check_out: NOW.toISOString() }, "driver-1", NOW)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("reports a created-but-not-accepted reservation when the confirmation fails", async () => {
    createReservation.mockResolvedValue({ id: "r1" });
    confirmArrival.mockRejectedValue(new Error("boom"));

    const error = await createWalkInArrival(supabase, VALID, "driver-1", NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriverServiceError);
    expect((error as Error).message).toMatch(/przyjmij ją z listy/);
  });
});
