import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
export const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:C});
export const text=(v:unknown)=>String(v??'').trim();
export const low=(v:unknown)=>text(v).toLowerCase();
export type Caller={id:string,email:string,role:string,sppg:string,yayasan:string};

function fromB64url(v:string){const p=v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4);const r=atob(p);return Uint8Array.from(r,c=>c.charCodeAt(0));}
function toB64url(bytes:Uint8Array){let r='';for(const b of bytes)r+=String.fromCharCode(b);return btoa(r).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function configureWebPush(){const pub=JSON.parse(Deno.env.get('VAPID_PUBLIC_JWK')||'{}'),priv=JSON.parse(Deno.env.get('VAPID_PRIVATE_JWK')||'{}');if(!pub.x||!pub.y||!priv.d)throw new Error('Konfigurasi VAPID tidak lengkap.');const x=fromB64url(pub.x),y=fromB64url(pub.y),raw=new Uint8Array(1+x.length+y.length);raw[0]=4;raw.set(x,1);raw.set(y,1+x.length);webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:admin@sppg.local',toB64url(raw),priv.d);}
export async function caller(req:Request):Promise<Caller>{const h=req.headers.get('Authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';if(!token)throw new Error('Token tidak ditemukan.');const a=await sb.auth.getUser(token);if(a.error||!a.data.user)throw new Error('Token tidak valid atau kedaluwarsa.');const q=await sb.from('USERS').select('ID,EMAIL,ROLE,SPPG,"NAMA YAYASAN"').eq('ID',a.data.user.id).maybeSingle();if(q.error||!q.data)throw new Error('Profil user tidak ditemukan.');return{id:q.data.ID,email:low(a.data.user.email||q.data.EMAIL),role:text(q.data.ROLE).toUpperCase(),sppg:text(q.data.SPPG),yayasan:text(q.data['NAMA YAYASAN'])};}
export async function sendPush(subscription:any,payload:any){return webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:300,urgency:'normal'});}
