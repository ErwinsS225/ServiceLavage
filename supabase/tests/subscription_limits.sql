-- Disposable test database only; all fixture changes roll back.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); st uuid := gen_random_uuid(); svc uuid := gen_random_uuid();
begin
  insert into auth.users(id,email) values (a, a::text || '@example.invalid'), (b, b::text || '@example.invalid');
  insert into public.stations(id,owner_id,name) values (st,a,'Station A');
  insert into public.station_services(id,station_id,name,price_xof,duration_minutes) values (svc,st,'Wash',1000,10);
  insert into public.station_orders(station_id,vehicle_info,total_xof) select st,'Fixture',0 from generate_series(1,499);
  perform set_config('test.sub_owner', a::text, true); perform set_config('test.sub_other', b::text, true);
  perform set_config('test.sub_station', st::text, true); perform set_config('test.sub_service', svc::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sub_owner'), true);
do $$
declare denied boolean := false; req uuid := gen_random_uuid(); oid uuid; other uuid; p record;
begin
  select * into p from public.my_subscription();
  if p.plan <> 'starter' or p.station_count <> 1 or p.monthly_orders <> 499 or p.max_stations <> 1 or p.max_monthly_orders <> 500 then
    raise exception 'Invalid Starter plan counters';
  end if;
  begin insert into public.stations(owner_id,name) values (auth.uid(),'Extra'); exception when raise_exception then denied := true; end;
  if not denied then raise exception 'Starter station limit bypassed'; end if;
  denied := false;
  begin insert into public.owner_subscriptions(owner_id,plan) values (auth.uid(),'business'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'User changed subscription'; end if;
  oid := public.create_station_order_idempotent(req, current_setting('test.sub_station')::uuid, null, 'Test', null, array[current_setting('test.sub_service')::uuid]);
  other := public.create_station_order_idempotent(req, current_setting('test.sub_station')::uuid, null, 'Test', null, array[current_setting('test.sub_service')::uuid]);
  if other <> oid then raise exception 'Idempotent retry failed at quota'; end if;
  denied := false;
  begin perform public.create_station_order_idempotent(gen_random_uuid(), current_setting('test.sub_station')::uuid, null, 'Exceeded', null, array[current_setting('test.sub_service')::uuid]); exception when raise_exception then denied := true; end;
  if not denied then raise exception 'Monthly limit bypassed'; end if;
end $$;
reset role;
insert into public.owner_subscriptions(owner_id, plan) values (current_setting('test.sub_owner')::uuid, 'pro');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sub_owner'), true);
do $$
declare denied boolean := false; p record;
begin
  select * into p from public.my_subscription();
  if p.plan <> 'pro' or p.max_stations <> 2 or p.max_monthly_orders <> 2500 then raise exception 'Pro assignment failed'; end if;
  insert into public.stations(owner_id,name) values (auth.uid(),'Pro station 2');
  begin insert into public.stations(owner_id,name) values (auth.uid(),'Pro station 3'); exception when raise_exception then denied := true; end;
  if not denied then raise exception 'Pro station limit bypassed'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.sub_other'), true);
do $$ begin
  if exists (select 1 from public.owner_subscriptions where owner_id = current_setting('test.sub_owner')::uuid) then raise exception 'Cross-owner subscription read'; end if;
end $$;
reset role;
update public.owner_subscriptions set plan = 'business' where owner_id = current_setting('test.sub_owner')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sub_owner'), true);
do $$ declare p record; begin
  select * into p from public.my_subscription();
  if p.plan <> 'business' or p.max_stations <> 10 or p.max_monthly_orders <> 10000 then raise exception 'Business assignment failed'; end if;
end $$;
reset role;
rollback;
