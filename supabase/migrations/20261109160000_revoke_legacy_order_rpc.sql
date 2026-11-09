-- A24 / L1-T5: close the non-idempotent create_station_order() to clients.
--
-- The plain function stays granted to `authenticated` beside its idempotent
-- variant, so any client could bypass the anti-duplicate protection simply by
-- calling it directly. Only create_station_order_idempotent() was ever used
-- by the application (grep rpc('create_station_order' in src/ -> 0 hits).
--
-- The function itself is NOT dropped: it is read by
-- create_station_order_idempotent(), which is SECURITY DEFINER and therefore
-- runs with its owner's privileges. Revoking EXECUTE from `authenticated`
-- only removes the direct client path; the internal call keeps working, as
-- proven by supabase/tests/revoke_legacy_order_rpc.sql.
--
-- Grants are additive, so the earlier migration cannot be edited (rule P3).
revoke execute on function public.create_station_order(uuid, uuid, text, text, uuid[])
  from authenticated;
