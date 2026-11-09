-- Orders are created transactionally from current, active services. Prices and
-- service names are snapshotted; customers and services must belong to the station.
create table public.station_orders (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  customer_id uuid references public.station_customers(id) on delete restrict,
  vehicle_info text not null check (length(trim(vehicle_info)) between 1 and 120),
  plate_number text check (plate_number is null or length(plate_number) <= 40),
  status text not null default 'en_attente' check (status in ('en_attente', 'en_cours', 'termine', 'annule')),
  total_xof integer not null check (total_xof between 0 and 2000000000),
  created_at timestamptz not null default now()
);
create index station_orders_station_created_idx on public.station_orders(station_id, created_at desc);
create table public.station_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.station_orders(id) on delete cascade,
  service_id uuid not null references public.station_services(id) on delete restrict,
  service_name text not null,
  price_xof integer not null check (price_xof between 0 and 100000000),
  unique(order_id, service_id)
);
alter table public.station_orders enable row level security;
alter table public.station_order_items enable row level security;
revoke all on public.station_orders, public.station_order_items from anon, authenticated;
grant select on public.station_orders, public.station_order_items to authenticated;
create policy "Owners read orders" on public.station_orders for select to authenticated
  using (exists (select 1 from public.stations s where s.id = station_id and s.owner_id = auth.uid()));
create policy "Owners read order items" on public.station_order_items for select to authenticated
  using (exists (select 1 from public.station_orders o join public.stations s on s.id = o.station_id where o.id = order_id and s.owner_id = auth.uid()));

create function public.create_station_order(p_station_id uuid, p_customer_id uuid, p_vehicle_info text, p_plate_number text, p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_count integer; v_total bigint;
begin
  if auth.uid() is null or not exists (select 1 from public.stations where id = p_station_id and owner_id = auth.uid()) then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  if p_vehicle_info is null or length(trim(p_vehicle_info)) not between 1 and 120 or (p_plate_number is not null and length(trim(p_plate_number)) > 40) then
    raise exception 'Véhicule ou immatriculation invalide' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 20 or array_position(p_service_ids, null) is not null or (select count(distinct x) from unnest(p_service_ids) x) <> cardinality(p_service_ids) then
    raise exception 'Sélection de services invalide' using errcode = '22023';
  end if;
  if p_customer_id is not null and not exists (select 1 from public.station_customers where id = p_customer_id and station_id = p_station_id) then
    raise exception 'Client invalide pour cette station' using errcode = '22023';
  end if;
  -- Prevent a concurrent price change until the snapshot has been inserted.
  perform id from public.station_services where id = any(p_service_ids) order by id for share;
  select count(*), coalesce(sum(price_xof), 0) into v_count, v_total from public.station_services
    where station_id = p_station_id and is_active and id = any(p_service_ids);
  if v_count <> cardinality(p_service_ids) then
    raise exception 'Un service est inactif ou ne relève pas de cette station' using errcode = '22023';
  end if;
  insert into public.station_orders(station_id, customer_id, vehicle_info, plate_number, total_xof)
    values (p_station_id, p_customer_id, trim(p_vehicle_info), nullif(trim(p_plate_number), ''), v_total)
    returning id into v_order_id;
  insert into public.station_order_items(order_id, service_id, service_name, price_xof)
    select v_order_id, id, name, price_xof from public.station_services where station_id = p_station_id and id = any(p_service_ids);
  return v_order_id;
end $$;
revoke all on function public.create_station_order(uuid, uuid, text, text, uuid[]) from public, anon;
grant execute on function public.create_station_order(uuid, uuid, text, text, uuid[]) to authenticated;

create function public.transition_station_order(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select o.status into v_status from public.station_orders o join public.stations s on s.id = o.station_id
    where o.id = p_order_id and s.owner_id = auth.uid() for update of o;
  if not found then raise exception 'Prestation introuvable ou non autorisée' using errcode = '42501'; end if;
  if not ((v_status = 'en_attente' and p_status in ('en_cours', 'annule')) or (v_status = 'en_cours' and p_status in ('termine', 'annule'))) then
    raise exception 'Transition de statut invalide' using errcode = '22023';
  end if;
  update public.station_orders set status = p_status where id = p_order_id;
end $$;
revoke all on function public.transition_station_order(uuid, text) from public, anon;
grant execute on function public.transition_station_order(uuid, text) to authenticated;
