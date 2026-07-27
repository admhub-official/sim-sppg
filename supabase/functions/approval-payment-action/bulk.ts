import { BUCKET, normalizeStatus, sb, TABLE, text } from './client.ts';
import { Caller, transaction } from './auth.ts';
import { cleanup, upload, uploadEnabled } from './upload.ts';

function idsOf(value: unknown) {
  const ids = Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter(Boolean)));
  if (ids.length < 2) throw new Error('Pilih minimal dua transaksi.');
  if (ids.length > 100) throw new Error('Maksimal 100 transaksi dalam satu proses.');
  return ids;
}

async function paymentState(ids: string[]) {
  const q = await sb.from(TABLE.proofs)
    .select('transaksi_id,nominal,status,storage_bucket,storage_path')
    .in('transaksi_id', ids);
  if (q.error) throw q.error;
  const states = new Map<string, { used: number; pending: number; path: string }>();
  ids.forEach((id) => states.set(id, { used: 0, pending: 0, path: '' }));
  (q.data || []).forEach((row: any) => {
    const state = states.get(text(row.transaksi_id));
    if (!state || text(row.status).toUpperCase() === 'DITOLAK') return;
    state.used += Number(row.nominal) || 0;
    if (text(row.status).toUpperCase() === 'MENUNGGU_VERIFIKASI') {
      state.pending += 1;
      state.path ||= text(row.storage_path);
    }
  });
  return states;
}

export async function submitBulkPayment(data: any, current: Caller) {
  if (current.role !== 'USER') throw new Error('Hanya user yang dapat mengirim bukti pembayaran mandiri.');
  if (!(await uploadEnabled())) throw new Error('Upload bukti pembayaran mandiri sedang dinonaktifkan.');
  const ids = idsOf(data.transactionIds);
  const rows = [];
  for (const id of ids) {
    const row: any = await transaction(current, id);
    const status = normalizeStatus(row['Metode Transaksi']);
    if (status === 'SUDAH_DIBAYAR') throw new Error(`Transaksi ${id} sudah dibayar.`);
    if (status === 'MENUNGGU_VERIFIKASI') throw new Error(`Transaksi ${id} sedang menunggu verifikasi.`);
    rows.push(row);
  }
  const states = await paymentState(ids);
  const amounts = rows.map((row: any) => {
    const remaining = Math.max(0, Number(row.Nominal || 0) - (states.get(text(row.ID))?.used || 0));
    if (remaining <= 0) throw new Error(`Transaksi ${row.ID} tidak memiliki sisa tagihan.`);
    return remaining;
  });
  const path = await upload(
    BUCKET.payment, text(data.buktiBase64), text(data.buktiMimeType),
    text(data.buktiFileName), `bulk_user_${current.id}`,
  );
  try {
    const q = await sb.rpc('submit_bulk_transaction_payment_atomic', {
      p_transaksi_ids: ids,
      p_nominals: amounts,
      p_storage_bucket: BUCKET.payment,
      p_storage_path: path,
      p_mime_type: text(data.buktiMimeType),
      p_original_file_name: text(data.buktiFileName),
      p_submitted_by: current.email,
    });
    if (q.error) throw q.error;
    return { success: true, message: `${ids.length} transaksi berhasil dikirim dengan satu bukti pelunasan.`, processed: ids.length, results: q.data };
  } catch (error) {
    await cleanup(path);
    throw error;
  }
}

export async function approveBulkTransactions(data: any, current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Hanya admin atau super admin yang dapat melakukan approval.');
  const ids = idsOf(data.transactionIds);
  const rows = [];
  for (const id of ids) rows.push(await transaction(current, id));
  const states = await paymentState(ids);
  const remainingFlags = rows.map((row: any) =>
    Math.max(0, Number(row.Nominal || 0) - (states.get(text(row.ID))?.used || 0)) > 0
  );
  const needsProof = remainingFlags.some(Boolean);
  if (needsProof && remainingFlags.some((value) => !value)) {
    throw new Error('Jangan gabungkan transaksi yang sudah memiliki pelunasan penuh dengan transaksi yang belum memiliki pelunasan penuh.');
  }
  let proofPath = '';
  let signaturePath = '';
  try {
    if (needsProof) {
      proofPath = await upload(
        BUCKET.payment, text(data.buktiBase64), text(data.buktiMimeType),
        text(data.buktiFileName), `bulk_admin_${current.id}`,
      );
    } else {
      for (const row of rows) {
        const state = states.get(text((row as any).ID));
        if (!state?.pending) throw new Error(`Transaksi ${(row as any).ID} tidak memiliki bukti yang menunggu verifikasi.`);
      }
      proofPath = Array.from(states.values()).find((state) => state.path)?.path || 'existing-pending-proof';
    }
    signaturePath = await upload(
      BUCKET.verifier, text(data.ttdBase64), 'image/png',
      `ttd_bulk_${Date.now()}.png`, `bulk_admin_${current.id}`, true,
    );
    const q = await sb.rpc('approve_bulk_transactions_atomic', {
      p_transaksi_ids: ids,
      p_storage_bucket: BUCKET.payment,
      p_storage_path: proofPath,
      p_mime_type: needsProof ? text(data.buktiMimeType) : '',
      p_original_file_name: needsProof ? text(data.buktiFileName) : '',
      p_verified_by: current.email,
      p_verified_name: text(data.approvedBy) || current.nama || current.email,
      p_verification_notes: text(data.catatanApproval),
      p_verifier_signature_path: signaturePath,
    });
    if (q.error) throw q.error;
    return { success: true, message: `${ids.length} transaksi berhasil di-approve bersama.`, processed: ids.length, results: q.data };
  } catch (error) {
    if (needsProof) await cleanup(proofPath);
    await cleanup(signaturePath, true);
    throw error;
  }
}
