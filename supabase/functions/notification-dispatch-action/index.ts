import {C,out,sb,text,caller,configureWebPush,sendPush} from './core.ts';
import {recipientEmails} from './recipients.ts';

async function logDelivery(row:any){const q=await sb.from('notification_deliveries').insert(row);if(q.error)console.error('delivery log',q.error.message);}

function errorStatus(e:any){return Number(e?.statusCode||e?.status||0)||null;}
function errorText(e:any){return String(e?.message||e).slice(0,500);}
function nextAttemptIso(attempt:number){const minutes=attempt<=1?5:attempt===2?15:45;return new Date(Date.now()+minutes*60_000).toISOString();}

async function enqueueRetry(base:any,sub:any,payload:any,e:any){
  const q=await sb.from('push_retry_queue').insert({
    requested_by:base.requested_by,
    target_email:sub.user_email,
    target_sppg:base.target_sppg,
    target_yayasan:base.target_yayasan,
    subscription_id:sub.id,
    endpoint:sub.endpoint,
    p256dh:sub.p256dh,
    auth:sub.auth,
    title:payload.title,
    body:payload.body,
    target_url:payload.url||null,
    attempt_count:1,
    max_attempts:3,
    status:'PENDING',
    next_attempt_at:nextAttemptIso(1),
    last_http_status:errorStatus(e),
    last_error:errorText(e)
  });
  if(q.error)console.error('retry enqueue',q.error.message);
}

function scheduleDueRetries(){
  try{
    const task=processRetries(10).catch(e=>console.error('opportunistic retry',e));
    const runtime=(globalThis as any).EdgeRuntime;
    if(runtime?.waitUntil)runtime.waitUntil(task);
  }catch(e){console.error('retry schedule',e)}
}

async function dispatch(c:any,d:any){
  const title=text(d.title).slice(0,120),body=text(d.body).slice(0,500),url=text(d.url).slice(0,500);
  if(!title||!body)throw new Error('Judul dan isi notifikasi wajib diisi.');
  configureWebPush();
  const emails=[...new Set(await recipientEmails(c,d))];
  if(!emails.length){scheduleDueRetries();return{success:true,sent:0,failed:0,expired:0,queued:0,recipients:0,subscriptions:0};}
  const q=await sb.from('PUSH_SUBSCRIPTIONS').select('id,user_email,endpoint,p256dh,auth').in('user_email',emails);if(q.error)throw q.error;
  let sent=0,failed=0,expired=0,queued=0;
  for(const sub of q.data||[]){
    const base={requested_by:c.email,target_email:sub.user_email,target_sppg:text(d.sppg)||null,target_yayasan:text(d.yayasan)||null,subscription_id:sub.id,title,body,target_url:url||null};
    try{
      await sendPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{title,body,url});
      sent++;
      await sb.from('PUSH_SUBSCRIPTIONS').update({last_used_at:new Date().toISOString()}).eq('id',sub.id);
      await logDelivery({...base,status:'SENT',http_status:201});
    }catch(e:any){
      const status=errorStatus(e);
      if(status===404||status===410){expired++;await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('id',sub.id);await logDelivery({...base,status:'EXPIRED',http_status:status,error_message:errorText(e)});}
      else{failed++;queued++;await enqueueRetry(base,sub,{title,body,url},e);await logDelivery({...base,status:'FAILED',http_status:status,error_message:`Queued retry 1/3: ${errorText(e)}`.slice(0,500)});}
    }
  }
  scheduleDueRetries();
  return{success:failed===0,sent,failed,expired,queued,recipients:emails.length,subscriptions:(q.data||[]).length};
}

