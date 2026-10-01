import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgencyMonthRowDto, AgencyMonthSummaryDto, InvoiceDto } from "../../types";
import { addUtcMonths, warsawDateKey } from "../calendar/warsaw-time";
import type { BillingMonth } from "../schemas/agency-billing.schema";

/** Base class for business-rule refusals when issuing an agency invoice. */
export class AgencyInvoiceRuleError extends Error {
  constructor(
    message: string,
    readonly code:
      | "MONTH_NOT_CLOSED"
      | "BLOCKING_RESERVATIONS"
      | "ALREADY_INVOICED"
      | "NOTHING_TO_INVOICE"
      | "AGENCY_NOT_FOUND"
  ) {
    super(message);
    this.name = "AgencyInvoiceRuleError";
  }
}

const RULE_MESSAGES: Record<AgencyInvoiceRuleError["code"], string> = {
  MONTH_NOT_CLOSED: "Miesiąc jeszcze trwa — fakturę wystawisz po jego zakończeniu",
  BLOCKING_RESERVATIONS: "Są rezerwacje bez potwierdzonego przyjazdu — rozstrzygnij je przed wystawieniem faktury",
  ALREADY_INVOICED: "Faktura za ten miesiąc została już wystawiona",
  NOTHING_TO_INVOICE: "Brak zrealizowanych rezerwacji do zafakturowania w tym miesiącu",
  AGENCY_NOT_FOUND: "Biuro podróży nie istnieje",
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** `YYYY-MM` of the month containing `now` in Warsaw, and whether (year, month) has ended. */
export function isBillingMonthClosed({ year, month }: BillingMonth, now: Date = new Date()): boolean {
  const nextMonthStart = addUtcMonths(`${year}-${String(month).padStart(2, "0")}-01`, 1);
  return warsawDateKey(now) >= nextMonthStart;
}

/** Previous Warsaw month — the natural default for month-end invoicing. */
export function previousBillingMonth(now: Date = new Date()): string {
  return addUtcMonths(warsawDateKey(now), -1).slice(0, 7);
}

/**
 * Monthly travel-agency billing. Categorisation, VAT split and issuing live in Postgres
 * (`agency_month_summary`, `create_agency_invoice`); this service shapes the results.
 */
export class AgencyBillingService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getMonthSummary(
    agencyId: string,
    period: BillingMonth,
    now: Date = new Date()
  ): Promise<AgencyMonthSummaryDto> {
    const { data, error } = await this.supabase.rpc("agency_month_summary", {
      p_agency_id: agencyId,
      p_year: period.year,
      p_month: period.month,
    });
    if (error) throw new Error(`Failed to fetch agency month summary: ${error.message}`);

    const rows = ((data ?? []) as AgencyMonthRowDto[]).map((row) => ({
      ...row,
      total_cost: Number(row.total_cost),
      net_amount: row.net_amount === null ? null : Number(row.net_amount),
      vat_amount: row.vat_amount === null ? null : Number(row.vat_amount),
      gross_amount: row.gross_amount === null ? null : Number(row.gross_amount),
    }));

    const invoiceable = rows.filter((row) => row.category === "invoiceable");
    const sum = (key: "net_amount" | "vat_amount" | "gross_amount") =>
      round2(invoiceable.reduce((total, row) => total + (row[key] ?? 0), 0));

    const { data: existing, error: invoiceError } = await this.supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("travel_agency_id", agencyId)
      .eq("billing_year", period.year)
      .eq("billing_month", period.month)
      .maybeSingle();
    if (invoiceError) throw new Error(`Failed to fetch agency invoice: ${invoiceError.message}`);

    return {
      month: `${period.year}-${String(period.month).padStart(2, "0")}`,
      rows,
      totals: { net: sum("net_amount"), vat: sum("vat_amount"), gross: sum("gross_amount") },
      counts: {
        invoiceable: invoiceable.length,
        blocking: rows.filter((row) => row.category === "blocking").length,
        excluded: rows.filter((row) => row.category === "excluded").length,
        invoiced: rows.filter((row) => row.category === "invoiced").length,
      },
      monthClosed: isBillingMonthClosed(period, now),
      invoice: existing ? { id: existing.id, invoice_number: existing.invoice_number } : null,
    };
  }

  /** Agency invoices, newest billing period first. */
  async listInvoices(agencyId: string): Promise<InvoiceDto[]> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*, items:invoice_items(*)")
      .eq("travel_agency_id", agencyId)
      .order("billing_year", { ascending: false })
      .order("billing_month", { ascending: false });
    if (error) throw new Error(`Failed to fetch agency invoices: ${error.message}`);
    return (data ?? []) as InvoiceDto[];
  }

  /** Issues the monthly invoice; returns its id. Rule refusals throw AgencyInvoiceRuleError. */
  async issueInvoice(agencyId: string, period: BillingMonth): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_agency_invoice", {
      p_agency_id: agencyId,
      p_year: period.year,
      p_month: period.month,
    });

    if (error) {
      const code = (Object.keys(RULE_MESSAGES) as AgencyInvoiceRuleError["code"][]).find((key) =>
        error.message?.includes(key)
      );
      if (code) throw new AgencyInvoiceRuleError(RULE_MESSAGES[code], code);
      if (error.code === "23505") throw new AgencyInvoiceRuleError(RULE_MESSAGES.ALREADY_INVOICED, "ALREADY_INVOICED");
      throw new Error(`Failed to issue agency invoice: ${error.message}`);
    }

    return data as string;
  }
}
