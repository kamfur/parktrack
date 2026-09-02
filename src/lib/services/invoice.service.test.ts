import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InvoiceService, ReservationNotCompletedError } from "@/lib/services/invoice.service";
import type { CreateInvoiceCommand } from "@/types";

const CMD: CreateInvoiceCommand = {
  reservation_id: "r-1",
  buyer_name: "Jan Kowalski",
  buyer_nip: "1234567890",
  buyer_address: "ul. Testowa 1, Warszawa",
};

const COMPLETED_RES = {
  id: "r-1",
  status: "completed",
  total_cost: 250,
  planned_check_in: "2026-09-01T10:00:00Z",
  planned_check_out: "2026-09-02T10:00:00Z",
  actual_check_in: null,
  actual_check_out: null,
};

// ---------------------------------------------------------------------------
// Mock builder factories
// ---------------------------------------------------------------------------

function makeSettingsBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { value: "dummy" }, error: null }),
  };
}

function makeReservationBuilder(reservation: object | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: reservation, error: null }),
  };
}

function makeSeqBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

function makeInsertBuilder(result: { data: object | null; error: object | null }) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function makeFullSupabase(insertResult: { data: object | null; error: object | null }) {
  let invoicesCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "reservations") return makeReservationBuilder(COMPLETED_RES);
      if (table === "settings") return makeSettingsBuilder();
      if (table === "invoices") {
        invoicesCallCount++;
        return invoicesCallCount === 1 ? makeSeqBuilder() : makeInsertBuilder(insertResult);
      }
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  };
}

// ---------------------------------------------------------------------------
// Risk #1: total_amount passthrough
// ---------------------------------------------------------------------------

describe("InvoiceService", () => {
  describe("create() — Risk #1: total_amount passthrough", () => {
    it("sets total_amount from reservation.total_cost (250) without recalculation", async () => {
      const insertResult = {
        data: {
          id: "inv-1",
          reservation_id: "r-1",
          invoice_number: "FV/2026/09/001",
          invoice_year: 2026,
          invoice_month: 9,
          invoice_seq: 1,
          seller_name: "dummy",
          seller_address: "dummy",
          seller_nip: "dummy",
          seller_bank_account: "dummy",
          buyer_name: "Jan Kowalski",
          buyer_nip: "1234567890",
          buyer_address: "ul. Testowa 1, Warszawa",
          buyer_email: null,
          total_amount: 250,
          days_count: 1,
          daily_rate_snapshot: 0,
          created_at: "2026-09-01T00:00:00Z",
          created_by: "user-1",
        },
        error: null,
      };

      const service = new InvoiceService(makeFullSupabase(insertResult) as unknown as SupabaseClient);
      vi.spyOn(service, "getByReservationId").mockResolvedValue(null);

      const result = await service.create(CMD);
      expect(result.total_amount).toBe(250);
    });
  });

  // ---------------------------------------------------------------------------
  // Risk #2: completed-only guard
  // ---------------------------------------------------------------------------

  describe("create() — Risk #2: completed-only guard", () => {
    it.each([["confirmed"], ["in_progress"], ["cancelled"], ["no_show"]])(
      "throws ReservationNotCompletedError for status: %s",
      async (status) => {
        const supabase = {
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "r-1", status, total_cost: 100 }, error: null }),
          }),
          auth: { getUser: vi.fn() },
        };

        const service = new InvoiceService(supabase as unknown as SupabaseClient);
        await expect(service.create(CMD)).rejects.toThrow(ReservationNotCompletedError);
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Risk #4: constraint violation surfaces
  // ---------------------------------------------------------------------------

  describe("create() — Risk #4: constraint violation surfaces", () => {
    it("throws Error when insert returns a unique-constraint violation", async () => {
      const insertResult = {
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint "invoices_invoice_number_key"',
          code: "23505",
        },
      };

      const service = new InvoiceService(makeFullSupabase(insertResult) as unknown as SupabaseClient);
      vi.spyOn(service, "getByReservationId").mockResolvedValue(null);

      await expect(service.create(CMD)).rejects.toThrow(/duplicate/);
    });
  });
});
