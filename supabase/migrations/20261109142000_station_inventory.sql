-- Real stock per station. Starter retains read-only access after downgrade.
create table public.station_inventory (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  unit text not null check (length(btrim(unit)) between 1 and 30),
  quantity integer not null check (quantity between 0 and 1000000000),
  min_threshold integer not null check (min_threshold between 0 and 1000000000),
  created_at timestamptz not null default now()
);
create index station_inventory_station_name_idx on public.station_inventory(station_id, name);
create table public.station_inventory_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  station_id uuid not null references public.stations(id) on delete cascade,
  item_id uuid not null references public.station_inventory(id) on delete restrict,
  payload jsonb not null,
  resulting_quantity integer not null,
  created_at timestamptz not null default now(),
  primary key(owner_id, request_id)
);
alter table public.station_inventory enable row level security;
alter table public.station_inventory_operations enable row level security;
revoke all on public.station_inventory, public.station_inventory_operations from public, anon, authenticated;
grant select on public.station_inventory, public.station_inventory_operations to authenticated;
create policy "Owners read station inventory" on public.station_inventory for select to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners read stock operations" on public.station_inventory_operations for select to authenticated
  using (owner_id = auth.uid());

-- One idempotent command supports creation and relative stock adjustment.
create function public.apply_inventory_operation(p_request_id uuid, p_station_id uuid, p_item_id uuid,
  p_name text, p_unit text, p_quantity integer, p_min_threshold integer)
returns table(item_id uuid, resulting_quantity integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_payload jsonb; v_previous public.station_inventory_operations%rowtype;
  v_item_id uuid; v_quantity integer; v_plan text;
begin
  if v_owner is null or p_request_id is null or not exists (select 1 from public.stations where id = p_station_id and owner_id = v_owner) then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('station', p_station_id, 'item', p_item_id, 'name', p_name, 'unit', p_unit, 'quantity', p_quantity, 'minimum', p_min_threshold);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inventory-request:' || v_owner::text || ':' || p_request_id::text, 0));
  select * into v_previous from public.station_inventory_operations where owner_id = v_owner and request_id = p_request_id;
  if found then
    if v_previous.payload is distinct from v_payload then raise exception 'Identifiant déjà utilisé' using errcode = '22023'; end if;
    return query select v_previous.item_id, v_previous.resulting_quantity;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('subscription:' || v_owner::text, 0));
  select plan into v_plan from public.subscription_limits(v_owner);
  if v_plan not in ('pro', 'business') then raise exception 'La modification du stock nécessite le plan Pro ou Business' using errcode = '42501'; end if;
  if p_quantity is null then raise exception 'Quantité invalide' using errcode = '22023'; end if;
  if p_item_id is null then
    if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_unit is null or length(btrim(p_unit)) not between 1 and 30 or
       p_quantity < 0 or p_quantity > 1000000000 or p_min_threshold is null or p_min_threshold not between 0 and 1000000000 then
      raise exception 'Article invalide' using errcode = '22023';
    end if;
    insert into public.station_inventory(station_id,name,unit,quantity,min_threshold)
      values (p_station_id, btrim(p_name), btrim(p_unit), p_quantity, p_min_threshold) returning id, quantity into v_item_id, v_quantity;
  else
    if p_name is not null or p_unit is not null or p_min_threshold is not null or p_quantity = 0 then
      raise exception 'Ajustement invalide' using errcode = '22023';
    end if;
    select id, quantity into v_item_id, v_quantity from public.station_inventory where id = p_item_id and station_id = p_station_id for update;
    if not found then raise exception 'Article introuvable' using errcode = '42501'; end if;
    if v_quantity::bigint + p_quantity::bigint not between 0 and 1000000000 then raise exception 'Stock insuffisant ou limite dépassée' using errcode = '22023'; end if;
    update public.station_inventory set quantity = v_quantity + p_quantity where id = v_item_id returning quantity into v_quantity;
  end if;
  insert into public.station_inventory_operations(owner_id,request_id,station_id,item_id,payload,resulting_quantity)
    values (v_owner,p_request_id,p_station_id,v_item_id,v_payload,v_quantity);
  return query select v_item_id, v_quantity;
end $$;
revoke all on function public.apply_inventory_operation(uuid, uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.apply_inventory_operation(uuid, uuid, uuid, text, text, integer, integer) to authenticated;
