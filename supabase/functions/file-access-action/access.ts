import {sb,s,lo,Caller,mayAccessOwner,mayAccessUser,userProfileByIdentifier,pairs} from './core.ts';

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
const TX_BUCKETS=new Set(['transaksi-images','transaksi-files','nota-pembelian','paraf-user','paraf-verifikator','bukti-payment']);
const IMAGE_EXT=/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i;
const pathFilter=(cols:string[],path:string)=>cols.map(c=>`"${c}".eq.${path}`).join(',');

async function canAccessTransaction(c:Caller,id:string){
 const q=await sb.from('TRANSAKSI').select('ID,User,SPPG,YAYASAN').eq('ID',id).maybeSingle();
 if(q.error)throw q.error;if(!q.data)return false;if(c.role==='SUPER_ADMIN')return true;
 if(c.role==='USER')return lo(q.data.User)===c.email||lo(q.data.User)===c.username;
 if(c.role==='ADMIN'){const ps=await pairs(c);return ps.some(([sp,ya])=>sp===s(q.data.SPPG)&&(!ya||ya===s(q.data.YAYASAN)));}
 return false;
}
async function transactionFileAllowed(c:Caller,bucket:string,path:string){
 const d=await sb.from('TRANSAKSI_DOCUMENTS_AVAILABLE').select('transaksi_id').eq('storage_bucket',bucket).eq('storage_path',path).limit(1).maybeSingle();
 if(d.error)throw d.error;if(d.data?.transaksi_id)return canAccessTransaction(c,s(d.data.transaksi_id));
 const p=await sb.from('TRANSAKSI_PAYMENT_PROOFS').select('transaksi_id,storage_bucket,storage_path,verifier_signature_path').or(`and(storage_bucket.eq.${bucket},storage_path.eq.${path}),and(verifier_signature_path.eq.${path})`).limit(1).maybeSingle();
 if(p.error)throw p.error;if(p.data?.transaksi_id)return canAccessTransaction(c,s(p.data.transaksi_id));
 return false;
}
async function genericAllowed(c:Caller,bucket:string,path:string){
 if(TX_BUCKETS.has(bucket))return transactionFileAllowed(c,bucket,path);
 if(bucket==='foto-profil'){const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","FOTO PROFIL"').eq('FOTO PROFIL',path).maybeSingle();if(q.error)throw q.error;return mayAccessUser(c,q.data);}
 if(bucket==='foto-supplier'||bucket==='file-mou'||bucket==='ttd-supplier-inv'){const col=bucket==='foto-supplier'?'FOTO SUPPLIER':bucket==='file-mou'?'FILE MOU':'TTD SUPPLIER';const q=await sb.from('MASTER_SUPPLIER').select(`ID,SPPG,YAYASAN,USER,"${col}"`).eq(col,path).maybeSingle();if(q.error)throw q.error;if(!q.data)return false;if(c.role==='SUPER_ADMIN')return true;if(c.role==='USER')return lo(q.data.USER)===c.email||lo(q.data.USER)===c.username;const ps=await pairs(c);return ps.some(([sp,ya])=>sp===s(q.data.SPPG)&&ya===s(q.data.YAYASAN));}
 return false;
}

export async function getFileUrl(bucketOrKey:any,pathArg:any,c:Caller){
 let bucket='',path='',variant='full';
 if(bucketOrKey&&typeof bucketOrKey==='object'){bucket=s(bucketOrKey.bucket);path=s(bucketOrKey.path);variant=s(bucketOrKey.variant||'full').toLowerCase();}else{
   const key=s(bucketOrKey).toUpperCase();const cfg=MAP[key];path=s(pathArg);
   if(!cfg)throw new Error('Bucket tidak diizinkan melalui endpoint ini.');bucket=cfg.bucket;
   let allowed=false;if(cfg.owner==='global')allowed=true;else if(cfg.owner==='profile'){const q=await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","FOTO PROFIL"').eq('FOTO PROFIL',path).maybeSingle();if(q.error)throw q.error;allowed=await mayAccessUser(c,q.data);}else{const q=await sb.from(cfg.table).select(`ID,${cfg.owner},${cfg.cols.map((x:string)=>`"${x}"`).join(',')}`).or(pathFilter(cfg.cols,path)).maybeSingle();if(q.error)throw q.error;allowed=!!q.data&&await mayAccessOwner(c,q.data[cfg.owner]);}if(!allowed)throw new Error('Akses file ditolak.');
 }
 if(!bucket||!path)return{success:true,data:{url:''}};
 if(bucketOrKey&&typeof bucketOrKey==='object'&&!await genericAllowed(c,bucket,path))throw new Error('Akses file ditolak.');
 const thumbnail=variant==='thumbnail'&&IMAGE_EXT.test(path.split('?')[0]);
 let u:any;
 if(thumbnail){
   u=await sb.storage.from(bucket).createSignedUrl(path,3600,{transform:{width:480,height:480,resize:'contain',quality:65}});
   if(u.error||!u.data?.signedUrl)u=await sb.storage.from(bucket).createSignedUrl(path,3600);
 }else u=await sb.storage.from(bucket).createSignedUrl(path,3600);
 if(u.error||!u.data?.signedUrl)throw new Error('File tidak ditemukan atau URL gagal dibuat.');
 return{success:true,data:{url:u.data.signedUrl,expiresIn:3600,bucket,path,variant:thumbnail?'thumbnail':'full',transformed:thumbnail&&!u.error}};
}
export async function showCredentials(username:string,c:Caller){const u=await userProfileByIdentifier(username);if(!u)throw new Error('User tidak ditemukan.');if(!(await mayAccessUser(c,u)))throw new Error('Akses kredensial ditolak.');return{success:true,username:s(u.USERNAME)}}