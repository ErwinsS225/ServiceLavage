-- Service catalogue for each station; prices are whole XOF, with no demo data.
create table public.station_services (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  price_xof integer not null check (price_xof between 0 and 100000000),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index station_services_station_created_idx on public.station_services(station_id, created_at desc);
alter table public.station_services enable row level security;
revoke all on public.station_services from anon, authenticated;
grant select, insert on public.station_services to authenticated;
grant update (name, price_xof, duration_minutes, is_active) on public.station_services to authenticated;
create policy "Owners read services" on public.station_services for select to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners create services" on public.station_services for insert to authenticated
  with check (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners update services" on public.station_services for update to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
