import { BUCKET, normalizeStatus, sb, text } from './client.ts';
import { transaction, type Caller } from './auth.ts';
import { audit, notify } from './events.ts';
import { cleanup, upload } from './upload.ts';

export async function directApproval(data: any, current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Hanya ADMIN/SUPER ADMIN yang dapat melakukan approval.');
  const row = await transaction(current, text(data.id || data.txId));
  if (normalizeStatus(row['Metode Transaksi']) === 'SUDAH_DIBAYAR') throw new Error('Transaksi sudah dibayar.');
  if (!data.buktiBase64) throw new Error('Bukti pelunasan wajib diupload.');
  if (!data.ttdBase64) throw new Error('TTD verifikator wajib diisi.');
  const mimeType = data.buktiMimeType || 'image/png';
  const fileName = data.buktiFileName || 'bukti.png';
  const proof = await upload(BUCKET.payment, data.buktiBase64, mimeType, fileName, `BUKTI_APPROVAL_${row.ID}`);
  let signature = '';
  try {
    signature = await upload(BUCKET.verifier, data.ttdBase64, 'image/png', `TTD_${row.ID}.png`, `TTD_VERIF_${row.ID}`, true);
    const rpc = await sb.rpc('approve_transaction_direct_atomic', {
      p_transaksi_id: row.ID, p_storage_bucket: BUCKET.payment, p_storage_path: proof,
      p_mime_type: mimeType, p_original_file_name: fileName, p_verified_by: current.email,
      p_verified_name: text(data.approvedBy || current.nama || current.email),
      p_verification_notes: text(data.catatanApproval), p_verifier_signature_path: signature,
    });
    if (rpc.error) throw rpc.error;
    const result: any = rpc.data || {};
    await audit(row.ID, 'APPROVE_DIRECT', current, result);
    await notify({ mode: 'email', email: text(row.User), title: 'Transaksi sudah dibayar', body: `Pelunasan transaksi ${row.ID} telah diverifikasi.`, url: '/?page=transaksi' });
    return { success: true, message: 'Pelunasan berhasil diverifikasi dan transaksi sudah dibayar.', ...result };
  } catch (error) {
    await cleanup(proof);
    if (signature) await cleanup(signature, true);
    throw error;
  }
}
