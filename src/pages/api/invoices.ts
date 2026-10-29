import type { APIRoute } from "astro";
import { z } from "zod";
import { createInvoiceSchema, invoicesListQuerySchema } from "../../lib/schemas/invoice.schema";
import type { InvoicesListResponse } from "../../types";
import {
  InvoiceService,
  ReservationNotFoundError,
  ReservationNotCompletedError,
  DuplicateInvoiceError,
  AgencyReservationInvoiceError,
} from "../../lib/services/invoice.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

export const GET: APIRoute = async ({ url, locals }) => {
  const reservationId = url.searchParams.get("reservation_id");

  // Bez reservation_id zwracamy stronicowaną listę faktur
  if (reservationId === null) {
    const parsedQuery = invoicesListQuerySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsedQuery.success) {
      return new Response(JSON.stringify({ error: "Validation failed", details: parsedQuery.error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { search, sort_by, sort_order, page, limit } = parsedQuery.data;

    try {
      const service = new InvoiceService(locals.supabase);
      const { data, total } = await service.list({
        search,
        sortBy: sort_by,
        sortOrder: sort_order,
        page,
        limit,
      });

      const response: InvoicesListResponse = {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!uuidSchema.safeParse(reservationId).success) {
    return new Response(JSON.stringify({ error: "reservation_id query param must be a valid UUID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new InvoiceService(locals.supabase);
    const invoice = await service.getByReservationId(reservationId);

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(invoice), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new InvoiceService(locals.supabase);
    const invoice = await service.create(parsed.data);

    return new Response(JSON.stringify(invoice), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof ReservationNotFoundError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (err instanceof ReservationNotCompletedError || err instanceof AgencyReservationInvoiceError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (err instanceof DuplicateInvoiceError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
