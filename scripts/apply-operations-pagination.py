from pathlib import Path

p=Path('supabase/functions/operations-action/index.ts')
t=p.read_text(encoding='utf-8')

anchor="async function audit(c:Caller,table:string,id:string,action:string,detail:any){try{await sb.from('AUDIT LOG').insert({TIMESTAMP:new Date().toISOString(),USER_EMAIL:c.email,USER_NAME:c.nama,ROLE:c.role,SPPG:c.sppg,ACTION_TYPE:action,TABLE_NAME:table,RECORD_ID:id,FIELD_CHANGED:'HARDENED_AUTH',OLD_VALUE:'',NEW_VALUE:JSON.stringify(detail).slice(0,500),DESCRIPTION:`${action} ${table}`,IP_USER:'',STATUS:'SUCCESS'})}catch(e){console.error('audit',e)}}\n"
helper="""async function audit(c:Caller,table:string,id:string,action:string,detail:any){try{await sb.from('AUDIT LOG').insert({TIMESTAMP:new Date().toISOString(),USER_EMAIL:c.email,USER_NAME:c.nama,ROLE:c.role,SPPG:c.sppg,ACTION_TYPE:action,TABLE_NAME:table,RECORD_ID:id,FIELD_CHANGED:'HARDENED_AUTH',OLD_VALUE:'',NEW_VALUE:JSON.stringify(detail).slice(0,500),DESCRIPTION:`${action} ${table}`,IP_USER:'',STATUS:'SUCCESS'})}catch(e){console.error('audit',e)}}
function pageSpec(v:any){const requested=Number(v?.page)>0||Number(v?.pageSize)>0;if(!requested)return null;const page=Math.max(1,Math.floor(Number(v?.page)||1));const pageSize=Math.min(100,Math.max(1,Math.floor(Number(v?.pageSize)||25)));return{page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1}}
function paged(data:any[],v:any){const x=pageSpec(v);if(!x)return null;const total=data.length;return{data:data.slice(x.from,x.to+1),page:x.page,pageSize:x.pageSize,total,hasMore:x.to+1<total}}
"""
if 'function pageSpec(' not in t:
    if anchor not in t: raise SystemExit('audit anchor missing')
    t=t.replace(anchor,helper,1)

old="async function getAllUsers(c:Caller){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');const q=await sb.from('USERS').select('ID,\"NAMA LENGKAP\",EMAIL,JABATAN,SPPG,ROLE,\"FOTO PROFIL\",TIMESTAMP,USERNAME,\"NAMA YAYASAN\"').order('TIMESTAMP',{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[]){if(c.role==='SUPER_ADMIN'||await pairOK(c,r.SPPG,r['NAMA YAYASAN']))out.push({id:r.ID,namaLengkap:r['NAMA LENGKAP'],email:r.EMAIL,jabatan:r.JABATAN,sppg:r.SPPG,role:r.ROLE,fotoProfil:r['FOTO PROFIL'],timestamp:r.TIMESTAMP,username:r.USERNAME,namaYayasan:r['NAMA YAYASAN']||''});}return{success:true,data:out};}"
new="async function getAllUsers(c:Caller,opt:any={}){if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');const q=await sb.from('USERS').select('ID,\"NAMA LENGKAP\",EMAIL,JABATAN,SPPG,ROLE,\"FOTO PROFIL\",TIMESTAMP,USERNAME,\"NAMA YAYASAN\"').order('TIMESTAMP',{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[]){if(c.role==='SUPER_ADMIN'||await pairOK(c,r.SPPG,r['NAMA YAYASAN']))out.push({id:r.ID,namaLengkap:r['NAMA LENGKAP'],email:r.EMAIL,jabatan:r.JABATAN,sppg:r.SPPG,role:r.ROLE,fotoProfil:r['FOTO PROFIL'],timestamp:r.TIMESTAMP,username:r.USERNAME,namaYayasan:r['NAMA YAYASAN']||''});}const pg=paged(out,opt);return pg?{success:true,...pg}:{success:true,data:out};}"
if old in t:t=t.replace(old,new,1)

