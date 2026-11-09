-- Make the previously local membership model effective for core station operations.
-- Owner controls station identity and role/invitation administration; managers run operations,
-- cashiers see/manage clients, and washers see only explicitly assigned orders.

create function public.current_station_role(p_station_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when s.owner_id = auth.uid() then 'owner' else m.role end
  from public.stations s
  left join public.station_memberships m
    on m.station_id = s.id and m.user_id = auth.uid() and m.revoked_at is null
  where s.id = p_station_id and auth.uid() is not null
    and (s.owner_id = auth.uid() or m.user_id = auth.uid())
  limit 1;
$$;
revoke all on function public.current_station_role(uuid) from public, anon;
grant execute on function public.current_station_role(uuid) to authenticated;

create table public.station_order_assignments (
  station_id uuid not null references public.stations(id) on delete cascade,
  order_id uuid not null references public.station_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (order_id, user_id)
);
create index station_order_assignments_user_idx on public.station_order_assignments(user_id, station_id);
alter table public.station_order_assignments enable row level security;
revoke all on public.station_order_assignments from public, anon, authenticated;
grant select on public.station_order_assignments to authenticated;
create policy "Managers and assignees read assignments" on public.station_order_assignments for select to authenticated
  using ((user_id = auth.uid() and public.current_station_role(station_id) = 'laveur') or public.current_station_role(station_id) in ('owner', 'gerant'));

-- Membership lists are visible to the owner and operational manager, but only the owner
-- may invite, revoke or change anyone's role (the security definer functions remain owner-only).
create policy "Managers read station roster" on public.station_memberships for select to authenticated
  using (public.current_station_role(station_id) in ('owner', 'gerant'));

create policy "Members read their station" on public.stations for select to authenticated
  using (public.current_station_role(id) in ('gerant', 'caissier', 'laveur'));

create policy "Managers and cashiers read customers" on public.station_customers for select to authenticated
  using (public.current_station_role(station_id) in ('gerant', 'caissier'));
create policy "Managers and cashiers create customers" on public.station_customers for insert to authenticated
  with check (public.current_station_role(station_id) in ('gerant', 'caissier'));
create policy "Managers and cashiers update customers" on public.station_customers for update to authenticated
  using (public.current_station_role(station_id) in ('gerant', 'caissier'))
  with check (public.current_station_role(station_id) in ('gerant', 'caissier'));

create policy "Managers read services" on public.station_services for select to authenticated
  using (public.current_station_role(station_id) in ('gerant'));
create policy "Managers create services" on public.station_services for insert to authenticated
  with check (public.current_station_role(station_id) in ('gerant'));
create policy "Managers update services" on public.station_services for update to authenticated
  using (public.current_station_role(station_id) in ('gerant'))
  with check (public.current_station_role(station_id) in ('gerant'));

create policy "Managers and assigned washers read orders" on public.station_orders for select to authenticated
  using (
    public.current_station_role(station_id) in ('gerant')
    or (public.current_station_role(station_id) = 'laveur'
      and exists (select 1 from public.station_order_assignments a where a.order_id = id and a.user_id = auth.uid()))
  );
create policy "Managers and assigned washers read order items" on public.station_order_items for select to authenticated
  using (
    exists (select 1 from public.station_orders o where o.id = order_id and public.current_station_role(o.station_id) = 'gerant')
    or exists (
      select 1 from public.station_orders o
      join public.station_order_assignments a on a.order_id = o.id
      where o.id = order_id and a.user_id = auth.uid() and public.current_station_role(o.station_id) = 'laveur'
    )
  );

create policy "Managers read station inventory" on public.station_inventory for select to authenticated
  using (public.current_station_role(station_id) in ('gerant'));
create policy "Managers read inventory operation log" on public.station_inventory_operations for select to authenticated
  using (public.current_station_role(station_id) in ('gerant'));

create function public.assign_station_order(p_order_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_station_id uuid; v_role text;
begin
  select station_id into v_station_id from public.station_orders where id = p_order_id;
  v_role := public.current_station_role(v_station_id);
  if v_station_id is null or coalesce(v_role, '') not in ('owner', 'gerant') then
    raise exception 'Prestation introuvable ou non autorisée' using errcode = '42501';
  end if;
  if v_role <> 'owner'
     and (select role from public.station_memberships where station_id = v_station_id and user_id = p_user_id and revoked_at is null) is distinct from 'laveur' then
    raise exception 'Seul un laveur actif de cette station peut être affecté' using errcode = '22023';
  end if;
  if not exists (select 1 from public.station_memberships where station_id = v_station_id and user_id = p_user_id and role = 'laveur' and revoked_at is null) then
    raise exception 'Laveur introuvable ou révoqué' using errcode = '22023';
  end if;
  insert into public.station_order_assignments(station_id, order_id, user_id, assigned_by)
    values (v_station_id, p_order_id, p_user_id, auth.uid()) on conflict (order_id, user_id) do nothing;
end $$;

create function public.unassign_station_order(p_order_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_station_id uuid;
begin
  select station_id into v_station_id from public.station_orders where id = p_order_id;
  if v_station_id is null or coalesce(public.current_station_role(v_station_id), '') not in ('owner', 'gerant') then
    raise exception 'Prestation introuvable ou non autorisée' using errcode = '42501';
  end if;
  delete from public.station_order_assignments where order_id = p_order_id and user_id = p_user_id;
end $$;

create or replace function public.create_station_order(p_station_id uuid, p_customer_id uuid, p_vehicle_info text, p_plate_number text, p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_count integer; v_total bigint;
begin
  if auth.uid() is null or coalesce(public.current_station_role(p_station_id), '') not in ('owner', 'gerant') then
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

create or replace function public.create_station_order_idempotent(
  p_request_id uuid, p_station_id uuid, p_customer_id uuid, p_vehicle_info text,
  p_plate_number text, p_service_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_payload jsonb := jsonb_build_object('station', p_station_id, 'customer', p_customer_id,
    'vehicle', p_vehicle_info, 'plate', p_plate_number, 'services', p_service_ids);
  v_previous_payload jsonb; v_order_id uuid;
begin
  if v_user_id is null or p_request_id is null or coalesce(public.current_station_role(p_station_id), '') not in ('owner', 'gerant') then
    raise exception 'Station non autorisée ou identifiant manquant' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id::text, 0));
  select payload, order_id into v_previous_payload, v_order_id from public.station_order_requests
    where owner_id = v_user_id and request_id = p_request_id;
  if found then
    if v_previous_payload is distinct from v_payload then
      raise exception 'Identifiant déjà utilisé pour une autre opération' using errcode = '22023';
    end if;
    return v_order_id;
  end if;
  v_order_id := public.create_station_order(p_station_id, p_customer_id, p_vehicle_info, p_plate_number, p_service_ids);
  insert into public.station_order_requests(owner_id, request_id, payload, order_id)
    values (v_user_id, p_request_id, v_payload, v_order_id);
  return v_order_id;
end $$;

create or replace function public.transition_station_order(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_station_id uuid; v_status text; v_role text;
begin
  select o.station_id, o.status into v_station_id, v_status from public.station_orders o where o.id = p_order_id for update;
  if not found then raise exception 'Prestation introuvable ou non autorisée' using errcode = '42501'; end if;
  v_role := public.current_station_role(v_station_id);
  if v_role in ('owner', 'gerant') then
    if not ((v_status = 'en_attente' and p_status in ('en_cours', 'annule')) or (v_status = 'en_cours' and p_status in ('termine', 'annule'))) then
      raise exception 'Transition de statut invalide' using errcode = '22023';
    end if;
  elsif v_role = 'laveur' and exists (
    select 1 from public.station_order_assignments where order_id = p_order_id and user_id = auth.uid()
  ) then
    if not ((v_status = 'en_attente' and p_status = 'en_cours') or (v_status = 'en_cours' and p_status = 'termine')) then
      raise exception 'Transition non autorisée pour le laveur' using errcode = '42501';
    end if;
  else
    raise exception 'Rôle non autorisé pour modifier cette prestation' using errcode = '42501';
  end if;
  update public.station_orders set status = p_status where id = p_order_id;
end $$;

create or replace function public.apply_inventory_operation(p_request_id uuid, p_station_id uuid, p_item_id uuid,
  p_name text, p_unit text, p_quantity integer, p_min_threshold integer)
returns table(item_id uuid, resulting_quantity integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_owner uuid; v_payload jsonb; v_previous public.station_inventory_operations%rowtype;
  v_item_id uuid; v_quantity integer; v_plan text;
begin
  if v_actor is null or p_request_id is null or coalesce(public.current_station_role(p_station_id), '') not in ('owner', 'gerant') then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  select owner_id into v_owner from public.stations where id = p_station_id;
  v_payload := jsonb_build_object('station', p_station_id, 'item', p_item_id, 'name', p_name, 'unit', p_unit, 'quantity', p_quantity, 'minimum', p_min_threshold);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inventory-request:' || v_actor::text || ':' || p_request_id::text, 0));
  select * into v_previous from public.station_inventory_operations where owner_id = v_actor and request_id = p_request_id;
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
    values (v_actor,p_request_id,p_station_id,v_item_id,v_payload,v_quantity);
  return query select v_item_id, v_quantity;
end $$;

revoke all on function public.assign_station_order(uuid, uuid), public.unassign_station_order(uuid, uuid) from public, anon;
grant execute on function public.assign_station_order(uuid, uuid), public.unassign_station_order(uuid, uuid) to authenticated;
revoke all on function public.current_station_role(uuid) from public, anon;
revoke all on function public.create_station_order(uuid, uuid, text, text, uuid[]),
  public.create_station_order_idempotent(uuid, uuid, uuid, text, text, uuid[]),
  public.transition_station_order(uuid, text),
  public.apply_inventory_operation(uuid, uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.create_station_order(uuid, uuid, text, text, uuid[]),
  public.create_station_order_idempotent(uuid, uuid, uuid, text, text, uuid[]),
  public.transition_station_order(uuid, text),
  public.apply_inventory_operation(uuid, uuid, uuid, text, text, integer, integer) to authenticated;
