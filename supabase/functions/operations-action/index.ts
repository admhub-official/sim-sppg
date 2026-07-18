import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{persistSession:false,autoRefreshToken:false} });
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
const s=(v:unknown)=>String(v??'').trim(); const lo=(v:unknown)=>s(v).toLowerCase();
type Caller={id:string,email:string,username:string,role:string,sppg:string,yayasan:string,nama:string};

async function caller(req:Request):Promise<Caller>{
  const h=req.headers.get('Authorization')||''; const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token) throw new Error('Token tidak ditemukan.');
  const {data,error}=await sb.auth.getUser(token); if(error||!data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"').eq('ID',data.user.id).maybeSingle();
  if(q.error||!q.data) throw new Error('Profil user tidak ditemukan.');
  return{id:data.user.id,email:lo(data.user.email||q.data.EMAIL),username:lo(q.data.USERNAME),role:s(q.data.ROLE).toUpperCase(),sppg:s(q.data.SPPG),yayasan:s(q.data['NAMA YAYASAN']),nama:s(q.data['NAMA LENGKAP'])};
}
async function assignments(c:Caller){if(c.role!=='ADMIN')return[];const q=await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email',c.email);if(q.error)throw q.error;return(q.data||[]).map((r:any)=>[s(r.sppg),s(r.yayasan)] as [string,string]);}
async function pairOK(c:Caller,sp:unknown,ya:unknown){if(c.role==='SUPER_ADMIN')return true;if(c.role!=='ADMIN')return false;const x=s(sp),y=s(ya);return(await assignments(c)).some(([a,b])=>a===x&&b===y);}
async function profileByOwner(owner:unknown){const x=lo(owner);if(!x)return null;const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"').or(`EMAIL.eq.${x},USERNAME.eq.${x}`).limit(1).maybeSingle();if(q.error)throw q.error;return q.data;}
async function ownerOK(c:Caller,owner:unknown){if(c.role==='SUPER_ADMIN')return true;const x=lo(owner);if(c.role==='USER')return x===c.email||x===c.username;if(c.role!=='ADMIN')return false;const p=await profileByOwner(owner);return !!p&&await pairOK(c,p.SPPG,p['NAMA YAYASAN']);}
async function requireRecord(c:Caller,table:string,id:string,ownerCol='USER'){const q=await sb.from(table).select('*').eq('ID',id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Data tidak ditemukan.');if(!(await ownerOK(c,q.data[ownerCol])))throw new Error('Akses record ditolak.');return q.data;}
async function audit(c:Caller,table:string,id:string,action:string,detail:any){try{await sb.from('AUDIT LOG').insert({TIMESTAMP:new Date().toISOString(),USER_EMAIL:c.email,USER_NAME:c.nama,ROLE:c.role,SPPG:c.sppg,ACTION_TYPE:action,TABLE_NAME:table,RECORD_ID:id,FIELD_CHANGED:'HARDENED_AUTH',OLD_VALUE:'',NEW_VALUE:JSON.stringify(detail).slice(0,500),DESCRIPTION:`${action} ${table}`,IP_USER:'',STATUS:'SUCCESS'})}catch(e){console.error('audit',e)}}
async function systemNotify(payload:any){try{const base=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!base||!service)return;const r=await fetch(base+'/functions/v1/notification-dispatch-action',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+service},body:JSON.stringify({function:'dispatchSystemNotification',parameters:[payload]}),signal:AbortSignal.timeout(8000)});if(!r.ok)console.error('notification dispatch failed',r.status,await r.text())}catch(e){console.error('notification dispatch error',e)}}

const STORAGE_FILES:any={
  'SURVEI_BB':{'FOTO BAHAN BAKU':'foto-bb'},
  'SERAH_TERIMA':{'FOTO BARANG DATANG':'foto-datang','FOTO SURAT JALAN':'foto-datang','TTD PENERIMA':'ttd-penerima','TTD SUPPLIER':'ttd-supplier-inv'},
  'Pending Payment':{'Bukti Pembayaran':'bukti-payment'}
};
async function removeStorageFiles(items:{bucket:string,path:any}[]){for(const x of items){const p=s(x.path);if(!p)continue;const q=await sb.storage.from(x.bucket).remove([p]);if(q.error)throw new Error(`Gagal menghapus file ${x.bucket}: ${q.error.message}`)}}
function recordFiles(table:string,row:any){const map=STORAGE_FILES[table]||{};return Object.entries(map).map(([field,bucket])=>({bucket:String(bucket),path:row?.[field]})).filter(x=>s(x.path));}
function changedFiles(table:string,old:any,patch:any){const map=STORAGE_FILES[table]||{},fresh:any[]=[],obsolete:any[]=[];for(const [field,bucket] of Object.entries(map)){if(!Object.prototype.hasOwnProperty.call(patch,field))continue;const before=s(old?.[field]),after=s(patch?.[field]);if(before===after)continue;if(after)fresh.push({bucket:String(bucket),path:after});if(before)obsolete.push({bucket:String(bucket),path:before});}return{fresh,obsolete};}

function pageSpec(v:any){const requested=Number(v?.page)>0||Number(v?.pageSize)>0;if(!requested)return null;const page=Math.max(1,Math.floor(Number(v?.page)||1));const pageSize=Math.min(100,Math.max(1,Math.floor(Number(v?.pageSize)||25)));return{page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1}}
function paged(data:any[],v:any){const x=pageSpec(v);if(!x)return null;const total=data.length;return{data:data.slice(x.from,x.to+1),page:x.page,pageSize:x.pageSize,total,hasMore:x.to+1<total}}

async function getAllUsers(c:Caller,opt:any={}){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');const q=await sb.from('USERS').select('ID,"NAMA LENGKAP",EMAIL,JABATAN,SPPG,ROLE,"FOTO PROFIL",TIMESTAMP,USERNAME,"NAMA YAYASAN"').order('TIMESTAMP',{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[]){if(c.role==='SUPER_ADMIN'||await pairOK(c,r.SPPG,r['NAMA YAYASAN']))out.push({id:r.ID,namaLengkap:r['NAMA LENGKAP'],email:r.EMAIL,jabatan:r.JABATAN,sppg:r.SPPG,role:r.ROLE,fotoProfil:r['FOTO PROFIL'],timestamp:r.TIMESTAMP,username:r.USERNAME,namaYayasan:r['NAMA YAYASAN']||''});}const pg=paged(out,opt);return pg?{success:true,...pg}:{success:true,data:out};}
async function deleteUser(username:string,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');
  const q=await sb.from('USERS').select('*').eq('USERNAME',lo(username)).maybeSingle();
  if(q.error)throw q.error;if(!q.data)throw new Error('User tidak ditemukan.');
  if(q.data.ID===c.id)throw new Error('Tidak bisa menghapus akun sendiri.');
  if(q.data.ROLE==='SUPER_ADMIN')throw new Error('Akun SUPER_ADMIN tidak dapat dihapus dari endpoint ini.');
  if(c.role==='ADMIN'){
    if(q.data.ROLE!=='USER')throw new Error('ADMIN hanya dapat menghapus USER.');
    if(!(await pairOK(c,q.data.SPPG,q.data['NAMA YAYASAN'])))throw new Error('Target di luar assignment ADMIN.');
  }
  const email=lo(q.data.EMAIL),photo=s(q.data['FOTO PROFIL']);
  const assignment=await sb.from('ADMIN_ASSIGNMENT').delete().eq('admin_email',email);if(assignment.error)throw assignment.error;
  const push=await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('user_email',email);if(push.error)throw push.error;
  const a=await sb.auth.admin.deleteUser(q.data.ID);if(a.error)throw a.error;
  const d=await sb.from('USERS').delete().eq('ID',q.data.ID);if(d.error)throw d.error;
  if(photo){const cleanup=await sb.storage.from('foto-profil').remove([photo]);if(cleanup.error)console.error('profile cleanup',cleanup.error.message);}
  await audit(c,'USERS',q.data.ID,'DELETE',{username,email,profilePhotoDeleted:!!photo,pushSubscriptionsDeleted:true,assignmentsDeleted:true});
  return{success:true,message:'User dan file profil terkait berhasil dihapus.'};
}

function requireSuperAdmin(c:Caller){if(c.role!=='SUPER_ADMIN')throw new Error('Hanya SUPER_ADMIN yang dapat mengelola assignment.');}
async function requireAdminAccount(email:unknown){const e=lo(email);if(!e)throw new Error('Email ADMIN wajib diisi.');const q=await sb.from('USERS').select('ID,EMAIL,ROLE').eq('EMAIL',e).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Akun ADMIN tidak ditemukan.');if(s(q.data.ROLE).toUpperCase()!=='ADMIN')throw new Error('Assignment hanya dapat diberikan kepada akun dengan ROLE ADMIN.');return e;}
async function getAdminAssignments(targetEmail:string,c:Caller){requireSuperAdmin(c);let q=sb.from('ADMIN_ASSIGNMENT').select('id,admin_email,sppg,yayasan,created_at,created_by').order('created_at',{ascending:false});if(lo(targetEmail))q=q.eq('admin_email',lo(targetEmail));const r=await q;if(r.error)throw r.error;return{success:true,data:r.data||[]};}
async function addAdminAssignment(email:string,sp:string,ya:string,c:Caller){requireSuperAdmin(c);const e=await requireAdminAccount(email),sppg=s(sp),yayasan=s(ya);if(!sppg||!yayasan)throw new Error('SPPG dan Yayasan wajib diisi.');const existing=await sb.from('ADMIN_ASSIGNMENT').select('id').eq('admin_email',e).eq('sppg',sppg).eq('yayasan',yayasan).maybeSingle();if(existing.error)throw existing.error;if(existing.data)throw new Error('Assignment yang sama sudah tersedia.');const q=await sb.from('ADMIN_ASSIGNMENT').insert({admin_email:e,sppg,yayasan,created_by:c.email}).select('id').single();if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',q.data.id,'ADD',{admin_email:e,sppg,yayasan});await systemNotify({mode:'email',email:e,title:'Assignment ADMIN baru',body:`Anda ditugaskan untuk ${sppg} — ${yayasan}.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil ditambahkan.',id:q.data.id};}
async function updateAdminAssignment(id:string,sp:string,ya:string,c:Caller){requireSuperAdmin(c);const assignmentId=s(id),sppg=s(sp),yayasan=s(ya);if(!assignmentId||!sppg||!yayasan)throw new Error('ID, SPPG, dan Yayasan wajib diisi.');const old=await sb.from('ADMIN_ASSIGNMENT').select('*').eq('id',assignmentId).maybeSingle();if(old.error)throw old.error;if(!old.data)throw new Error('Assignment tidak ditemukan.');const duplicate=await sb.from('ADMIN_ASSIGNMENT').select('id').eq('admin_email',old.data.admin_email).eq('sppg',sppg).eq('yayasan',yayasan).neq('id',assignmentId).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('Assignment tujuan sudah tersedia.');const q=await sb.from('ADMIN_ASSIGNMENT').update({sppg,yayasan}).eq('id',assignmentId);if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'EDIT',{from:{sppg:old.data.sppg,yayasan:old.data.yayasan},to:{sppg,yayasan}});await systemNotify({mode:'email',email:old.data.admin_email,title:'Assignment ADMIN diperbarui',body:`Assignment Anda berubah menjadi ${sppg} — ${yayasan}.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil diperbarui.'};}
async function deleteAdminAssignment(id:string,c:Caller){requireSuperAdmin(c);const assignmentId=s(id);const old=await sb.from('ADMIN_ASSIGNMENT').select('*').eq('id',assignmentId).maybeSingle();if(old.error)throw old.error;if(!old.data)throw new Error('Assignment tidak ditemukan.');const q=await sb.from('ADMIN_ASSIGNMENT').delete().eq('id',assignmentId);if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'DELETE',{admin_email:old.data.admin_email,sppg:old.data.sppg,yayasan:old.data.yayasan});await systemNotify({mode:'email',email:old.data.admin_email,title:'Assignment ADMIN dihapus',body:`Assignment ${old.data.sppg} — ${old.data.yayasan} telah dihapus.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil dihapus.'};}

async function addPending(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const deskripsi=s(d.deskripsi),tanggalPending=s(d.tanggalPending);
  if(!deskripsi||!tanggalPending)throw new Error('Deskripsi dan Tanggal Pending wajib diisi.');
  const row:any={ID:id,Timestamp:new Date().toISOString(),User:c.email,Transaksi:s(d.transaksiRef),Deskripsi:deskripsi,'Tanggal Pending':tanggalPending,'Tanggal Payment':s(d.tanggalPayment)||null,Status:'HUTANG','Tanggal Lunas':null,'Bukti Pembayaran':'',Catatan:''};
  const q=await sb.from('Pending Payment').insert(row);if(q.error)throw q.error;
  await audit(c,'Pending Payment',id,'ADD',{transaksi:row.Transaksi});
  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Pending payment baru',body:`Pending payment ${id} menunggu tindak lanjut.`,url:'/?page=pending-payment'});
  return{success:true,message:'Pending Payment berhasil ditambahkan.',id};
}
async function addSurvei(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const kode=s(d.KODE_BAHAN_BAKU),harga=Number(d.HARGA_PASAR||0),alamat=s(d.ALAMAT_SURVEI);
  if(!kode||!(harga>0)||!alamat)throw new Error('Kode Bahan, Harga Pasar, dan Alamat wajib diisi.');
  const row:any={ID:id,'KODE BAHAN BAKU':kode,'WAKTU SURVEI':new Date().toISOString(),'KATEGORI BAHAN BAKU':s(d.KATEGORI_BAHAN_BAKU),'NAMA BAHAN BAKU':s(d.NAMA_BAHAN_BAKU),'HARGA RAB':Number(d.HARGA_RAB||0),'HARGA PASAR':harga,'ALAMAT SURVEI':alamat,'LOKASI SURVEI':s(d.LOKASI_SURVEI),'FOTO BAHAN BAKU':s(d.FOTO_BAHAN_BAKU),'LINK FOTO BAHAN BAKU':'',USER:c.email,TIMESTAMP:new Date().toISOString(),YAYASAN:c.yayasan||null};
  const q=await sb.from('SURVEI_BB').insert(row);if(q.error){await removeStorageFiles(recordFiles('SURVEI_BB',row)).catch(e=>console.error('cleanup survei add orphan',e));throw q.error;}
  await audit(c,'SURVEI_BB',id,'ADD',{kode});
  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Survei bahan baku baru',body:`Survei ${kode} telah ditambahkan.`,url:'/?page=survei'});
  return{success:true,message:'Data survei berhasil ditambahkan.',id};
}
async function addSerahTerima(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const kode=s(d.KODE_BAHAN_BAKU),penerima=s(d.PENERIMA);
  if(!kode||!penerima)throw new Error('Penerima dan Bahan Baku wajib diisi.');
  const row:any={ID:id,'KODE BAHAN BAKU':kode,'KATEGORI BAHAN BAKU':s(d.KATEGORI_BAHAN_BAKU),'NAMA BAHAN BAKU':s(d.NAMA_BAHAN_BAKU),'FOTO BARANG DATANG':s(d.FOTO_BARANG_DATANG),'LINK FOTO BARANG DATANG':'','FOTO SURAT JALAN':s(d.FOTO_SURAT_JALAN),'LINK FOTO SURAT JALAN':'',PENERIMA:penerima,'TTD PENERIMA':s(d.TTD_PENERIMA),'LINK TTD PENERIMA':'',SUPPLIER:s(d.SUPPLIER),'TTD SUPPLIER':s(d.TTD_SUPPLIER),'LINK TTD SUPPLIER':'','KONDISI BAHAN BAKU':s(d.KONDISI_BAHAN_BAKU),CATATAN:s(d.CATATAN),LOKASI:s(d.LOKASI),USER:c.email,TIMESTAMP:new Date().toISOString(),YAYASAN:c.yayasan||null};
  const q=await sb.from('SERAH_TERIMA').insert(row);if(q.error){await removeStorageFiles(recordFiles('SERAH_TERIMA',row)).catch(e=>console.error('cleanup serah add orphan',e));throw q.error;}
  await audit(c,'SERAH_TERIMA',id,'ADD',{kode,penerima});
  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Serah terima baru',body:`Serah terima ${kode} untuk ${penerima} telah dicatat.`,url:'/?page=serah-terima'});
  return{success:true,message:'Serah terima berhasil ditambahkan.',id};
}
async function addMenu(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const tanggal=s(d.tanggal),jumlahKpm=Number(d.jumlahKpm||0),menu=s(d.menu),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('create_menu_harian_atomic',{p_id:id,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_user:c.email,p_yayasan:c.yayasan||'',p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Menu MBG baru',body:`Menu ${menu} untuk ${jumlahKpm.toLocaleString('id-ID')} KPM telah dibuat.`,url:'/?page=menu-mbg'});
  return{success:true,message:'Menu MBG berhasil ditambahkan.',id};
}

async function updateMenuAtomic(id:string,d:any,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');
  const old=await requireRecord(c,'MENU_HARIAN',id,'USER');
  const tanggal=s(d.TANGGAL??d.tanggal??old.TANGGAL);
  const jumlahKpm=Number((d['JUMLAH KPM']??d.jumlahKpm??old['JUMLAH KPM'])||0);
  const menu=s(d.MENU??d.menu??old.MENU),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('update_menu_harian_atomic',{p_id:id,p_expected_owner:old.USER,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'EDIT',{detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  const owner=await profileByOwner(old.USER);if(owner)await systemNotify({mode:'pair',sppg:owner.SPPG,yayasan:owner['NAMA YAYASAN'],title:'Menu MBG diperbarui',body:`Menu ${menu} tanggal ${tanggal} telah diperbarui.`,url:'/?page=menu-mbg'});
  return{success:true,message:'Menu MBG berhasil diperbarui.'};
}

async function getUploadBuktiMode(c:Caller){
  const q=await sb.from('APP_SETTINGS').select('VALUE').eq('KEY','ALLOW_USER_UPLOAD_BUKTI').maybeSingle();
  if(q.error)throw q.error;
  return{success:true,enabled:String(q.data?.VALUE||'false').toLowerCase()==='true'};
}
async function setUploadBuktiMode(enabled:boolean,c:Caller){
  requireSuperAdmin(c);
  const value=enabled?'true':'false';
  const existing=await sb.from('APP_SETTINGS').select('KEY').eq('KEY','ALLOW_USER_UPLOAD_BUKTI').maybeSingle();
  if(existing.error)throw existing.error;
  const q=existing.data
    ? await sb.from('APP_SETTINGS').update({VALUE:value}).eq('KEY','ALLOW_USER_UPLOAD_BUKTI')
    : await sb.from('APP_SETTINGS').insert({KEY:'ALLOW_USER_UPLOAD_BUKTI',VALUE:value});
  if(q.error)throw q.error;
  await audit(c,'APP_SETTINGS','ALLOW_USER_UPLOAD_BUKTI','TOGGLE_MODE',{enabled});
  return{success:true,enabled,message:'Mode upload bukti berhasil diperbarui.'};
}
async function listOwned(table:string,c:Caller,orderCol='TIMESTAMP'){const q=await sb.from(table).select('*').order(orderCol,{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[])if(await ownerOK(c,r.USER))out.push(r);return out;}
function ownedResult(data:any[],opt:any={}){const pg=paged(data,opt);return pg?{success:true,...pg}:{success:true,data}}
async function getPending(c:Caller,opt:any={}){return ownedResult(await listOwned('Pending Payment',c,'Timestamp'),opt);}
async function updatePending(id:string,data:any,c:Caller){await requireRecord(c,'Pending Payment',id,'User');if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat memperbarui.');const p:any={};if(data.status!==undefined)p.Status=data.status;if(data.tanggalLunas!==undefined)p['Tanggal Lunas']=data.tanggalLunas||null;if(data.buktiPembayaran!==undefined)p['Bukti Pembayaran']=data.buktiPembayaran;if(data.catatan!==undefined)p.Catatan=data.catatan;const q=await sb.from('Pending Payment').update(p).eq('ID',id);if(q.error)throw q.error;await audit(c,'Pending Payment',id,'EDIT',Object.keys(p));return{success:true,message:'Pending Payment diperbarui.'};}
async function delRecord(table:string,id:string,c:Caller,ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat menghapus.');const old=await requireRecord(c,table,id,ownerCol);const files=recordFiles(table,old);const q=await sb.from(table).delete().eq('ID',id);if(q.error)throw q.error;if(files.length)await removeStorageFiles(files).catch(e=>console.error('cleanup deleted record files',table,id,e));await audit(c,table,id,'DELETE',{storageFiles:files.length});return{success:true,message:'Data berhasil dihapus.'};}
async function updateRecord(table:string,id:string,fields:any,c:Caller,allowed:string[],ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');const old=await requireRecord(c,table,id,ownerCol);const p:any={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(fields||{},k))p[k]=fields[k];if(!Object.keys(p).length)throw new Error('Tidak ada field yang dapat diperbarui.');const files=changedFiles(table,old,p);const q=await sb.from(table).update(p).eq('ID',id);if(q.error){if(files.fresh.length)await removeStorageFiles(files.fresh).catch(e=>console.error('cleanup update orphan',table,id,e));throw q.error;}if(files.obsolete.length)await removeStorageFiles(files.obsolete).catch(e=>console.error('cleanup replaced files',table,id,e));await audit(c,table,id,'EDIT',{fields:Object.keys(p),oldFilesDeleted:files.obsolete.length});return{success:true,message:'Data berhasil diperbarui.'};}
async function getMenu(c:Caller,filters:any){const menus=await listOwned('MENU_HARIAN',c,'TIMESTAMP');let out=menus;if(filters?.dateStart)out=out.filter((r:any)=>s(r.TANGGAL)>=s(filters.dateStart));if(filters?.dateEnd)out=out.filter((r:any)=>s(r.TANGGAL)<=s(filters.dateEnd));const total=out.length,ps=pageSpec(filters),selected=ps?out.slice(ps.from,ps.to+1):out;const ids=selected.map((r:any)=>r.ID);let details:any[]=[];if(ids.length){const q=await sb.from('DETAIL_MENU_HARIAN').select('*').in('MENU_ID',ids);if(q.error)throw q.error;details=q.data||[];}const data=selected.map((r:any)=>({id:r.ID,tanggal:r.TANGGAL,jumlahKpm:r['JUMLAH KPM']||0,menu:r.MENU||'',user:r.USER||'',detail:details.filter((d:any)=>d.MENU_ID===r.ID).map((d:any)=>({namaItem:d['Nama Item']||'',jumlah:d.Jumlah||0,satuan:d.Satuan||'',hargaSatuan:d['Harga Satuan']||0,totalHarga:d['Total Harga']||0}))}));return ps?{success:true,data,page:ps.page,pageSize:ps.pageSize,total,hasMore:ps.to+1<total}:{success:true,data};}

const SURVEI_FIELDS=['KODE BAHAN BAKU','KATEGORI BAHAN BAKU','NAMA BAHAN BAKU','HARGA RAB','HARGA PASAR','ALAMAT SURVEI','LOKASI SURVEI','FOTO BAHAN BAKU','LINK FOTO BAHAN BAKU'];
const SERAH_FIELDS=['KODE BAHAN BAKU','KATEGORI BAHAN BAKU','NAMA BAHAN BAKU','FOTO BARANG DATANG','LINK FOTO BARANG DATANG','FOTO SURAT JALAN','LINK FOTO SURAT JALAN','PENERIMA','TTD PENERIMA','LINK TTD PENERIMA','SUPPLIER','TTD SUPPLIER','LINK TTD SUPPLIER','KONDISI BAHAN BAKU','CATATAN','LOKASI'];
const MENU_FIELDS=['TANGGAL','JUMLAH KPM','MENU'];
const H:any={
 getAllUsers:(p:any[],c:Caller)=>getAllUsers(c,p[0]||{}),deleteUser:(p:any[],c:Caller)=>deleteUser(s(p[0]),c),
 getUploadBuktiMode:(_p:any[],c:Caller)=>getUploadBuktiMode(c),setUploadBuktiMode:(p:any[],c:Caller)=>setUploadBuktiMode(Boolean(p[0]),c),
 addPendingPayment:(p:any[],c:Caller)=>addPending(p[0]||{},c),addSurveiBahanBaku:(p:any[],c:Caller)=>addSurvei(p[0]||{},c),addSerahTerima:(p:any[],c:Caller)=>addSerahTerima(p[0]||{},c),addMenuHarian:(p:any[],c:Caller)=>addMenu(p[0]||{},c),
 getAdminAssignments:(p:any[],c:Caller)=>getAdminAssignments(s(p[0]),c),addAdminAssignment:(p:any[],c:Caller)=>addAdminAssignment(s(p[0]),s(p[1]),s(p[2]),c),updateAdminAssignment:(p:any[],c:Caller)=>updateAdminAssignment(s(p[0]),s(p[1]),s(p[2]),c),deleteAdminAssignment:(p:any[],c:Caller)=>deleteAdminAssignment(s(p[0]),c),
 getPendingPayments:(p:any[],c:Caller)=>getPending(c,p[0]||{}),updatePendingPayment:(p:any[],c:Caller)=>updatePending(s(p[0]),p[1]||{},c),deletePendingPayment:(p:any[],c:Caller)=>delRecord('Pending Payment',s(p[0]),c,'User'),
 getSurveiBahanBaku:async(p:any[],c:Caller)=>ownedResult(await listOwned('SURVEI_BB',c),p[0]||{}),updateSurvei:(p:any[],c:Caller)=>updateRecord('SURVEI_BB',s(p[0]),p[1]||{},c,SURVEI_FIELDS),deleteSurvei:(p:any[],c:Caller)=>delRecord('SURVEI_BB',s(p[0]),c),
 getSerahTerima:async(p:any[],c:Caller)=>ownedResult(await listOwned('SERAH_TERIMA',c),p[0]||{}),updateSerahTerima:(p:any[],c:Caller)=>updateRecord('SERAH_TERIMA',s(p[0]),p[1]||{},c,SERAH_FIELDS),deleteSerahTerima:(p:any[],c:Caller)=>delRecord('SERAH_TERIMA',s(p[0]),c),
 getMenuHarian:(p:any[],c:Caller)=>getMenu(c,p[0]||{}),updateMenuMBG:(p:any[],c:Caller)=>updateMenuAtomic(s(p[0]),p[1]||{},c),deleteMenuMBG:(p:any[],c:Caller)=>delRecord('MENU_HARIAN',s(p[0]),c)
};
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method==='GET')return j({status:'ok',service:'operations-action',version:5});if(req.method!=='POST')return j({error:'Method tidak didukung.'},405);try{const c=await caller(req),b=await req.json(),fn=H[b?.function];if(!fn)return j({error:`Fungsi tidak diizinkan: ${b?.function||''}`},404);return j({result:await fn(Array.isArray(b.parameters)?b.parameters:[],c)})}catch(e){const message=e instanceof Error?e.message:String(e);const denied=/akses|token|hanya admin|super_admin|assignment|ditolak/i.test(message);console.error(message);return j({error:message,result:{success:false,message}},denied?403:400)}});