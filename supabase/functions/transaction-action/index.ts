import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method === 'GET') {
    return json({
      status: 'ok',
      service: 'SIM-SPPG transaction-action',
      mode: 'bootstrap-proxy',
      target: 'dynamic-action',
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);

  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'Authorization bearer token wajib tersedia.' }, 401);
  }

  const token = authorization.slice(7);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Token tidak valid atau kedaluwarsa.' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body JSON tidak valid.' }, 400);
  }

  const upstream = await fetch(`${SUPABASE_URL}/functions/v1/dynamic-action`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: req.headers.get('apikey') || SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'x-client-info': req.headers.get('x-client-info') || 'sim-sppg-transaction-action',
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      ...CORS,
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'X-Transaction-Action-Mode': 'bootstrap-proxy',
    },
  });
});
