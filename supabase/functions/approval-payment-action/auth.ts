import { lower, sb, TABLE, text } from './client.ts';

export type Caller = { id: string; email: string; role: string; sppg: string; yayasan: string; nama: string };

export async function caller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const q = await sb.from(TABLE.users)
    .select('ID,EMAIL,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (q.error || !q.data) throw new Error('Profil user tidak ditemukan.');
  const role = text(q.data.ROLE).toUpperCase();
  if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) throw new Error('Role akun tidak didukung.');
  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || q.data.EMAIL),
    role,
    sppg: text(q.data.SPPG),
    yayasan: text(q.data['NAMA YAYASAN']),
    nama: text(q.data['NAMA LENGKAP']),
  };
}

async function assignments(current: Caller) {
  if (current.role !== 'ADMIN') return [] as [string, string][];
  const q = await sb.from(TABLE.assignment).select('sppg,yayasan').eq('admin_email', current.email);
  if (q.error) throw q.error;
  return (q.data || []).map((row: any) => [text(row.sppg), text(row.yayasan)] as [string, string]);
}

export async function transaction(current: Caller, id: string) {
  const q = await sb.from(TABLE.tx).select('*').eq('ID', id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Transaksi tidak ditemukan.');
  let allowed = current.role === 'SUPER_ADMIN' || (current.role === 'USER' && lower(q.data.User) === current.email);
  if (current.role === 'ADMIN') {
    allowed = (await assignments(current)).some(([sppg, yayasan]) => sppg === text(q.data.SPPG) && yayasan === text(q.data.YAYASAN));
  }
  if (!allowed) throw new Error('Akses transaksi ditolak.');
  return q.data;
}
