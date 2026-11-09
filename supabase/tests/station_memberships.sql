-- Run only on a disposable database: fixtures are rolled back.
begin;
do $$
declare owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid();
  member_a uuid := gen_random_uuid(); unconfirmed uuid := gen_random_uuid(); station_a uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, email_confirmed_at) values
    (owner_a, owner_a::text || '@example.invalid', now()),
    (owner_b, owner_b::text || '@example.invalid', now()),
    (member_a, member_a::text || '@example.invalid', now()),
    (unconfirmed, unconfirmed::text || '@example.invalid', null);
  insert into public.stations(id, owner_id, name) values (station_a, owner_a, 'Test');
  insert into public.station_services(station_id, name, price_xof, duration_minutes) values (station_a, 'Test', 1500, 10);
  perform set_config('test.owner', owner_a::text, true);
  perform set_config('test.other', owner_b::text, true);
  perform set_config('test.member', member_a::text, true);
  perform set_config('test.unconfirmed', unconfirmed::text, true);
  perform set_config('test.station', station_a::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.other'), true);
do $$
declare denied boolean := false;
begin
  begin perform public.create_station_invitation(current_setting('test.station')::uuid, 'x@example.invalid', 'gerant');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Other owner created invitation'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
do $$
declare invitation uuid; second_invitation uuid; unverified_invitation uuid; cancelled uuid; denied boolean := false;
begin
  begin perform public.create_station_invitation(current_setting('test.station')::uuid, 'x@example.invalid', 'super_admin');
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Unauthorized role accepted'; end if;
  invitation := public.create_station_invitation(current_setting('test.station')::uuid, upper(current_setting('test.member') || '@example.invalid'), 'gerant');
  second_invitation := public.create_station_invitation(current_setting('test.station')::uuid, current_setting('test.member') || '@example.invalid', 'caissier');
  unverified_invitation := public.create_station_invitation(current_setting('test.station')::uuid, current_setting('test.unconfirmed') || '@example.invalid', 'laveur');
  cancelled := public.create_station_invitation(current_setting('test.station')::uuid, current_setting('test.member') || '@example.invalid', 'laveur');
  perform public.cancel_station_invitation(cancelled);
  perform set_config('test.invitation', invitation::text, true);
  perform set_config('test.second', second_invitation::text, true);
  perform set_config('test.unverified_invitation', unverified_invitation::text, true);
  perform set_config('test.cancelled', cancelled::text, true);
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.unconfirmed'), true);
do $$
declare denied boolean := false;
begin
  begin perform public.accept_station_invitation(current_setting('test.unverified_invitation')::uuid);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Unverified email accepted'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.other'), true);
do $$
declare denied boolean := false;
begin
  begin perform public.accept_station_invitation(current_setting('test.invitation')::uuid);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Invitation accepted by wrong user'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.member'), true);
do $$
declare denied boolean := false;
begin
  if exists (select 1 from public.station_invitations) then raise exception 'Member read invitations'; end if;
  begin perform public.accept_station_invitation(current_setting('test.cancelled')::uuid);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cancelled invitation accepted'; end if;
  perform public.accept_station_invitation(current_setting('test.invitation')::uuid);
  if not exists (select 1 from public.station_memberships where user_id = auth.uid() and role = 'gerant' and revoked_at is null) then
    raise exception 'Membership not created';
  end if;
  if exists (select 1 from public.station_services where station_id = current_setting('test.station')::uuid) then
    raise exception 'Experimental membership granted operational access';
  end if;
  denied := false;
  begin perform public.accept_station_invitation(current_setting('test.second')::uuid);
  exception when invalid_parameter_value then denied := true; end;
  if not denied then raise exception 'Second invitation changed role'; end if;
  denied := false;
  begin perform public.revoke_station_membership(current_setting('test.station')::uuid, auth.uid());
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Member revoked membership'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
select public.revoke_station_membership(current_setting('test.station')::uuid, current_setting('test.member')::uuid);
do $$ begin
  if not exists (select 1 from public.station_memberships where user_id = current_setting('test.member')::uuid and revoked_at is not null) then
    raise exception 'Revocation not recorded';
  end if;
end $$;
reset role;
rollback;
