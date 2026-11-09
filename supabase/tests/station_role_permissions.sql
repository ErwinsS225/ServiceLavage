-- Disposable database test for the role-aware operational RLS/RPC layer.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid(); manager_id uuid := gen_random_uuid(); cashier_id uuid := gen_random_uuid();
  washer_id uuid := gen_random_uuid(); other_washer_id uuid := gen_random_uuid(); other_owner_id uuid := gen_random_uuid();
  station_id uuid := gen_random_uuid(); other_station_id uuid := gen_random_uuid(); service_id uuid := gen_random_uuid(); customer_id uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (owner_id,owner_id::text||'@example.invalid',now()),(manager_id,manager_id::text||'@example.invalid',now()),
    (cashier_id,cashier_id::text||'@example.invalid',now()),(washer_id,washer_id::text||'@example.invalid',now()),
    (other_washer_id,other_washer_id::text||'@example.invalid',now()),(other_owner_id,other_owner_id::text||'@example.invalid',now());
  insert into public.stations(id,owner_id,name) values (station_id,owner_id,'Station A'),(other_station_id,other_owner_id,'Station B');
  insert into public.station_memberships(station_id,user_id,role) values
    (station_id,manager_id,'gerant'),(station_id,cashier_id,'caissier'),
    (station_id,washer_id,'laveur'),(station_id,other_washer_id,'laveur'),
    (other_station_id,manager_id,'laveur');
  insert into public.station_services(id,station_id,name,price_xof,duration_minutes) values (service_id,station_id,'Lavage test',1000,20);
  insert into public.station_customers(id,station_id,name,phone) values (customer_id,station_id,'Client test','0700000000');
  insert into public.owner_subscriptions(owner_id,plan) values (owner_id,'pro'),(other_owner_id,'starter');
  perform set_config('test.role_owner',owner_id::text,true);
  perform set_config('test.role_manager',manager_id::text,true);
  perform set_config('test.role_cashier',cashier_id::text,true);
  perform set_config('test.role_washer',washer_id::text,true);
  perform set_config('test.role_other_washer',other_washer_id::text,true);
  perform set_config('test.role_other_owner',other_owner_id::text,true);
  perform set_config('test.role_station',station_id::text,true);
  perform set_config('test.role_other_station',other_station_id::text,true);
  perform set_config('test.role_service',service_id::text,true);
  perform set_config('test.role_customer',customer_id::text,true);
end $$;

-- Manager has operational access, but cannot change identity or role administration.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.role_manager'),true);
do $$
declare request_a uuid := gen_random_uuid(); request_b uuid := gen_random_uuid(); order_a uuid; order_b uuid; denied boolean := false; affected integer; stock_item uuid; stock_quantity integer;
begin
  if public.current_station_role(current_setting('test.role_station')::uuid) <> 'gerant' then raise exception 'Manager role lookup failed'; end if;
  if not exists(select 1 from public.stations where id=current_setting('test.role_station')::uuid) then raise exception 'Manager cannot read station'; end if;
  if not exists(select 1 from public.station_services where id=current_setting('test.role_service')::uuid) then raise exception 'Manager cannot read services'; end if;
  insert into public.station_customers(station_id,name,phone) values(current_setting('test.role_station')::uuid,'Manager client','0711111111');
  update public.station_services set price_xof=1200 where id=current_setting('test.role_service')::uuid;
  order_a := public.create_station_order_idempotent(request_a,current_setting('test.role_station')::uuid,current_setting('test.role_customer')::uuid,'Berline',null,array[current_setting('test.role_service')::uuid]);
  order_b := public.create_station_order_idempotent(request_b,current_setting('test.role_station')::uuid,null,'SUV',null,array[current_setting('test.role_service')::uuid]);
  perform public.assign_station_order(order_a,current_setting('test.role_washer')::uuid);
  if not exists(select 1 from public.station_order_assignments where order_id=order_a and user_id=current_setting('test.role_washer')::uuid) then raise exception 'Manager assignment failed'; end if;
  select item_id,resulting_quantity into stock_item,stock_quantity from public.apply_inventory_operation(gen_random_uuid(),current_setting('test.role_station')::uuid,null,'Soap','litre',5,1);
  if stock_quantity <> 5 or not exists(select 1 from public.station_inventory where id=stock_item) then raise exception 'Pro manager inventory write failed'; end if;
  begin perform public.create_station_invitation(current_setting('test.role_station')::uuid,'new@example.invalid','laveur');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Manager administered roles'; end if;
  update public.stations set name='Changed by manager' where id=current_setting('test.role_station')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Manager changed station identity'; end if;
  perform set_config('test.role_order_assigned',order_a::text,true);
  perform set_config('test.role_order_unassigned',order_b::text,true);
