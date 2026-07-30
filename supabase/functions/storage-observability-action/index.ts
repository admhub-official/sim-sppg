import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
const text=(v:unknown)=>String(v??'').trim();

async function requireSuperAdmin(req:Request){
 const h=req.headers.get('Authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';
 if(!token)throw new Error('Token tidak ditemukan.');
 const auth=await sb.auth.getUser(token);if(auth.error||!auth.data.user)throw new Error('Token tidak valid atau kedaluwarsa.');
 const q=await sb.from('USERS').select('ID,EMAIL,ROLE').eq('ID',auth.data.user.id).maybeSingle();
 if(q.error||!q.data)throw new Error('Profil user tidak ditemukan.');
 if(text(q.data.ROLE).toUpperCase()!=='SUPER_ADMIN')throw new Error('Hanya SUPER ADMIN yang dapat melihat observability Storage.');
 return q.data;
}
async function dashboard(daysInput:unknown,capture:boolean){
 const days=Math.min(90,Math.max(1,Number(daysInput)||7));
 if(capture){const snap=await sb.rpc('capture_storage_health_snapshot');if(snap.error)throw snap.error;}
 const [snapshot,daily,top,cleanup,approval]=await Promise.all([
  sb.from('storage_health_snapshots').select('*').order('captured_at',{ascending:false}).limit(1).maybeSingle(),
  sb.from('storage_access_daily_v').select('*').gte('day_bucket',new Date(Date.now()-days*86400000).toISOString()).order('day_bucket',{ascending:false}),
  sb.from('storage_access_top_objects_v').select('*').order('estimated_bytes',{ascending:false}).limit(25),
  sb.from('storage_cleanup_queue').select('status,size_bytes'),
  sb.from('approval_queue_enriched_v').select('ID,Nominal,document_status,pending_count',{count:'exact',head:false}).limit(1000)
 ]);
 for(const r of [snapshot,daily,top,cleanup,approval])if(r.error)throw r.error;
 const cleanupSummary:any={pending:0,deleted:0,failed:0,skipped:0,pendingBytes:0};
 for(const row of cleanup.data||[]){const status=text(row.status).toLowerCase();cleanupSummary[status]=(cleanupSummary[status]||0)+1;if(status==='pending')cleanupSummary.pendingBytes+=Number(row.size_bytes)||0;}
 const approvalSummary={total:approval.count??(approval.data||[]).length,nominal:(approval.data||[]).reduce((n:number,r:any)=>n+(Number(r.Nominal)||0),0),incomplete:(approval.data||[]).filter((r:any)=>r.document_status!=='LENGKAP').length,pendingVerification:(approval.data||[]).filter((r:any)=>Number(r.pending_count)>0).length};
 return{success:true,generatedAt:new Date().toISOString(),days,snapshot:snapshot.data||null,daily:daily.data||[],topObjects:top.data||[],cleanup:cleanupSummary,approval:approvalSummary,note:'estimated_bytes adalah estimasi berdasarkan ukuran objek asli; thumbnail dibatasi estimasi 120 KB.'};
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method==='GET')return json({status:'ok',service:'storage-observability-action',version:1});
 if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);
 try{await requireSuperAdmin(req);const body=await req.json();const fn=text(body?.function);const p=Array.isArray(body?.parameters)?body.parameters:[];
  if(fn==='getStorageObservability')return json({result:await dashboard(p[0]?.days,p[0]?.capture===true)});
  if(fn==='captureStorageSnapshot')return json({result:await dashboard(p[0]?.days,true)});
  return json({error:'Fungsi tidak diizinkan.'},404);
 }catch(error){const message=error instanceof Error?error.message:String(error);return json({error:message,result:{success:false,message}},/token|super admin|akses/i.test(message)?403:400);}
});