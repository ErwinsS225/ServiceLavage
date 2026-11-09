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
  cb uuid := current_setting('test.customer_b')::uuid; req uuid := gen_random_uuid(); first_order uuid; second_order uuid; new_order uuid;
  affected integer; denied boolean := false;
begin
  if not exists (select 1 from public.stations where id = sa) or exists (select 1 from public.stations where id = sb)
    or not exists (select 1 from public.station_customers where station_id = sa) or exists (select 1 from public.station_customers where station_id = sb)
    or not exists (select 1 from public.station_services where station_id = sa) or exists (select 1 from public.station_services where station_id = sb) then
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
  -- Pricing is snapshotted on creation; retries reuse it and new orders use the server's latest price.
  update public.station_services set price_xof = 2500, name = 'Nouveau tarif' where id = svc_a;
  second_order := public.create_station_order_idempotent(req, sa, null, 'Vehicle', null, array[svc_a]);
  if second_order <> first_order or (select total_xof from public.station_orders where id = first_order) <> 1000
    or (select price_xof from public.station_order_items where order_id = first_order) <> 1000
    or (select service_name from public.station_order_items where order_id = first_order) <> 'A' then
    raise exception 'Order price/name snapshot changed on retry';
  end if;
  new_order := public.create_station_order_idempotent(gen_random_uuid(), sa, null, 'Second', null, array[svc_a]);
  if (select total_xof from public.station_orders where id = new_order) <> 2500 then
    raise exception 'New order did not use current server price';
  end if;
  denied := false;
  begin perform public.transition_station_order(first_order, 'termine');
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Invalid status transition succeeded'; end if;
  perform public.transition_station_order(first_order, 'en_cours');
  perform public.transition_station_order(first_order, 'termine');
  if (select status from public.station_orders where id = first_order) <> 'termine' then raise exception 'Valid transition failed'; end if;
  denied := false;
  begin perform public.transition_station_order(first_order, 'en_cours');
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Completed order reopened'; end if;
  update public.station_services set is_active = false where id = svc_a;
  denied := false;
  begin perform public.create_station_order_idempotent(gen_random_uuid(), sa, null, 'Inactive', null, array[svc_a]);
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Inactive service accepted'; end if;
  denied := false;
  begin perform public.create_station_order_idempotent(req, sa, null, 'Different', null, array[svc_a]);
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Idempotency key allowed different payload'; end if;
  denied := false;
  begin insert into public.stations(owner_id, name) values (current_setting('test.owner_b')::uuid, 'Forbidden');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Owner spoofing succeeded'; end if;
  denied := false;
  begin update public.stations set owner_id = current_setting('test.owner_b')::uuid where id = sa;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Station owner update permitted'; end if;
  denied := false;
  begin insert into public.station_orders(station_id, vehicle_info, total_xof) values (sa, 'Forged', 0);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Direct order insert succeeded'; end if;
  perform set_config('test.order_a', first_order::text, true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);
do $$
declare oid uuid := current_setting('test.order_a')::uuid; denied boolean := false;
begin
  if not exists (select 1 from public.stations where id = current_setting('test.station_b')::uuid)
     or exists (select 1 from public.stations where id = current_setting('test.station_a')::uuid)
     or not exists (select 1 from public.station_customers where id = current_setting('test.customer_b')::uuid)
     or exists (select 1 from public.station_customers where id = current_setting('test.customer_a')::uuid) then
    raise exception 'Owner B isolation failed';
  end if;
  if (select count(*) from public.station_orders where id = oid) <> 0 or
     (select count(*) from public.station_order_items where order_id = oid) <> 0 then
    raise exception 'Cross-tenant order read succeeded';
  end if;
  begin perform public.transition_station_order(oid, 'en_cours');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-tenant transition succeeded'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare denied boolean := false;
begin
  begin perform 1 from public.stations limit 1;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Anonymous station access succeeded'; end if;
  denied := false;
  begin perform public.create_station_order(current_setting('test.station_a')::uuid, null, 'Forbidden', null, array[current_setting('test.service_a')::uuid]);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Anonymous order RPC succeeded'; end if;
end $$;
reset role;
rollback;
