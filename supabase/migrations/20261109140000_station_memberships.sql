-- Owner-controlled membership foundation. Existing operational RLS remains
-- owner-only until a separate, tested role-permission migration is deployed.
create table public.station_memberships (
  station_id uuid not null references public.stations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('gerant', 'caissier', 'laveur')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (station_id, user_id)
);
create index station_memberships_user_idx on public.station_memberships(user_id);
create table public.station_invitations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  role text not null check (role in ('gerant', 'caissier', 'laveur')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz
);
create index station_invitations_station_idx on public.station_invitations(station_id, created_at desc);
alter table public.station_memberships enable row level security;
alter table public.station_invitations enable row level security;
revoke all on public.station_memberships, public.station_invitations from public, anon, authenticated;
grant select on public.station_memberships, public.station_invitations to authenticated;
create policy "Owners and members read memberships" on public.station_memberships for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners read invitations" on public.station_invitations for select to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));

create function public.create_station_invitation(p_station_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := lower(btrim(p_email));
begin
  if auth.uid() is null or not exists (select 1 from public.stations where id = p_station_id and owner_id = auth.uid()) then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
     or p_role is null or p_role not in ('gerant', 'caissier', 'laveur') then
    raise exception 'Adresse ou rôle invalide' using errcode = '22023';
  end if;
  insert into public.station_invitations(station_id, email, role) values (p_station_id, v_email, p_role) returning id into v_id;
  return v_id;
end $$;

create function public.accept_station_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_email text; v_inv public.station_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select lower(btrim(email)) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Adresse e-mail confirmée requise' using errcode = '42501'; end if;
  select * into v_inv from public.station_invitations where id = p_invitation_id for update;
  if not found or v_inv.email <> v_email or v_inv.accepted_at is not null or v_inv.cancelled_at is not null or v_inv.expires_at <= now() then
    raise exception 'Invitation invalide ou expirée' using errcode = '42501';
  end if;
  if exists (select 1 from public.stations where id = v_inv.station_id and owner_id = auth.uid()) then
    raise exception 'Le propriétaire ne peut pas accepter cette invitation' using errcode = '22023';
  end if;
  -- Never allow a stale or second invitation to change a member's role.
  if exists (select 1 from public.station_memberships where station_id = v_inv.station_id and user_id = auth.uid()) then
    raise exception 'Une adhésion existe déjà pour cette station' using errcode = '22023';
  end if;
  insert into public.station_memberships(station_id, user_id, role) values (v_inv.station_id, auth.uid(), v_inv.role);
  update public.station_invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.station_id;
end $$;

create function public.cancel_station_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.station_invitations i set cancelled_at = now()
  where i.id = p_invitation_id and i.accepted_at is null and i.cancelled_at is null
    and exists (select 1 from public.stations s where s.id = i.station_id and s.owner_id = auth.uid());
  if not found then raise exception 'Invitation introuvable ou non autorisée' using errcode = '42501'; end if;
end $$;

create function public.revoke_station_membership(p_station_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.stations where id = p_station_id and owner_id = auth.uid()) then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  update public.station_memberships set revoked_at = now() where station_id = p_station_id and user_id = p_user_id and revoked_at is null;
  if not found then raise exception 'Adhésion introuvable ou déjà révoquée' using errcode = '22023'; end if;
end $$;

revoke all on function public.create_station_invitation(uuid, text, text), public.accept_station_invitation(uuid),
  public.cancel_station_invitation(uuid), public.revoke_station_membership(uuid, uuid) from public, anon;
grant execute on function public.create_station_invitation(uuid, text, text), public.accept_station_invitation(uuid),
  public.cancel_station_invitation(uuid), public.revoke_station_membership(uuid, uuid) to authenticated;
