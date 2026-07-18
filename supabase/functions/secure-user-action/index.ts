import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const bearer=(r:Request)=>{const h=r.headers.get('Authorization')||'';return h.startsWith('Bearer ')?h.slice(7).trim():''};
const text=(v:unknown)=>String(v??'').trim();
const validPath=(v:unknown)=>{const x=text(v);return !!x&&x!=='-'&&!/^https?:\/\//i.test(x)};

function cleanObject(value:unknown){const source=value&&typeof value==='object'?value as Record<string,unknown>:{};const allowed=new Set(['NAMA LENGKAP','FOTO PROFIL','JABATAN','SPPG','NAMA YAYASAN','ROLE','EMAIL']);const out:Record<string,unknown>={};for(const [k,v] of Object.entries(source))if(allowed.has(k))out[k]=v;return out;}
async function callerProfile(id:string){const q=await supabase.from('USERS').select('ID,USERNAME,EMAIL,ROLE,SPPG,"NAMA YAYASAN"').eq('ID',id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Profil caller tidak ditemukan.');return q.data as Record<string,string>;}
async function targetAllowed(caller:Record<string,string>,username:string){const q=await supabase.from('USERS').select('ID,USERNAME,EMAIL,ROLE,SPPG,"NAMA YAYASAN","FOTO PROFIL"').eq('USERNAME',username).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('User tidak ditemukan.');const target=q.data as Record<string,string>;const role=caller.ROLE||'',isAdmin=role==='ADMIN'||role==='SUPER_ADMIN';if(target.ID!==caller.ID&&!isAdmin)throw new Error('Anda hanya dapat mengubah profil sendiri.');if(target.ID!==caller.ID&&role==='ADMIN'){const a=await supabase.from('ADMIN_ASSIGNMENT').select('id').eq('admin_email',text(caller.EMAIL).toLowerCase()).eq('sppg',target.SPPG||'').eq('yayasan',target['NAMA YAYASAN']||'').limit(1);if(a.error)throw a.error;if(!a.data?.length)throw new Error('Target berada di luar assignment admin.');}return{target,isAdmin};}
function decodeBase64(data:string){const clean=data.includes(',')?data.split(',')[1]:data;const binary=atob(clean);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function removeProfile(path:unknown){if(!validPath(path))return;const q=await supabase.storage.from('foto-profil').remove([text(path)]);if(q.error)console.error('profile cleanup',q.error.message);}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(request.method!=='POST')return response({error:'Method tidak didukung.'},405);
  try{
    const token=bearer(request);if(!token)return response({error:'Bearer token wajib disertakan.'},401);
    const auth=await supabase.auth.getUser(token);if(auth.error||!auth.data.user)return response({error:'Token tidak valid atau kedaluwarsa.'},401);
    const caller=await callerProfile(auth.data.user.id),body=await request.json(),fn=text(body?.function),params=Array.isArray(body?.parameters)?body.parameters:[];
    if(fn==='updateUserProfile'){
      const username=text(params[0]).toLowerCase(),raw=params[1]&&typeof params[1]==='object'?params[1] as Record<string,unknown>:{};
      const authorization=await targetAllowed(caller,username),adminMode=raw._isAdmin===true&&authorization.isAdmin,update=cleanObject(raw);
      const oldPhoto=authorization.target['FOTO PROFIL'];
      const rpc=await supabase.rpc('secure_update_user_profile',{p_caller_id:caller.ID,p_target_username:username,p_update:update,p_admin_mode:adminMode});if(rpc.error)throw rpc.error;
      if(Object.prototype.hasOwnProperty.call(update,'FOTO PROFIL')&&text(update['FOTO PROFIL'])!==text(oldPhoto))await removeProfile(oldPhoto);
      return response({result:rpc.data});
    }
    if(fn==='uploadFotoProfil'){
      const username=text(params[0]).toLowerCase(),base64=text(params[1]),mime=text(params[2]).toLowerCase(),name=text(params[3]||'profile.png');
      const authorization=await targetAllowed(caller,username),oldPhoto=authorization.target['FOTO PROFIL'];
      if(!base64)throw new Error('Data foto kosong.');if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Format foto harus JPG, PNG, atau WebP.');
      const bytes=decodeBase64(base64);if(bytes.byteLength>5*1024*1024)throw new Error('Ukuran foto maksimal 5 MB.');
      const path=`PROFIL_${username}_${crypto.randomUUID()}_${name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const upload=await supabase.storage.from('foto-profil').upload(path,bytes,{contentType:mime,upsert:false});if(upload.error)throw upload.error;
      try{const rpc=await supabase.rpc('secure_update_user_profile',{p_caller_id:caller.ID,p_target_username:username,p_update:{'FOTO PROFIL':path},p_admin_mode:false});if(rpc.error)throw rpc.error;}catch(e){await removeProfile(path);throw e;}
      if(text(oldPhoto)!==path)await removeProfile(oldPhoto);
      const signed=await supabase.storage.from('foto-profil').createSignedUrl(path,3600);
      return response({result:{success:true,fileId:path,filePath:path,fileUrl:signed.data?.signedUrl||''}});
    }
    return response({error:'Fungsi tidak didukung.'},404);
  }catch(error){return response({result:{success:false,message:error instanceof Error?error.message:String(error)}},400);}
});