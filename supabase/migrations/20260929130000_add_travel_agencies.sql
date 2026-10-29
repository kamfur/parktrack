-- Migration: travel agencies (master data)
-- Affected: travel_agencies (new), invoices.travel_agency_id (FK)
-- Intent: agencies pay for their clients' stays and receive a monthly VAT invoice.
--         Staff-only; drivers have no access. An agency referenced by reservations
--         or invoices cannot be deleted (FK RESTRICT) — it is archived instead.

create table public.travel_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  nip text not null unique check (nip ~ '^[0-9]{10}$'),
  address text not null check (btrim(address) <> ''),
  email text null,
  phone text null,
  contact_person text null,
  notes text null,
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  payment_term_days integer not null default 14 check (payment_term_days >= 0 and payment_term_days <= 365),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.travel_agencies is
  'Travel agencies billed monthly for their clients'' reservations. archived_at not null = hidden from pickers.';
comment on column public.travel_agencies.nip is 'Normalised 10-digit NIP (checksum validated in the app).';
comment on column public.travel_agencies.discount_pct is 'Discount % off the price list; snapshotted on each reservation when assigned.';
comment on column public.travel_agencies.payment_term_days is 'Invoice due date = issue date + this many days.';

create trigger handle_updated_at
  before update on public.travel_agencies
  for each row
  execute function public.handle_updated_at();

alter table public.travel_agencies enable row level security;

create policy "Staff manage travel_agencies"
  on public.travel_agencies for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

alter table public.invoices
  add constraint invoices_travel_agency_id_fkey
  foreign key (travel_agency_id) references public.travel_agencies(id) on delete restrict;

create index invoices_travel_agency_id_idx on public.invoices (travel_agency_id) where travel_agency_id is not null;
