import { BUCKET, sb, text } from './client.ts';
import { transaction, type Caller } from './auth.ts';
import { audit, notify } from './events.ts';
import { cleanup, upload, uploadEnabled } from './upload.ts';

export async function submitPayment(data: any, current: Caller) {
  if (current.role !== 'USER') throw new Error('Upload bukti mandiri hanya tersedia untuk role USER.');
  if (!(await uploadEnabled())) throw new Error('Upload bukti mandiri sedang dinonaktifkan.');
  const row = await transaction(current, text(data.txId));
  const status = text(row['Metode Transaksi']).toUpperCase().replace(/\s+/g, '_');
  if (status === 'SUDAH_DIBAYAR') throw new Error('Transaksi sudah dibayar.');
  if (status === 'MENUNGGU_VERIFIKASI') throw new Error('Pelunasan sudah lengkap dan sedang menunggu TTD verifikator.');
  const nominal = Number(data.nominalDibayar);
  if (!(nominal > 0)) throw new Error('Nominal pembayaran harus lebih dari 0.');
  if (!data.buktiBase64) throw new Error('Bukti pelunasan wajib diupload.');
  const mimeType = data.buktiMimeType || 'image/png';
  const fileName = data.buktiFileName || 'bukti.png';
  const path = await upload(BUCKET.payment, data.buktiBase64, mimeType, fileName, `BUKTI_USER_${row.ID}`);
  try {
    const rpc = await sb.rpc('submit_transaction_payment_atomic', {
      p_transaksi_id: row.ID, p_nominal: nominal, p_storage_bucket: BUCKET.payment,
      p_storage_path: path, p_mime_type: mimeType, p_original_file_name: fileName,
      p_submitted_by: current.email,
    });
    if (rpc.error) throw rpc.error;
    const result: any = rpc.data || {};
    await audit(row.ID, 'USER_SUBMIT_BUKTI', current, result);
    await notify({
      mode: 'pair', sppg: text(row.SPPG), yayasan: text(row.YAYASAN),
      title: result.status === 'MENUNGGU_VERIFIKASI' ? 'Pelunasan siap diverifikasi' : 'Pembayaran parsial baru',
      body: `Bukti pembayaran transaksi ${row.ID} telah diunggah.`, url: '/?page=approval',
    });
    return {
      success: true,
      message: result.status === 'MENUNGGU_VERIFIKASI'
        ? 'Pelunasan lengkap. Menunggu TTD verifikator.'
        : 'Pembayaran parsial tersimpan. Transaksi masih belum lunas.',
      ...result,
    };
  } catch (error) {
    await cleanup(path);
    throw error;
  }
}
