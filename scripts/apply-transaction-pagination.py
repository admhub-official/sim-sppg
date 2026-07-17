from pathlib import Path
import re

p = Path('supabase/functions/transaction-action/index.ts')
s = p.read_text()

if 'function txPageSpec' not in s:
    marker = "async function list(filters:any,c:Caller){"
    helper = "function txPageSpec(v:any){const requested=Number(v?.page)>0||Number(v?.pageSize)>0;if(!requested)return null;const page=Math.max(1,Math.floor(Number(v?.page)||1));const pageSize=Math.min(100,Math.max(1,Math.floor(Number(v?.pageSize)||25)));return{page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1}}\n"
    if marker not in s:
        raise SystemExit('list marker not found')
    s = s.replace(marker, helper + marker, 1)

pattern = re.compile(r"async function list\(filters:any,c:Caller\)\{.*?return out\}", re.S)
replacement = """async function list(filters:any,c:Caller){let q=sb.from(T.X).select('*').order('Tanggal',{ascending:false});if(filters?.sppg&&filters.sppg!=='ALL')q=q.eq('SPPG',filters.sppg);if(filters?.yayasan&&filters.yayasan!=='ALL')q=q.eq('YAYASAN',filters.yayasan);if(filters?.kategori&&filters.kategori!=='ALL')q=q.eq('Kategori',filters.kategori);if(filters?.dateStart)q=q.gte('Tanggal',date(filters.dateStart));if(filters?.dateEnd)q=q.lte('Tanggal',date(filters.dateEnd));const r=await q;if(r.error)throw r.error;const out=[];for(const row of r.data||[])if(await access(c,row))out.push(map(row));const pg=txPageSpec(filters);if(!pg)return out;const total=out.length;return{data:out.slice(pg.from,pg.to+1),page:pg.page,pageSize:pg.pageSize,total,hasMore:pg.to+1<total}}"""
new_s, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit(f'list replacement count={n}')

if 'function txPageSpec' not in new_s or 'hasMore:pg.to+1<total' not in new_s:
    raise SystemExit('pagination validation failed')

p.write_text(new_s)
