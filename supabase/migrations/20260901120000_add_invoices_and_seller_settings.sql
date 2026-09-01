-- Create invoices table
CREATE TABLE public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  CONSTRAINT unique_invoice_per_reservation UNIQUE (reservation_id),
  invoice_number text NOT NULL UNIQUE,
  invoice_year integer NOT NULL,
  invoice_month integer NOT NULL,
  invoice_seq integer NOT NULL,
  seller_name text NOT NULL,
  seller_address text NOT NULL,
  seller_nip text NOT NULL,
  seller_bank_account text NOT NULL,
  buyer_name text NOT NULL,
  buyer_nip text NOT NULL,
  buyer_address text NOT NULL,
  buyer_email text,
  total_amount numeric(10,2) NOT NULL,
  days_count integer NOT NULL,
  daily_rate_snapshot numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed seller settings rows
INSERT INTO public.settings (key, value, description, updated_by) VALUES
  ('seller_name',         '""', 'Nazwa firmy (sprzedawca na fakturze)',    get_system_user()),
  ('seller_address',      '""', 'Adres firmy (sprzedawca)',                get_system_user()),
  ('seller_nip',          '""', 'NIP firmy (sprzedawca)',                  get_system_user()),
  ('seller_bank_account', '""', 'Numer konta bankowego (sprzedawca)',      get_system_user())
ON CONFLICT (key) DO NOTHING;
