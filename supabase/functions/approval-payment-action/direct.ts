import { BUCKET, normalizeStatus, sb, TABLE, text } from './client.ts';
import { transaction, type Caller } from './auth.ts';
import { audit, notify } from './events.ts';
import { cleanup, upload } from './upload.ts';

export async function directApproval(data: any, current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Hanya ADMIN/SUPER ADMIN yang dapat melakukan approval.');
  const row = await transaction(current, text(data.id || data.txId));
  if (normalizeStatus(row['Metode Transaksi']) === 'SUDAH_DIBAYAR') throw new Error('Transaksi sudah dibayar.');
  if (!data.ttdBase64) throw new Error('TTD verifikator wajib diisi.');

  const pending = await sb.from(TABLE.proofs)
    .select('id,nominal,status,storage_path')
    .eq('transaksi_id', row.ID)
    .eq('status', 'MENUNGGU_VERIFIKASI');
  if (pending.error) throw pending.error;

  const pendingRows = pending.data || [];
  const pendingTotal = pendingRows.reduce((sum: number, proof: any) => sum + (Number(proof.nominal) || 0), 0);
  const hasUsablePendingProof = pendingRows.some((proof: any) => text(proof.storage_path));

  // Defensive compatibility path: when the user has already uploaded a complete proof,
  // never require the verifier to upload a duplicate proof even if a stale UI opens
  // the direct approval modal instead of the dedicated verification modal.
  if (pendingRows.length && pendingTotal >= Number(row.Nominal || 0) && hasUsablePendingProof) {
    const signature = await upload(BUCKET.verifier, data.ttdBase64, 'image/png', `TTD_${row.ID}.png`, `TTD_VERIF_${row.ID}`, true);
    try {
      const rpc = await sb.rpc('verify_transaction_payment_batch_atomic', {
        p_transaksi_id: row.ID,
        p_accepted: true,
        p_verified_by: current.email,
        p_verified_name: text(data.approvedBy || current.nama || current.email),
        p_verification_notes: text(data.catatanApproval),
        p_verifier_signature_path: signature,
      });
      if (rpc.error) throw rpc.error;
      const result: any = rpc.data || {};
      await audit(row.ID, 'VERIFY_EXISTING_USER_PAYMENT', current, result);
      await notify({ mode: 'email', email: text(row.User), title: 'Transaksi sudah dibayar', body: `Bukti pembayaran transaksi ${row.ID} telah diverifikasi.`, url: '/?page=transaksi' });
      return { success: true, message: 'Bukti pembayaran user berhasil diverifikasi dan transaksi sudah dibayar.', reusedUserProof: true, ...result };
    } catch (error) {
      await cleanup(signature, true);
      throw error;
    }
  }

  if (!data.buktiBase64) throw new Error('Bukti pelunasan wajib diupload karena belum ada bukti user yang siap diverifikasi.');
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
    return { success: true, message: 'Pelunasan berhasil diverifikasi dan transaksi sudah dibayar.', reusedUserProof: false, ...result };
  } catch (error) {
    await cleanup(proof);
    if (signature) await cleanup(signature, true);
    throw error;
  }
}
