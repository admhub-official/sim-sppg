import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const text = (v: unknown) => String(v ?? '').trim();
const BUCKET: Record<string,string> = { foto:'transaksi-images', file:'transaksi-files', ttdUser:'paraf-user', nota:'nota-pembelian' };
const MIME: Record<string,RegExp> = {
  foto: /^image\/(jpeg|jpg|png|webp)$/i,
  file: /^(application\/pdf|image\/(jpeg|jpg|png|webp))$/i,
  ttdUser: /^image\/(jpeg|jpg|png|webp)$/i,
  nota: /^(application\/pdf|image\/(jpeg|jpg|png|webp))$/i,
};
function decode(value:string){const raw=value.includes(',')?value.split(',').pop()!:value;const bin=atob(raw);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const h=req.headers.get('Authorization')||'', token=h.startsWith('Bearer ')?h.slice(7):'';
    if(!token) throw new Error('Token tidak ditemukan.');
    const auth=await sb.auth.getUser(token); if(auth.error||!auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
    const body=await req.json(); if(body?.function!=='uploadTxFile') return json({error:'Fungsi tidak diizinkan.'},404);
    const p=Array.isArray(body.parameters)?body.parameters:[];
    const base64=text(p[0]), mime=text(p[1]).toLowerCase(), original=text(p[2]||'file'), kind=text(p[3]);
    if(!BUCKET[kind]||!MIME[kind]?.test(mime)) throw new Error('Tipe file transaksi tidak diizinkan.');
    const bytes=decode(base64);
    const image=/^image\//.test(mime), max=image?1024*1024:5*1024*1024;
    if(bytes.byteLength>max) throw new Error(image?'Ukuran gambar maksimal 1 MB setelah kompresi.':'Ukuran PDF maksimal 5 MB.');
    const safe=original.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${kind}_${auth.data.user.id}_${Date.now()}_${crypto.randomUUID()}_${safe}`;
    const up=await sb.storage.from(BUCKET[kind]).upload(path,bytes,{contentType:mime,cacheControl:'31536000',upsert:false});
    if(up.error) throw new Error(`Upload gagal: ${up.error.message}`);
    return json({result:{success:true,fileName:path,filePath:path,bucket:BUCKET[kind],mimeType:mime,accessMode:'on-demand'}});
  } catch(error){const m=error instanceof Error?error.message:String(error);return json({error:m,result:{success:false,message:m}},/token|akses/i.test(m)?403:400);}
});