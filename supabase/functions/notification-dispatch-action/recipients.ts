import {sb,text,low,Caller} from './core.ts';

async function pairs(c:Caller){if(c.role!=='ADMIN')return[];const q=await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email',c.email);if(q.error)throw q.error;return(q.data||[]).map((r:any)=>[text(r.sppg),text(r.yayasan)] as const);}
async function pairOK(c:Caller,sppg:string,yayasan:string){if(c.role==='SUPER_ADMIN')return true;if(c.role!=='ADMIN')return false;return(await pairs(c)).some(([sp,ya])=>sp===sppg&&ya===yayasan);}

export async function recipientEmails(c:Caller,d:any){
  const mode=text(d.mode||'self').toLowerCase();
  if(mode==='self')return[c.email];
  if(mode==='email'){
    const email=low(d.email);if(!email)throw new Error('Email target wajib diisi.');
    if(c.role==='USER'&&email!==c.email)throw new Error('Akses target ditolak.');
    if(c.role==='ADMIN'){
      const q=await sb.from('USERS').select('SPPG,"NAMA YAYASAN"').eq('EMAIL',email).maybeSingle();
      if(q.error||!q.data||!(await pairOK(c,text(q.data.SPPG),text(q.data['NAMA YAYASAN']))))throw new Error('Target di luar assignment ADMIN.');
    }
    return[email];
  }
  if(mode==='pair'){
    const sppg=text(d.sppg),yayasan=text(d.yayasan);if(!sppg||!yayasan)throw new Error('SPPG dan Yayasan wajib diisi.');
    if(!(await pairOK(c,sppg,yayasan)))throw new Error('Pasangan SPPG + Yayasan tidak diizinkan.');
    const q=await sb.from('USERS').select('EMAIL').eq('SPPG',sppg).eq('NAMA YAYASAN',yayasan);if(q.error)throw q.error;
    return(q.data||[]).map((r:any)=>low(r.EMAIL)).filter(Boolean);
  }
  if(mode==='role'){
    if(c.role!=='SUPER_ADMIN')throw new Error('Hanya SUPER_ADMIN yang dapat menargetkan ROLE.');
    const role=text(d.role).toUpperCase();if(!['SUPER_ADMIN','ADMIN','USER'].includes(role))throw new Error('ROLE target tidak valid.');
    const q=await sb.from('USERS').select('EMAIL').eq('ROLE',role);if(q.error)throw q.error;
    return(q.data||[]).map((r:any)=>low(r.EMAIL)).filter(Boolean);
  }
  if(mode==='all'){
    if(c.role!=='SUPER_ADMIN')throw new Error('Hanya SUPER_ADMIN yang dapat mengirim ke semua user.');
    const q=await sb.from('USERS').select('EMAIL');if(q.error)throw q.error;
    return(q.data||[]).map((r:any)=>low(r.EMAIL)).filter(Boolean);
  }
  throw new Error('Mode target tidak dikenal.');
}
