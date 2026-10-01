import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("./garage-allocation.service", () => ({
  GarageAllocationService: vi.fn(),
  GarageBufferViolationError: class GarageBufferViolationError extends Error {},
}));

import {
  ReservationService,
  KeysLeftNotEditableError,
  NoGarageAvailableError,
  NoPriceListError,
  ReservationInvoicedError,
  TravelAgencyUnavailableError,
} from "./reservation.service";
import { createSupabaseAdminClient } from "../supabase-admin";
import { GarageAllocationService, GarageBufferViolationError } from "./garage-allocation.service";

const SPOT_B = "22222222-2222-4222-8222-222222222222";

function mockListClient() {
  const result = { data: [{ id: "r1" }], error: null };
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(builder),
    builder,
  };
}

describe("ReservationService dashboard lists", () => {
  it("getTodaysArrivals includes overdue plus Warsaw today confirmed arrivals", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    const now = new Date("2026-09-09T10:00:00Z");
    const rows = await service.getTodaysArrivals(now);

    expect(client.from).toHaveBeenCalledWith("reservations");
    expect(client.builder.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_in", "2026-09-09T22:00:00.000Z");
    expect(client.builder.order).toHaveBeenCalledWith("planned_check_in", { ascending: true });
    expect(rows).toEqual([{ id: "r1" }]);
  });

  it("getTodaysArrivals looks 12h ahead in the evening (customers after midnight)", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    await service.getTodaysArrivals(new Date("2026-09-09T18:00:00Z"));

    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_in", "2026-09-10T06:00:00.000Z");
  });

  it("getTodaysDepartures includes delayed plus Warsaw today in-progress returns", async () => {
    const client = mockListClient();
    const service = new ReservationService(client as never);
    const now = new Date("2026-09-09T10:00:00Z");
    await service.getTodaysDepartures(now);

    expect(client.builder.eq).toHaveBeenCalledWith("status", "in_progress");
    expect(client.builder.lt).toHaveBeenCalledWith("planned_check_out", "2026-09-09T22:00:00.000Z");
    expect(client.builder.order).toHaveBeenCalledWith("planned_check_out", { ascending: true });
  });
});

describe("ReservationService.listFlightDirections", () => {
  it("returns unique saved destinations", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { flight_direction: "Londyn" },
        { flight_direction: "londyn" },
        { flight_direction: "Dortmund" },
        { flight_direction: "departure" },
      ],
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({ limit }),
          }),
        }),
      }),
    };
    const service = new ReservationService(client as never);

    await expect(service.listFlightDirections()).resolves.toEqual(["Dortmund", "Londyn"]);
    expect(client.from).toHaveBeenCalledWith("reservations");
  });
});

