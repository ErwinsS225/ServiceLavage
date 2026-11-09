-- Run only on a disposable test database with psql -v ON_ERROR_STOP=1.
-- All fixtures are generated in the transaction and rolled back on success.
begin;
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  sa uuid := gen_random_uuid(); sb uuid := gen_random_uuid();
  svc_a uuid := gen_random_uuid(); svc_b uuid := gen_random_uuid();
  customer_a uuid := gen_random_uuid(); customer_b uuid := gen_random_uuid();
begin
  insert into auth.users(id, email) values (ua, ua::text || '@example.invalid'), (ub, ub::text || '@example.invalid');
  insert into public.stations(id, owner_id, name) values (sa, ua, 'Test A'), (sb, ub, 'Test B');
  insert into public.station_services(id, station_id, name, price_xof, duration_minutes) values
    (svc_a, sa, 'A', 1000, 15), (svc_b, sb, 'B', 2000, 15);
  insert into public.station_customers(id, station_id, name, phone) values
    (customer_a, sa, 'A', '000'), (customer_b, sb, 'B', '000');
  perform set_config('test.owner_a', ua::text, true); perform set_config('test.owner_b', ub::text, true);
  perform set_config('test.station_a', sa::text, true); perform set_config('test.station_b', sb::text, true);
  perform set_config('test.service_a', svc_a::text, true); perform set_config('test.service_b', svc_b::text, true);
  perform set_config('test.customer_a', customer_a::text, true); perform set_config('test.customer_b', customer_b::text, true);
end $$;

do $$ begin
  if has_table_privilege('anon', 'public.stations', 'TRUNCATE') or has_table_privilege('authenticated', 'public.stations', 'TRUNCATE') then
    raise exception 'TRUNCATE privilege must not be granted';
  end if;
  if has_table_privilege('anon', 'public.stations', 'SELECT') or has_table_privilege('authenticated', 'public.stations', 'DELETE') then
    raise exception 'Unexpected station privilege';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
do $$
declare sa uuid := current_setting('test.station_a')::uuid; sb uuid := current_setting('test.station_b')::uuid;
  svc_a uuid := current_setting('test.service_a')::uuid; svc_b uuid := current_setting('test.service_b')::uuid;
  cb uuid := current_setting('test.customer_b')::uuid; req uuid := gen_random_uuid(); first_order uuid; second_order uuid;
  affected integer; denied boolean := false;
begin
  if (select count(*) from public.stations where id in (sa, sb)) <> 1
    or (select count(*) from public.station_customers where station_id in (sa, sb)) <> 1
    or (select count(*) from public.station_services where station_id in (sa, sb)) <> 1 then
    raise exception 'Cross-tenant read isolation failed';
  end if;
  update public.station_customers set name = 'Forbidden' where id = cb;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-tenant update succeeded'; end if;
  begin insert into public.station_customers(station_id, name, phone) values (sb, 'Forbidden', '000');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-tenant insert succeeded'; end if;
  denied := false;
  begin perform public.create_station_order(sb, null, 'Forbidden', null, array[svc_b]);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-tenant RPC succeeded'; end if;
  denied := false;
  begin perform public.create_station_order(sa, null, 'Forbidden', null, array[svc_b]);
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Foreign service accepted'; end if;
  first_order := public.create_station_order_idempotent(req, sa, null, 'Vehicle', null, array[svc_a]);
  second_order := public.create_station_order_idempotent(req, sa, null, 'Vehicle', null, array[svc_a]);
  if first_order <> second_order or (select count(*) from public.station_orders where id = first_order) <> 1 then
    raise exception 'Idempotent order retry failed';
  end if;
  perform set_config('test.order_a', first_order::text, true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);
do $$
declare oid uuid := current_setting('test.order_a')::uuid; denied boolean := false;
begin
  if (select count(*) from public.station_orders where id = oid) <> 0 or
     (select count(*) from public.station_order_items where order_id = oid) <> 0 then
    raise exception 'Cross-tenant order read succeeded';
  end if;
  begin perform public.transition_station_order(oid, 'en_cours');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-tenant transition succeeded'; end if;
end $$;
reset role;
rollback;
