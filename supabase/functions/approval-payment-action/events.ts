import { serviceKey, sb, TABLE, url } from './client.ts';
import type { Caller } from './auth.ts';

export async function audit(id: string, action: string, current: Caller, detail: unknown) {
  try {
    await sb.from(TABLE.audit).insert({
      TIMESTAMP: new Date().toISOString(), USER_EMAIL: current.email, USER_NAME: current.nama,
      ROLE: current.role, SPPG: current.sppg, ACTION_TYPE: action, TABLE_NAME: TABLE.tx,
      RECORD_ID: id, FIELD_CHANGED: 'APPROVAL_PAYMENT_FLOW', OLD_VALUE: '',
      NEW_VALUE: JSON.stringify(detail).slice(0, 1000), DESCRIPTION: `${action} ${TABLE.tx}`,
      IP_USER: '', STATUS: 'SUCCESS',
    });
  } catch (error) { console.error('audit', error); }
}

export async function notify(payload: any) {
  try {
    const r = await fetch(`${url}/functions/v1/notification-dispatch-action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ function: 'dispatchSystemNotification', parameters: [payload] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('notification dispatch failed', r.status);
  } catch (error) { console.error('notification dispatch error', error); }
}