describe("ReservationService.createReservation — garage auto-assign", () => {
  const insertedReservation = {
    id: "r1",
    planned_check_in: "2026-09-02T00:00:00Z",
    planned_check_out: "2026-09-02T08:00:00Z",
    parking_type: "garage",
  };

  function mockAdminClient() {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    return {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedReservation, error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: deleteEq,
      }),
      deleteEq,
    };
  }

  beforeEach(() => {
    vi.mocked(GarageAllocationService).mockClear();
  });

  it("auto-assigns a garage spot when parking_type is 'garage'", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const listAvailableSpots = vi.fn().mockResolvedValue([{ id: "spot-1" }]);
    const assign = vi.fn().mockResolvedValue({ id: "assignment-1" });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots, assign };
    } as never);

    const service = new ReservationService({} as never);
    const result = await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "garage",
      },
      "user-1"
    );

    expect(listAvailableSpots).toHaveBeenCalledWith(
      insertedReservation.planned_check_in,
      insertedReservation.planned_check_out,
      "garage",
      undefined
    );
    expect(assign).toHaveBeenCalledWith("r1", "spot-1", "system");
    expect(result).toEqual(insertedReservation);
  });

  it("assigns the chosen garage spot when it is free", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const listAvailableSpots = vi.fn().mockResolvedValue([{ id: "spot-1" }, { id: SPOT_B }]);
    const assign = vi.fn().mockResolvedValue({ id: "assignment-1" });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots, assign };
    } as never);

    await new ReservationService({} as never).createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "garage",
        garage_spot_id: SPOT_B,
      },
      "user-1"
    );

    expect(assign).toHaveBeenCalledWith("r1", SPOT_B, "staff");
  });

  it("rejects a chosen spot that is taken, and deletes the orphaned reservation", async () => {
    const adminClient = mockAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminClient as never);

    const assign = vi.fn();
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots: vi.fn().mockResolvedValue([{ id: "spot-1" }]), assign };
    } as never);

    await expect(
      new ReservationService({} as never).createReservation(
        {
          last_name: "Kowalski",
          planned_check_in: "2026-09-02T00:00:00Z",
          planned_check_out: "2026-09-02T08:00:00Z",
          source: "phone",
          total_cost: 100,
          parking_type: "carport",
          garage_spot_id: SPOT_B,
        },
        "user-1"
      )
    ).rejects.toThrow("Wybrana wiata jest zajęta w tym terminie");
    expect(assign).not.toHaveBeenCalled();
    expect(adminClient.deleteEq).toHaveBeenCalledWith("id", "r1");
  });

  it("auto-assigns only a carport spot when parking_type is 'carport'", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const listAvailableSpots = vi.fn().mockResolvedValue([{ id: "spot-2" }]);
    const assign = vi.fn().mockResolvedValue({ id: "assignment-2" });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots, assign };
    } as never);

    const service = new ReservationService({} as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "carport",
      },
      "user-1"
    );

    expect(listAvailableSpots).toHaveBeenCalledWith(expect.any(String), expect.any(String), "carport", undefined);
    expect(assign).toHaveBeenCalledWith("r1", "spot-2", "system");
  });

  it("throws NoGarageAvailableError when no spot is available within the buffer, and deletes the orphaned reservation", async () => {
    const adminClient = mockAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminClient as never);

    const listAvailableSpots = vi.fn().mockResolvedValue([]);
    const assign = vi.fn();
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots, assign };
    } as never);

    const service = new ReservationService({} as never);

    await expect(
      service.createReservation(
        {
          last_name: "Kowalski",
          planned_check_in: "2026-09-02T00:00:00Z",
          planned_check_out: "2026-09-02T08:00:00Z",
          source: "phone",
          total_cost: 100,
          parking_type: "garage",
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(NoGarageAvailableError);

    expect(assign).not.toHaveBeenCalled();
    expect(adminClient.deleteEq).toHaveBeenCalledWith("id", "r1");
  });

  it("does not touch garage allocation for a regular (open_air) reservation", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockAdminClient() as never);

    const service = new ReservationService({} as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-02T08:00:00Z",
        source: "phone",
        total_cost: 100,
        parking_type: "open_air",
      },
      "user-1"
    );

    expect(GarageAllocationService).not.toHaveBeenCalled();
  });
});

describe("ReservationService pricing", () => {
  it("prices a reservation without total_cost from the price list row for its parking type", async () => {
    const insert = vi.fn().mockReturnThis();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
      }),
    } as never);
    const rpc = vi.fn().mockResolvedValue({ data: 180, error: null });
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { listAvailableSpots: vi.fn().mockResolvedValue([{ id: "spot-1" }]), assign: vi.fn() };
    } as never);

    const service = new ReservationService({ rpc } as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-05T00:00:00Z",
        source: "phone",
        parking_type: "carport",
      },
      "user-1"
    );

    expect(rpc).toHaveBeenCalledWith("calculate_total_cost", {
      p_check_in: "2026-09-02T00:00:00Z",
      p_check_out: "2026-09-05T00:00:00Z",
      p_parking_type: "carport",
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ total_cost: 180, parking_type: "carport" }));
  });

  it("throws NoPriceListError when no price list covers the check-in date", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "NO_PRICE_LIST: no price list for open_air on 2030-01-01" },
    });
    const service = new ReservationService({ rpc } as never);

    await expect(service.calculateCost("2030-01-01T10:00:00Z", "2030-01-03T10:00:00Z")).rejects.toBeInstanceOf(
      NoPriceListError
    );
  });
});

