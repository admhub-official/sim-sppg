import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function bearer(req: Request) {
  const h = req.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

const actionTypes = ['ADD','EDIT','UPDATE','DELETE','APPROVE','VERIFY','VERIFY_USER_PAYMENT','USER_SUBMIT_BUKTI'];
const tables = ['USERS','TRANSAKSI','MASTER_BB','MASTER_SUPPLIER','SURVEI_BB','SERAH_TERIMA','MENU_HARIAN','Pending Payment'];
const meta: Record<string, {page:string;icon:string;label:string}> = {
  USERS:{page:'users',icon:'fa-user',label:'Data User'}, TRANSAKSI:{page:'transaksi',icon:'fa-exchange-alt',label:'Transaksi'},
  MASTER_BB:{page:'master-bahan',icon:'fa-boxes',label:'Bahan Baku'}, MASTER_SUPPLIER:{page:'master-supplier',icon:'fa-truck',label:'Supplier'},
  SURVEI_BB:{page:'survei',icon:'fa-search-dollar',label:'Survei'}, SERAH_TERIMA:{page:'serah-terima',icon:'fa-dolly',label:'Serah Terima'},
  MENU_HARIAN:{page:'menu-mbg',icon:'fa-utensils',label:'Menu MBG'}, 'Pending Payment':{page:'pending-payment',icon:'fa-clock',label:'Pending Payment'}
};

async function callerFromToken(token: string) {
  const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false }
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin.from('USERS').select('EMAIL,ROLE,SPPG,"NAMA YAYASAN",USERNAME,"NAMA LENGKAP"').eq('ID', data.user.id).maybeSingle();
  if (!profile) return null;
  return { email:String(profile.EMAIL || data.user.email || '').toLowerCase(), role:String(profile.ROLE || ''),
    sppg:String(profile.SPPG || ''), yayasan:String(profile['NAMA YAYASAN'] || ''), username:String(profile.USERNAME || ''), nama:String(profile['NAMA LENGKAP'] || '') };
}

async function visibleActors(caller: any): Promise<Set<string> | null> {
  if (caller.role === 'SUPER_ADMIN') return null;
  if (caller.role !== 'ADMIN') return new Set([caller.email, caller.username.toLowerCase()].filter(Boolean));
  const { data: assignments } = await admin.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email', caller.email);
  if (!assignments?.length) return new Set([caller.email]);
  const sppg = [...new Set(assignments.map((x:any)=>x.sppg).filter(Boolean))];
  const yayasan = [...new Set(assignments.map((x:any)=>x.yayasan).filter(Boolean))];
  let q = admin.from('USERS').select('EMAIL,USERNAME');
  if (sppg.length) q = q.in('SPPG', sppg);
  if (yayasan.length) q = q.in('NAMA YAYASAN', yayasan);
  const { data: users } = await q;
  const set = new Set<string>([caller.email]);
  (users || []).forEach((u:any)=>{ if(u.EMAIL)set.add(String(u.EMAIL).toLowerCase()); if(u.USERNAME)set.add(String(u.USERNAME).toLowerCase()); });
  return set;
}

function actionLabel(action:string) {
  if(action==='ADD')return'ditambahkan'; if(action==='DELETE')return'dihapus'; if(action==='APPROVE')return'disetujui';
  if(action.includes('VERIFY'))return'diverifikasi'; if(action==='USER_SUBMIT_BUKTI')return'mengirim bukti pembayaran'; return'diperbarui';
}

async function getNotifications(caller:any) {
  const actors = await visibleActors(caller);
  const { data, error } = await admin.from('AUDIT LOG').select('*').in('ACTION_TYPE',actionTypes).in('TABLE_NAME',tables).order('TIMESTAMP',{ascending:false}).limit(100);
  if(error)throw error;
  let rows=data||[]; if(actors)rows=rows.filter((r:any)=>actors.has(String(r.USER_EMAIL||'').toLowerCase())); rows=rows.slice(0,50);
  const ids=rows.map((r:any)=>r.LOG_ID).filter(Boolean); let reads:any[]=[];
  if(ids.length){const res=await admin.from('NOTIFICATION_READS').select('log_id').eq('admin_email',caller.email).in('log_id',ids);reads=res.data||[];}
  const readSet=new Set(reads.map((r:any)=>r.log_id));
  const result=rows.map((r:any)=>{const m=meta[r.TABLE_NAME]||{page:'dashboard',icon:'fa-bell',label:'Aktivitas'};return{
    logId:r.LOG_ID,page:m.page,icon:m.icon,label:`${m.label} ${actionLabel(String(r.ACTION_TYPE||'UPDATE'))}`,actionType:r.ACTION_TYPE,
    recordId:r.RECORD_ID||'',pelaku:r.USER_EMAIL||'-',deskripsi:r.DESCRIPTION||`${r.ACTION_TYPE} ${r.TABLE_NAME}`,
    waktu:new Date(r.TIMESTAMP).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}),waktuRaw:r.TIMESTAMP||'',isRead:readSet.has(r.LOG_ID)
  }});
  return{success:true,data:result,unreadCount:result.filter((x:any)=>!x.isRead).length};
}

async function markRead(logId:string,caller:any){
  if(!logId)return{success:false,message:'logId wajib diisi.'};
  const{data}=await admin.from('NOTIFICATION_READS').select('id').eq('admin_email',caller.email).eq('log_id',logId).maybeSingle();
  if(!data)await admin.from('NOTIFICATION_READS').insert({admin_email:caller.email,log_id:logId,read_at:new Date().toISOString()});
  return{success:true};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return response({error:'Method tidak didukung.'},405);
  try{
    const token=bearer(req);if(!token)return response({error:'Token wajib disertakan.'},401);
    const caller=await callerFromToken(token);if(!caller)return response({error:'Token tidak valid atau akun tidak ditemukan.'},401);
    const body=await req.json(),fn=body.function,params=Array.isArray(body.parameters)?body.parameters:[];let result;
    if(fn==='getNotifications')result=await getNotifications(caller);
    else if(fn==='markNotificationRead')result=await markRead(String(params[0]||''),caller);
    else if(fn==='markAllNotificationsRead'){const visible=await getNotifications(caller);for(const n of visible.data||[])if(!n.isRead)await markRead(n.logId,caller);result={success:true};}
    else return response({error:'Fungsi tidak dikenali.'},404);
    return response({result});
  }catch(e){console.error(e);return response({error:e instanceof Error?e.message:String(e)},500);}
});
