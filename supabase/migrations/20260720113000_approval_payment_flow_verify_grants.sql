-- Keep approval RPCs inaccessible to browser roles.
revoke all on function public.submit_transaction_payment_atomic(text,numeric,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.verify_transaction_payment_batch_atomic(text,boolean,text,text,text,text) from public, anon, authenticated;
revoke all on function public.approve_transaction_direct_atomic(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_transaction_payment_atomic(text,numeric,text,text,text,text,text) to service_role;
grant execute on function public.verify_transaction_payment_batch_atomic(text,boolean,text,text,text,text) to service_role;
grant execute on function public.approve_transaction_direct_atomic(text,text,text,text,text,text,text,text,text) to service_role;