describe("ReservationService.updateReservation — garage buffer revalidation", () => {
  function mockClient(currentReservation: unknown, updatedReservation: unknown) {
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: currentReservation, error: null }) // fetch current dates
      .mockResolvedValueOnce({ data: updatedReservation, error: null }); // update().select().single()
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };
  }

  beforeEach(() => {
    vi.mocked(GarageAllocationService).mockClear();
  });

  it("re-validates the buffer when planned dates change, and proceeds when it passes", async () => {
    const current = { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" };
    const updated = { id: "r1", planned_check_out: "2026-09-02T10:00:00Z" };
    const client = mockClient(current, updated);

    const revalidateAssignment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { revalidateAssignment };
    } as never);

    const service = new ReservationService(client as never);
    const result = await service.updateReservation("r1", { planned_check_out: "2026-09-02T10:00:00Z" });

    expect(revalidateAssignment).toHaveBeenCalledWith("r1", current.planned_check_in, "2026-09-02T10:00:00Z");
    expect(result).toEqual(updated);
  });

  it("propagates GarageBufferViolationError when the new dates would break the buffer", async () => {
    const current = { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" };
    const client = mockClient(current, {});

    const revalidateAssignment = vi.fn().mockRejectedValue(new GarageBufferViolationError());
    vi.mocked(GarageAllocationService).mockImplementation(function () {
      return { revalidateAssignment };
    } as never);

    const service = new ReservationService(client as never);

    await expect(service.updateReservation("r1", { planned_check_out: "2026-09-02T10:00:00Z" })).rejects.toBeInstanceOf(
      GarageBufferViolationError
    );
  });

  it("does not touch garage allocation when planned dates are not part of the update", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1", notes: "updated" }, error: null }),
      }),
    };

    const service = new ReservationService(client as never);
    await service.updateReservation("r1", { notes: "updated" });

    expect(GarageAllocationService).not.toHaveBeenCalled();
  });

  describe("parking type change", () => {
    const current = {
      planned_check_in: "2026-09-02T00:00:00Z",
      planned_check_out: "2026-09-05T00:00:00Z",
      parking_type: "open_air",
      status: "in_progress",
    };

    function mockAllocation(spot: { id: string } | null) {
      const allocation = {
        listAvailableSpots: vi.fn().mockResolvedValue(spot ? [spot] : []),
        release: vi.fn().mockResolvedValue("old-spot"),
        assign: vi.fn().mockResolvedValue({}),
        revalidateAssignment: vi.fn(),
        activeSpotId: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(GarageAllocationService).mockImplementation(function () {
        return allocation;
      } as never);
      return allocation;
    }

    it("assigns a spot of the new covered type, even for an in-progress stay", async () => {
      const client = mockClient(current, { id: "r1", parking_type: "garage" });
      const allocation = mockAllocation({ id: "g1" });

      await new ReservationService(client as never).updateReservation("r1", { parking_type: "garage" });

      expect(allocation.listAvailableSpots).toHaveBeenCalledWith(
        current.planned_check_in,
        current.planned_check_out,
        "garage",
        "r1"
      );
      expect(allocation.release).toHaveBeenCalledWith("r1");
      expect(allocation.assign).toHaveBeenCalledWith("r1", "g1", "staff");
      expect(allocation.revalidateAssignment).not.toHaveBeenCalled();
    });

    it("rejects before writing when no spot of the new type is free", async () => {
      const client = mockClient(current, {});
      const allocation = mockAllocation(null);

      await expect(
        new ReservationService(client as never).updateReservation("r1", { parking_type: "carport" })
      ).rejects.toBeInstanceOf(NoGarageAvailableError);
      expect(allocation.release).not.toHaveBeenCalled();
    });

    it("only releases the old spot when switching to open air", async () => {
      const client = mockClient({ ...current, parking_type: "garage" }, { id: "r1", parking_type: "open_air" });
      const allocation = mockAllocation(null);

      await new ReservationService(client as never).updateReservation("r1", { parking_type: "open_air" });

      expect(allocation.listAvailableSpots).not.toHaveBeenCalled();
      expect(allocation.release).toHaveBeenCalledWith("r1");
      expect(allocation.assign).not.toHaveBeenCalled();
    });

    it("uses the chosen spot of the new type", async () => {
      const client = mockClient(current, { id: "r1", parking_type: "carport" });
      const allocation = mockAllocation({ id: SPOT_B });

      await new ReservationService(client as never).updateReservation("r1", {
        parking_type: "carport",
        garage_spot_id: SPOT_B,
      });

      expect(allocation.assign).toHaveBeenCalledWith("r1", SPOT_B, "staff");
    });

    it("moves a garage stay to another chosen garage without changing the type", async () => {
      const client = mockClient({ ...current, parking_type: "garage" }, { id: "r1" });
      const allocation = mockAllocation({ id: SPOT_B });
      allocation.activeSpotId = vi.fn().mockResolvedValue("old-spot");

      await new ReservationService(client as never).updateReservation("r1", { garage_spot_id: SPOT_B });

      expect(allocation.release).toHaveBeenCalledWith("r1");
      expect(allocation.assign).toHaveBeenCalledWith("r1", SPOT_B, "staff");
    });

    it("keeps the assignment when the chosen spot is the current one", async () => {
      const client = mockClient({ ...current, parking_type: "garage" }, { id: "r1" });
      const allocation = mockAllocation({ id: SPOT_B });
      allocation.activeSpotId = vi.fn().mockResolvedValue(SPOT_B);

      await new ReservationService(client as never).updateReservation("r1", { garage_spot_id: SPOT_B });

      expect(allocation.release).not.toHaveBeenCalled();
      expect(allocation.assign).not.toHaveBeenCalled();
    });

    it("does not look for a spot for a finished stay", async () => {
      const client = mockClient({ ...current, status: "completed" }, { id: "r1", parking_type: "garage" });
      const allocation = mockAllocation(null);

      await new ReservationService(client as never).updateReservation("r1", { parking_type: "garage" });

      expect(allocation.listAvailableSpots).not.toHaveBeenCalled();
      expect(allocation.release).toHaveBeenCalledWith("r1");
      expect(allocation.assign).not.toHaveBeenCalled();
    });
  });
});

