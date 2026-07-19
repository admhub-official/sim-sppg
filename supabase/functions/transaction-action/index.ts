import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{persistSession:false,autoRefreshToken:false} });
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const T={U:'USERS',X:'TRANSAKSI',A:'ADMIN_ASSIGNMENT',P:'TRANSAKSI_PAYMENT_PROOFS',L:'AUDIT LOG'};
const B={foto:'transaksi-images',file:'transaksi-files',ttdUser:'paraf-user',nota:'nota-pembelian',ttdVerif:'paraf-verifikator',payment:'bukti-payment'};
type Caller={id:string,email:string,role:string,sppg:string,yayasan:string,nama:string};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
const s=(v:unknown)=>String(v??'').trim();
const lo=(v:unknown)=>s(v).toLowerCase();
const status=(v:unknown)=>{const x=s(v).toUpperCase().replace(/\s+/g,'_');return x==='LUNAS'?'SUDAH_DIBAYAR':(x||'BELUM_BAYAR')};
const valid=(v:unknown)=>{const x=s(v);return !!x&&x!=='-'&&!/^(FOTO|FILE)$/i.test(x)};
const date=(v:unknown)=>{const x=s(v);if(!x)return new Date().toISOString().slice(0,10);if(/^\d{4}-\d{2}-\d{2}/.test(x))return x.slice(0,10);const m=x.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:x};
const missingDocs=(r:any)=>{const miss=[] as string[];if(!valid(r['UPLOUD FOTO'])&&!valid(r['UPLOUD FILE']))miss.push('Bukti Transaksi');if(!valid(r['TTD USER']))miss.push('TTD User');if(!valid(r['NOTA PEMBELIAN']))miss.push('Nota Pembelian');return miss};
const doc=(r:any)=>{const miss=missingDocs(r);return miss.length?`Dokumen Tidak Lengkap: ${miss.join(', ')}`:'Dokumen Lengkap'};
const requireCompleteDocs=(r:any)=>{const miss=missingDocs(r);if(miss.length)throw new Error(`Upload wajib belum lengkap atau gagal: ${miss.join(', ')}.`)};
function bytes(v:string){const raw=v.includes(',')?v.split(',').pop()!:v;const bin=atob(raw);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function map(r:any){return{id:r.ID||'',kode:r['Kode Pemasukan']||'',tanggal:r.Tanggal||'',kategori:r.Kategori||'',jenisKategori:r['Jenis Kategori']||'',sppg:r.SPPG||'',yayasan:r.YAYASAN||'',nominal:Number(r.Nominal)||0,uploadFoto:r['UPLOUD FOTO']||'',uploadFile:r['UPLOUD FILE']||'',catatan:r.Catatan||'',user:r.User||'',item:r['Nama Item/ Bahan Baku']||'',namaItem:r['Nama Item/ Bahan Baku']||'',metodeTransaksi:status(r['Metode Transaksi']),ttdVerifikator:r['TTD VERIFIKATOR']||'',ttdUser:r['TTD USER']||'',notaPembelian:r['NOTA PEMBELIAN']||'',approvedBy:r['APPROVED BY']||'',waktuApprove:r['WAKTU APPROVE']||'',statusDokumen:doc(r),catatanApproval:r.Catatan_1||''}}
async function caller(req:Request):Promise<Caller>{const h=req.headers.get('Authorization')||'';const token=h.startsWith('Bearer ')?h.slice(7):'';if(!token)throw new Error('Token tidak ditemukan.');const {data,error}=await sb.auth.getUser(token);if(error||!data.user)throw new Error('Token tidak valid atau kedaluwarsa.');const q=await sb.from(T.U).select('ID,EMAIL,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"').eq('ID',data.user.id).maybeSingle();if(q.error||!q.data)throw new Error('Profil user tidak ditemukan.');return{id:data.user.id,email:lo(data.user.email||q.data.EMAIL),role:s(q.data.ROLE).toUpperCase(),sppg:s(q.data.SPPG),yayasan:s(q.data['NAMA YAYASAN']),nama:s(q.data['NAMA LENGKAP'])}}
async function pairs(c:Caller){if(c.role!=='ADMIN')return[];const q=await sb.from(T.A).select('sppg,yayasan').eq('admin_email',c.email);if(q.error)throw q.error;return(q.data||[]).map((r:any)=>[s(r.sppg),s(r.yayasan)])}
async function pairOK(c:Caller,sp:unknown,ya:unknown){if(c.role==='SUPER_ADMIN')return true;if(c.role!=='ADMIN')return false;const x=s(sp),y=s(ya);return(await pairs(c)).some(([a,b])=>a===x&&b===y)}
async function access(c:Caller,r:any){if(c.role==='SUPER_ADMIN')return true;if(c.role==='ADMIN')return pairOK(c,r.SPPG,r.YAYASAN);return lo(r.User)===c.email}
async function tx(c:Caller,id:string){const q=await sb.from(T.X).select('*').eq('ID',id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Transaksi tidak ditemukan.');if(!(await access(c,q.data)))throw new Error('Akses transaksi ditolak.');return q.data}
async function upload(kind:keyof typeof B,b64:string,mime:string,name:string,prefix:string){const rules:any={foto:/^image\/(jpeg|jpg|png|webp|heic|heif)$/i,file:/^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,ttdUser:/^image\/(png|jpeg|jpg|webp)$/i,nota:/^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,ttdVerif:/^image\/(png|jpeg|jpg|webp)$/i,payment:/^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i};if(!rules[kind].test(s(mime)))throw new Error('Tipe MIME file tidak diizinkan.');if(!b64||!name)throw new Error('Data file tidak lengkap.');const path=`${prefix}_${Date.now()}_${crypto.randomUUID()}_${s(name).replace(/[^a-zA-Z0-9._-]/g,'_')}`;const q=await sb.storage.from(B[kind]).upload(path,bytes(b64),{contentType:mime,upsert:false});if(q.error)throw new Error(`Upload gagal: ${q.error.message}`);return path}
async function sign(kind:keyof typeof B,path:unknown,mime?:string){if(!valid(path))return null;const q=await sb.storage.from(B[kind]).createSignedUrl(s(path),3600);if(q.error||!q.data?.signedUrl)return null;return{path:s(path),bucket:B[kind],name:s(path).split('/').pop(),signedUrl:q.data.signedUrl,signedThumbnailUrl:q.data.signedUrl,mimeType:mime||null}}
async function audit(id:string,action:string,c:Caller,detail:any){try{await sb.from(T.L).insert({TIMESTAMP:new Date().toISOString(),USER_EMAIL:c.email,USER_NAME:c.nama,ROLE:c.role,SPPG:c.sppg,ACTION_TYPE:action,TABLE_NAME:T.X,RECORD_ID:id,FIELD_CHANGED:'TRANSACTION_SECURITY',OLD_VALUE:'',NEW_VALUE:JSON.stringify(detail).slice(0,500),DESCRIPTION:`${action} ${T.X}`,IP_USER:'',STATUS:'SUCCESS'})}catch(e){console.error('audit',e)}}
function txPageSpec(v:any){const requested=Number(v?.page)>0||Number(v?.pageSize)>0;if(!requested)return null;const page=Math.max(1,Math.floor(Number(v?.page)||1));const pageSize=Math.min(100,Math.max(1,Math.floor(Number(v?.pageSize)||25)));return{page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1}}
async function list(filters:any,c:Caller){let q=sb.from(T.X).select('*').order('Tanggal',{ascending:false});if(filters?.sppg&&filters.sppg!=='ALL')q=q.eq('SPPG',filters.sppg);if(filters?.yayasan&&filters.yayasan!=='ALL')q=q.eq('YAYASAN',filters.yayasan);if(filters?.kategori&&filters.kategori!=='ALL')q=q.eq('Kategori',filters.kategori);if(filters?.dateStart)q=q.gte('Tanggal',date(filters.dateStart));if(filters?.dateEnd)q=q.lte('Tanggal',date(filters.dateEnd));const r=await q;if(r.error)throw r.error;const out=[];for(const row of r.data||[])if(await access(c,row))out.push(map(row));const pg=txPageSpec(filters);if(!pg)return out;const total=out.length;return{data:out.slice(pg.from,pg.to+1),page:pg.page,pageSize:pg.pageSize,total,hasMore:pg.to+1<total}}
async function detail(id:string,c:Caller){const r=await tx(c,id);const p=await sb.from(T.P).select('*').eq('transaksi_id',id).order('payment_sequence',{ascending:true});if(p.error)throw p.error;const proofs=[];for(const x of p.data||[])proofs.push({...x,nominal:Number(x.nominal)||0,file:await sign('payment',x.storage_path,x.mime_type),verifierSignature:await sign('ttdVerif',x.verifier_signature_path,'image/png')});return{...map(r),fileBuktiFoto:await sign('foto',r['UPLOUD FOTO']),fileBuktiFile:await sign('file',r['UPLOUD FILE']),fileBuktiApproval:await sign('payment',r['LINK FOTO/ FILE  BUKTI TRANSAKSI']),fileNota:await sign('nota',r['NOTA PEMBELIAN']),fileTtdUser:await sign('ttdUser',r['TTD USER']),fileTtdVerif:await sign('ttdVerif',r['TTD VERIFIKATOR']),paymentProofs:proofs}}
function ownedUpload(c:Caller,kind:string,path:unknown){return valid(path)&&s(path).startsWith(`${kind}_${c.id}_`)}
function txFileItems(r:any){return[
  {kind:'foto',bucket:B.foto,path:s(r['UPLOUD FOTO'])},
  {kind:'file',bucket:B.file,path:s(r['UPLOUD FILE'])},
  {kind:'ttdUser',bucket:B.ttdUser,path:s(r['TTD USER'])},
  {kind:'nota',bucket:B.nota,path:s(r['NOTA PEMBELIAN'])}
]}

async function systemNotify(payload:any){
  try{
    const base=Deno.env.get('SUPABASE_URL')||'';
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!base||!service)return;
    const r=await fetch(base+'/functions/v1/notification-dispatch-action',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+service},
      body:JSON.stringify({function:'dispatchSystemNotification',parameters:[payload]})
    });
    if(!r.ok)console.error('notification dispatch failed',r.status,await r.text());
  }catch(e){console.error('notification dispatch error',e)}
}

