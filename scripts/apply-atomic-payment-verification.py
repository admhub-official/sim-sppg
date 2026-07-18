from pathlib import Path
import re

path = Path('supabase/functions/transaction-action/index.ts')
text = path.read_text(encoding='utf-8')

pattern = re.compile(r"async function verify\(d:any,c:Caller\)\{.*?\nasync function note", re.S)
replacement = r'''async function verify(d:any,c:Caller){
  if(!['ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Hanya ADMIN yang dapat memverifikasi.');
  const r=await tx(c,s(d.txId));
  let q=sb.from(T.P).select('*').eq('transaksi_id',r.ID);
  if(d.proofId)q=q.eq('id',d.proofId);
  else if(d.paymentSequence)q=q.eq('payment_sequence',Number(d.paymentSequence));
  else q=q.eq('status','MENUNGGU_VERIFIKASI').order('payment_sequence',{ascending:false}).limit(1);
  const p=await q.maybeSingle();
  if(p.error)throw p.error;
  if(!p.data)throw new Error('Bukti pembayaran tidak ditemukan.');
  const ok=d.accepted!==false&&s(d.status).toUpperCase()!=='DITOLAK';
  let tt='';
  if(d.ttdBase64)tt=await upload('ttdVerif',d.ttdBase64,'image/png',`TTD_${r.ID}.png`,`TTD_VERIF_${r.ID}`);
  try{
    const rpc=await sb.rpc('verify_transaction_payment_atomic',{
      p_transaksi_id:r.ID,
      p_proof_id:p.data.id,
      p_accepted:ok,
      p_verified_by:c.email,
      p_verified_name:c.nama||c.email,
      p_verification_notes:s(d.catatanApproval||d.verificationNotes),
      p_verifier_signature_path:tt||null
    });
    if(rpc.error)throw rpc.error;
    const x=rpc.data||{};
    await audit(r.ID,'VERIFY_USER_PAYMENT',c,{proofId:p.data.id,ok,total:x.totalVerified,status:x.status,atomic:true});
    return{success:true,message:ok?'Bukti pembayaran berhasil diverifikasi.':'Bukti pembayaran ditolak.',totalVerified:Number(x.totalVerified)||0,status:s(x.status)};
  }catch(e){
    if(tt)await sb.storage.from(B.ttdVerif).remove([tt]).catch(()=>undefined);
    throw e;
  }
}
async function note'''

new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('verify function patch target not found')

required = [
    "verify_transaction_payment_atomic",
    "p_verifier_signature_path:tt||null",
    "atomic:true",
    "remove([tt])",
]
for token in required:
    if token not in new_text:
        raise SystemExit(f'atomic verification validation failed: {token}')

path.write_text(new_text, encoding='utf-8')
print('atomic payment verification patch applied')
