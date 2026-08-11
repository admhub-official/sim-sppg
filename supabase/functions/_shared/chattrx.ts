import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession:false, autoRefreshToken:false } });
export const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS' };
export const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
export const text = (v:unknown)=>String(v??'').trim();
export type Caller={id:string;email:string;username:string;role:string;sppg:string;yayasan:string;nama:string};

export async function getCaller(req:Request):Promise<Caller>{
  const h=req.headers.get('Authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token)throw new Error('Token tidak ditemukan.');
  const auth=await sb.auth.getUser(token);if(auth.error||!auth.data.user)throw new Error('Token tidak valid atau kedaluwarsa.');
  const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"').eq('ID',auth.data.user.id).maybeSingle();
  if(q.error||!q.data)throw new Error('Profil user tidak ditemukan.');
  const c={id:auth.data.user.id,email:text(auth.data.user.email||q.data.EMAIL).toLowerCase(),username:text(q.data.USERNAME).toLowerCase(),role:text(q.data.ROLE).toUpperCase(),sppg:text(q.data.SPPG),yayasan:text(q.data['NAMA YAYASAN']),nama:text(q.data['NAMA LENGKAP'])};
  if(!['SUPER_ADMIN','ADMIN'].includes(c.role))throw new Error('Akses ChatTrx ditolak.');
  return c;
}

// Satu-satunya penerapan cakupan role untuk seluruh query ChatTrx.
export async function applyRoleFilter(query:any,c:Caller,columns={owner:'user_id',sppg:'sppg',yayasan:'yayasan'}){
  if(c.role==='SUPER_ADMIN')return query;
  const a=await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email',c.email);
  if(a.error)throw a.error;
  const pairs=(a.data||[]).filter((x:any)=>text(x.sppg));
  if(!pairs.length)return columns.owner?query.eq(columns.owner,c.id):query.eq(columns.sppg,'__NO_SCOPE__');
  const value=(v:unknown)=>`"${text(v).replaceAll('\\','\\\\').replaceAll('"','\\"')}"`;
  const clauses=pairs.map((x:any)=>`and(${columns.sppg}.eq.${value(x.sppg)},${columns.yayasan}.eq.${value(x.yayasan)})`);
  return query.or(clauses.join(','));
}

export function handlerError(error:unknown){const e=error as any;const message=text(error instanceof Error?error.message:e?.message||e?.details||e?.hint||e?.code)||'Terjadi kesalahan pada layanan ChatTrx.';console.error(message,e?.code||'');return json({error:message,result:{success:false,message}},/akses|token/i.test(message)?403:400)}
