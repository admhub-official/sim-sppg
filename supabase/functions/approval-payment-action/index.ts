import { CORS, json } from './client.ts';
import { caller } from './auth.ts';
import { getTransactionDetail, getTransactions } from './read.ts';
import { submitPayment } from './submit.ts';
import { verifyPayment } from './verify.ts';
import { directApproval } from './direct.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'approval-payment-action', version: 3, scopeMode: 'assigned-sppg', documentSource: 'storage-verified' });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const current = await caller(req);
    const body = await req.json();
    const parameters = Array.isArray(body?.parameters) ? body.parameters : [];
    let result: any;
    if (body?.function === 'getTransactions') result = await getTransactions(parameters, current);
    else if (body?.function === 'getTransactionDetail') result = await getTransactionDetail(parameters, current);
    else if (body?.function === 'submitUserBuktiPembayaran') result = await submitPayment(parameters[0] || {}, current);
    else if (body?.function === 'verifyUserPayment') result = await verifyPayment(parameters[0] || {}, current);
    else if (body?.function === 'approveTransaction') result = await directApproval(parameters[0] || {}, current);
    else return json({ error: `Fungsi tidak diizinkan: ${body?.function || ''}` }, 404);
    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = /akses|token|hanya admin|super admin|role/i.test(message);
    console.error(message);
    return json({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
