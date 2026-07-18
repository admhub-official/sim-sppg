from pathlib import Path
import re
p=Path('supabase/functions/operations-action/index.ts')
s=p.read_text()
if 'create_menu_harian_atomic' not in s:
    s=re.sub(r"async function addMenu\(d:any,c:Caller\)\{.*?\n\}\n\n",'''async function addMenu(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const tanggal=s(d.tanggal),jumlahKpm=Number(d.jumlahKpm||0),menu=s(d.menu),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('create_menu_harian_atomic',{p_id:id,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_user:c.email,p_yayasan:c.yayasan||'',p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  return{success:true,message:'Menu MBG berhasil ditambahkan.',id};
}

async function updateMenuAtomic(id:string,d:any,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');
  const old=await requireRecord(c,'MENU_HARIAN',id,'USER');
  const tanggal=s(d.TANGGAL??d.tanggal??old.TANGGAL),jumlahKpm=Number(d['JUMLAH KPM']??d.jumlahKpm??old['JUMLAH KPM']||0),menu=s(d.MENU??d.menu??old.MENU),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('update_menu_harian_atomic',{p_id:id,p_expected_owner:old.USER,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'EDIT',{detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  return{success:true,message:'Menu MBG berhasil diperbarui.'};
}

''',s,flags=re.S)
s=s.replace("updateMenuMBG:(p:any[],c:Caller)=>updateRecord('MENU_HARIAN',s(p[0]),p[1]||{},c,MENU_FIELDS)","updateMenuMBG:(p:any[],c:Caller)=>updateMenuAtomic(s(p[0]),p[1]||{},c)")
p.write_text(s)
