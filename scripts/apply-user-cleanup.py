from pathlib import Path
import re

path=Path('supabase/functions/operations-action/index.ts')
text=path.read_text(encoding='utf-8')
pattern=r"async function deleteUser\(username:string,c:Caller\)\{.*?return\{success:true,message:'User berhasil dihapus\.'\};\}"
replacement="""async function deleteUser(username:string,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses ditolak.');
  const q=await sb.from('USERS').select('*').eq('USERNAME',lo(username)).maybeSingle();
  if(q.error)throw q.error;if(!q.data)throw new Error('User tidak ditemukan.');
  if(q.data.ID===c.id)throw new Error('Tidak bisa menghapus akun sendiri.');
  if(q.data.ROLE==='SUPER_ADMIN')throw new Error('Akun SUPER_ADMIN tidak dapat dihapus dari endpoint ini.');
  if(c.role==='ADMIN'){
    if(q.data.ROLE!=='USER')throw new Error('ADMIN hanya dapat menghapus USER.');
    if(!(await pairOK(c,q.data.SPPG,q.data['NAMA YAYASAN'])))throw new Error('Target di luar assignment ADMIN.');
  }
  const email=lo(q.data.EMAIL),photo=s(q.data['FOTO PROFIL']);
  const assignment=await sb.from('ADMIN_ASSIGNMENT').delete().eq('admin_email',email);if(assignment.error)throw assignment.error;
  const push=await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('user_email',email);if(push.error)throw push.error;
  const a=await sb.auth.admin.deleteUser(q.data.ID);if(a.error)throw a.error;
  const d=await sb.from('USERS').delete().eq('ID',q.data.ID);if(d.error)throw d.error;
  if(photo){const cleanup=await sb.storage.from('foto-profil').remove([photo]);if(cleanup.error)console.error('profile cleanup',cleanup.error.message);}
  await audit(c,'USERS',q.data.ID,'DELETE',{username,email,profilePhotoDeleted:!!photo,pushSubscriptionsDeleted:true,assignmentsDeleted:true});
  return{success:true,message:'User dan file profil terkait berhasil dihapus.'};
}"""
new,count=re.subn(pattern,replacement,text,flags=re.S)
if count!=1:
    if 'User dan file profil terkait berhasil dihapus.' in text:
        print('User cleanup already applied.')
        raise SystemExit(0)
    raise SystemExit(f'Expected one deleteUser function, found {count}')
path.write_text(new,encoding='utf-8')
print('User cleanup applied.')