end $$;

-- Cashier can manage customer records but cannot edit the catalogue or create/transition orders.
select set_config('request.jwt.claim.sub',current_setting('test.role_cashier'),true);
do $$
declare denied boolean := false; affected integer;
begin
  if public.current_station_role(current_setting('test.role_station')::uuid) <> 'caissier' then raise exception 'Cashier role lookup failed'; end if;
  if not exists(select 1 from public.station_customers where id=current_setting('test.role_customer')::uuid) then raise exception 'Cashier cannot read customers'; end if;
  update public.station_customers set name='Cashier edited' where id=current_setting('test.role_customer')::uuid;
  if exists(select 1 from public.station_services where station_id=current_setting('test.role_station')::uuid) then raise exception 'Cashier read catalogue'; end if;
  if exists(select 1 from public.station_inventory where station_id=current_setting('test.role_station')::uuid) then raise exception 'Cashier read inventory'; end if;
  update public.station_services set price_xof=1 where id=current_setting('test.role_service')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cashier changed catalogue'; end if;
  denied := false;
  begin perform public.create_station_order_idempotent(gen_random_uuid(),current_setting('test.role_station')::uuid,null,'Test',null,array[current_setting('test.role_service')::uuid]);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cashier created an order'; end if;
  denied := false;
  begin perform public.transition_station_order(current_setting('test.role_order_assigned')::uuid,'en_cours');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cashier transitioned an order'; end if;
end $$;

-- A washer reads only assigned orders and can move an assigned job forward, not cancel it.
select set_config('request.jwt.claim.sub',current_setting('test.role_washer'),true);
do $$
declare denied boolean := false;
begin
  if public.current_station_role(current_setting('test.role_station')::uuid) <> 'laveur' then raise exception 'Washer role lookup failed'; end if;
  if (select count(*) from public.station_orders where station_id=current_setting('test.role_station')::uuid) <> 1 then raise exception 'Washer order visibility is not assignment-scoped'; end if;
  if not exists(select 1 from public.station_order_items i where i.order_id=current_setting('test.role_order_assigned')::uuid) then raise exception 'Washer cannot read assigned order details'; end if;
  if exists(select 1 from public.station_customers where station_id=current_setting('test.role_station')::uuid) then raise exception 'Washer read customer data'; end if;
  if exists(select 1 from public.station_order_assignments where order_id=current_setting('test.role_order_unassigned')::uuid) then raise exception 'Washer read another assignment'; end if;
  perform public.transition_station_order(current_setting('test.role_order_assigned')::uuid,'en_cours');
  perform public.transition_station_order(current_setting('test.role_order_assigned')::uuid,'termine');
  denied := false;
  begin perform public.transition_station_order(current_setting('test.role_order_unassigned')::uuid,'en_cours');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Washer transitioned unassigned order'; end if;
  denied := false;
  begin perform public.assign_station_order(current_setting('test.role_order_unassigned')::uuid,current_setting('test.role_other_washer')::uuid);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Washer assigned work'; end if;
end $$;

-- Owner remains authorized and revoked membership loses all role access immediately.
select set_config('request.jwt.claim.sub',current_setting('test.role_owner'),true);
do $$
begin
  if public.current_station_role(current_setting('test.role_station')::uuid) <> 'owner' then raise exception 'Owner role lookup failed'; end if;
  perform public.revoke_station_membership(current_setting('test.role_station')::uuid,current_setting('test.role_washer')::uuid);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.role_washer'),true);
do $$
declare denied boolean := false;
begin
  if public.current_station_role(current_setting('test.role_station')::uuid) is not null then raise exception 'Revoked washer role remains active'; end if;
  if exists(select 1 from public.station_orders where id=current_setting('test.role_order_assigned')::uuid) then raise exception 'Revoked washer still sees order'; end if;
  begin perform public.transition_station_order(current_setting('test.role_order_assigned')::uuid,'en_cours');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Revoked washer changed order'; end if;
end $$;
reset role;
rollback;
