import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceDto, CreateInvoiceCommand, InvoicesQueryParams } from "../../types";

/** Znaki rozdzielające filtry PostgREST — usuwane z frazy wyszukiwania. */
const POSTGREST_FILTER_CHARS = /[,()]/g;

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

export class InvoiceService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getByReservationId(reservationId: string): Promise<InvoiceDto | null> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
    return data as InvoiceDto | null;
  }

  async list(params: InvoicesQueryParams): Promise<{ data: InvoiceDto[]; total: number }> {
    let query = this.supabase.from("invoices").select("*", { count: "exact" });

    const search = params.search.replace(POSTGREST_FILTER_CHARS, "").trim();
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,buyer_name.ilike.%${search}%`);
    }

    query = query.order(params.sortBy, { ascending: params.sortOrder === "asc" });

    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
    return { data: (data ?? []) as InvoiceDto[], total: count ?? 0 };
  }

  async getById(id: string): Promise<InvoiceDto | null> {
    const { data, error } = await this.supabase.from("invoices").select("*").eq("id", id).maybeSingle();

    if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
    return data as InvoiceDto | null;
  }

  async create(cmd: CreateInvoiceCommand): Promise<InvoiceDto> {
    // 1. Fetch reservation
    const { data: reservation, error: resError } = await this.supabase
      .from("reservations")
      .select("*")
      .eq("id", cmd.reservation_id)
      .maybeSingle();

    if (resError) throw new Error(`Failed to fetch reservation: ${resError.message}`);
    if (!reservation) throw new ReservationNotFoundError(cmd.reservation_id);
    if (reservation.status !== "completed") throw new ReservationNotCompletedError(cmd.reservation_id);

    // 2. Check for duplicate
    const existing = await this.getByReservationId(cmd.reservation_id);
    if (existing) throw new DuplicateInvoiceError(cmd.reservation_id);

    // 3. Fetch seller settings + daily_rate + auth user in parallel
    const [sellerNameRes, sellerAddressRes, sellerNipRes, sellerBankRes, dailyRateRes, userRes] = await Promise.all([
      this.supabase.from("settings").select("value").eq("key", "seller_name").maybeSingle(),
      this.supabase.from("settings").select("value").eq("key", "seller_address").maybeSingle(),
      this.supabase.from("settings").select("value").eq("key", "seller_nip").maybeSingle(),
      this.supabase.from("settings").select("value").eq("key", "seller_bank_account").maybeSingle(),
      this.supabase.from("settings").select("value").eq("key", "daily_rate").maybeSingle(),
      this.supabase.auth.getUser(),
    ]);

    const parseStr = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
    const seller_name = parseStr(sellerNameRes.data?.value);
    const seller_address = parseStr(sellerAddressRes.data?.value);
    const seller_nip = parseStr(sellerNipRes.data?.value);
    const seller_bank_account = parseStr(sellerBankRes.data?.value);
    const daily_rate_snapshot = Number(dailyRateRes.data?.value ?? 0);

    const created_by = userRes.data.user?.id;
    if (!created_by) throw new Error("Not authenticated");

    // 4. Calculate days_count from actual timestamps; fall back to planned
    let days_count: number;
    if (reservation.actual_check_in && reservation.actual_check_out) {
      const ms = new Date(reservation.actual_check_out).getTime() - new Date(reservation.actual_check_in).getTime();
      days_count = Math.max(1, Math.ceil(ms / 86400000));
    } else {
      const ms = new Date(reservation.planned_check_out).getTime() - new Date(reservation.planned_check_in).getTime();
      days_count = Math.max(1, Math.ceil(ms / 86400000));
    }

    // 5. Get next monthly sequence number
    const now = new Date();
    const invoice_year = now.getFullYear();
    const invoice_month = now.getMonth() + 1;

    const { data: seqData, error: seqError } = await this.supabase
      .from("invoices")
      .select("invoice_seq")
      .eq("invoice_year", invoice_year)
      .eq("invoice_month", invoice_month)
      .order("invoice_seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seqError) throw new Error(`Failed to get invoice sequence: ${seqError.message}`);
    const invoice_seq = (seqData?.invoice_seq ?? 0) + 1;

    // 6. Build invoice number
    const invoice_number = `FV/${invoice_year}/${String(invoice_month).padStart(2, "0")}/${String(invoice_seq).padStart(3, "0")}`;

    // 7. Insert invoice row
    const { data: invoice, error: insertError } = await this.supabase
      .from("invoices")
      .insert({
        reservation_id: cmd.reservation_id,
        invoice_number,
        invoice_year,
        invoice_month,
        invoice_seq,
        seller_name,
        seller_address,
        seller_nip,
        seller_bank_account,
        buyer_name: cmd.buyer_name,
        buyer_nip: cmd.buyer_nip,
        buyer_address: cmd.buyer_address,
        buyer_email: cmd.buyer_email ?? null,
        total_amount: reservation.total_cost,
        days_count,
        daily_rate_snapshot,
        created_by,
      })
      .select()
      .single();

    if (insertError) throw new Error(`Failed to create invoice: ${insertError.message}`);
    return invoice as InvoiceDto;
  }
}