async function add(d:any,c:Caller){
  const sp=(c.role==='ADMIN'||c.role==='SUPER_ADMIN')?s(d.sppg||c.sppg):c.sppg;
  const ya=(c.role==='ADMIN'||c.role==='SUPER_ADMIN')?s(d.yayasan||c.yayasan):c.yayasan;
  if(!sp||!ya)throw new Error('SPPG dan YAYASAN wajib tersedia.');
  if(c.role==='ADMIN'&&!(await pairOK(c,sp,ya)))throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
  if(!(Number(d.nominal)>0))throw new Error('Nominal transaksi harus lebih dari 0.');
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const row:any={ID:id,'Kode Pemasukan':`TRX - ${crypto.randomUUID().slice(0,8)}`,Tanggal:date(d.tanggal),Kategori:s(d.kategori),'Jenis Kategori':s(d.jenisKategori),SPPG:sp,YAYASAN:ya,Nominal:Number(d.nominal),'UPLOUD FOTO':s(d.uploadFoto),'UPLOUD FILE':s(d.uploadFile),Catatan:s(d.catatan),Timestamp:new Date().toISOString(),User:c.email,'Nama Item/ Bahan Baku':s(d.namaItem||d.item),'Metode Transaksi':status(d.metodeTransaksi),'TTD VERIFIKATOR':'','TTD USER':s(d.ttdUser),'NOTA PEMBELIAN':s(d.notaPembelian),'APPROVED BY':'','WAKTU APPROVE':null,'LINK FOTO/ FILE  BUKTI TRANSAKSI':'','LINK  TTD USER':'','LINK FOTO NOTA':'',Catatan_1:'',Deskripsi:''};
  requireCompleteDocs(row);row['STATUS DOKUMEN']=doc(row);
  const uploaded=txFileItems(row).filter(x=>ownedUpload(c,x.kind,x.path)).map(x=>({bucket:x.bucket,path:x.path}));
  try{
    const q=await sb.from(T.X).insert(row).select().single();
    if(q.error)throw q.error;
    await audit(id,'ADD',c,{sp,ya,orphanCleanup:true});
    await systemNotify({mode:'pair',sppg:sp,yayasan:ya,title:'Transaksi baru',body:`Transaksi ${id} sebesar Rp ${Number(d.nominal).toLocaleString('id-ID')} telah dibuat.`,url:'/?page=transaksi'});
    return{success:true,message:'Transaksi berhasil ditambahkan.',id,data:map(q.data)};
  }catch(e){
    await removeFiles(uploaded).catch(err=>console.error('cleanup add orphan',err));
    throw e;
  }
}
async function edit(id:string,f:any,c:Caller){
  const old=await tx(c,id);
  const m:any={'Tanggal':'Tanggal','Kategori':'Kategori','Jenis Kategori':'Jenis Kategori','SPPG':'SPPG','YAYASAN':'YAYASAN','Nama Item/Bahan Baku':'Nama Item/ Bahan Baku','Nominal':'Nominal','Catatan':'Catatan','Metode Transaksi':'Metode Transaksi','Upload Foto':'UPLOUD FOTO','Upload File':'UPLOUD FILE','Nota Pembelian':'NOTA PEMBELIAN','TTD User':'TTD USER'};
  const patch:any={};for(const [k,v]of Object.entries(f||{}))if(m[k])patch[m[k]]=m[k]==='Tanggal'?date(v):v;
  const sp=s(patch.SPPG??old.SPPG),ya=s(patch.YAYASAN??old.YAYASAN);
  if(c.role==='ADMIN'&&!(await pairOK(c,sp,ya)))throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)){delete patch.SPPG;delete patch.YAYASAN;delete patch['Metode Transaksi']}
  const proofState=await sb.from(T.P).select('nominal,status').eq('transaksi_id',id);
  if(proofState.error)throw proofState.error;
  let submitted=0,verified=0,pendingCount=0;
  for(const proof of proofState.data||[]){const amount=Number(proof.nominal)||0,proofStatus=status(proof.status);if(proofStatus!=='DITOLAK')submitted+=amount;if(proofStatus==='TERVERIFIKASI')verified+=amount;if(proofStatus==='MENUNGGU_VERIFIKASI')pendingCount++;}
  const targetNominal=Object.prototype.hasOwnProperty.call(patch,'Nominal')?Number(patch.Nominal):Number(old.Nominal);
  if(!(targetNominal>0))throw new Error('Nominal transaksi harus lebih dari 0.');
  if(targetNominal<submitted)throw new Error('Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.');
  if((proofState.data||[]).length){if(verified>=targetNominal)patch['Metode Transaksi']='SUDAH_DIBAYAR';else if(submitted>=targetNominal&&pendingCount>0)patch['Metode Transaksi']='MENUNGGU_VERIFIKASI';else patch['Metode Transaksi']='BELUM_LUNAS';}
  const merged={...old,...patch};requireCompleteDocs(merged);patch['STATUS DOKUMEN']=doc(merged);
  const before=txFileItems(old),after=txFileItems(merged);
  const fresh=after.filter((x,i)=>x.path!==before[i].path&&ownedUpload(c,x.kind,x.path)).map(x=>({bucket:x.bucket,path:x.path}));
  const obsolete=before.filter((x,i)=>valid(x.path)&&x.path!==after[i].path).map(x=>({bucket:x.bucket,path:x.path}));
  try{
    const q=await sb.from(T.X).update(patch).eq('ID',id).select().single();
    if(q.error)throw q.error;
    await removeFiles(obsolete).catch(err=>console.error('cleanup replaced files',err));
    await audit(id,'EDIT',c,{fields:Object.keys(patch),oldFilesDeleted:obsolete.length,orphanCleanup:true});
    return{success:true,message:'Transaksi berhasil diubah.',data:map(q.data)};
  }catch(e){
    await removeFiles(fresh).catch(err=>console.error('cleanup edit orphan',err));
    throw e;
  }
}
async function approve(d:any,c:Caller){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat melakukan approval.');const r=await tx(c,s(d.id||d.txId));let bp='',tt='';if(d.buktiBase64)bp=await upload('payment',d.buktiBase64,d.buktiMimeType||'image/png',d.buktiFileName||'bukti.png',`BUKTI_APPROVAL_${r.ID}`);if(d.ttdBase64)tt=await upload('ttdVerif',d.ttdBase64,'image/png',`TTD_${r.ID}.png`,`TTD_VERIF_${r.ID}`);const p:any={'Metode Transaksi':'SUDAH_DIBAYAR','APPROVED BY':s(d.approvedBy||c.nama||c.email),'WAKTU APPROVE':new Date().toISOString(),Catatan_1:s(d.catatanApproval)};if(bp)p['LINK FOTO/ FILE  BUKTI TRANSAKSI']=bp;if(tt)p['TTD VERIFIKATOR']=tt;const q=await sb.from(T.X).update(p).eq('ID',r.ID);if(q.error){const files=[] as string[];if(bp)files.push(bp);if(files.length)await sb.storage.from(B.payment).remove(files).catch(()=>undefined);if(tt)await sb.storage.from(B.ttdVerif).remove([tt]).catch(()=>undefined);throw q.error}await audit(r.ID,'APPROVE',c,{bp,tt});await systemNotify({mode:'email',email:s(r.User),title:'Transaksi disetujui',body:`Transaksi ${r.ID} telah disetujui.`,url:'/?page=transaksi'});return{success:true,message:'Transaksi berhasil di-approve.'}}
async function submitPayment(d:any,c:Caller){
  const r=await tx(c,s(d.txId));
  const nominal=Number(d.nominalDibayar);
  if(!(nominal>0))throw new Error('Nominal pembayaran harus lebih dari 0.');
  const mime=d.buktiMimeType||'image/png',name=d.buktiFileName||'bukti.png';
  const path=await upload('payment',d.buktiBase64,mime,name,`BUKTI_USER_${r.ID}`);
  try{
    const q=await sb.rpc('submit_transaction_payment_atomic',{
      p_transaksi_id:r.ID,p_nominal:nominal,p_storage_bucket:B.payment,
      p_storage_path:path,p_mime_type:mime,p_original_file_name:name,p_submitted_by:c.email
    });
    if(q.error)throw q.error;
    const x=q.data||{};
    await audit(r.ID,'USER_SUBMIT_BUKTI',c,{seq:x.paymentSequence,nominal,total:x.totalDibayar,status:x.status,atomic:true});
    await systemNotify({mode:'pair',sppg:s(r.SPPG),yayasan:s(r.YAYASAN),title:'Bukti pembayaran baru',body:`Bukti pembayaran transaksi ${r.ID} menunggu verifikasi.`,url:'/?page=transaksi'});
    return{success:true,message:'Bukti pembayaran tersimpan dalam riwayat.',paymentSequence:x.paymentSequence,totalDibayar:x.totalDibayar,status:x.status};
  }catch(e){
    await sb.storage.from(B.payment).remove([path]).catch(()=>undefined);
    throw e;
  }
}
async function verify(d:any,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat memverifikasi.');
  const r=await tx(c,s(d.txId));
  let q=sb.from(T.P).select('*').eq('transaksi_id',r.ID);
  if(d.proofId)q=q.eq('id',d.proofId);
  else if(d.paymentSequence)q=q.eq('payment_sequence',Number(d.paymentSequence));
  else q=q.eq('status','MENUNGGU_VERIFIKASI').order('payment_sequence',{ascending:false}).limit(1);
  const p=await q.maybeSingle();
  if(p.error)throw p.error;
  if(!p.data)throw new Error('Bukti pembayaran tidak ditemukan.');
  const ok=d.accepted!==false&&s(d.status).toUpperCase()!=='DITOLAK';
  let tt='';
  if(d.ttdBase64)tt=await upload('ttdVerif',d.ttdBase64,'image/png',`TTD_${r.ID}.png`,`TTD_VERIF_${r.ID}`);
  try{
    const rpc=await sb.rpc('verify_transaction_payment_atomic',{
      p_transaksi_id:r.ID,
      p_proof_id:p.data.id,
      p_accepted:ok,
      p_verified_by:c.email,
      p_verified_name:c.nama||c.email,
      p_verification_notes:s(d.catatanApproval||d.verificationNotes),
      p_verifier_signature_path:tt||null
    });
    if(rpc.error)throw rpc.error;
    const x=rpc.data||{};
    await audit(r.ID,'VERIFY_USER_PAYMENT',c,{proofId:p.data.id,ok,total:x.totalVerified,status:x.status,atomic:true});
    await systemNotify({mode:'email',email:s(r.User),title:ok?'Pembayaran diverifikasi':'Pembayaran ditolak',body:`Bukti pembayaran transaksi ${r.ID} ${ok?'telah diverifikasi':'ditolak'}.`,url:'/?page=transaksi'});
    return{success:true,message:ok?'Bukti pembayaran berhasil diverifikasi.':'Bukti pembayaran ditolak.',totalVerified:Number(x.totalVerified)||0,status:s(x.status)};
  }catch(e){
    if(tt)await sb.storage.from(B.ttdVerif).remove([tt]).catch(()=>undefined);
    throw e;
  }
}
async function note(p:any[],c:Caller){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');const a=p[0],id=typeof a==='object'?s(a.txId||a.id):s(a),n=typeof a==='object'?s(a.note||a.catatanApproval||a.catatan):s(p[1]);await tx(c,id);const q=await sb.from(T.X).update({Catatan_1:n}).eq('ID',id);if(q.error)throw q.error;return{success:true,message:'Catatan berhasil disimpan.'}}
async function uploadFile(p:any[],c:Caller){const kind=s(p[3]) as keyof typeof B;if(!['foto','file','ttdUser','nota'].includes(kind))throw new Error('Tipe file transaksi tidak diizinkan.');const path=await upload(kind,p[0],p[1],p[2],`${kind}_${c.id}`);return{success:true,fileName:path,bucket:B[kind],viewUrl:(await sign(kind,path,p[1]))?.signedUrl||''}}
async function removeFiles(items:{bucket:string,path:string}[]){const grouped=new Map<string,string[]>();for(const x of items){if(!valid(x.path)||!x.bucket)continue;const a=grouped.get(x.bucket)||[];if(!a.includes(s(x.path)))a.push(s(x.path));grouped.set(x.bucket,a)}for(const [bucket,paths] of grouped){if(!paths.length)continue;const q=await sb.storage.from(bucket).remove(paths);if(q.error)throw new Error(`Gagal membersihkan Storage ${bucket}: ${q.error.message}`)}}
async function del(id:string,c:Caller){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat menghapus transaksi.');const r=await tx(c,id);const pq=await sb.from(T.P).select('storage_bucket,storage_path,verifier_signature_path').eq('transaksi_id',id);if(pq.error)throw pq.error;const files:{bucket:string,path:string}[]=[{bucket:B.foto,path:r['UPLOUD FOTO']},{bucket:B.file,path:r['UPLOUD FILE']},{bucket:B.ttdUser,path:r['TTD USER']},{bucket:B.nota,path:r['NOTA PEMBELIAN']},{bucket:B.ttdVerif,path:r['TTD VERIFIKATOR']},{bucket:B.payment,path:r['LINK FOTO/ FILE  BUKTI TRANSAKSI']}];for(const p of pq.data||[]){files.push({bucket:s(p.storage_bucket)||B.payment,path:p.storage_path},{bucket:B.ttdVerif,path:p.verifier_signature_path})}await removeFiles(files);const q=await sb.from(T.X).delete().eq('ID',id);if(q.error)throw q.error;await audit(id,'DELETE',c,{storageFilesDeleted:files.filter(x=>valid(x.path)).length});return{success:true,message:'Transaksi dan file Storage terkait berhasil dihapus.'}}
const H:any={getTransactions:(p:any[],c:Caller)=>list(p[0]||{},c),getTransactionDetail:(p:any[],c:Caller)=>detail(s(p[0]),c),addTransaction:(p:any[],c:Caller)=>add(p[0]||{},c),editTransaction:(p:any[],c:Caller)=>edit(s(p[0]),p[1]||{},c),approveTransaction:(p:any[],c:Caller)=>approve(p[0]||{},c),submitUserBuktiPembayaran:(p:any[],c:Caller)=>submitPayment(p[0]||{},c),verifyUserPayment:(p:any[],c:Caller)=>verify(p[0]||{},c),sendCatatanApproval:note,uploadTxFile:uploadFile,deleteTransaction:(p:any[],c:Caller)=>del(s(p[0]),c)};
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method==='GET')return j({status:'ok',service:'transaction-action',version:3});if(req.method!=='POST')return j({error:'Method tidak didukung.'},405);try{const c=await caller(req),body=await req.json(),fn=H[body?.function];if(!fn)return j({error:`Fungsi tidak diizinkan: ${body?.function||''}`},404);const result=await fn(Array.isArray(body.parameters)?body.parameters:[],c);return j({result})}catch(e){const message=e instanceof Error?e.message:String(e);const denied=/akses|token|hanya admin|di-assign/i.test(message);console.error(message);return j({error:message,result:{success:false,message}},denied?403:400)}});
