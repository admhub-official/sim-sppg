const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
const allowed=new Set(['loginUser','verifyRegistrationOtp','resendRegistrationOtp','checkSession']);
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:C});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  if(req.method==='GET')return out({status:'ok',service:'auth-public-action',version:1});
  if(req.method!=='POST')return out({error:'Method tidak didukung.'},405);
  const len=Number(req.headers.get('content-length')||0);if(len>32000)return out({error:'Payload terlalu besar.'},413);
  try{
    const body=await req.json();
    if(!allowed.has(String(body?.function||'')))return out({error:'Fungsi tidak diizinkan.'},404);
    const base=Deno.env.get('SUPABASE_URL')||'';
    const key=Deno.env.get('SUPABASE_ANON_KEY')||'';
    const r=await fetch(base+'/functions/v1/dynamic-action',{method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify({function:body.function,parameters:Array.isArray(body.parameters)?body.parameters:[]})});
    return new Response(await r.text(),{status:r.status,headers:C});
  }catch(e){return out({error:e instanceof Error?e.message:String(e)},400);}
});
