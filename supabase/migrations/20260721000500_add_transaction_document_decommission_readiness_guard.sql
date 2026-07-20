create or replace view public.transaction_document_decommission_readiness
with (security_invoker = true)
as
with rollout as (
  select timestamptz '2026-07-20 16:57:02.802+00' as deployed_at
), audits as (
  select
    count(*) filter (
      where "ACTION_TYPE" = 'ADD'
        and coalesce("NEW_VALUE", '') like '%normalized-atomic%'
    ) as normalized_add_count,
    count(*) filter (
      where "ACTION_TYPE" = 'EDIT'
        and coalesce("NEW_VALUE", '') like '%normalized-atomic%'
    ) as normalized_edit_count,
    max("TIMESTAMP") filter (
      where coalesce("NEW_VALUE", '') like '%normalized-atomic%'
    ) as latest_normalized_write_at
  from public."AUDIT LOG", rollout
  where "TIMESTAMP" >= rollout.deployed_at
), health as (
  select * from public.transaction_document_rollout_health
), state as (
  select
    rollout.deployed_at,
    now() - rollout.deployed_at as observation_age,
    audits.normalized_add_count,
    audits.normalized_edit_count,
    audits.latest_normalized_write_at,
    health.normalized_rows,
    health.normalized_transactions,
    health.orphan_document_rows,
    health.mismatch_count,
    health.legacy_only_values,
    health.healthy,
    (now() >= rollout.deployed_at + interval '24 hours') as observation_window_complete,
    (audits.normalized_add_count >= 1) as has_real_add,
    (audits.normalized_edit_count >= 1) as has_real_edit
  from rollout cross join audits cross join health
)
select *,
  (healthy and observation_window_complete and has_real_add and has_real_edit) as ready_to_disable_legacy_sync,
  array_remove(array[
    case when not healthy then 'rollout_health_not_healthy' end,
    case when not observation_window_complete then 'observation_window_under_24h' end,
    case when not has_real_add then 'no_real_normalized_add' end,
    case when not has_real_edit then 'no_real_normalized_edit' end
  ], null) as blockers
from state;

revoke all on public.transaction_document_decommission_readiness from anon, authenticated;
grant select on public.transaction_document_decommission_readiness to service_role;

create or replace function public.assert_transaction_document_decommission_ready()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ready public.transaction_document_decommission_readiness%rowtype;
begin
  select * into v_ready from public.transaction_document_decommission_readiness;
  if not coalesce(v_ready.ready_to_disable_legacy_sync, false) then
    raise exception 'Transaction document decommission is blocked: %', array_to_string(v_ready.blockers, ', ');
  end if;
  return to_jsonb(v_ready);
end;
$$;

revoke all on function public.assert_transaction_document_decommission_ready() from public, anon, authenticated;
grant execute on function public.assert_transaction_document_decommission_ready() to service_role;