async function processRetries(limit=25){
  configureWebPush();
  const claimed=await sb.rpc('claim_push_retry_batch',{p_limit:Math.max(1,Math.min(Number(limit)||25,100))});
  if(claimed.error)throw claimed.error;
  let sent=0,rescheduled=0,expired=0,dead=0;
  for(const job of claimed.data||[]){
    const base={requested_by:job.requested_by,target_email:job.target_email,target_sppg:job.target_sppg,target_yayasan:job.target_yayasan,subscription_id:job.subscription_id,title:job.title,body:job.body,target_url:job.target_url};
    try{
      await sendPush({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},{title:job.title,body:job.body,url:job.target_url||''});
      sent++;
      await sb.from('push_retry_queue').update({status:'SENT',updated_at:new Date().toISOString(),locked_at:null,last_http_status:201,last_error:null}).eq('id',job.id);
      if(job.subscription_id)await sb.from('PUSH_SUBSCRIPTIONS').update({last_used_at:new Date().toISOString()}).eq('id',job.subscription_id);
      await logDelivery({...base,status:'SENT',http_status:201,error_message:`Retry ${job.attempt_count}/3 berhasil`});
    }catch(e:any){
      const status=errorStatus(e),message=errorText(e);
      if(status===404||status===410){
        expired++;
        if(job.subscription_id)await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('id',job.subscription_id);
        await sb.from('push_retry_queue').update({status:'EXPIRED',updated_at:new Date().toISOString(),locked_at:null,last_http_status:status,last_error:message}).eq('id',job.id);
        await logDelivery({...base,status:'EXPIRED',http_status:status,error_message:message});
        continue;
      }
      const nextCount=Number(job.attempt_count||0)+1;
      if(nextCount>=Number(job.max_attempts||3)){
        dead++;
        await sb.from('push_retry_queue').update({status:'DEAD',attempt_count:nextCount,updated_at:new Date().toISOString(),locked_at:null,last_http_status:status,last_error:message}).eq('id',job.id);
        await logDelivery({...base,status:'FAILED',http_status:status,error_message:`Retry habis ${nextCount}/3: ${message}`.slice(0,500)});
      }else{
        rescheduled++;
        await sb.from('push_retry_queue').update({status:'PENDING',attempt_count:nextCount,next_attempt_at:nextAttemptIso(nextCount),updated_at:new Date().toISOString(),locked_at:null,last_http_status:status,last_error:message}).eq('id',job.id);
        await logDelivery({...base,status:'FAILED',http_status:status,error_message:`Dijadwalkan ulang ${nextCount}/3: ${message}`.slice(0,500)});
      }
    }
  }
  return{success:true,claimed:(claimed.data||[]).length,sent,rescheduled,expired,dead};
}

function internalCaller(req:Request){
  const auth=req.headers.get('Authorization')||'';
  const expected=`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}`;
  if(!expected.endsWith(' ')&&auth===expected)return{id:'system',email:'system@sim-sppg.local',role:'SUPER_ADMIN',sppg:'',yayasan:''};
  return null;
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  if(req.method==='GET')return out({status:'ok',service:'notification-dispatch-action',version:5,internalDispatch:true,retryQueue:true,maxAttempts:3,opportunisticRetry:true});
  if(req.method!=='POST')return out({error:'Method tidak didukung.'},405);
  if(Number(req.headers.get('content-length')||0)>32000)return out({error:'Payload terlalu besar.'},413);
  try{
    const b=await req.json();
    if(b?.function==='dispatchSystemNotification'){
      const c=internalCaller(req);if(!c)throw new Error('Akses internal ditolak.');
      return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});
    }
    if(b?.function==='processPushRetries'){
      const c=internalCaller(req);if(!c)throw new Error('Akses internal ditolak.');
      return out({result:await processRetries(Array.isArray(b.parameters)?b.parameters[0]?.limit:25)});
    }
    if(b?.function!=='dispatchNotification')return out({error:'Fungsi tidak diizinkan.'},404);
    const c=await caller(req);
    return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    const denied=/token|akses|hanya super_admin|assignment|ditolak|diizinkan/i.test(message);
    console.error(message);
    return out({error:message,result:{success:false,message}},denied?403:400);
  }
});