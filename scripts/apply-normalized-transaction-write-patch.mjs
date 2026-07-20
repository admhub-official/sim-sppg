import fs from 'node:fs';

const path = 'supabase/functions/transaction-action/index.ts';
let source = fs.readFileSync(path, 'utf8');

const helperBlock = `function ownedUpload(c:Caller,kind:string,path:unknown){return valid(path)&&s(path).startsWith(\`${'${kind}'}_${'${c.id}'}_\`)}
function inputDocs(data:any,id:string){return docIndex([
  valid(data.uploadFoto)?{transaksi_id:id,document_type:DT.foto,storage_bucket:B.foto,storage_path:s(data.uploadFoto)}:null,
  valid(data.uploadFile)?{transaksi_id:id,document_type:DT.file,storage_bucket:B.file,storage_path:s(data.uploadFile)}:null,
  valid(data.ttdUser)?{transaksi_id:id,document_type:DT.ttdUser,storage_bucket:B.ttdUser,storage_path:s(data.ttdUser)}:null,
  valid(data.notaPembelian)?{transaksi_id:id,document_type:DT.nota,storage_bucket:B.nota,storage_path:s(data.notaPembelian)}:null
].filter(Boolean) as Doc[])}
function docPayload(d:Map<string,Doc>){return[...d.values()].filter(x=>[DT.foto,DT.file,DT.ttdUser,DT.nota].includes(x.document_type)).map(x=>({document_type:x.document_type,storage_bucket:x.storage_bucket,storage_path:x.storage_path,mime_type:x.mime_type||null,original_file_name:x.original_file_name||s(x.storage_path).split('/').pop()||null}))}
function docFiles(d:Map<string,Doc>){return[...d.values()].map(x=>({bucket:x.storage_bucket,path:x.storage_path}))}
function docKind(type:string){return type===DT.foto?'foto':type===DT.file?'file':type===DT.ttdUser?'ttdUser':'nota'}
`;

