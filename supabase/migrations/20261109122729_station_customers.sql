-- Real customer records, isolated by station owner. No demo data is imported.
create table public.station_customers (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text not null check (length(trim(phone)) between 1 and 40),
  created_at timestamptz not null default now()
);
create index station_customers_station_created_idx on public.station_customers(station_id, created_at desc);
alter table public.station_customers enable row level security;
revoke all on public.station_customers from anon, authenticated;
grant select, insert on public.station_customers to authenticated;
grant update (name, phone) on public.station_customers to authenticated;
create policy "Owners read customers" on public.station_customers for select to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners create customers" on public.station_customers for insert to authenticated
  with check (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners update customers" on public.station_customers for update to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
