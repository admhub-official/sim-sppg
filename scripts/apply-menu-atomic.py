from pathlib import Path

PATH = Path('supabase/functions/operations-action/index.ts')
source = PATH.read_text(encoding='utf-8')


def replace_function(text: str, function_name: str, replacement: str, next_marker: str) -> str:
    start_marker = f'async function {function_name}('
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'Missing function anchor: {function_name}')
    end = text.find(next_marker, start)
    if end < 0:
        raise SystemExit(f'Missing end marker after: {function_name}')
    return text[:start] + replacement.rstrip() + '\n\n' + text[end:]


if "sb.rpc('create_menu_harian_atomic'" not in source:
    add_menu = '''async function addMenu(d:any,c:Caller){
  const id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const tanggal=s(d.tanggal),jumlahKpm=Number(d.jumlahKpm||0),menu=s(d.menu),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('create_menu_harian_atomic',{p_id:id,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_user:c.email,p_yayasan:c.yayasan||'',p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'ADD',{jumlahKpm,detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  return{success:true,message:'Menu MBG berhasil ditambahkan.',id};
}'''
    source = replace_function(source, 'addMenu', add_menu, 'async function getUploadBuktiMode(')

if 'async function updateMenuAtomic(' not in source:
    update_menu = '''async function updateMenuAtomic(id:string,d:any,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat mengubah.');
  const old=await requireRecord(c,'MENU_HARIAN',id,'USER');
  const tanggal=s(d.TANGGAL??d.tanggal??old.TANGGAL);
  const jumlahKpm=Number((d['JUMLAH KPM']??d.jumlahKpm??old['JUMLAH KPM'])||0);
  const menu=s(d.MENU??d.menu??old.MENU),items=Array.isArray(d.items)?d.items:[];
  if(!tanggal||!(jumlahKpm>0)||!menu)throw new Error('Tanggal, Jumlah KPM, dan Menu wajib diisi.');
  const q=await sb.rpc('update_menu_harian_atomic',{p_id:id,p_expected_owner:old.USER,p_tanggal:tanggal,p_jumlah_kpm:jumlahKpm,p_menu:menu,p_items:items});
  if(q.error)throw q.error;
  await audit(c,'MENU_HARIAN',id,'EDIT',{detailCount:Number((q.data as any)?.detailCount||0),atomic:true});
  return{success:true,message:'Menu MBG berhasil diperbarui.'};
}'''
    anchor = 'async function getUploadBuktiMode('
    pos = source.find(anchor)
    if pos < 0:
        raise SystemExit('Missing insertion anchor: getUploadBuktiMode')
    source = source[:pos] + update_menu + '\n\n' + source[pos:]

old_route = "updateMenuMBG:(p:any[],c:Caller)=>updateRecord('MENU_HARIAN',s(p[0]),p[1]||{},c,MENU_FIELDS)"
new_route = "updateMenuMBG:(p:any[],c:Caller)=>updateMenuAtomic(s(p[0]),p[1]||{},c)"
if old_route in source:
    source = source.replace(old_route, new_route, 1)
elif new_route not in source:
    raise SystemExit('Missing route anchor: updateMenuMBG')

required = [
    "sb.rpc('create_menu_harian_atomic'",
    "sb.rpc('update_menu_harian_atomic'",
    'async function updateMenuAtomic(',
    new_route,
]
missing = [marker for marker in required if marker not in source]
if missing:
    raise SystemExit('Patch validation failed: ' + ', '.join(missing))

PATH.write_text(source, encoding='utf-8')
print('Menu MBG atomic patch applied and validated.')
