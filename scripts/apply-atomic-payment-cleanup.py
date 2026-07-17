from pathlib import Path

p = Path('supabase/functions/transaction-action/index.ts')
t = p.read_text(encoding='utf-8')

start = t.index('async function submitPayment(')
end = t.index('\nasync function verify(', start)
new_submit = '''async function submitPayment(d:any,c:Caller){
  const r=await tx(c,s(d.txId));
  const nominal=Number(d.nominalDibayar);
  if(!(nominal>0))throw new Error('Nominal pembayaran harus lebih dari 0.');
  const mime=d.buktiMimeType||'image/png',name=d.buktiFileName||'bukti.png';
  const path=await upload('payment',d.buktiBase64,mime,name,`BUKTI_USER_${r.ID}`);
  try{
    const q=await sb.rpc('submit_transaction_payment_atomic',{
      p_transaksi_id:r.ID,p_nominal:nominal,p_storage_bucket:B.payment,
      p_storage_path:path,p_mime_type:mime,p_original_file_name:name,p_submitted_by:c.email
    });
    if(q.error)throw q.error;
    const x=q.data||{};
    await audit(r.ID,'USER_SUBMIT_BUKTI',c,{seq:x.paymentSequence,nominal,total:x.totalDibayar,status:x.status,atomic:true});
    return{success:true,message:'Bukti pembayaran tersimpan dalam riwayat.',paymentSequence:x.paymentSequence,totalDibayar:x.totalDibayar,status:x.status};
  }catch(e){
    await sb.storage.from(B.payment).remove([path]).catch(()=>undefined);
    throw e;
  }
}'''
t = t[:start] + new_submit + t[end:]

old = "const q=await sb.from(T.X).update(p).eq('ID',r.ID);if(q.error)throw q.error;await audit(r.ID,'APPROVE',c,{bp,tt});"
new = "const q=await sb.from(T.X).update(p).eq('ID',r.ID);if(q.error){const files=[] as string[];if(bp)files.push(bp);if(files.length)await sb.storage.from(B.payment).remove(files).catch(()=>undefined);if(tt)await sb.storage.from(B.ttdVerif).remove([tt]).catch(()=>undefined);throw q.error}await audit(r.ID,'APPROVE',c,{bp,tt});"
if old not in t:
    raise SystemExit('approval update anchor not found')
t = t.replace(old,new,1)

p.write_text(t,encoding='utf-8')
print('atomic payment and orphan cleanup installed')
