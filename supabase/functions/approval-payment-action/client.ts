import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const url = Deno.env.get('SUPABASE_URL')!;
export const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export const TABLE = {
  users: 'USERS',
  tx: 'TRANSAKSI',
  assignment: 'ADMIN_ASSIGNMENT',
  proofs: 'TRANSAKSI_PAYMENT_PROOFS',
  docs: 'TRANSAKSI_DOCUMENTS',
  docsAvailable: 'TRANSAKSI_DOCUMENTS_AVAILABLE',
  settings: 'APP_SETTINGS',
  audit: 'AUDIT LOG',
};
export const BUCKET = { payment: 'bukti-payment', verifier: 'paraf-verifikator' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
export const text = (value: unknown) => String(value ?? '').trim();
export const lower = (value: unknown) => text(value).toLowerCase();
export const norm = (value: unknown) => text(value).replace(/\s+/g, ' ').toUpperCase();
export const normalizeStatus = (value: unknown) => { const x = norm(value).replace(/\s+/g, '_'); return x === 'LUNAS' ? 'SUDAH_DIBAYAR' : (x || 'BELUM_BAYAR'); };