describe("ReservationService.updateReservation — keys left", () => {
  function mockClient(currentReservation: unknown) {
    const update = vi.fn().mockReturnThis();
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: currentReservation, error: null })
      .mockResolvedValueOnce({ data: { id: "r1", keys_left: true }, error: null });
    return {
      client: {
        from: vi
          .fn()
          .mockReturnValue({ select: vi.fn().mockReturnThis(), update, eq: vi.fn().mockReturnThis(), single }),
      },
      update,
    };
  }

  it("saves the flag while the car is on the parking", async () => {
    const { client, update } = mockClient({ status: "in_progress", keys_left: false });

    await new ReservationService(client as never).updateReservation("r1", { keys_left: true });

    expect(update).toHaveBeenCalledWith({ keys_left: true });
  });

  it("rejects a change before arrival or after departure", async () => {
    for (const status of ["confirmed", "completed"]) {
      const { client, update } = mockClient({ status, keys_left: false });

      await expect(
        new ReservationService(client as never).updateReservation("r1", { keys_left: true })
      ).rejects.toBeInstanceOf(KeysLeftNotEditableError);
      expect(update).not.toHaveBeenCalled();
    }
  });

  it("accepts an unchanged flag in any status (full-form resubmits)", async () => {
    const { client, update } = mockClient({ status: "completed", keys_left: true });

    await new ReservationService(client as never).updateReservation("r1", { keys_left: true });

    expect(update).toHaveBeenCalled();
  });
});

