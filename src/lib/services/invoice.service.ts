import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceDto, CreateInvoiceCommand, InvoicesQueryParams } from "../../types";

/** Znaki rozdzielające filtry PostgREST — usuwane z frazy wyszukiwania. */
const POSTGREST_FILTER_CHARS = /[,()]/g;

/** Faktura wraz z pozycjami (PostgREST embed). */
const INVOICE_WITH_ITEMS = "*, items:invoice_items(*)";

export class ReservationNotFoundError extends Error {
  constructor(id: string) {
    super(`Reservation ${id} not found`);
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationNotCompletedError extends Error {
  constructor(id: string) {
    super(`Reservation ${id} is not completed`);
    this.name = "ReservationNotCompletedError";
  }
}

export class DuplicateInvoiceError extends Error {
  constructor(reservationId: string) {
    super(`Invoice already exists for reservation ${reservationId}`);
    this.name = "DuplicateInvoiceError";
  }
}

/** Pozycje w kolejności na fakturze (embed PostgREST nie gwarantuje kolejności). */
function withSortedItems(row: unknown): InvoiceDto {
  const invoice = row as InvoiceDto;
  return { ...invoice, items: [...(invoice.items ?? [])].sort((a, b) => a.position - b.position) };
}

export class AgencyReservationInvoiceError extends Error {
  constructor(reservationId: string) {
    super(`Reservation ${reservationId} is billed to a travel agency (monthly agency invoice)`);
    this.name = "AgencyReservationInvoiceError";
  }
}

export class InvoiceService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getByReservationId(reservationId: string): Promise<InvoiceDto | null> {
    const { data, error } = await this.supabase
      .from("invoice_items")
      .select("invoice_id")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
    return data ? this.getById(data.invoice_id) : null;
  }

  async list(params: InvoicesQueryParams): Promise<{ data: InvoiceDto[]; total: number }> {
    let query = this.supabase.from("invoices").select(INVOICE_WITH_ITEMS, { count: "exact" });

    const search = params.search.replace(POSTGREST_FILTER_CHARS, "").trim();
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,buyer_name.ilike.%${search}%`);
    }

    query = query.order(params.sortBy, { ascending: params.sortOrder === "asc" });

    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
    return { data: (data ?? []).map(withSortedItems), total: count ?? 0 };
  }

  async getById(id: string): Promise<InvoiceDto | null> {
    const { data, error } = await this.supabase.from("invoices").select(INVOICE_WITH_ITEMS).eq("id", id).maybeSingle();

    if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
    return data ? withSortedItems(data) : null;
  }

  /**
   * Wystawia fakturę indywidualną. Walidacja, numeracja (Europe/Warsaw, blokada per miesiąc)
   * i rozbicie VAT dzieją się atomowo w RPC `create_invoice`.
   */
  async create(cmd: CreateInvoiceCommand): Promise<InvoiceDto> {
    const { data: invoiceId, error } = await this.supabase.rpc("create_invoice", {
      p_reservation_id: cmd.reservation_id,
      p_buyer_name: cmd.buyer_name,
      p_buyer_nip: cmd.buyer_nip,
      p_buyer_address: cmd.buyer_address,
      p_buyer_email: cmd.buyer_email ?? undefined,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("RESERVATION_NOT_FOUND")) throw new ReservationNotFoundError(cmd.reservation_id);
      if (message.includes("RESERVATION_NOT_COMPLETED")) throw new ReservationNotCompletedError(cmd.reservation_id);
      if (message.includes("DUPLICATE_INVOICE")) throw new DuplicateInvoiceError(cmd.reservation_id);
      if (message.includes("RESERVATION_BILLED_TO_AGENCY")) throw new AgencyReservationInvoiceError(cmd.reservation_id);
      if (message.includes("NOT_AUTHENTICATED")) throw new Error("Not authenticated");
      throw new Error(`Failed to create invoice: ${message}`);
    }

    const invoice = await this.getById(invoiceId as string);
    if (!invoice) throw new Error("Failed to create invoice: created invoice not found");
    return invoice;
  }
}
