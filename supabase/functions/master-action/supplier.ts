import {sb,s,low,Caller,requireAdmin,audit,rid,B,removeFiles,upload,exactPairs} from './core.ts';

async function canAccessSupplier(c:Caller,row:any){
  if(c.role==='SUPER_ADMIN')return true;
  if(c.role==='USER')return low(row?.USER)===c.email||low(row?.USER)===low(c.username);
  if(c.role!=='ADMIN')return false;
  const pairs=await exactPairs(c);
  return !!pairs?.some(([sp,ya])=>sp===s(row?.SPPG)&&ya===s(row?.YAYASAN));
}

export async function getSupplier(c:Caller){
  const q=await sb.from('MASTER_SUPPLIER').select('*').order('ID',{ascending:false});
  if(q.error)throw q.error;
  const rows=q.data||[];
  if(c.role==='SUPER_ADMIN')return{success:true,data:rows};
  if(c.role==='USER')return{success:true,data:rows.filter((r:any)=>low(r.USER)===c.email||low(r.USER)===low(c.username))};
  if(c.role==='ADMIN'){
    const pairs=await exactPairs(c);
    return{success:true,data:rows.filter((r:any)=>pairs?.some(([sp,ya])=>sp===s(r.SPPG)&&ya===s(r.YAYASAN)))};
  }
  return{success:true,data:[]};
}

export async function addSupplier(d:any,c:Caller){
  requireAdmin(c);
  if(!c.sppg||!c.yayasan)throw new Error('SPPG dan Yayasan caller wajib tersedia.');
  if(c.role==='ADMIN'){
    const pairs=await exactPairs(c);
    if(!pairs?.some(([sp,ya])=>sp===c.sppg&&ya===c.yayasan))throw new Error('SPPG dan Yayasan caller tidak termasuk assignment ADMIN.');
  }
  const id=rid();
  const row:any={
    ID:id,'NAMA SUPPLIER':s(d.NAMA_SUPPLIER),'NO WHATSAPP':s(d.NO_WHATSAPP),EMAIL:low(d.EMAIL),
    'ALAMAT TOKO':s(d.ALAMAT_TOKO),'FOTO SUPPLIER':s(d.FOTO_SUPPLIER),'LINK FOTO SUPPLIER':'',
    'TTD SUPPLIER':s(d.TTD_SUPPLIER),'FILE MOU':s(d.FILE_MOU),'LINK FILE MOU':'',STATUS:s(d.STATUS||'Aktif'),
    USER:c.email,SPPG:c.sppg,YAYASAN:c.yayasan
  };
  const q=await sb.from('MASTER_SUPPLIER').insert(row);
  if(q.error)throw q.error;
  await audit(c,id,'ADD','MASTER_SUPPLIER',{nama:row['NAMA SUPPLIER'],sppg:row.SPPG,yayasan:row.YAYASAN});
  return{success:true,message:'Supplier berhasil ditambahkan.',id};
}

export async function updateSupplier(id:string,f:any,c:Caller){
  requireAdmin(c);
  const old=await sb.from('MASTER_SUPPLIER').select('*').eq('ID',id).maybeSingle();
  if(old.error||!old.data)throw new Error('Supplier tidak ditemukan.');
  if(!await canAccessSupplier(c,old.data))throw new Error('Akses supplier ditolak.');
  const allow=['NAMA SUPPLIER','NO WHATSAPP','EMAIL','ALAMAT TOKO','FOTO SUPPLIER','TTD SUPPLIER','FILE MOU','STATUS'];
  const patch:any={};for(const k of allow)if(f[k]!==undefined)patch[k]=f[k];
  const q=await sb.from('MASTER_SUPPLIER').update(patch).eq('ID',id);
  if(q.error)throw q.error;
  const cleanup:any[]=[];
  if(patch['FOTO SUPPLIER']!==undefined&&s(patch['FOTO SUPPLIER'])!==s(old.data['FOTO SUPPLIER']))cleanup.push({bucket:B.supplierFoto,path:old.data['FOTO SUPPLIER']});
  if(patch['TTD SUPPLIER']!==undefined&&s(patch['TTD SUPPLIER'])!==s(old.data['TTD SUPPLIER']))cleanup.push({bucket:B.supplierTtd,path:old.data['TTD SUPPLIER']});
  if(patch['FILE MOU']!==undefined&&s(patch['FILE MOU'])!==s(old.data['FILE MOU']))cleanup.push({bucket:B.supplierMou,path:old.data['FILE MOU']});
  if(cleanup.length)await removeFiles(cleanup);
  await audit(c,id,'EDIT','MASTER_SUPPLIER',Object.keys(patch));
  return{success:true,message:'Supplier berhasil diperbarui.'};
}

export async function deleteSupplier(id:string,c:Caller){
  requireAdmin(c);
  const old=await sb.from('MASTER_SUPPLIER').select('*').eq('ID',id).maybeSingle();
  if(old.error||!old.data)throw new Error('Supplier tidak ditemukan.');
  if(!await canAccessSupplier(c,old.data))throw new Error('Akses supplier ditolak.');
  await removeFiles([{bucket:B.supplierFoto,path:old.data['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:old.data['TTD SUPPLIER']},{bucket:B.supplierMou,path:old.data['FILE MOU']}]);
  const q=await sb.from('MASTER_SUPPLIER').delete().eq('ID',id);if(q.error)throw q.error;
  await audit(c,id,'DELETE','MASTER_SUPPLIER',{});
  return{success:true,message:'Supplier dan file terkait berhasil dihapus.'};
}

export async function uploadSupplier(p:any[],c:Caller){
  requireAdmin(c);
  const type=s(p[3]);const map:any={foto:'supplierFoto',ttd:'supplierTtd',mou:'supplierMou'};
  if(!map[type])throw new Error('Tipe file tidak dikenal.');
  return upload(map[type],p[0],p[1],p[2],`${type.toUpperCase()}_SUPPLIER_${c.id}`);
}
