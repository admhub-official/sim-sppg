import { BUCKET, normalizeStatus, sb, TABLE, text } from './client.ts';

export type Summary = { submitted: number; verified: number; pending: number; rejected: number; proofCount: number; pendingCount: number };
export const emptySummary = (): Summary => ({ submitted: 0, verified: 0, pending: 0, rejected: 0, proofCount: 0, pendingCount: 0 });

export function summarize(rows: any[]): Summary {
  const result = emptySummary();
  for (const row of rows || []) {
    const nominal = Number(row.nominal) || 0;
    const status = normalizeStatus(row.status);
    result.proofCount++;
    if (status === 'DITOLAK') result.rejected += nominal; else result.submitted += nominal;
    if (status === 'TERVERIFIKASI') result.verified += nominal;
    if (status === 'MENUNGGU_VERIFIKASI') { result.pending += nominal; result.pendingCount++; }
  }
  return result;
}

export function inferMime(path: unknown, supplied?: string | null) {
  if (supplied) return supplied;
  const value = text(path).toLowerCase().split('?')[0];
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.heic')) return 'image/heic';
  if (value.endsWith('.heif')) return 'image/heif';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export async function proofRows(ids: string[]) {
  if (!ids.length) return [] as any[];
  const q = await sb.from(TABLE.proofs)
    .select('id,transaksi_id,payment_sequence,nominal,storage_bucket,storage_path,mime_type,original_file_name,submitted_by,submitted_at,status,verified_by,verified_at,verifier_signature_path,verification_notes')
    .in('transaksi_id', ids)
    .order('payment_sequence', { ascending: true });
  if (q.error) throw q.error;
  return q.data || [];
}

export function enrich(row: any, payment: Summary) {
  const nominal = Number(row.nominal) || 0;
  const remaining = Math.max(0, nominal - payment.submitted);
  return {
    ...row,
    metodeTransaksi: normalizeStatus(row.metodeTransaksi),
    nominalDibayar: payment.submitted,
    nominalTerverifikasi: payment.verified,
    nominalMenungguVerifikasi: payment.pending,
    sisaPembayaran: remaining,
    jumlahBuktiPembayaran: payment.proofCount,
    jumlahBuktiMenunggu: payment.pendingCount,
    canVerify: remaining <= 0 && payment.pendingCount > 0,
  };
}

export async function signedFile(bucket: string, path: unknown, suppliedMime?: string | null) {
  const filePath = text(path);
  if (!filePath) return null;
  const q = await sb.storage.from(bucket).createSignedUrl(filePath, 3600);
  if (q.error || !q.data?.signedUrl) return null;
  return { path: filePath, bucket, name: filePath.split('/').pop(), signedUrl: q.data.signedUrl, signedThumbnailUrl: q.data.signedUrl, mimeType: inferMime(filePath, suppliedMime) };
}

export async function normalizeProof(row: any) {
  return {
    id: row.id,
    paymentSequence: Number(row.payment_sequence) || 0,
    nominal: Number(row.nominal) || 0,
    status: normalizeStatus(row.status),
    submittedBy: row.submitted_by || '', submittedAt: row.submitted_at || '',
    verifiedBy: row.verified_by || '', verifiedAt: row.verified_at || '',
    verificationNotes: row.verification_notes || '', originalFileName: row.original_file_name || '',
    mimeType: inferMime(row.storage_path, row.mime_type),
    file: await signedFile(text(row.storage_bucket) || BUCKET.payment, row.storage_path, row.mime_type),
    verifierSignature: await signedFile(BUCKET.verifier, row.verifier_signature_path, 'image/png'),
  };
}
