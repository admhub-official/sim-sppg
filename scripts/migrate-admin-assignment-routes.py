from pathlib import Path

ops_path = Path('supabase/functions/operations-action/index.ts')
app_path = Path('app.js')
ops = ops_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')

marker = "async function listOwned(table:string,c:Caller,orderCol='TIMESTAMP')"
if 'async function getAdminAssignments(' not in ops:
    block = r'''function requireSuperAdmin(c:Caller){if(c.role!=='SUPER_ADMIN')throw new Error('Hanya SUPER_ADMIN yang dapat mengelola assignment.');}
async function requireAdminAccount(email:unknown){const e=lo(email);if(!e)throw new Error('Email ADMIN wajib diisi.');const q=await sb.from('USERS').select('ID,EMAIL,ROLE').eq('EMAIL',e).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Akun ADMIN tidak ditemukan.');if(s(q.data.ROLE).toUpperCase()!=='ADMIN')throw new Error('Assignment hanya dapat diberikan kepada akun dengan ROLE ADMIN.');return e;}
async function getAdminAssignments(targetEmail:string,c:Caller){requireSuperAdmin(c);let q=sb.from('ADMIN_ASSIGNMENT').select('id,admin_email,sppg,yayasan,created_at,created_by').order('created_at',{ascending:false});if(lo(targetEmail))q=q.eq('admin_email',lo(targetEmail));const r=await q;if(r.error)throw r.error;return{success:true,data:r.data||[]};}
async function addAdminAssignment(email:string,sp:string,ya:string,c:Caller){requireSuperAdmin(c);const e=await requireAdminAccount(email),sppg=s(sp),yayasan=s(ya);if(!sppg||!yayasan)throw new Error('SPPG dan Yayasan wajib diisi.');const existing=await sb.from('ADMIN_ASSIGNMENT').select('id').eq('admin_email',e).eq('sppg',sppg).eq('yayasan',yayasan).maybeSingle();if(existing.error)throw existing.error;if(existing.data)throw new Error('Assignment yang sama sudah tersedia.');const q=await sb.from('ADMIN_ASSIGNMENT').insert({admin_email:e,sppg,yayasan,created_by:c.email}).select('id').single();if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',q.data.id,'ADD',{admin_email:e,sppg,yayasan});return{success:true,message:'Assignment berhasil ditambahkan.',id:q.data.id};}
async function updateAdminAssignment(id:string,sp:string,ya:string,c:Caller){requireSuperAdmin(c);const assignmentId=s(id),sppg=s(sp),yayasan=s(ya);if(!assignmentId||!sppg||!yayasan)throw new Error('ID, SPPG, dan Yayasan wajib diisi.');const old=await sb.from('ADMIN_ASSIGNMENT').select('*').eq('id',assignmentId).maybeSingle();if(old.error)throw old.error;if(!old.data)throw new Error('Assignment tidak ditemukan.');const duplicate=await sb.from('ADMIN_ASSIGNMENT').select('id').eq('admin_email',old.data.admin_email).eq('sppg',sppg).eq('yayasan',yayasan).neq('id',assignmentId).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('Assignment tujuan sudah tersedia.');const q=await sb.from('ADMIN_ASSIGNMENT').update({sppg,yayasan}).eq('id',assignmentId);if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'EDIT',{from:{sppg:old.data.sppg,yayasan:old.data.yayasan},to:{sppg,yayasan}});return{success:true,message:'Assignment berhasil diperbarui.'};}
async function deleteAdminAssignment(id:string,c:Caller){requireSuperAdmin(c);const assignmentId=s(id);const old=await sb.from('ADMIN_ASSIGNMENT').select('*').eq('id',assignmentId).maybeSingle();if(old.error)throw old.error;if(!old.data)throw new Error('Assignment tidak ditemukan.');const q=await sb.from('ADMIN_ASSIGNMENT').delete().eq('id',assignmentId);if(q.error)throw q.error;await audit(c,'ADMIN_ASSIGNMENT',assignmentId,'DELETE',{admin_email:old.data.admin_email,sppg:old.data.sppg,yayasan:old.data.yayasan});return{success:true,message:'Assignment berhasil dihapus.'};}

'''
    if marker not in ops:
        raise SystemExit('operations insertion marker not found')
    ops = ops.replace(marker, block + marker, 1)

handler_marker = " getAllUsers:(p:any[],c:Caller)=>getAllUsers(c,p[0]||{}),deleteUser:(p:any[],c:Caller)=>deleteUser(s(p[0]),c),"
handler_add = handler_marker + "\n getAdminAssignments:(p:any[],c:Caller)=>getAdminAssignments(s(p[0]),c),addAdminAssignment:(p:any[],c:Caller)=>addAdminAssignment(s(p[0]),s(p[1]),s(p[2]),c),updateAdminAssignment:(p:any[],c:Caller)=>updateAdminAssignment(s(p[0]),s(p[1]),s(p[2]),c),deleteAdminAssignment:(p:any[],c:Caller)=>deleteAdminAssignment(s(p[0]),c),"
if 'getAdminAssignments:(p:any[]' not in ops:
    if handler_marker not in ops:
        raise SystemExit('operations handler marker not found')
    ops = ops.replace(handler_marker, handler_add, 1)

ops = ops.replace("service:'operations-action',version:1", "service:'operations-action',version:3")
ops = ops.replace("/akses|token|hanya admin|assignment|ditolak/i", "/akses|token|hanya admin|super_admin|assignment|ditolak/i")

route_marker = "  getAllUsers:1, deleteUser:1,"
route_add = route_marker + "\n  getAdminAssignments:1, addAdminAssignment:1, updateAdminAssignment:1, deleteAdminAssignment:1,"
if 'getAdminAssignments:1' not in app:
    if route_marker not in app:
        raise SystemExit('app route marker not found')
    app = app.replace(route_marker, route_add, 1)

for token in ['requireSuperAdmin', 'getAdminAssignments:(p:any[]', 'addAdminAssignment:(p:any[]', 'updateAdminAssignment:(p:any[]', 'deleteAdminAssignment:(p:any[]']:
    if token not in ops:
        raise SystemExit(f'missing operations token: {token}')
for token in ['getAdminAssignments:1', 'addAdminAssignment:1', 'updateAdminAssignment:1', 'deleteAdminAssignment:1']:
    if token not in app:
        raise SystemExit(f'missing app route token: {token}')

ops_path.write_text(ops, encoding='utf-8')
app_path.write_text(app, encoding='utf-8')
print('Admin assignment routes migrated to operations-action')
