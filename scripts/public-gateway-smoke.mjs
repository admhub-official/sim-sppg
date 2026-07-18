// Non-mutating production checks for modular public gateways.
const base='https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1';

async function request(slug,body){
  const res=await fetch(`${base}/${slug}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const text=await res.text();
  let json={};try{json=text?JSON.parse(text):{};}catch{throw new Error(`${slug} returned invalid JSON: ${res.status}`)}
  return{res,json};
}
function assert(ok,msg){if(!ok)throw new Error(msg)}

for(const slug of ['auth-public-action','account-recovery-action','app-config-action']){
  const {res,json}=await request(slug);
  assert(res.ok,`${slug} health failed: ${res.status}`);
  assert(json.status==='ok',`${slug} health payload invalid`);
  const bad=await request(slug,{function:'notAllowedFunction',parameters:[]});
  assert(bad.res.status===404,`${slug} accepted unknown function: ${bad.res.status}`);
}

{
  const {res}=await request('auth-public-action',{function:'checkSession',parameters:[Date.now()+60000]});
  assert(res.ok,`checkSession failed: ${res.status}`);
}
{
  const {res}=await request('account-recovery-action',{function:'recoverToken',parameters:[{}]});
  assert(res.ok,`recoverToken compatibility check failed: ${res.status}`);
}
{
  const {res,json}=await request('app-config-action',{function:'getAppConfig',parameters:[]});
  assert(res.ok,`getAppConfig failed: ${res.status}`);
  assert(json&&Object.prototype.hasOwnProperty.call(json,'result'),'getAppConfig result missing');
}

console.log('Public gateway smoke tests passed.');
