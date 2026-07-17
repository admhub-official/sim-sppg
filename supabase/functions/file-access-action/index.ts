import {CORS,json,caller} from './core.ts';
import {getFileUrl,showCredentials} from './access.ts';
const H:any={getFileUrl:(p:any[],c:any)=>getFileUrl(p[0],p[1],c),showCredentials:(p:any[],c:any)=>showCredentials(p[0],c)};
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);try{const c=await caller(req),b=await req.json(),fn=H[b?.function];if(!fn)return json({error:'Fungsi tidak diizinkan.'},404);const result=await fn(Array.isArray(b.parameters)?b.parameters:[],c);return json({result})}catch(e){const m=e instanceof Error?e.message:String(e);const denied=/akses|token|ditolak/i.test(m);return json({error:m,result:{success:false,message:m}},denied?403:400)}});
