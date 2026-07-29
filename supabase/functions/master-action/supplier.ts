import {sb,s,low,Caller,requireAdmin,audit,rid,B,removeFiles,upload,exactPairs} from './core.ts';
const SUPPLIER_COLUMNS='ID,"NAMA SUPPLIER","NO WHATSAPP",EMAIL,"ALAMAT TOKO","NAMA BANK","NO REKENING","ATAS NAMA REKENING","ITEM YANG DIJUAL","FOTO SUPPLIER","LINK FOTO SUPPLIER","TTD SUPPLIER","FILE MOU","LINK FILE MOU",STATUS,SPPG,YAYASAN,USER';
const itemList=(value:any)=>[...new Set(
  (Array.isArray(value)?value:String(value??'').split(/[\n,;]/))
    .map((item:any)=>s(item))
    .filter(Boolean)
)].slice(0,100);

async function canAccessSupplier(c:Caller,row:any){
  if(c.role==='SUPER_ADMIN')return true;
  if(c.role==='USER')return low(row?.USER)===c.email||low(row?.USER)===low(c.username);
  if(c.role!=='ADMIN')return false;
  const pairs=await exactPairs(c);
  return !!pairs?.some(([sp,ya])=>sp===s(row?.SPPG)&&ya===s(row?.YAYASAN));
}

export async function getSupplier(c:Caller,opt:any={}){
  const requested=Number(opt?.page)>0||Number(opt?.pageSize)>0;
  const page=Math.max(1,Math.floor(Number(opt.page)||1)),pageSize=Math.min(100,Math.max(1,Math.floor(Number(opt.pageSize)||25))),from=(page-1)*pageSize,to=from+pageSize-1;
  const pairs=c.role==='ADMIN'?await exactPairs(c):null;
  let q=requested&&c.role!=='ADMIN'
    ?sb.from('MASTER_SUPPLIER').select(SUPPLIER_COLUMNS,{count:'exact'})
    :sb.from('MASTER_SUPPLIER').select(SUPPLIER_COLUMNS);
  if(c.role==='USER')q=q.in('USER',[c.email,c.username].filter(Boolean));
  if(c.role==='ADMIN'){
    const sppg=[...new Set((pairs||[]).map(([sp])=>sp).filter(Boolean))];
    if(!sppg.length)return requested?{success:true,data:[],page,pageSize,total:0,hasMore:false}:{success:true,data:[]};
    q=q.in('SPPG',sppg);
  }
  q=q.order('ID',{ascending:false});
  // ADMIN keeps its pair check in memory; other roles are filtered and ranged in PostgREST.
  if(requested&&c.role!=='ADMIN')q=q.range(from,to);
  const result=await q;if(result.error)throw result.error;
  let data=result.data||[];let total=result.count??data.length;
  if(c.role==='ADMIN'){data=data.filter((r:any)=>pairs?.some(([sp,ya])=>sp===s(r.SPPG)&&ya===s(r.YAYASAN)));total=data.length;if(requested)data=data.slice(from,to+1)}
  if(!requested)return{success:true,data};
  return{success:true,data,page,pageSize,total,hasMore:to+1<total};
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
    'NAMA BANK':s(d.NAMA_BANK),'NO REKENING':s(d.NO_REKENING),
    'ATAS NAMA REKENING':s(d.ATAS_NAMA_REKENING),'ITEM YANG DIJUAL':itemList(d.ITEM_YANG_DIJUAL),
    'TTD SUPPLIER':s(d.TTD_SUPPLIER),'FILE MOU':s(d.FILE_MOU),'LINK FILE MOU':'',STATUS:s(d.STATUS||'Aktif'),
    USER:c.email,SPPG:c.sppg,YAYASAN:c.yayasan
  };
  const fresh=[{bucket:B.supplierFoto,path:row['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:row['TTD SUPPLIER']},{bucket:B.supplierMou,path:row['FILE MOU']}];
  const q=await sb.from('MASTER_SUPPLIER').insert(row);
  if(q.error){await removeFiles(fresh).catch(e=>console.error('cleanup supplier add orphan',e));throw q.error;}
  await audit(c,id,'ADD','MASTER_SUPPLIER',{nama:row['NAMA SUPPLIER'],sppg:row.SPPG,yayasan:row.YAYASAN});
  return{success:true,message:'Supplier berhasil ditambahkan.',id};
}

export async function updateSupplier(id:string,f:any,c:Caller){
  requireAdmin(c);
  const old=await sb.from('MASTER_SUPPLIER').select(SUPPLIER_COLUMNS).eq('ID',id).maybeSingle();
  if(old.error||!old.data)throw new Error('Supplier tidak ditemukan.');
  if(!await canAccessSupplier(c,old.data))throw new Error('Akses supplier ditolak.');
  const allow=['NAMA SUPPLIER','NO WHATSAPP','EMAIL','ALAMAT TOKO','NAMA BANK','NO REKENING','ATAS NAMA REKENING','ITEM YANG DIJUAL','FOTO SUPPLIER','TTD SUPPLIER','FILE MOU','STATUS'];
  const patch:any={};for(const k of allow)if(f[k]!==undefined)patch[k]=f[k];
  if(patch['ITEM YANG DIJUAL']!==undefined)patch['ITEM YANG DIJUAL']=itemList(patch['ITEM YANG DIJUAL']);
  const fresh:any[]=[];
  if(patch['FOTO SUPPLIER']!==undefined&&s(patch['FOTO SUPPLIER'])!==s(old.data['FOTO SUPPLIER']))fresh.push({bucket:B.supplierFoto,path:patch['FOTO SUPPLIER']});
  if(patch['TTD SUPPLIER']!==undefined&&s(patch['TTD SUPPLIER'])!==s(old.data['TTD SUPPLIER']))fresh.push({bucket:B.supplierTtd,path:patch['TTD SUPPLIER']});
  if(patch['FILE MOU']!==undefined&&s(patch['FILE MOU'])!==s(old.data['FILE MOU']))fresh.push({bucket:B.supplierMou,path:patch['FILE MOU']});
  const q=await sb.from('MASTER_SUPPLIER').update(patch).eq('ID',id);
  if(q.error){await removeFiles(fresh).catch(e=>console.error('cleanup supplier update orphan',e));throw q.error;}
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
  const old=await sb.from('MASTER_SUPPLIER').select('ID,"FOTO SUPPLIER","TTD SUPPLIER","FILE MOU",SPPG,YAYASAN,USER').eq('ID',id).maybeSingle();
  if(old.error||!old.data)throw new Error('Supplier tidak ditemukan.');
  if(!await canAccessSupplier(c,old.data))throw new Error('Akses supplier ditolak.');
  const files=[{bucket:B.supplierFoto,path:old.data['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:old.data['TTD SUPPLIER']},{bucket:B.supplierMou,path:old.data['FILE MOU']}];
  const q=await sb.from('MASTER_SUPPLIER').delete().eq('ID',id);if(q.error)throw q.error;
  await removeFiles(files).catch(e=>console.error('cleanup deleted supplier files',e));
  await audit(c,id,'DELETE','MASTER_SUPPLIER',{});
  return{success:true,message:'Supplier dan file terkait berhasil dihapus.'};
}

export async function uploadSupplier(p:any[],c:Caller){
  requireAdmin(c);
  const type=s(p[3]);const map:any={foto:'supplierFoto',ttd:'supplierTtd',mou:'supplierMou'};
  if(!map[type])throw new Error('Tipe file tidak dikenal.');
  return upload(map[type],p[0],p[1],p[2],`${type.toUpperCase()}_SUPPLIER_${c.id}`);
}
