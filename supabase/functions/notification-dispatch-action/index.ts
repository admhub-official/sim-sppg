import {C,out,sb,text,caller,configureWebPush,sendPush} from './core.ts';
import {recipientEmails} from './recipients.ts';

async function logDelivery(row:any){const q=await sb.from('notification_deliveries').insert(row);if(q.error)console.error('delivery log',q.error.message);}

async function dispatch(c:any,d:any){
  const title=text(d.title).slice(0,120),body=text(d.body).slice(0,500),url=text(d.url).slice(0,500);
  if(!title||!body)throw new Error('Judul dan isi notifikasi wajib diisi.');
  configureWebPush();
  const emails=[...new Set(await recipientEmails(c,d))];
  if(!emails.length)return{success:true,sent:0,failed:0,expired:0,recipients:0,subscriptions:0};
  const q=await sb.from('PUSH_SUBSCRIPTIONS').select('id,user_email,endpoint,p256dh,auth').in('user_email',emails);if(q.error)throw q.error;
  let sent=0,failed=0,expired=0;
  for(const sub of q.data||[]){
    const base={requested_by:c.email,target_email:sub.user_email,target_sppg:text(d.sppg)||null,target_yayasan:text(d.yayasan)||null,subscription_id:sub.id,title,body,target_url:url||null};
    try{
      await sendPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{title,body,url});
      sent++;
      await sb.from('PUSH_SUBSCRIPTIONS').update({last_used_at:new Date().toISOString()}).eq('id',sub.id);
      await logDelivery({...base,status:'SENT',http_status:201});
    }catch(e:any){
      const status=Number(e?.statusCode||e?.status||0)||null;
      if(status===404||status===410){expired++;await sb.from('PUSH_SUBSCRIPTIONS').delete().eq('id',sub.id);await logDelivery({...base,status:'EXPIRED',http_status:status,error_message:String(e?.message||e).slice(0,500)});}
      else{failed++;await logDelivery({...base,status:'FAILED',http_status:status,error_message:String(e?.message||e).slice(0,500)});}
    }
  }
  return{success:failed===0,sent,failed,expired,recipients:emails.length,subscriptions:(q.data||[]).length};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  if(req.method==='GET')return out({status:'ok',service:'notification-dispatch-action',version:1});
  if(req.method!=='POST')return out({error:'Method tidak didukung.'},405);
  if(Number(req.headers.get('content-length')||0)>32000)return out({error:'Payload terlalu besar.'},413);
  try{
    const c=await caller(req),b=await req.json();
    if(b?.function!=='dispatchNotification')return out({error:'Fungsi tidak diizinkan.'},404);
    return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    const denied=/token|akses|hanya super_admin|assignment|ditolak|diizinkan/i.test(message);
    console.error(message);
    return out({error:message,result:{success:false,message}},denied?403:400);
  }
});