describe("ReservationService — travel agency pricing", () => {
  const AGENCY_ID = "11111111-1111-4111-8111-111111111111";

  function agencyClient(agency: { discount_pct: number; archived_at: string | null } | null) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: 50, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: agency, error: null }),
      }),
    };
  }

  it("quoteCost applies the agency discount to the price-list total", async () => {
    const service = new ReservationService(agencyClient({ discount_pct: 15, archived_at: null }) as never);
    await expect(
      service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z", "open_air", AGENCY_ID)
    ).resolves.toEqual({ baseCost: 50, discountPct: 15, totalCost: 42.5 });
  });

  it("quoteCost without an agency returns the full price", async () => {
    const service = new ReservationService(agencyClient(null) as never);
    await expect(service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z")).resolves.toEqual({
      baseCost: 50,
      discountPct: 0,
      totalCost: 50,
    });
  });

  it("quoteCost rejects an archived agency", async () => {
    const service = new ReservationService(agencyClient({ discount_pct: 15, archived_at: "2026-09-01" }) as never);
    await expect(
      service.quoteCost("2026-09-02T10:00:00Z", "2026-09-07T10:00:00Z", "open_air", AGENCY_ID)
    ).rejects.toBeInstanceOf(TravelAgencyUnavailableError);
  });

  it("createReservation ignores a client total for agency reservations (DB prices it)", async () => {
    const insert = vi.fn().mockReturnThis();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
      }),
    } as never);
    const rpc = vi.fn().mockResolvedValue({ data: 180, error: null });

    const service = new ReservationService({ rpc } as never);
    await service.createReservation(
      {
        last_name: "Kowalski",
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-05T00:00:00Z",
        source: "phone",
        total_cost: 1,
        travel_agency_id: AGENCY_ID,
      },
      "user-1"
    );

    expect(rpc).toHaveBeenCalledWith("calculate_total_cost", expect.anything());
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ total_cost: 180, travel_agency_id: AGENCY_ID }));
  });

  it("maps the AGENCY_ARCHIVED trigger error on create", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "AGENCY_ARCHIVED: x" } }),
      }),
    } as never);
    const service = new ReservationService({ rpc: vi.fn().mockResolvedValue({ data: 180, error: null }) } as never);

    await expect(
      service.createReservation(
        {
          last_name: "Kowalski",
          planned_check_in: "2026-09-02T00:00:00Z",
          planned_check_out: "2026-09-05T00:00:00Z",
          source: "phone",
          travel_agency_id: AGENCY_ID,
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(TravelAgencyUnavailableError);
  });
});

describe("ReservationService.updateReservation — invoice locks", () => {
  function failingUpdate(message: string, currentRow?: Record<string, unknown>) {
    const single = vi.fn();
    // A status change first reads the current row (garage spot bookkeeping), then writes.
    if (currentRow) single.mockResolvedValueOnce({ data: currentRow, error: null });
    single.mockResolvedValue({ data: null, error: { message, code: "P0001" } });
    return {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single,
      }),
    };
  }

  it("maps RESERVATION_INVOICED to a Polish ReservationInvoicedError naming the invoice", async () => {
    const service = new ReservationService(
      failingUpdate("RESERVATION_INVOICED: FV/2026/09/004", {
        planned_check_in: "2026-09-02T00:00:00Z",
        planned_check_out: "2026-09-05T00:00:00Z",
        parking_type: "open_air",
        status: "confirmed",
        keys_left: false,
      }) as never
    );
    const promise = service.updateReservation("r1", { status: "cancelled" });
    await expect(promise).rejects.toBeInstanceOf(ReservationInvoicedError);
    await expect(promise).rejects.toThrow("FV/2026/09/004");
  });

  it("maps AGENCY_MONTH_INVOICED to ReservationInvoicedError naming the month", async () => {
    const service = new ReservationService(failingUpdate("AGENCY_MONTH_INVOICED: 08/2026") as never);
    await expect(service.updateReservation("r1", { travel_agency_id: null })).rejects.toThrow("08/2026");
  });
});
