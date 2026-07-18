import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb=createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {auth:{persistSession:false,autoRefreshToken:false}}
);
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:C});
const SPPG_LIST=['DARMARAJA','CIAMIS','TANJUNG MEDAR','PAKUALAM','KIRISIK','CIBUNAR','CINTA JAYA'];
const JABATAN=['ADMIN','PIC','ASISTEN LAPANGAN','WAKIL ASISTEN LAPANGAN','AKUNTAN','AHLI GIZI'];
const SATUAN=['Kg','Pcs','Ikat','Pack','Liter','Botol','Gram','Ml'];
const KONDISI=['Baik','Cukup Baik','Rusak Ringan','Rusak Berat'];
const STATUS_SUPPLIER=['Aktif','Non-Aktif','Suspend'];
const clean=(v:unknown)=>String(v??'').trim();

function getAppConfig(){
  return {sppgList:SPPG_LIST,jabatan:JABATAN,satuan:SATUAN,kondisiBB:KONDISI,statusSupplier:STATUS_SUPPLIER};
}

async function getDropdownOptions(){
  const [bb,supplier,tx,user]=await Promise.all([
    sb.from('MASTER_BB').select('ID,"KODE BAHAN","KATEGORI BAHAN BAKU","NAMA BAHAN BAKU","HARGA BAHAN BAKU",SATUAN'),
    sb.from('MASTER_SUPPLIER').select('ID,"NAMA SUPPLIER"'),
    sb.from('TRANSAKSI').select('Kategori,"Jenis Kategori"'),
    sb.from('USERS').select('"NAMA YAYASAN"')
  ]);
  for(const q of [bb,supplier,tx,user])if(q.error)throw q.error;
  const uniq=(a:string[])=>[...new Set(a.filter(Boolean))].sort();
  const bbRows=bb.data||[],supplierRows=supplier.data||[],txRows=tx.data||[],userRows=user.data||[];
  return {
    success:true,
    kategori:uniq(bbRows.map((r:any)=>clean(r['KATEGORI BAHAN BAKU']))),
    bahanBaku:bbRows.filter((r:any)=>clean(r['NAMA BAHAN BAKU'])).map((r:any)=>({id:r.ID,kode:r['KODE BAHAN'],nama:r['NAMA BAHAN BAKU'],kategori:r['KATEGORI BAHAN BAKU'],harga:Number(r['HARGA BAHAN BAKU'])||0,satuan:r.SATUAN||''})),
    suppliers:supplierRows.filter((r:any)=>clean(r['NAMA SUPPLIER'])).map((r:any)=>({id:r.ID,nama:r['NAMA SUPPLIER']})),
    satuan:SATUAN,kondisi:KONDISI,statusSupplier:STATUS_SUPPLIER,sppgList:SPPG_LIST,jabatan:JABATAN,
    txKategori:uniq(txRows.map((r:any)=>clean(r.Kategori))),
    txJenisKategori:uniq(txRows.map((r:any)=>clean(r['Jenis Kategori']))),
    yayasanList:uniq(userRows.map((r:any)=>clean(r['NAMA YAYASAN'])))
  };
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  if(req.method==='GET')return out({status:'ok',service:'app-config-action',version:2,native:true});
  if(req.method!=='POST')return out({error:'Method tidak didukung.'},405);
  const len=Number(req.headers.get('content-length')||0);if(len>16000)return out({error:'Payload terlalu besar.'},413);
  try{
    const body=await req.json();
    const fn=String(body?.function||'');
    if(fn==='getAppConfig')return out({result:getAppConfig()});
    if(fn==='getDropdownOptions')return out({result:await getDropdownOptions()});
    return out({error:'Fungsi tidak diizinkan.'},404);
  }catch(e){return out({error:e instanceof Error?e.message:String(e)},400);}
});
