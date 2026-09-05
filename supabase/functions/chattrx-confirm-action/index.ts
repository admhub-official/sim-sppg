import {CORS,json,text,sb,getCaller,applyRoleFilter,handlerError} from '../_shared/chattrx.ts';

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);
  try{
    const c=await getCaller(req);
    const body=await req.json();
    const p=Array.isArray(body.parameters)?body.parameters[0]||{}:body;
    const draftId=text(p.draftId);
    if(!draftId)throw new Error('ID draft wajib diisi.');

    // Authorization remains in the Edge Function. Business validation and both
    // writes are performed by one database transaction to prevent partial state.
    let q:any=sb.from('CHATTRX_DRAFT').select('draft_id').eq('draft_id',draftId).maybeSingle();
    const scoped=await applyRoleFilter(q,c);
    if(scoped.error)throw scoped.error;
    if(!scoped.data)throw new Error('Draft tidak ditemukan atau akses ditolak.');

    const saved=await sb.rpc('confirm_chattrx_atomic',{p_draft_id:scoped.data.draft_id});
    if(saved.error)throw saved.error;

    return json({result:{success:true,message:'Transaksi ChatTrx berhasil disimpan.',transactionId:saved.data}});
  }catch(e){return handlerError(e)}
});
