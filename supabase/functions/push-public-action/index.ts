const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
  'Content-Type':'application/json'
};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});

function b64urlToBytes(value:string){
  const b64=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  const raw=atob(b64),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes:Uint8Array){
  let raw='';for(const b of bytes)raw+=String.fromCharCode(b);
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function publicApplicationServerKey(){
  const raw=Deno.env.get('VAPID_PUBLIC_JWK');
  if(!raw)throw new Error('Push notification belum dikonfigurasi di server.');
  const jwk=JSON.parse(raw);
  if(jwk.kty!=='EC'||jwk.crv!=='P-256'||!jwk.x||!jwk.y)throw new Error('VAPID public key tidak valid.');
  const x=b64urlToBytes(jwk.x),y=b64urlToBytes(jwk.y);
  if(x.length!==32||y.length!==32)throw new Error('VAPID public key tidak valid.');
  const out=new Uint8Array(65);out[0]=4;out.set(x,1);out.set(y,33);
  return bytesToB64url(out);
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method==='GET')return j({status:'ok',service:'push-public-action',version:1});
  if(req.method!=='POST')return j({error:'Method tidak didukung.'},405);
  try{
    const b=await req.json();
    if(b?.function!=='getPushPublicKey')return j({error:`Fungsi tidak diizinkan: ${b?.function||''}`},404);
    return j({result:{success:true,data:{publicKey:publicApplicationServerKey()}}});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return j({error:message,result:{success:false,message}},400);
  }
});
