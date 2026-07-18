import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
  'Content-Type':'application/json'
};
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
const s=(v:unknown)=>String(v??'').trim();

async function caller(req:Request){
  const auth=req.headers.get('Authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)throw new Error('Token wajib disertakan.');
  const {data,error}=await sb.auth.getUser(token);
  if(error||!data.user?.email)throw new Error('Token tidak valid atau kedaluwarsa.');
  return {id:data.user.id,email:data.user.email.toLowerCase()};
}

async function savePushSubscription(p:any,c:{email:string}){
  const sub=p?.subscription||p;
  const endpoint=s(sub?.endpoint),p256dh=s(sub?.keys?.p256dh),auth=s(sub?.keys?.auth);
  const deviceLabel=s(p?.deviceLabel||p?.label).slice(0,160);
  if(!endpoint||!p256dh||!auth)throw new Error('Subscription push tidak valid.');
  if(endpoint.length>4096||p256dh.length>1024||auth.length>1024)throw new Error('Subscription push melebihi batas ukuran.');
  const row={user_email:c.email,endpoint,p256dh,auth,device_label:deviceLabel,last_used_at:new Date().toISOString()};
  const q=await sb.from('PUSH_SUBSCRIPTIONS').upsert(row,{onConflict:'endpoint'});
  if(q.error)throw q.error;
  return {success:true,message:'Notifikasi push berhasil diaktifkan di perangkat ini.'};
}

async function deletePushSubscription(endpointValue:unknown,c:{email:string}){
  const endpoint=s(endpointValue);
  if(!endpoint)throw new Error('Endpoint wajib diisi.');
  const q=await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('endpoint',endpoint).eq('user_email',c.email);
  if(q.error)throw q.error;
  return {success:true,message:'Notifikasi push dinonaktifkan di perangkat ini.'};
}

const H:Record<string,(p:any[],c:any)=>Promise<any>>={
  savePushSubscription:(p,c)=>savePushSubscription({subscription:p[0],deviceLabel:p[1]},c),
  deletePushSubscription:(p,c)=>deletePushSubscription(p[0],c)
};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method==='GET')return j({status:'ok',service:'push-action',version:1});
  if(req.method!=='POST')return j({error:'Method tidak didukung.'},405);
  try{
    const c=await caller(req),b=await req.json(),fn=H[b?.function];
    if(!fn)return j({error:`Fungsi tidak diizinkan: ${b?.function||''}`},404);
    return j({result:await fn(Array.isArray(b.parameters)?b.parameters:[],c)});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return j({error:message,result:{success:false,message}},/token|akses/i.test(message)?401:400);
  }
});
