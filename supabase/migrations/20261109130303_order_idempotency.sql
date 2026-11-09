-- Request IDs make retries atomic and safe even after a lost response.
create table public.station_order_requests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  order_id uuid not null references public.station_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);
alter table public.station_order_requests enable row level security;
revoke all on public.station_order_requests from public, anon, authenticated;

create function public.create_station_order_idempotent(
  p_request_id uuid, p_station_id uuid, p_customer_id uuid, p_vehicle_info text,
  p_plate_number text, p_service_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_payload jsonb := jsonb_build_object('station', p_station_id, 'customer', p_customer_id,
    'vehicle', p_vehicle_info, 'plate', p_plate_number, 'services', p_service_ids);
  v_previous_payload jsonb;
  v_order_id uuid;
begin
  if v_user_id is null or p_request_id is null or not exists (
    select 1 from public.stations where id = p_station_id and owner_id = v_user_id
  ) then
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
revoke all on function public.create_station_order_idempotent(uuid, uuid, uuid, text, text, uuid[]) from public, anon;
grant execute on function public.create_station_order_idempotent(uuid, uuid, uuid, text, text, uuid[]) to authenticated;
