from pathlib import Path

backend_path = Path('supabase/functions/operations-action/index.ts')
app_path = Path('app.js')
backend = backend_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')

block = r'''
async function getUploadBuktiMode(c:Caller){
  const q=await sb.from('APP_SETTINGS').select('VALUE').eq('KEY','ALLOW_USER_UPLOAD_BUKTI').maybeSingle();
  if(q.error)throw q.error;
  return{success:true,enabled:String(q.data?.VALUE||'false').toLowerCase()==='true'};
}
async function setUploadBuktiMode(enabled:boolean,c:Caller){
  requireSuperAdmin(c);
  const value=enabled?'true':'false';
  const existing=await sb.from('APP_SETTINGS').select('KEY').eq('KEY','ALLOW_USER_UPLOAD_BUKTI').maybeSingle();
  if(existing.error)throw existing.error;
  const q=existing.data
    ? await sb.from('APP_SETTINGS').update({VALUE:value}).eq('KEY','ALLOW_USER_UPLOAD_BUKTI')
    : await sb.from('APP_SETTINGS').insert({KEY:'ALLOW_USER_UPLOAD_BUKTI',VALUE:value});
  if(q.error)throw q.error;
  await audit(c,'APP_SETTINGS','ALLOW_USER_UPLOAD_BUKTI','TOGGLE_MODE',{enabled});
  return{success:true,enabled,message:'Mode upload bukti berhasil diperbarui.'};
}
'''.strip()

if 'async function getUploadBuktiMode(c:Caller)' not in backend:
    anchor = '\nasync function listOwned(table:string,c:Caller,orderCol=\'TIMESTAMP\')'
    if anchor not in backend:
        raise SystemExit('backend anchor listOwned not found')
    backend = backend.replace(anchor, '\n\n' + block + anchor, 1)

old_route = " getAllUsers:(p:any[],c:Caller)=>getAllUsers(c,p[0]||{}),deleteUser:(p:any[],c:Caller)=>deleteUser(s(p[0]),c),"
new_route = old_route + "\n getUploadBuktiMode:(_p:any[],c:Caller)=>getUploadBuktiMode(c),setUploadBuktiMode:(p:any[],c:Caller)=>setUploadBuktiMode(Boolean(p[0]),c),"
if 'getUploadBuktiMode:(_p:any[],c:Caller)' not in backend:
    if old_route not in backend:
        raise SystemExit('backend handler anchor not found')
    backend = backend.replace(old_route, new_route, 1)

backend = backend.replace("version:4", "version:5")

old_map = "  getAllUsers:1, deleteUser:1,\n  addPendingPayment:1, addSurveiBahanBaku:1, addSerahTerima:1, addMenuHarian:1,"
new_map = "  getAllUsers:1, deleteUser:1, getUploadBuktiMode:1, setUploadBuktiMode:1,\n  addPendingPayment:1, addSurveiBahanBaku:1, addSerahTerima:1, addMenuHarian:1,"
if 'getUploadBuktiMode:1, setUploadBuktiMode:1' not in app:
    if old_map not in app:
        raise SystemExit('app operations map anchor not found')
    app = app.replace(old_map, new_map, 1)

for token in [
    'async function getUploadBuktiMode(c:Caller)',
    'async function setUploadBuktiMode(enabled:boolean,c:Caller)',
    'getUploadBuktiMode:(_p:any[],c:Caller)',
    'setUploadBuktiMode:(p:any[],c:Caller)',
    'getUploadBuktiMode:1, setUploadBuktiMode:1',
    'version:5',
]:
    if token not in backend + app:
        raise SystemExit(f'missing token after patch: {token}')

backend_path.write_text(backend, encoding='utf-8')
app_path.write_text(app, encoding='utf-8')
print('Applied upload mode route migration')
