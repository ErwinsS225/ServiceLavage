-- The plan is per owner, assigned only by a privileged administrator.
-- Unassigned owners have Starter. No payment processing is implied.
create table public.owner_subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro', 'business')),
  updated_at timestamptz not null default now()
);
alter table public.owner_subscriptions enable row level security;
revoke all on public.owner_subscriptions from public, anon, authenticated;
grant select on public.owner_subscriptions to authenticated;
grant select, insert, update, delete on public.owner_subscriptions to service_role;
create policy "Owners read their subscription" on public.owner_subscriptions for select to authenticated using (owner_id = auth.uid());

-- Use the same owner lock for changing the plan and creating stations/orders.
create function public.lock_subscription_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'Modification du propriétaire interdite' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('subscription:' || (case when tg_op = 'DELETE' then old.owner_id else new.owner_id end)::text, 0));
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger owner_subscription_lock before insert or update or delete on public.owner_subscriptions for each row execute function public.lock_subscription_owner();

create function public.subscription_limits(p_owner_id uuid)
returns table(plan text, max_stations integer, max_monthly_orders integer)
language sql stable security definer set search_path = '' as $$
  select p.plan,
    case p.plan when 'pro' then 2 when 'business' then 10 else 1 end,
    case p.plan when 'pro' then 2500 when 'business' then 10000 else 500 end
  from (select coalesce((select s.plan from public.owner_subscriptions s where s.owner_id = p_owner_id), 'starter') as plan) p;
$$;
revoke all on function public.subscription_limits(uuid) from public, anon, authenticated;

create function public.my_subscription()
returns table(plan text, max_stations integer, max_monthly_orders integer, station_count bigint, monthly_orders bigint)
language sql stable security definer set search_path = '' as $$
  select l.plan, l.max_stations, l.max_monthly_orders,
    (select count(*) from public.stations s where s.owner_id = auth.uid()),
    (select count(*) from public.station_orders o join public.stations s on s.id = o.station_id
      where s.owner_id = auth.uid() and o.created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
        and o.created_at < ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'))
  from public.subscription_limits(auth.uid()) l where auth.uid() is not null;
$$;
revoke all on function public.my_subscription() from public, anon;
grant execute on function public.my_subscription() to authenticated;

create function public.enforce_station_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit integer;
begin
  if auth.uid() is not null and auth.uid() <> new.owner_id then
    raise exception 'Station non autorisée' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('subscription:' || new.owner_id::text, 0));
  select max_stations into v_limit from public.subscription_limits(new.owner_id);
  if (select count(*) from public.stations where owner_id = new.owner_id) >= v_limit then
    raise exception 'Limite de stations atteinte pour votre abonnement' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger enforce_station_limit before insert on public.stations for each row execute function public.enforce_station_limit();

create function public.enforce_monthly_order_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_limit integer;
begin
  select owner_id into v_owner from public.stations where id = new.station_id;
  if v_owner is null then raise exception 'Station introuvable' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('subscription:' || v_owner::text, 0));
  select max_monthly_orders into v_limit from public.subscription_limits(v_owner);
  if (select count(*) from public.station_orders o join public.stations s on s.id = o.station_id
      where s.owner_id = v_owner and o.created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
        and o.created_at < ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC')) >= v_limit then
    raise exception 'Limite mensuelle de prestations atteinte pour votre abonnement' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger enforce_monthly_order_limit before insert on public.station_orders for each row execute function public.enforce_monthly_order_limit();
revoke all on function public.lock_subscription_owner(), public.enforce_station_limit(), public.enforce_monthly_order_limit() from public, anon, authenticated;
