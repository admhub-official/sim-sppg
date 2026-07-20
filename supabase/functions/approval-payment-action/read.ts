import { serviceKey, text, url } from './client.ts';
import { enrich, normalizeProof, proofRows, summarize } from './proofs.ts';

async function legacyCall(req: Request, functionName: string, parameters: any[]) {
  const response = await fetch(`${url}/functions/v1/transaction-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.get('Authorization') || '',
      apikey: serviceKey,
    },
    body: JSON.stringify({ function: functionName, parameters }),
    signal: AbortSignal.timeout(25000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.result?.message || payload?.error || 'Transaction service gagal.');
  return payload?.result;
}

export async function getTransactions(req: Request, parameters: any[]) {
  const original = await legacyCall(req, 'getTransactions', parameters);
  const rows = Array.isArray(original) ? original : (Array.isArray(original?.data) ? original.data : []);
  const proofs = await proofRows(rows.map((row: any) => text(row.id)).filter(Boolean));
  const grouped = new Map<string, any[]>();
  for (const proof of proofs) {
    const group = grouped.get(proof.transaksi_id) || [];
    group.push(proof);
    grouped.set(proof.transaksi_id, group);
  }
  const enriched = rows.map((row: any) => enrich(row, summarize(grouped.get(text(row.id)) || [])));
  return Array.isArray(original) ? enriched : { ...original, data: enriched };
}

export async function getTransactionDetail(req: Request, parameters: any[]) {
  const original = await legacyCall(req, 'getTransactionDetail', parameters);
  const id = text(original?.id || parameters?.[0]);
  const proofs = await proofRows(id ? [id] : []);
  const normalized = [];
  for (const proof of proofs) normalized.push(await normalizeProof(proof));

  const pending = normalized.filter((proof: any) => proof.status === 'MENUNGGU_VERIFIKASI');
  const latestPending = pending[pending.length - 1] || normalized[normalized.length - 1] || null;

  // Compatibility aliases for the existing approval UI. The canonical source remains
  // paymentProofs[], but these fields let the verifier modal display the user proof
  // and submitter metadata without requiring a duplicate upload.
  return {
    ...enrich(original || {}, summarize(proofs)),
    paymentProofs: normalized,
    fileBuktiUser: latestPending?.file || null,
    submittedByUser: latestPending?.submittedBy || '',
    submittedAt: latestPending?.submittedAt || '',
    pendingPaymentProofCount: pending.length,
    hasPendingPaymentProof: pending.some((proof: any) => !!proof.file?.path),
  };
}
