import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const buyerSchema = z.object({
  buyer_name: z.string().min(1, "Nazwa nabywcy jest wymagana"),
  buyer_nip: z.string().min(1, "NIP jest wymagany"),
  buyer_address: z.string().min(1, "Adres jest wymagany"),
  buyer_email: z.string().email("Nieprawidłowy adres e-mail").optional().or(z.literal("")),
});

type BuyerFormData = z.infer<typeof buyerSchema>;

interface ReservationSummary {
  lastName: string;
  firstName: string | null;
  plannedCheckIn: string;
  plannedCheckOut: string;
  totalCost: number;
}

interface InvoiceFormProps {
  reservationId: string;
  reservationSummary: ReservationSummary;
}

export function InvoiceForm({ reservationId, reservationSummary }: InvoiceFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }, [redirectUrl]);

  const form = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      buyer_name: "",
      buyer_nip: "",
      buyer_address: "",
      buyer_email: "",
    },
  });

  const { isSubmitting } = form.formState;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatCost = (cost: number) => cost.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

  const onSubmit = async (data: BuyerFormData) => {
    setApiError(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservation_id: reservationId,
        buyer_name: data.buyer_name,
        buyer_nip: data.buyer_nip,
        buyer_address: data.buyer_address,
        buyer_email: data.buyer_email || undefined,
      }),
    });

    if (res.status === 201) {
      const invoice = await res.json();
      setRedirectUrl(`/faktury/${invoice.id}/druk`);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setApiError(body.error ?? "Błąd podczas generowania faktury");
  };

  const fullName = reservationSummary.firstName
    ? `${reservationSummary.firstName} ${reservationSummary.lastName}`
    : reservationSummary.lastName;

  return (
    <div className="max-w-lg">
      <div className="mb-6 p-4 bg-muted/30 rounded-lg text-sm space-y-1">
        <p className="font-medium">{fullName}</p>
        <p className="text-muted-foreground">
          {formatDate(reservationSummary.plannedCheckIn)} — {formatDate(reservationSummary.plannedCheckOut)}
        </p>
        <p className="font-semibold">{formatCost(reservationSummary.totalCost)}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="buyer_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Nazwa nabywcy <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Firma Sp. z o.o." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="buyer_nip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  NIP <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="1234567890" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="buyer_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Adres <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ul. Przykładowa 1, 00-001 Warszawa" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="buyer_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail (opcjonalnie)</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="firma@example.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Generowanie…" : "Generuj fakturę"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
