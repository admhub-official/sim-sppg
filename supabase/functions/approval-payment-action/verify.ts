import { BUCKET, sb, text } from './client.ts';
import { transaction, type Caller } from './auth.ts';
import { audit, notify } from './events.ts';
import { cleanup, upload } from './upload.ts';

export async function verifyPayment(data: any, current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Hanya ADMIN/SUPER ADMIN yang dapat memverifikasi.');
  const row = await transaction(current, text(data.txId));
  if (!data.ttdBase64) throw new Error('TTD verifikator wajib diisi.');
  const signature = await upload(BUCKET.verifier, data.ttdBase64, 'image/png', `TTD_${row.ID}.png`, `TTD_VERIF_${row.ID}`, true);
  try {
    const rpc = await sb.rpc('verify_transaction_payment_batch_atomic', {
      p_transaksi_id: row.ID,
      p_accepted: data.accepted !== false && text(data.status).toUpperCase() !== 'DITOLAK',
      p_verified_by: current.email,
      p_verified_name: current.nama || current.email,
      p_verification_notes: text(data.catatanApproval || data.verificationNotes),
      p_verifier_signature_path: signature,
    });
    if (rpc.error) throw rpc.error;
    const result: any = rpc.data || {};
    await audit(row.ID, 'VERIFY_PAYMENT_BATCH', current, result);
    await notify({
      mode: 'email', email: text(row.User),
      title: result.status === 'SUDAH_DIBAYAR' ? 'Pelunasan diverifikasi' : 'Bukti pelunasan ditolak',
      body: `Status transaksi ${row.ID}: ${text(result.status).replaceAll('_', ' ')}.`, url: '/?page=transaksi',
    });
    return {
      success: true,
      message: result.status === 'SUDAH_DIBAYAR'
        ? 'Seluruh bukti pelunasan telah diverifikasi dan transaksi sudah dibayar.'
        : 'Bukti pelunasan ditolak.',
      ...result,
    };
  } catch (error) {
    await cleanup(signature, true);
    throw error;
  }
}
