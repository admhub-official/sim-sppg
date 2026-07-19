-- Optimize PUSH_SUBSCRIPTIONS policies by evaluating auth.jwt() once per query.
-- Access semantics are unchanged: authenticated users may only access rows
-- whose user_email matches the email claim in their JWT.

begin;

 drop policy if exists push_subscriptions_select_own on public."PUSH_SUBSCRIPTIONS";
 drop policy if exists push_subscriptions_insert_own on public."PUSH_SUBSCRIPTIONS";
 drop policy if exists push_subscriptions_update_own on public."PUSH_SUBSCRIPTIONS";
 drop policy if exists push_subscriptions_delete_own on public."PUSH_SUBSCRIPTIONS";

create policy push_subscriptions_select_own
on public."PUSH_SUBSCRIPTIONS"
for select
to authenticated
using (user_email = ((select auth.jwt()) ->> 'email'));

create policy push_subscriptions_insert_own
on public."PUSH_SUBSCRIPTIONS"
for insert
to authenticated
with check (user_email = ((select auth.jwt()) ->> 'email'));

create policy push_subscriptions_update_own
on public."PUSH_SUBSCRIPTIONS"
for update
to authenticated
using (user_email = ((select auth.jwt()) ->> 'email'))
with check (user_email = ((select auth.jwt()) ->> 'email'));

create policy push_subscriptions_delete_own
on public."PUSH_SUBSCRIPTIONS"
for delete
to authenticated
using (user_email = ((select auth.jwt()) ->> 'email'));

commit;

-- Rollback (run as a new migration if required): recreate the same four
-- policies with auth.jwt() in place of (select auth.jwt()).
