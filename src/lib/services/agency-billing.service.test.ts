import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AgencyBillingService,
  AgencyInvoiceRuleError,
  isBillingMonthClosed,
  previousBillingMonth,
} from "./agency-billing.service";
import { billingMonthSchema } from "../schemas/agency-billing.schema";

const AGENCY_ID = "11111111-1111-4111-8111-111111111111";
const AUGUST = { year: 2026, month: 8 };

function row(category: string, gross: number | null, net: number | null) {
  return {
    reservation_id: `r-${category}-${gross}`,
    last_name: "X",
    first_name: null,
    license_plate: null,
    planned_check_in: "2026-08-05T08:00:00Z",
    planned_check_out: "2026-08-08T08:00:00Z",
    status: "completed",
    actual_check_in: null,
    actual_check_out: null,
    parking_type: "open_air",
    total_cost: String(gross ?? 50),
    category,
    invoice_id: null,
    invoice_number: null,
    net_amount: net === null ? null : String(net),
    vat_amount: gross === null || net === null ? null : String(gross - net),
    gross_amount: gross === null ? null : String(gross),
  };
}

function supabaseWith(rpcResult: { data: unknown; error: unknown }, invoice: unknown = null) {
  const invoiceBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: invoice, error: null }),
  };
  return { rpc: vi.fn().mockResolvedValue(rpcResult), from: vi.fn(() => invoiceBuilder) };
}

describe("billing month helpers (Europe/Warsaw)", () => {
  it("parses YYYY-MM and rejects anything else", () => {
    expect(billingMonthSchema.parse("2026-08")).toEqual(AUGUST);
    expect(billingMonthSchema.safeParse("2026-13").success).toBe(false);
    expect(billingMonthSchema.safeParse("2026-8").success).toBe(false);
  });

  it("closes a month at Warsaw midnight, not UTC", () => {
    // 31 Aug 23:30 Warsaw = 21:30 UTC → still August
    expect(isBillingMonthClosed(AUGUST, new Date("2026-08-31T21:30:00Z"))).toBe(false);
    // 1 Sep 00:30 Warsaw = 22:30 UTC on 31 Aug → August closed
    expect(isBillingMonthClosed(AUGUST, new Date("2026-08-31T22:30:00Z"))).toBe(true);
  });

  it("defaults to the previous Warsaw month, across the year boundary", () => {
    expect(previousBillingMonth(new Date("2026-09-29T10:00:00Z"))).toBe("2026-08");
    expect(previousBillingMonth(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12"); // 1 Jan 00:30 Warsaw
    expect(previousBillingMonth(new Date("2027-01-15T10:00:00Z"))).toBe("2026-12");
  });
});

describe("AgencyBillingService.getMonthSummary", () => {
  it("totals only invoiceable rows and counts categories", async () => {
    const supabase = supabaseWith({
      data: [
        row("invoiceable", 30, 24.39),
        row("invoiceable", 10, 8.13),
        row("blocking", null, null),
        row("excluded", null, null),
      ],
      error: null,
    });
    const summary = await new AgencyBillingService(supabase as unknown as SupabaseClient).getMonthSummary(
      AGENCY_ID,
      AUGUST,
      new Date("2026-09-29T10:00:00Z")
    );

    expect(supabase.rpc).toHaveBeenCalledWith("agency_month_summary", {
      p_agency_id: AGENCY_ID,
      p_year: 2026,
      p_month: 8,
    });
    expect(summary.totals).toEqual({ net: 32.52, vat: 7.48, gross: 40 });
    expect(summary.counts).toEqual({ invoiceable: 2, blocking: 1, excluded: 1, invoiced: 0 });
    expect(summary.monthClosed).toBe(true);
    expect(summary.month).toBe("2026-08");
    expect(summary.invoice).toBeNull();
  });

  it("reports an already issued invoice", async () => {
    const supabase = supabaseWith({ data: [], error: null }, { id: "inv-1", invoice_number: "FV/2026/09/004" });
    const summary = await new AgencyBillingService(supabase as unknown as SupabaseClient).getMonthSummary(
      AGENCY_ID,
      AUGUST
    );
    expect(summary.invoice).toEqual({ id: "inv-1", invoice_number: "FV/2026/09/004" });
  });
});

describe("AgencyBillingService.issueInvoice", () => {
  it.each([
    ["MONTH_NOT_CLOSED: 2026-9", "MONTH_NOT_CLOSED"],
    ["BLOCKING_RESERVATIONS: 1", "BLOCKING_RESERVATIONS"],
    ["ALREADY_INVOICED: 2026-8", "ALREADY_INVOICED"],
    ["NOTHING_TO_INVOICE: 2026-8", "NOTHING_TO_INVOICE"],
  ])("maps %s to a rule error with a Polish message", async (message, code) => {
    const supabase = supabaseWith({ data: null, error: { message, code: "P0001" } });
    const promise = new AgencyBillingService(supabase as unknown as SupabaseClient).issueInvoice(AGENCY_ID, AUGUST);
    await expect(promise).rejects.toBeInstanceOf(AgencyInvoiceRuleError);
    await expect(promise).rejects.toMatchObject({ code });
  });

  it("maps a unique violation (concurrent issue) to ALREADY_INVOICED", async () => {
    const supabase = supabaseWith({ data: null, error: { message: "duplicate key", code: "23505" } });
    await expect(
      new AgencyBillingService(supabase as unknown as SupabaseClient).issueInvoice(AGENCY_ID, AUGUST)
    ).rejects.toMatchObject({ code: "ALREADY_INVOICED" });
  });

  it("returns the new invoice id", async () => {
    const supabase = supabaseWith({ data: "inv-9", error: null });
    await expect(
      new AgencyBillingService(supabase as unknown as SupabaseClient).issueInvoice(AGENCY_ID, AUGUST)
    ).resolves.toBe("inv-9");
    expect(supabase.rpc).toHaveBeenCalledWith("create_agency_invoice", {
      p_agency_id: AGENCY_ID,
      p_year: 2026,
      p_month: 8,
    });
  });
});
