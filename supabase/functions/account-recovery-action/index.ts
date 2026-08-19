import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:C});
const GENERIC='Jika data akun cocok, instruksi pemulihan akan dikirim ke email terdaftar.';
const text=(v:unknown)=>String(v??'').trim();
const low=(v:unknown)=>text(v).toLowerCase();
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function allow(action:string,ip:string,identity:string){const key=await sha256(`${action}|${ip}|${identity}`);const q=await sb.rpc('consume_public_rate_limit',{p_key_hash:key,p_action:action,p_limit:3,p_window_seconds:1800,p_block_seconds:1800});if(q.error){console.error('rate limit rpc',q.error.message);return false}return Boolean(q.data?.[0]?.allowed)}
function recoveryRedirect(origin:string){
  try{
    const u=new URL(origin);
    if(u.protocol!=='http:'&&u.protocol!=='https:')return '';
    return new URL('/reset-password.html',u.origin).toString();
  }catch(_){return ''}
}
async function recoverPassword(data:any,ip:string,origin:string){
  const email=low(data?.email);
  if(!email||email.length>254||!email.includes('@'))return{success:true,message:GENERIC};
  if(!(await allow('recoverPassword',ip,email)))return{success:true,message:GENERIC};
  const redirectTo=recoveryRedirect(origin);
  const options=redirectTo?{redirectTo}:undefined;
  const q=await sb.auth.resetPasswordForEmail(email,options);
  if(q.error)console.error('recovery email error',q.error.message);
  return{success:true,message:GENERIC};
}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:C});if(req.method==='GET')return out({status:'ok',service:'account-recovery-action',version:5,native:true,persistentRateLimit:true,emailRecoveryOnly:true});if(req.method!=='POST')return out({error:'Method tidak didukung.'},405);if(Number(req.headers.get('content-length')||0)>16000)return out({error:'Payload terlalu besar.'},413);try{const body=await req.json();const fn=String(body?.function||'');if(fn!=='recoverPassword')return out({error:'Fungsi tidak diizinkan.'},404);const data=Array.isArray(body.parameters)?body.parameters[0]||{}:{};const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const origin=req.headers.get('origin')||'';return out({result:await recoverPassword(data,ip,origin)})}catch(e){console.error(e);return out({result:{success:true,message:GENERIC}})}});
