from pathlib import Path

SUPPLIER = Path('supabase/functions/master-action/supplier.ts')
OPS = Path('supabase/functions/operations-action/index.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'Missing anchor: {label}')

s = SUPPLIER.read_text(encoding='utf-8')

s = replace_once(
    s,
    "  const q=await sb.from('MASTER_SUPPLIER').insert(row);\n  if(q.error)throw q.error;",
    "  const fresh=[{bucket:B.supplierFoto,path:row['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:row['TTD SUPPLIER']},{bucket:B.supplierMou,path:row['FILE MOU']}];\n  const q=await sb.from('MASTER_SUPPLIER').insert(row);\n  if(q.error){await removeFiles(fresh).catch(e=>console.error('cleanup supplier add orphan',e));throw q.error;}",
    'supplier add cleanup',
)

s = replace_once(
    s,
    "  const q=await sb.from('MASTER_SUPPLIER').update(patch).eq('ID',id);\n  if(q.error)throw q.error;\n  const cleanup:any[]=[];",
    "  const fresh:any[]=[];\n  if(patch['FOTO SUPPLIER']!==undefined&&s(patch['FOTO SUPPLIER'])!==s(old.data['FOTO SUPPLIER']))fresh.push({bucket:B.supplierFoto,path:patch['FOTO SUPPLIER']});\n  if(patch['TTD SUPPLIER']!==undefined&&s(patch['TTD SUPPLIER'])!==s(old.data['TTD SUPPLIER']))fresh.push({bucket:B.supplierTtd,path:patch['TTD SUPPLIER']});\n  if(patch['FILE MOU']!==undefined&&s(patch['FILE MOU'])!==s(old.data['FILE MOU']))fresh.push({bucket:B.supplierMou,path:patch['FILE MOU']});\n  const q=await sb.from('MASTER_SUPPLIER').update(patch).eq('ID',id);\n  if(q.error){await removeFiles(fresh).catch(e=>console.error('cleanup supplier update orphan',e));throw q.error;}\n  const cleanup:any[]=[];",
    'supplier update rollback cleanup',
)

s = replace_once(
    s,
    "  await removeFiles([{bucket:B.supplierFoto,path:old.data['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:old.data['TTD SUPPLIER']},{bucket:B.supplierMou,path:old.data['FILE MOU']}]);\n  const q=await sb.from('MASTER_SUPPLIER').delete().eq('ID',id);if(q.error)throw q.error;",
    "  const files=[{bucket:B.supplierFoto,path:old.data['FOTO SUPPLIER']},{bucket:B.supplierTtd,path:old.data['TTD SUPPLIER']},{bucket:B.supplierMou,path:old.data['FILE MOU']}];\n  const q=await sb.from('MASTER_SUPPLIER').delete().eq('ID',id);if(q.error)throw q.error;\n  await removeFiles(files).catch(e=>console.error('cleanup deleted supplier files',e));",
    'supplier delete ordering',
)

op = OPS.read_text(encoding='utf-8')
helper = """
const STORAGE_FILES:any={
  'SURVEI_BB':{'FOTO BAHAN BAKU':'foto-bb'},
  'SERAH_TERIMA':{'FOTO BARANG DATANG':'foto-datang','FOTO SURAT JALAN':'foto-datang','TTD PENERIMA':'ttd-penerima','TTD SUPPLIER':'ttd-supplier-inv'},
  'Pending Payment':{'Bukti Pembayaran':'bukti-payment'}
};
async function removeStorageFiles(items:{bucket:string,path:any}[]){for(const x of items){const p=s(x.path);if(!p)continue;const q=await sb.storage.from(x.bucket).remove([p]);if(q.error)throw new Error(`Gagal menghapus file ${x.bucket}: ${q.error.message}`)}}
function recordFiles(table:string,row:any){const map=STORAGE_FILES[table]||{};return Object.entries(map).map(([field,bucket])=>({bucket:String(bucket),path:row?.[field]})).filter(x=>s(x.path));}
function changedFiles(table:string,old:any,patch:any){const map=STORAGE_FILES[table]||{},fresh:any[]=[],obsolete:any[]=[];for(const [field,bucket] of Object.entries(map)){if(!Object.prototype.hasOwnProperty.call(patch,field))continue;const before=s(old?.[field]),after=s(patch?.[field]);if(before===after)continue;if(after)fresh.push({bucket:String(bucket),path:after});if(before)obsolete.push({bucket:String(bucket),path:before});}return{fresh,obsolete};}
"""
if 'const STORAGE_FILES:any=' not in op:
    op = op.replace("function pageSpec(v:any){", helper + "\nfunction pageSpec(v:any){", 1)

op = replace_once(
    op,
    "  const q=await sb.from('SURVEI_BB').insert(row);if(q.error)throw q.error;",
    "  const q=await sb.from('SURVEI_BB').insert(row);if(q.error){await removeStorageFiles(recordFiles('SURVEI_BB',row)).catch(e=>console.error('cleanup survei add orphan',e));throw q.error;}",
    'survei add cleanup',
)
op = replace_once(
    op,
    "  const q=await sb.from('SERAH_TERIMA').insert(row);if(q.error)throw q.error;",
    "  const q=await sb.from('SERAH_TERIMA').insert(row);if(q.error){await removeStorageFiles(recordFiles('SERAH_TERIMA',row)).catch(e=>console.error('cleanup serah add orphan',e));throw q.error;}",
    'serah add cleanup',
)

old_del = "async function delRecord(table:string,id:string,c:Caller,ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat menghapus.');await requireRecord(c,table,id,ownerCol);const q=await sb.from(table).delete().eq('ID',id);if(q.error)throw q.error;await audit(c,table,id,'DELETE',{});return{success:true,message:'Data berhasil dihapus.'};}"
new_del = "async function delRecord(table:string,id:string,c:Caller,ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat menghapus.');const old=await requireRecord(c,table,id,ownerCol);const files=recordFiles(table,old);const q=await sb.from(table).delete().eq('ID',id);if(q.error)throw q.error;if(files.length)await removeStorageFiles(files).catch(e=>console.error('cleanup deleted record files',table,id,e));await audit(c,table,id,'DELETE',{storageFiles:files.length});return{success:true,message:'Data berhasil dihapus.'};}"
op = replace_once(op, old_del, new_del, 'generic delete cleanup')

old_update = "async function updateRecord(table:string,id:string,fields:any,c:Caller,allowed:string[],ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');await requireRecord(c,table,id,ownerCol);const p:any={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(fields||{},k))p[k]=fields[k];if(!Object.keys(p).length)throw new Error('Tidak ada field yang dapat diperbarui.');const q=await sb.from(table).update(p).eq('ID',id);if(q.error)throw q.error;await audit(c,table,id,'EDIT',Object.keys(p));return{success:true,message:'Data berhasil diperbarui.'};}"
new_update = "async function updateRecord(table:string,id:string,fields:any,c:Caller,allowed:string[],ownerCol='USER'){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');const old=await requireRecord(c,table,id,ownerCol);const p:any={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(fields||{},k))p[k]=fields[k];if(!Object.keys(p).length)throw new Error('Tidak ada field yang dapat diperbarui.');const files=changedFiles(table,old,p);const q=await sb.from(table).update(p).eq('ID',id);if(q.error){if(files.fresh.length)await removeStorageFiles(files.fresh).catch(e=>console.error('cleanup update orphan',table,id,e));throw q.error;}if(files.obsolete.length)await removeStorageFiles(files.obsolete).catch(e=>console.error('cleanup replaced files',table,id,e));await audit(c,table,id,'EDIT',{fields:Object.keys(p),oldFilesDeleted:files.obsolete.length});return{success:true,message:'Data berhasil diperbarui.'};}"
op = replace_once(op, old_update, new_update, 'generic update cleanup')

SUPPLIER.write_text(s, encoding='utf-8')
OPS.write_text(op, encoding='utf-8')
print('Storage cleanup hardening applied.')
