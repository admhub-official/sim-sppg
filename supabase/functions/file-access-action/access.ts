import {sb,s,Caller,mayAccessOwner,mayAccessUser,userProfileByIdentifier} from './core.ts';
const MAP:any={
 FOTO_PROFIL:{bucket:'foto-profil',table:'USERS',cols:['FOTO PROFIL'],owner:'profile'},
 FOTO_BB:{bucket:'foto-bb',table:'SURVEI_BB',cols:['FOTO BAHAN BAKU'],owner:'USER'},
 FOTO_DATANG:{bucket:'foto-datang',table:'SERAH_TERIMA',cols:['FOTO BARANG DATANG','FOTO SURAT JALAN'],owner:'USER'},
 TTD_PENERIMA:{bucket:'ttd-penerima',table:'SERAH_TERIMA',cols:['TTD PENERIMA'],owner:'USER'},
 TTD_SUPPLIER:{bucket:'ttd-supplier-inv',table:'SERAH_TERIMA',cols:['TTD SUPPLIER'],owner:'USER'},
 FOTO_SUPPLIER:{bucket:'foto-supplier',table:'MASTER_SUPPLIER',cols:['FOTO SUPPLIER'],owner:'global'},
 FILE_MOU:{bucket:'file-mou',table:'MASTER_SUPPLIER',cols:['FILE MOU'],owner:'global'},
 TTD_SUPPLIER_INV:{bucket:'ttd-supplier-inv',table:'MASTER_SUPPLIER',cols:['TTD SUPPLIER'],owner:'global'}
};
function pathFilter(cols:string[],path:string){return cols.map(c=>`"${c}".eq.${path}`).join(',')}
export async function getFileUrl(bucketKey:string,path:string,c:Caller){const k=s(bucketKey).toUpperCase(),p=s(path);if(!p)return{success:true,data:{url:''}};const cfg=MAP[k];if(!cfg)throw new Error('Bucket tidak diizinkan melalui endpoint ini. Gunakan endpoint detail modul terkait.');let allowed=false;if(cfg.owner==='global'){allowed=true}else if(cfg.owner==='profile'){const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","FOTO PROFIL"').eq('FOTO PROFIL',p).maybeSingle();if(q.error)throw q.error;allowed=await mayAccessUser(c,q.data)}else{const q=await sb.from(cfg.table).select(`ID,${cfg.owner},${cfg.cols.map((x:string)=>`"${x}"`).join(',')}`).or(pathFilter(cfg.cols,p)).maybeSingle();if(q.error)throw q.error;allowed=!!q.data&&await mayAccessOwner(c,q.data[cfg.owner])}if(!allowed)throw new Error('Akses file ditolak.');const u=await sb.storage.from(cfg.bucket).createSignedUrl(p,900);if(u.error||!u.data?.signedUrl)throw new Error('File tidak ditemukan atau URL gagal dibuat.');return{success:true,data:{url:u.data.signedUrl,expiresIn:900,bucket:cfg.bucket,path:p}}}
export async function showCredentials(username:string,c:Caller){const u=await userProfileByIdentifier(username);if(!u)throw new Error('User tidak ditemukan.');if(!(await mayAccessUser(c,u)))throw new Error('Akses kredensial ditolak.');return{success:true,username:s(u.USERNAME)}}
