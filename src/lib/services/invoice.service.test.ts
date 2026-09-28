import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DuplicateInvoiceError,
  InvoiceService,
  ReservationNotCompletedError,
  ReservationNotFoundError,
} from "@/lib/services/invoice.service";
import type { CreateInvoiceCommand } from "@/types";

const CMD: CreateInvoiceCommand = {
  reservation_id: "r-1",
  buyer_name: "Jan Kowalski",
  buyer_nip: "1234567890",
  buyer_address: "ul. Testowa 1, Warszawa",
};

const INVOICE_ROW = {
  id: "inv-1",
  invoice_number: "FV/2026/09/001",
  total_amount: 250,
  total_net: 203.25,
  total_vat: 46.75,
  vat_rate: 23,
  items: [
    { id: "it-2", position: 2, reservation_id: "r-2" },
    { id: "it-1", position: 1, reservation_id: "r-1" },
  ],
};

// ---------------------------------------------------------------------------
// Mock builder factories
// ---------------------------------------------------------------------------

function makeMaybeSingleBuilder(result: { data: object | null; error: object | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function makeRpcSupabase(rpcResult: { data: unknown; error: { message: string; code?: string } | null }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn(() => makeMaybeSingleBuilder({ data: INVOICE_ROW, error: null })),
  };
}

describe("InvoiceService", () => {
  // ---------------------------------------------------------------------------
  // create(): delegates to the create_invoice RPC (numbering + VAT in the DB)
  // ---------------------------------------------------------------------------

  describe("create()", () => {
    it("calls create_invoice with the command and returns the stored invoice (Risk #1: amounts from DB)", async () => {
      const supabase = makeRpcSupabase({ data: "inv-1", error: null });
      const service = new InvoiceService(supabase as unknown as SupabaseClient);

      const result = await service.create({ ...CMD, buyer_email: "a@b.pl" });

      expect(supabase.rpc).toHaveBeenCalledWith("create_invoice", {
        p_reservation_id: "r-1",
        p_buyer_name: "Jan Kowalski",
        p_buyer_nip: "1234567890",
        p_buyer_address: "ul. Testowa 1, Warszawa",
        p_buyer_email: "a@b.pl",
      });
      expect(result.total_amount).toBe(250);
      expect(result.items.map((i) => i.position)).toEqual([1, 2]);
    });

    it.each([
      ["RESERVATION_NOT_FOUND: r-1", ReservationNotFoundError],
      ["RESERVATION_NOT_COMPLETED: r-1", ReservationNotCompletedError],
      ["DUPLICATE_INVOICE: r-1", DuplicateInvoiceError],
    ])("maps RPC error %s to a domain error (Risk #2)", async (message, ErrorClass) => {
      const service = new InvoiceService(
        makeRpcSupabase({ data: null, error: { message, code: "P0001" } }) as unknown as SupabaseClient
      );
      await expect(service.create(CMD)).rejects.toThrow(ErrorClass);
    });

    it("surfaces other RPC errors (Risk #4: constraint violation)", async () => {
      const service = new InvoiceService(
        makeRpcSupabase({
          data: null,
          error: {
            message: 'duplicate key value violates unique constraint "invoices_year_month_seq_key"',
            code: "23505",
          },
        }) as unknown as SupabaseClient
      );
      await expect(service.create(CMD)).rejects.toThrow(/duplicate/);
    });
  });

  // ---------------------------------------------------------------------------
  // getByReservationId(): looks up through invoice_items
  // ---------------------------------------------------------------------------

  describe("getByReservationId()", () => {
    it("resolves the invoice via invoice_items", async () => {
      const itemBuilder = makeMaybeSingleBuilder({ data: { invoice_id: "inv-1" }, error: null });
      const invoiceBuilder = makeMaybeSingleBuilder({ data: INVOICE_ROW, error: null });
      const supabase = {
        from: vi.fn((table: string) => (table === "invoice_items" ? itemBuilder : invoiceBuilder)),
      };

      const service = new InvoiceService(supabase as unknown as SupabaseClient);
      const result = await service.getByReservationId("r-1");

      expect(itemBuilder.eq).toHaveBeenCalledWith("reservation_id", "r-1");
      expect(invoiceBuilder.eq).toHaveBeenCalledWith("id", "inv-1");
      expect(result?.id).toBe("inv-1");
    });

    it("returns null when the reservation has no invoice line", async () => {
      const supabase = { from: vi.fn(() => makeMaybeSingleBuilder({ data: null, error: null })) };
      const service = new InvoiceService(supabase as unknown as SupabaseClient);
      expect(await service.getByReservationId("r-9")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // list(): wyszukiwanie, sortowanie, paginacja
  // ---------------------------------------------------------------------------

  describe("list()", () => {
    function makeListSupabase(result: { data: object[] | null; count: number | null; error: object | null }) {
      const builder = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(result),
      };

      return { supabase: { from: vi.fn().mockReturnValue(builder) }, builder };
    }

    const BASE_PARAMS = { search: "", sortBy: "created_at", sortOrder: "desc", page: 1, limit: 25 } as const;

    it("applies sorting and the page range, returning the total row count", async () => {
      const { supabase, builder } = makeListSupabase({ data: [{ id: "inv-1" }], count: 42, error: null });

      const service = new InvoiceService(supabase as unknown as SupabaseClient);
      const result = await service.list({ ...BASE_PARAMS, sortBy: "total_amount", sortOrder: "asc", page: 3 });

      expect(builder.order).toHaveBeenCalledWith("total_amount", { ascending: true });
      expect(builder.range).toHaveBeenCalledWith(50, 74);
      expect(builder.or).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [{ id: "inv-1", items: [] }], total: 42 });
    });

    it("strips PostgREST filter characters from the search term", async () => {
      const { supabase, builder } = makeListSupabase({ data: [], count: 0, error: null });

      const service = new InvoiceService(supabase as unknown as SupabaseClient);
      await service.list({ ...BASE_PARAMS, search: "Kowalski, (sp. z o.o.)" });

      expect(builder.or).toHaveBeenCalledWith(
        "invoice_number.ilike.%Kowalski sp. z o.o.%,buyer_name.ilike.%Kowalski sp. z o.o.%"
      );
    });

    it("throws when the query fails", async () => {
      const { supabase } = makeListSupabase({ data: null, count: null, error: { message: "boom" } });

      const service = new InvoiceService(supabase as unknown as SupabaseClient);
      await expect(service.list(BASE_PARAMS)).rejects.toThrow(/boom/);
    });
  });
});