const writeBlock = `async function add(d:any,c:Caller){
  const sp=(c.role==='ADMIN'||c.role==='SUPER_ADMIN')?s(d.sppg||c.sppg):c.sppg,ya=(c.role==='ADMIN'||c.role==='SUPER_ADMIN')?s(d.yayasan||c.yayasan):c.yayasan;
  if(!sp||!ya)throw new Error('SPPG dan YAYASAN wajib tersedia.');
  if(c.role==='ADMIN'&&!(await pairOK(c,sp,ya)))throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
  if(!(Number(d.nominal)>0))throw new Error('Nominal transaksi harus lebih dari 0.');
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const core:any={ID:id,'Kode Pemasukan':\`TRX - ${'${crypto.randomUUID().slice(0,8)}'}\`,Tanggal:date(d.tanggal),Kategori:s(d.kategori),'Jenis Kategori':s(d.jenisKategori),SPPG:sp,YAYASAN:ya,Nominal:Number(d.nominal),Catatan:s(d.catatan),Timestamp:new Date().toISOString(),User:c.email,'Nama Item/ Bahan Baku':s(d.namaItem||d.item),'Metode Transaksi':status(d.metodeTransaksi),'APPROVED BY':'','WAKTU APPROVE':'',Catatan_1:'','Catatan Approval':'',Deskripsi:''};
  const docs=inputDocs(d,id),miss=missingDocs(docs);
  if(miss.length)throw new Error(\`Upload wajib belum lengkap atau gagal: ${'${miss.join(", ")}.'}\`);
  const uploaded=[...docs.values()].filter(x=>ownedUpload(c,docKind(x.document_type),x.storage_path)).map(x=>({bucket:x.storage_bucket,path:x.storage_path}));
  try{
    const q=await sb.rpc('create_transaction_with_documents_atomic',{p_transaction:core,p_documents:docPayload(docs),p_uploaded_by:c.email});
    if(q.error)throw q.error;
    const nd=(await docsFor([id])).get(id)||docs;
    await audit(id,'ADD',c,{sp,ya,documentWrite:'normalized-atomic'});
    await systemNotify({mode:'pair',sppg:sp,yayasan:ya,title:'Transaksi baru',body:\`Transaksi ${'${id}'} sebesar Rp ${'${Number(d.nominal).toLocaleString("id-ID")}'} telah dibuat.\`,url:'/?page=transaksi'});
    return{success:true,message:'Transaksi berhasil ditambahkan.',id,data:map(q.data,nd)};
  }catch(e){await removeFiles(uploaded).catch(err=>console.error('cleanup add orphan',err));throw e}
}
async function edit(id:string,f:any,c:Caller){
  const old=await tx(c,id),existing=(await docsFor([id])).get(id)||legacyDocs(old);
  const m:any={'Tanggal':'Tanggal','Kategori':'Kategori','Jenis Kategori':'Jenis Kategori','SPPG':'SPPG','YAYASAN':'YAYASAN','Nama Item/Bahan Baku':'Nama Item/ Bahan Baku','Nominal':'Nominal','Catatan':'Catatan','Metode Transaksi':'Metode Transaksi'};
  const dm:any={'Upload Foto':[DT.foto,B.foto,'foto'],'Upload File':[DT.file,B.file,'file'],'Nota Pembelian':[DT.nota,B.nota,'nota'],'TTD User':[DT.ttdUser,B.ttdUser,'ttdUser']};
  const patch:any={};for(const[k,v]of Object.entries(f||{}))if(m[k])patch[m[k]]=m[k]==='Tanggal'?date(v):v;
  const sp=s(patch.SPPG??old.SPPG),ya=s(patch.YAYASAN??old.YAYASAN);
  if(c.role==='ADMIN'&&!(await pairOK(c,sp,ya)))throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)){delete patch.SPPG;delete patch.YAYASAN;delete patch['Metode Transaksi']}
  const proofState=await sb.from(T.P).select('nominal,status').eq('transaksi_id',id);if(proofState.error)throw proofState.error;
  let submitted=0,verified=0,pendingCount=0;for(const proof of proofState.data||[]){const amount=Number(proof.nominal)||0,ps=status(proof.status);if(ps!=='DITOLAK')submitted+=amount;if(ps==='TERVERIFIKASI')verified+=amount;if(ps==='MENUNGGU_VERIFIKASI')pendingCount++}
  const targetNominal=Object.prototype.hasOwnProperty.call(patch,'Nominal')?Number(patch.Nominal):Number(old.Nominal);
  if(!(targetNominal>0))throw new Error('Nominal transaksi harus lebih dari 0.');
  if(targetNominal<submitted)throw new Error('Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.');
  if((proofState.data||[]).length){if(verified>=targetNominal)patch['Metode Transaksi']='SUDAH_DIBAYAR';else if(submitted>=targetNominal&&pendingCount>0)patch['Metode Transaksi']='MENUNGGU_VERIFIKASI';else patch['Metode Transaksi']='BELUM_LUNAS'}
  const next=new Map(existing),fresh:any[]=[],obsolete:any[]=[];
  for(const[field,[type,bucket,kind]]of Object.entries(dm) as any){if(!Object.prototype.hasOwnProperty.call(f||{},field))continue;const path=s(f[field]),before=next.get(type);if(before&&before.storage_path!==path)obsolete.push({bucket:before.storage_bucket,path:before.storage_path});if(valid(path)){next.set(type,{transaksi_id:id,document_type:type,storage_bucket:bucket,storage_path:path});if(ownedUpload(c,kind,path))fresh.push({bucket,path})}else next.delete(type)}
  const miss=missingDocs(next);if(miss.length)throw new Error(\`Upload wajib belum lengkap atau gagal: ${'${miss.join(", ")}.'}\`);
  try{
    const q=await sb.rpc('update_transaction_with_documents_atomic',{p_transaksi_id:id,p_patch:patch,p_documents:docPayload(next),p_uploaded_by:c.email});if(q.error)throw q.error;
    await removeFiles(obsolete).catch(err=>console.error('cleanup replaced files',err));
    await audit(id,'EDIT',c,{fields:Object.keys(patch),documentWrite:'normalized-atomic'});
    const nd=(await docsFor([id])).get(id)||next;
    return{success:true,message:'Transaksi berhasil diubah.',data:map(q.data,nd)};
  }catch(e){await removeFiles(fresh).catch(err=>console.error('cleanup edit orphan',err));throw e}
}
`;

const helperPattern = /function ownedUpload[\s\S]*?(?=async function systemNotify)/;
const writePattern = /async function add[\s\S]*?(?=async function note)/;
if (!helperPattern.test(source)) throw new Error('Helper block marker not found');
if (!writePattern.test(source)) throw new Error('Write block marker not found');
source = source.replace(helperPattern, helperBlock);
source = source.replace(writePattern, writeBlock);
source = source.replace("version:4,documentReadSource:T.D,writeMode:'legacy-compatible'", "version:5,documentReadSource:T.D,writeMode:'normalized-atomic'");

for (const marker of ['create_transaction_with_documents_atomic','update_transaction_with_documents_atomic',"writeMode:'normalized-atomic'",'cleanup add orphan','cleanup edit orphan']) {
  if (!source.includes(marker)) throw new Error(`Missing generated marker: ${marker}`);
}
fs.writeFileSync(path, source);
console.log('Normalized transaction write patch applied.');
