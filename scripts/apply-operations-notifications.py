from pathlib import Path

PATH = Path('supabase/functions/operations-action/index.ts')
source = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if new in source:
        return
    if old not in source:
        raise SystemExit(f'Missing anchor: {label}')
    source = source.replace(old, new, 1)


helper_anchor = "async function audit(c:Caller,table:string,id:string,action:string,detail:any){try{await sb.from('AUDIT LOG').insert({TIMESTAMP:new Date().toISOString(),USER_EMAIL:c.email,USER_NAME:c.nama,ROLE:c.role,SPPG:c.sppg,ACTION_TYPE:action,TABLE_NAME:table,RECORD_ID:id,FIELD_CHANGED:'HARDENED_AUTH',OLD_VALUE:'',NEW_VALUE:JSON.stringify(detail).slice(0,500),DESCRIPTION:`${action} ${table}`,IP_USER:'',STATUS:'SUCCESS'})}catch(e){console.error('audit',e)}}"
helper = helper_anchor + "\nasync function systemNotify(payload:any){try{const base=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!base||!service)return;const r=await fetch(base+'/functions/v1/notification-dispatch-action',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+service},body:JSON.stringify({function:'dispatchSystemNotification',parameters:[payload]}),signal:AbortSignal.timeout(8000)});if(!r.ok)console.error('notification dispatch failed',r.status,await r.text())}catch(e){console.error('notification dispatch error',e)}}"
replace_once(helper_anchor, helper, 'systemNotify helper')

replace_once(
"await audit(c,'ADMIN_ASSIGNMENT',q.data.id,'ADD',{admin_email:e,sppg,yayasan});return{success:true,message:'Assignment berhasil ditambahkan.',id:q.data.id};",
"await audit(c,'ADMIN_ASSIGNMENT',q.data.id,'ADD',{admin_email:e,sppg,yayasan});await systemNotify({mode:'email',email:e,title:'Assignment ADMIN baru',body:`Anda ditugaskan untuk ${sppg} — ${yayasan}.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil ditambahkan.',id:q.data.id};",
'add assignment notification')

replace_once(
"await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'EDIT',{from:{sppg:old.data.sppg,yayasan:old.data.yayasan},to:{sppg,yayasan}});return{success:true,message:'Assignment berhasil diperbarui.'};",
"await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'EDIT',{from:{sppg:old.data.sppg,yayasan:old.data.yayasan},to:{sppg,yayasan}});await systemNotify({mode:'email',email:old.data.admin_email,title:'Assignment ADMIN diperbarui',body:`Assignment Anda berubah menjadi ${sppg} — ${yayasan}.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil diperbarui.'};",
'update assignment notification')

replace_once(
"await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'DELETE',{admin_email:old.data.admin_email,sppg:old.data.sppg,yayasan:old.data.yayasan});return{success:true,message:'Assignment berhasil dihapus.'};",
"await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'DELETE',{admin_email:old.data.admin_email,sppg:old.data.sppg,yayasan:old.data.yayasan});await systemNotify({mode:'email',email:old.data.admin_email,title:'Assignment ADMIN dihapus',body:`Assignment ${old.data.sppg} — ${old.data.yayasan} telah dihapus.`,url:'/?page=admin-assignment'});return{success:true,message:'Assignment berhasil dihapus.'};",
'delete assignment notification')

replace_once(
"await audit(c,'Pending Payment',id,'ADD',{transaksi:row.Transaksi});\n  return{success:true,message:'Pending Payment berhasil ditambahkan.',id};",
"await audit(c,'Pending Payment',id,'ADD',{transaksi:row.Transaksi});\n  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Pending payment baru',body:`Pending payment ${id} menunggu tindak lanjut.`,url:'/?page=pending-payment'});\n  return{success:true,message:'Pending Payment berhasil ditambahkan.',id};",
'pending payment notification')

replace_once(
"await audit(c,'SURVEI_BB',id,'ADD',{kode});\n  return{success:true,message:'Data survei berhasil ditambahkan.',id};",
"await audit(c,'SURVEI_BB',id,'ADD',{kode});\n  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Survei bahan baku baru',body:`Survei ${kode} telah ditambahkan.`,url:'/?page=survei'});\n  return{success:true,message:'Data survei berhasil ditambahkan.',id};",
'survey notification')

replace_once(
"await audit(c,'SERAH_TERIMA',id,'ADD',{kode,penerima});\n  return{success:true,message:'Serah terima berhasil ditambahkan.',id};",
"await audit(c,'SERAH_TERIMA',id,'ADD',{kode,penerima});\n  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Serah terima baru',body:`Serah terima ${kode} untuk ${penerima} telah dicatat.`,url:'/?page=serah-terima'});\n  return{success:true,message:'Serah terima berhasil ditambahkan.',id};",
'handover notification')

replace_once(
"await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:Number((q.data as any)?.detailCount||0),atomic:true});\n  return{success:true,message:'Menu MBG berhasil ditambahkan.',id};",
"await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:Number((q.data as any)?.detailCount||0),atomic:true});\n  await systemNotify({mode:'pair',sppg:c.sppg,yayasan:c.yayasan,title:'Menu MBG baru',body:`Menu ${menu} untuk ${jumlahKpm.toLocaleString('id-ID')} KPM telah dibuat.`,url:'/?page=menu-mbg'});\n  return{success:true,message:'Menu MBG berhasil ditambahkan.',id};",
'menu add notification')

replace_once(
"await audit(c,'MENU_HARIAN',id,'EDIT',{detailCount:Number((q.data as any)?.detailCount||0),atomic:true});\n  return{success:true,message:'Menu MBG berhasil diperbarui.'};",
"await audit(c,'MENU_HARIAN',id,'EDIT',{detailCount:Number((q.data as any)?.detailCount||0),atomic:true});\n  const owner=await profileByOwner(old.USER);if(owner)await systemNotify({mode:'pair',sppg:owner.SPPG,yayasan:owner['NAMA YAYASAN'],title:'Menu MBG diperbarui',body:`Menu ${menu} tanggal ${tanggal} telah diperbarui.`,url:'/?page=menu-mbg'});\n  return{success:true,message:'Menu MBG berhasil diperbarui.'};",
'menu update notification')

required = [
    'async function systemNotify(',
    "title:'Pending payment baru'",
    "title:'Survei bahan baku baru'",
    "title:'Serah terima baru'",
    "title:'Menu MBG baru'",
    "title:'Assignment ADMIN baru'",
]
missing = [x for x in required if x not in source]
if missing:
    raise SystemExit('Patch validation failed: ' + ', '.join(missing))

PATH.write_text(source, encoding='utf-8')
print('Operations automatic notifications applied.')
