const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
  'Content-Type':'application/json'
};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
const clean=(v:unknown)=>String(v??'').trim();

async function requireUser(req:Request){
  const auth=req.headers.get('Authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)throw new Error('Token wajib disertakan.');
  const base=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const r=await fetch(base+'/auth/v1/user',{headers:{Authorization:'Bearer '+token,apikey:key}});
  if(!r.ok)throw new Error('Token tidak valid atau kedaluwarsa.');
}

async function geocodeAlamat(value:unknown){
  const alamat=clean(value);
  if(!alamat)throw new Error('Alamat wajib diisi.');
  if(alamat.length<5||alamat.length>300)throw new Error('Panjang alamat tidak valid.');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const host=['https://nominatim','openstreetmap','org'].join('.');
    const url=host+'/search?'+new URLSearchParams({q:alamat,format:'jsonv2',limit:'1',addressdetails:'1',countrycodes:'id'});
    const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'SIM-SPPG/1.0','Accept-Language':'id'}});
    if(!r.ok)throw new Error('Layanan geocoding tidak tersedia.');
    const rows=await r.json();
    if(!Array.isArray(rows)||!rows.length)return {success:false,message:'Alamat tidak ditemukan.'};
    const first=rows[0],lat=Number(first.lat),lng=Number(first.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('Koordinat tidak valid.');
    return {success:true,lat,lng,formattedAddress:clean(first.display_name)||alamat,mapsLink:'https://www.google.com/maps?q='+lat+','+lng};
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError')throw new Error('Pencarian alamat timeout.');
    throw e;
  }finally{clearTimeout(timeout);}
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method==='GET')return j({status:'ok',service:'geocode-action',version:1});
  if(req.method!=='POST')return j({error:'Method tidak didukung.'},405);
  try{
    await requireUser(req);
    const b=await req.json();
    if(b?.function!=='geocodeAlamat')return j({error:'Fungsi tidak diizinkan.'},404);
    const p=Array.isArray(b.parameters)?b.parameters:[];
    return j({result:await geocodeAlamat(p[0])});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return j({error:message,result:{success:false,message}},/token/i.test(message)?401:400);
  }
});