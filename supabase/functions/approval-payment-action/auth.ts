import { lower, norm, sb, TABLE, text } from './client.ts';

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
  const role = norm(q.data.ROLE);
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

export async function assignedSppg(current: Caller) {
  if (current.role !== 'ADMIN') return new Set<string>();
  const q = await sb.from(TABLE.assignment).select('sppg,admin_email');
  if (q.error) throw q.error;
  return new Set(
    (q.data || [])
      .filter((row: any) => lower(row.admin_email) === current.email)
      .map((row: any) => norm(row.sppg))
      .filter(Boolean),
  );
}

export async function canAccess(current: Caller, row: any) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role === 'USER') return lower(row?.User) === current.email;
  return (await assignedSppg(current)).has(norm(row?.SPPG));
}

export async function transaction(current: Caller, id: string) {
  const q = await sb.from(TABLE.tx)
    .select('ID,User,SPPG,YAYASAN,"Metode Transaksi",Nominal')
    .eq('ID', id)
    .maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(current, q.data))) throw new Error('Akses transaksi ditolak.');
  return q.data;
}
