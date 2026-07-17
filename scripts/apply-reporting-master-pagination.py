from pathlib import Path
import re

# reporting/activity.ts
p=Path('supabase/functions/reporting-action/activity.ts')
s=p.read_text()
if 'function pageSpec' not in s:
    s=s.replace("import { Caller,fmt,iso,lo,s,sb,visibleActors } from './core.ts';\n", "import { Caller,fmt,iso,lo,s,sb,visibleActors } from './core.ts';\nfunction pageSpec(v:any){const requested=Number(v?.page)>0||Number(v?.pageSize)>0;if(!requested)return null;const page=Math.max(1,Math.floor(Number(v?.page)||1));const pageSize=Math.min(100,Math.max(1,Math.floor(Number(v?.pageSize)||25)));return{page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1}}\nfunction paged(data:any[],v:any){const x=pageSpec(v);if(!x)return null;const total=data.length;return{data:data.slice(x.from,x.to+1),page:x.page,pageSize:x.pageSize,total,hasMore:x.to+1<total}}\n")
s=s.replace("return{success:true,data:rows.map((x:any)=>({uuid:x.LOG_ID||'',waktu:fmt(x.TIMESTAMP),pelaku:x.USER_EMAIL||'-',role:x.ROLE||'-',actionType:x.ACTION_TYPE||'-',tableName:x.TABLE_NAME||'-',recordId:x.RECORD_ID||'-',fieldChanged:x.FIELD_CHANGED||'-',oldValue:x.OLD_VALUE||'',newValue:x.NEW_VALUE||'',deskripsi:x.DESCRIPTION||'',status:x.STATUS||'SUCCESS'}))}}", "const data=rows.map((x:any)=>({uuid:x.LOG_ID||'',waktu:fmt(x.TIMESTAMP),pelaku:x.USER_EMAIL||'-',role:x.ROLE||'-',actionType:x.ACTION_TYPE||'-',tableName:x.TABLE_NAME||'-',recordId:x.RECORD_ID||'-',fieldChanged:x.FIELD_CHANGED||'-',oldValue:x.OLD_VALUE||'',newValue:x.NEW_VALUE||'',deskripsi:x.DESCRIPTION||'',status:x.STATUS||'SUCCESS'}));const pg=paged(data,f);return pg?{success:true,...pg}:{success:true,data}}")
s=s.replace("export async function getNotifications(_p:any[],c:Caller){", "export async function getNotifications(p:any[],c:Caller){")
s=s.replace("const data=rows.map((x:any)=>{", "const allData=rows.map((x:any)=>{")
s=s.replace("return{success:true,data,unreadCount:data.filter((x:any)=>!x.isRead).length}}", "const opt=p[0]||{},pg=paged(allData,opt),data=pg?pg.data:allData;return pg?{success:true,...pg,unreadCount:allData.filter((x:any)=>!x.isRead).length}:{success:true,data,unreadCount:data.filter((x:any)=>!x.isRead).length}}")
p.write_text(s)

# master-bb.ts
p=Path('supabase/functions/master-action/master-bb.ts')
s=p.read_text()
s=s.replace("export async function getBB(){const q=await sb.from('MASTER_BB').select('*').order('TIMESTAMP',{ascending:false});if(q.error)throw q.error;return{success:true,data:q.data||[]}}", "export async function getBB(opt:any={}){const q=await sb.from('MASTER_BB').select('*').order('TIMESTAMP',{ascending:false});if(q.error)throw q.error;const data=q.data||[],requested=Number(opt?.page)>0||Number(opt?.pageSize)>0;if(!requested)return{success:true,data};const page=Math.max(1,Math.floor(Number(opt.page)||1)),pageSize=Math.min(100,Math.max(1,Math.floor(Number(opt.pageSize)||25))),from=(page-1)*pageSize,total=data.length;return{success:true,data:data.slice(from,from+pageSize),page,pageSize,total,hasMore:from+pageSize<total}}")
p.write_text(s)

# supplier.ts
p=Path('supabase/functions/master-action/supplier.ts')
s=p.read_text()
s=s.replace("export async function getSupplier(c:Caller){", "export async function getSupplier(c:Caller,opt:any={}){")
s=s.replace("  if(c.role==='SUPER_ADMIN')return{success:true,data:rows};\n  if(c.role==='USER')return{success:true,data:rows.filter((r:any)=>low(r.USER)===c.email||low(r.USER)===low(c.username))};\n  if(c.role==='ADMIN'){\n    const pairs=await exactPairs(c);\n    return{success:true,data:rows.filter((r:any)=>pairs?.some(([sp,ya])=>sp===s(r.SPPG)&&ya===s(r.YAYASAN)))};\n  }\n  return{success:true,data:[]};", "  let data:any[]=[];if(c.role==='SUPER_ADMIN')data=rows;else if(c.role==='USER')data=rows.filter((r:any)=>low(r.USER)===c.email||low(r.USER)===low(c.username));else if(c.role==='ADMIN'){const pairs=await exactPairs(c);data=rows.filter((r:any)=>pairs?.some(([sp,ya])=>sp===s(r.SPPG)&&ya===s(r.YAYASAN)))}const requested=Number(opt?.page)>0||Number(opt?.pageSize)>0;if(!requested)return{success:true,data};const page=Math.max(1,Math.floor(Number(opt.page)||1)),pageSize=Math.min(100,Math.max(1,Math.floor(Number(opt.pageSize)||25))),from=(page-1)*pageSize,total=data.length;return{success:true,data:data.slice(from,from+pageSize),page,pageSize,total,hasMore:from+pageSize<total};")
p.write_text(s)

# master index routing: regex tolerates whitespace/minification changes
p=Path('supabase/functions/master-action/index.ts')
s=p.read_text()
s=re.sub(r"getMasterBahanBaku:\(p:any\[\],c:Caller\)=>getBB\(\)", "getMasterBahanBaku:(p:any[],c:Caller)=>getBB(p[0]||{})", s)
s=re.sub(r"getMasterSupplier:\(p:any\[\],c:Caller\)=>getSupplier\(c\)", "getMasterSupplier:(p:any[],c:Caller)=>getSupplier(c,p[0]||{})", s)
p.write_text(s)

checks={
 'supabase/functions/reporting-action/activity.ts':['function pageSpec','hasMore'],
 'supabase/functions/master-action/master-bb.ts':['pageSize','hasMore'],
 'supabase/functions/master-action/supplier.ts':['pageSize','hasMore'],
 'supabase/functions/master-action/index.ts':['getBB(p[0]||{})','getSupplier(c,p[0]||{})'],
}
for f,needles in checks.items():
    text=Path(f).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'pagination validation failed: {f} missing {needle}')
