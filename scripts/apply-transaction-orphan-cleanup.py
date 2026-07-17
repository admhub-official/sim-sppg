from pathlib import Path
import re

path = Path('supabase/functions/transaction-action/index.ts')
text = path.read_text(encoding='utf-8')

helper = """function ownedUpload(c:Caller,kind:string,path:unknown){return valid(path)&&s(path).startsWith(`${kind}_${c.id}_`)}
function txFileItems(r:any){return[
  {kind:'foto',bucket:B.foto,path:s(r['UPLOUD FOTO'])},
  {kind:'file',bucket:B.file,path:s(r['UPLOUD FILE'])},
  {kind:'ttdUser',bucket:B.ttdUser,path:s(r['TTD USER'])},
  {kind:'nota',bucket:B.nota,path:s(r['NOTA PEMBELIAN'])}
]}
"""
if 'function ownedUpload(' not in text:
    anchor = 'async function add(d:any,c:Caller)'
    if anchor not in text:
        raise SystemExit('add anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

new_add = """async function add(d:any,c:Caller){
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
    return{success:true,message:'Transaksi berhasil ditambahkan.',id,data:map(q.data)};
  }catch(e){
    await removeFiles(uploaded).catch(err=>console.error('cleanup add orphan',err));
    throw e;
  }
}
"""
text, count = re.subn(r"async function add\(d:any,c:Caller\)\{.*?\}\nasync function edit", new_add + 'async function edit', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('add function replacement failed')

new_edit = """async function edit(id:string,f:any,c:Caller){
  const old=await tx(c,id);
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)&&status(old['Metode Transaksi'])==='SUDAH_DIBAYAR')throw new Error('Transaksi yang sudah dibayar tidak dapat diedit.');
  const m:any={'Tanggal':'Tanggal','Kategori':'Kategori','Jenis Kategori':'Jenis Kategori','SPPG':'SPPG','YAYASAN':'YAYASAN','Nama Item/Bahan Baku':'Nama Item/ Bahan Baku','Nominal':'Nominal','Catatan':'Catatan','Metode Transaksi':'Metode Transaksi','Upload Foto':'UPLOUD FOTO','Upload File':'UPLOUD FILE','Nota Pembelian':'NOTA PEMBELIAN','TTD User':'TTD USER'};
  const patch:any={};for(const [k,v]of Object.entries(f||{}))if(m[k])patch[m[k]]=m[k]==='Tanggal'?date(v):v;
  const sp=s(patch.SPPG??old.SPPG),ya=s(patch.YAYASAN??old.YAYASAN);
  if(c.role==='ADMIN'&&!(await pairOK(c,sp,ya)))throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)){delete patch.SPPG;delete patch.YAYASAN;delete patch['Metode Transaksi']}
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
"""
text, count = re.subn(r"async function edit\(id:string,f:any,c:Caller\)\{.*?\}\nasync function approve", new_edit + 'async function approve', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('edit function replacement failed')

path.write_text(text, encoding='utf-8')
print('transaction add/edit orphan cleanup installed')
