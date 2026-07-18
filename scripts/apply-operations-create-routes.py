from pathlib import Path

ops = Path('supabase/functions/operations-action/index.ts')
app = Path('app.js')
s = ops.read_text(encoding='utf-8')
a = app.read_text(encoding='utf-8')

anchor = "async function listOwned(table:string,c:Caller,orderCol='TIMESTAMP')"
if 'async function addPending(' not in s:
    block = r'''async function addPending(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const deskripsi=s(d.deskripsi),tanggalPending=s(d.tanggalPending);
  if(!deskripsi||!tanggalPending)throw new Error('Deskripsi dan Tanggal Pending wajib diisi.');
  const row:any={ID:id,Timestamp:new Date().toISOString(),User:c.email,Transaksi:s(d.transaksiRef),Deskripsi:deskripsi,'Tanggal Pending':tanggalPending,'Tanggal Payment':s(d.tanggalPayment)||null,Status:'HUTANG','Tanggal Lunas':null,'Bukti Pembayaran':'',Catatan:''};
  const q=await sb.from('Pending Payment').insert(row);if(q.error)throw q.error;
  await audit(c,'Pending Payment',id,'ADD',{transaksi:row.Transaksi});
  return{success:true,message:'Pending Payment berhasil ditambahkan.',id};
}
async function addSurvei(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const kode=s(d.KODE_BAHAN_BAKU),harga=Number(d.HARGA_PASAR||0),alamat=s(d.ALAMAT_SURVEI);
  if(!kode||!(harga>0)||!alamat)throw new Error('Kode Bahan, Harga Pasar, dan Alamat wajib diisi.');
  const row:any={ID:id,'KODE BAHAN BAKU':kode,'WAKTU SURVEI':new Date().toISOString(),'KATEGORI BAHAN BAKU':s(d.KATEGORI_BAHAN_BAKU),'NAMA BAHAN BAKU':s(d.NAMA_BAHAN_BAKU),'HARGA RAB':Number(d.HARGA_RAB||0),'HARGA PASAR':harga,'ALAMAT SURVEI':alamat,'LOKASI SURVEI':s(d.LOKASI_SURVEI),'FOTO BAHAN BAKU':s(d.FOTO_BAHAN_BAKU),'LINK FOTO BAHAN BAKU':'',USER:c.email,TIMESTAMP:new Date().toISOString(),YAYASAN:c.yayasan||null};
  const q=await sb.from('SURVEI_BB').insert(row);if(q.error)throw q.error;
  await audit(c,'SURVEI_BB',id,'ADD',{kode});
  return{success:true,message:'Data survei berhasil ditambahkan.',id};
}
async function addSerahTerima(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const kode=s(d.KODE_BAHAN_BAKU),penerima=s(d.PENERIMA);
  if(!kode||!penerima)throw new Error('Penerima dan Bahan Baku wajib diisi.');
  const row:any={ID:id,'KODE BAHAN BAKU':kode,'KATEGORI BAHAN BAKU':s(d.KATEGORI_BAHAN_BAKU),'NAMA BAHAN BAKU':s(d.NAMA_BAHAN_BAKU),'FOTO BARANG DATANG':s(d.FOTO_BARANG_DATANG),'LINK FOTO BARANG DATANG':'','FOTO SURAT JALAN':s(d.FOTO_SURAT_JALAN),'LINK FOTO SURAT JALAN':'',PENERIMA:penerima,'TTD PENERIMA':s(d.TTD_PENERIMA),'LINK TTD PENERIMA':'',SUPPLIER:s(d.SUPPLIER),'TTD SUPPLIER':s(d.TTD_SUPPLIER),'LINK TTD SUPPLIER':'','KONDISI BAHAN BAKU':s(d.KONDISI_BAHAN_BAKU),CATATAN:s(d.CATATAN),LOKASI:s(d.LOKASI),USER:c.email,TIMESTAMP:new Date().toISOString(),YAYASAN:c.yayasan||null};
  const q=await sb.from('SERAH_TERIMA').insert(row);if(q.error)throw q.error;
  await audit(c,'SERAH_TERIMA',id,'ADD',{kode,penerima});
  return{success:true,message:'Serah terima berhasil ditambahkan.',id};
}
async function addMenu(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const tanggal=s(d.tanggal),jumlahKpm=Number(d.jumlahKpm||0),menu=s(d.menu),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const parent:any={ID:id,TANGGAL:tanggal,'JUMLAH KPM':jumlahKpm,MENU:menu,USER:c.email,TIMESTAMP:new Date().toISOString(),YAYASAN:c.yayasan||null};
  const q=await sb.from('MENU_HARIAN').insert(parent);if(q.error)throw q.error;
  try{
    const detail=items.filter((x:any)=>s(x?.namaItem)).map((x:any)=>({MENU_ID:id,TANGGAL:tanggal,'Nama Item':s(x.namaItem),Jumlah:Number(x.jumlah||0),Satuan:s(x.satuan),'Harga Satuan':Number(x.hargaSatuan||0),'Total Harga':Number(x.jumlah||0)*Number(x.hargaSatuan||0)}));
    if(detail.length){const dq=await sb.from('DETAIL_MENU_HARIAN').insert(detail);if(dq.error)throw dq.error;}
    await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:detail.length});
    return{success:true,message:'Menu MBG berhasil ditambahkan.',id};
  }catch(e){await sb.from('MENU_HARIAN').delete().eq('ID',id);throw e;}
}

'''
    if anchor not in s:
        raise SystemExit('operations insertion anchor not found')
    s = s.replace(anchor, block + anchor, 1)

old_h = " getAllUsers:(p:any[],c:Caller)=>getAllUsers(c,p[0]||{}),deleteUser:(p:any[],c:Caller)=>deleteUser(s(p[0]),c),"
new_h = old_h + "\n addPendingPayment:(p:any[],c:Caller)=>addPending(p[0]||{},c),addSurveiBahanBaku:(p:any[],c:Caller)=>addSurvei(p[0]||{},c),addSerahTerima:(p:any[],c:Caller)=>addSerahTerima(p[0]||{},c),addMenuHarian:(p:any[],c:Caller)=>addMenu(p[0]||{},c),"
if 'addPendingPayment:(p:any[]' not in s:
    if old_h not in s:
        raise SystemExit('handler map anchor not found')
    s = s.replace(old_h, new_h, 1)

s = s.replace("service:'operations-action',version:3", "service:'operations-action',version:4")

old_map = "  getAllUsers:1, deleteUser:1,\n"
new_map = "  getAllUsers:1, deleteUser:1,\n  addPendingPayment:1, addSurveiBahanBaku:1, addSerahTerima:1, addMenuHarian:1,\n"
if 'addPendingPayment:1' not in a:
    if old_map not in a:
        raise SystemExit('frontend map anchor not found')
    a = a.replace(old_map, new_map, 1)

for token in ['async function addPending(', 'async function addSurvei(', 'async function addSerahTerima(', 'async function addMenu(', 'addPendingPayment:1', 'addMenuHarian:1']:
    if token not in (s + a):
        raise SystemExit(f'missing token: {token}')

ops.write_text(s, encoding='utf-8')
app.write_text(a, encoding='utf-8')
print('operations create routes patched')
