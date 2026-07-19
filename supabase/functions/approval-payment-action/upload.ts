import { BUCKET, sb, TABLE, text } from './client.ts';

function decodeBase64(value: string) {
  const raw = value.includes(',') ? value.split(',').pop()! : value;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function upload(bucket: string, base64: string, mimeType: string, fileName: string, prefix: string, signature = false) {
  const allowed = signature ? /^image\/(png|jpeg|jpg|webp)$/i : /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i;
  if (!allowed.test(text(mimeType))) throw new Error('Tipe MIME file tidak diizinkan.');
  if (!base64 || !fileName) throw new Error('Data file tidak lengkap.');
  const bytes = decodeBase64(base64);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB.');
  const path = `${prefix}_${Date.now()}_${crypto.randomUUID()}_${text(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const q = await sb.storage.from(bucket).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (q.error) throw new Error(`Upload gagal: ${q.error.message}`);
  return path;
}

export async function uploadEnabled() {
  const q = await sb.from(TABLE.settings).select('VALUE').eq('KEY', 'ALLOW_USER_UPLOAD_BUKTI').maybeSingle();
  if (q.error) throw q.error;
  return String(q.data?.VALUE || 'false').toLowerCase() === 'true';
}

export async function cleanup(path: string, signature = false) {
  if (path) await sb.storage.from(signature ? BUCKET.verifier : BUCKET.payment).remove([path]).catch(() => undefined);
}
