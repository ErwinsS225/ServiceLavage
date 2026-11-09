-- Initial owner-only station model. Employee invitations and operational data
-- are intentionally not enabled until their authorization model is implemented.
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index stations_owner_id_idx on public.stations(owner_id);
alter table public.stations enable row level security;
create policy "Owners can read their stations" on public.stations for select to authenticated using (owner_id = auth.uid());
create policy "Owners can create stations" on public.stations for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners can update their stations" on public.stations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update on public.stations to authenticated;
