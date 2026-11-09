-- Disposable test database only.
--
-- Regression test for A24 / L1-T5: the plain create_station_order() stays
-- callable by `authenticated` next to its idempotent variant, so a client can
-- bypass the anti-duplicate protection by calling it directly.
--
-- Two things must hold after the REVOKE:
--   1. an authenticated user can no longer call the plain function;
--   2. create_station_order_idempotent() still works, because it is
--      SECURITY DEFINER: it runs with the privileges of its owner
--      (postgres), not of the caller, so the REVOKE does not affect it.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  station_id uuid := gen_random_uuid();
  service_id uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values (owner_id, owner_id::text||'@example.invalid', now());
  insert into public.stations(id,owner_id,name) values (station_id, owner_id, 'Station legacy rpc');
  insert into public.station_services(id,station_id,name,price_xof,duration_minutes)
    values (service_id, station_id, 'Lavage legacy', 1500, 20);
  insert into public.owner_subscriptions(owner_id,plan) values (owner_id,'pro');
  perform set_config('test.rpc_owner', owner_id::text, true);
  perform set_config('test.rpc_station', station_id::text, true);
  perform set_config('test.rpc_service', service_id::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.rpc_owner'), true);

do $$
declare
  denied boolean := false;
  request_id uuid := gen_random_uuid();
  order_id uuid;
  order_id_retry uuid;
begin
  -- 1. The plain function must be closed to authenticated users.
  begin
    perform public.create_station_order(
      current_setting('test.rpc_station')::uuid, null, 'Voiture legacy', 'CI-0001',
      array[current_setting('test.rpc_service')::uuid]);
  exception
    when insufficient_privilege then denied := true;
    when undefined_function then denied := true; -- if the overload was dropped
  end;
  if not denied then
    raise exception 'A24: authenticated can still call create_station_order directly';
  end if;

  -- 2. The idempotent variant must keep working through SECURITY DEFINER.
  select public.create_station_order_idempotent(
    request_id, current_setting('test.rpc_station')::uuid, null, 'Voiture idem', 'CI-0002',
    array[current_setting('test.rpc_service')::uuid]) into order_id;
  if order_id is null then
    raise exception 'A24: the idempotent variant stopped working after the REVOKE';
  end if;

  -- 3. Retrying with the same request id returns the same order, never a copy.
  select public.create_station_order_idempotent(
    request_id, current_setting('test.rpc_station')::uuid, null, 'Voiture idem', 'CI-0002',
    array[current_setting('test.rpc_service')::uuid]) into order_id_retry;
  if order_id_retry <> order_id then
    raise exception 'A24: retry created a second order';
  end if;

  if (select count(*) from public.station_orders where station_id = current_setting('test.rpc_station')::uuid) <> 1 then
    raise exception 'A24: expected exactly one order, found more';
  end if;
end $$;

reset role;
rollback;
