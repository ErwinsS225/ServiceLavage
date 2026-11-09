-- Disposable test database only.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); st uuid := gen_random_uuid();
begin
  insert into auth.users(id,email) values (a, a::text || '@example.invalid'), (b, b::text || '@example.invalid');
  insert into public.stations(id,owner_id,name) values (st,a,'Test');
  perform set_config('test.inv_owner', a::text, true); perform set_config('test.inv_other', b::text, true); perform set_config('test.inv_station', st::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.inv_owner'), true);
do $$
declare denied boolean := false;
begin
  begin perform public.apply_inventory_operation(gen_random_uuid(),current_setting('test.inv_station')::uuid,null,'Soap','litre',10,2);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Starter may not write stock'; end if;
end $$;
reset role;
insert into public.owner_subscriptions(owner_id,plan) values(current_setting('test.inv_owner')::uuid,'pro');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.inv_owner'), true);
do $$
declare item uuid; item2 uuid; q integer; req uuid := gen_random_uuid(); adjust uuid := gen_random_uuid(); denied boolean := false;
begin
  select item_id, resulting_quantity into item,q from public.apply_inventory_operation(req,current_setting('test.inv_station')::uuid,null,'Soap','litre',10,2);
  select item_id into item2 from public.apply_inventory_operation(req,current_setting('test.inv_station')::uuid,null,'Soap','litre',10,2);
  if item <> item2 or q <> 10 or (select count(*) from public.station_inventory where station_id = current_setting('test.inv_station')::uuid) <> 1 then raise exception 'Create retry not idempotent'; end if;
  select resulting_quantity into q from public.apply_inventory_operation(adjust,current_setting('test.inv_station')::uuid,item,null,null,-3,null);
  perform public.apply_inventory_operation(adjust,current_setting('test.inv_station')::uuid,item,null,null,-3,null);
  if q <> 7 or (select quantity from public.station_inventory where id = item) <> 7 then raise exception 'Adjustment retry not idempotent'; end if;
  begin perform public.apply_inventory_operation(adjust,current_setting('test.inv_station')::uuid,item,null,null,-2,null);
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Changed request accepted'; end if;
  denied := false;
  begin perform public.apply_inventory_operation(gen_random_uuid(),current_setting('test.inv_station')::uuid,item,null,null,-8,null);
  exception when invalid_parameter_value then denied := true; end;
  if not denied or (select quantity from public.station_inventory where id = item) <> 7 then raise exception 'Negative stock accepted'; end if;
  denied := false;
  begin update public.station_inventory set quantity = 100 where id = item;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Direct mutation accepted'; end if;
  perform set_config('test.inv_item',item::text,true); perform set_config('test.inv_request',adjust::text,true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.inv_other'), true);
do $$ declare denied boolean := false; begin
  if exists(select 1 from public.station_inventory where station_id = current_setting('test.inv_station')::uuid) then raise exception 'Inventory leaked'; end if;
  begin perform public.apply_inventory_operation(gen_random_uuid(),current_setting('test.inv_station')::uuid,current_setting('test.inv_item')::uuid,null,null,1,null);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-tenant mutation'; end if;
end $$;
reset role;
update public.owner_subscriptions set plan='starter' where owner_id=current_setting('test.inv_owner')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.inv_owner'), true);
do $$ declare denied boolean := false; q integer; begin
  if not exists(select 1 from public.station_inventory where id=current_setting('test.inv_item')::uuid) then raise exception 'Downgrade lost read access'; end if;
  select resulting_quantity into q from public.apply_inventory_operation(current_setting('test.inv_request')::uuid,current_setting('test.inv_station')::uuid,current_setting('test.inv_item')::uuid,null,null,-3,null);
  if q <> 7 then raise exception 'Acknowledgement retry blocked after downgrade'; end if;
  begin perform public.apply_inventory_operation(gen_random_uuid(),current_setting('test.inv_station')::uuid,current_setting('test.inv_item')::uuid,null,null,1,null);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Downgraded user may not write stock'; end if;
end $$;
reset role;
rollback;
