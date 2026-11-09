-- RLS does not apply to TRUNCATE; explicitly revoke default table grants.
revoke all privileges on table public.stations from public, anon, authenticated;
grant select on table public.stations to authenticated;
grant insert (owner_id, name) on table public.stations to authenticated;
grant update (name) on table public.stations to authenticated;