old="async function listOwned(table:string,c:Caller,orderCol='TIMESTAMP'){const q=await sb.from(table).select('*').order(orderCol,{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[])if(await ownerOK(c,r.USER))out.push(r);return out;}"
new="async function listOwned(table:string,c:Caller,orderCol='TIMESTAMP'){const q=await sb.from(table).select('*').order(orderCol,{ascending:false});if(q.error)throw q.error;const out=[];for(const r of q.data||[])if(await ownerOK(c,r.USER))out.push(r);return out;}\nfunction ownedResult(data:any[],opt:any={}){const pg=paged(data,opt);return pg?{success:true,...pg}:{success:true,data}}"
if 'function ownedResult(' not in t:
    if old not in t: raise SystemExit('listOwned anchor missing')
    t=t.replace(old,new,1)

t=t.replace("async function getPending(c:Caller){return await listOwned('Pending Payment',c,'Timestamp');}","async function getPending(c:Caller,opt:any={}){return ownedResult(await listOwned('Pending Payment',c,'Timestamp'),opt);}")

t=t.replace("async function getMenu(c:Caller,filters:any){const menus=await listOwned('MENU_HARIAN',c,'TIMESTAMP');let out=menus;if(filters?.dateStart)out=out.filter((r:any)=>s(r.TANGGAL)>=s(filters.dateStart));if(filters?.dateEnd)out=out.filter((r:any)=>s(r.TANGGAL)<=s(filters.dateEnd));const ids=out.map((r:any)=>r.ID);let details:any[]=[];if(ids.length){const q=await sb.from('DETAIL_MENU_HARIAN').select('*').in('MENU_ID',ids);if(q.error)throw q.error;details=q.data||[];}return{success:true,data:out.map((r:any)=>({id:r.ID,tanggal:r.TANGGAL,jumlahKpm:r['JUMLAH KPM']||0,menu:r.MENU||'',user:r.USER||'',detail:details.filter((d:any)=>d.MENU_ID===r.ID).map((d:any)=>({namaItem:d['Nama Item']||'',jumlah:d.Jumlah||0,satuan:d.Satuan||'',hargaSatuan:d['Harga Satuan']||0,totalHarga:d['Total Harga']||0}))}))};}","async function getMenu(c:Caller,filters:any){const menus=await listOwned('MENU_HARIAN',c,'TIMESTAMP');let out=menus;if(filters?.dateStart)out=out.filter((r:any)=>s(r.TANGGAL)>=s(filters.dateStart));if(filters?.dateEnd)out=out.filter((r:any)=>s(r.TANGGAL)<=s(filters.dateEnd));const total=out.length,ps=pageSpec(filters),selected=ps?out.slice(ps.from,ps.to+1):out;const ids=selected.map((r:any)=>r.ID);let details:any[]=[];if(ids.length){const q=await sb.from('DETAIL_MENU_HARIAN').select('*').in('MENU_ID',ids);if(q.error)throw q.error;details=q.data||[];}const data=selected.map((r:any)=>({id:r.ID,tanggal:r.TANGGAL,jumlahKpm:r['JUMLAH KPM']||0,menu:r.MENU||'',user:r.USER||'',detail:details.filter((d:any)=>d.MENU_ID===r.ID).map((d:any)=>({namaItem:d['Nama Item']||'',jumlah:d.Jumlah||0,satuan:d.Satuan||'',hargaSatuan:d['Harga Satuan']||0,totalHarga:d['Total Harga']||0}))}));return ps?{success:true,data,page:ps.page,pageSize:ps.pageSize,total,hasMore:ps.to+1<total}:{success:true,data};}")

t=t.replace("getAllUsers:(p:any[],c:Caller)=>getAllUsers(c)","getAllUsers:(p:any[],c:Caller)=>getAllUsers(c,p[0]||{})")
t=t.replace("getPendingPayments:(p:any[],c:Caller)=>getPending(c)","getPendingPayments:(p:any[],c:Caller)=>getPending(c,p[0]||{})")
t=t.replace("getSurveiBahanBaku:async(p:any[],c:Caller)=>({success:true,data:await listOwned('SURVEI_BB',c)})","getSurveiBahanBaku:async(p:any[],c:Caller)=>ownedResult(await listOwned('SURVEI_BB',c),p[0]||{})")
t=t.replace("getSerahTerima:async(p:any[],c:Caller)=>({success:true,data:await listOwned('SERAH_TERIMA',c)})","getSerahTerima:async(p:any[],c:Caller)=>ownedResult(await listOwned('SERAH_TERIMA',c),p[0]||{})")

if 'function pageSpec(' not in t or 'ownedResult' not in t: raise SystemExit('pagination patch incomplete')
p.write_text(t,encoding='utf-8')
print('operations pagination installed')
