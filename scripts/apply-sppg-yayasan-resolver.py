from pathlib import Path

path = Path('supabase/functions/transaction-action/index.ts')
source = path.read_text(encoding='utf-8')
original = source

old_table = "  DA: 'TRANSAKSI_DOCUMENTS_AVAILABLE',\n  L: 'AUDIT LOG',"
new_table = "  DA: 'TRANSAKSI_DOCUMENTS_AVAILABLE',\n  S: 'SPPG_DIRECTORY',\n  L: 'AUDIT LOG',"
if old_table not in source and "S: 'SPPG_DIRECTORY'" not in source:
    raise SystemExit('Table constant anchor not found')
source = source.replace(old_table, new_table, 1)

anchor = """async function canAccess(current: Caller, row: any) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role === 'ADMIN') return pairAllowed(current, row.SPPG, row.YAYASAN);
  return lower(row.User) === current.email;
}
"""
resolver = """const sameText = (left: unknown, right: unknown) => text(left).toUpperCase() === text(right).toUpperCase();

async function resolveYayasan(sppg: unknown, requested: unknown, current: Caller) {
  const targetSppg = text(sppg);
  const explicitYayasan = text(requested);
  if (!targetSppg) return '';
  if (explicitYayasan) return explicitYayasan;

  if (current.role === 'ADMIN') {
    const matches = (await assignedPairs(current)).filter(
      ([assignedSppg, assignedYayasan]) => sameText(assignedSppg, targetSppg) && !!text(assignedYayasan),
    );
    if (matches.length === 1) return text(matches[0][1]);
    if (current.yayasan && matches.some(([, assignedYayasan]) => sameText(assignedYayasan, current.yayasan))) {
      return current.yayasan;
    }
  }

  if (sameText(current.sppg, targetSppg) && current.yayasan) return current.yayasan;

  const directory = await sb.from(T.S)
    .select('yayasan')
    .eq('sppg', targetSppg.toUpperCase())
    .maybeSingle();
  if (directory.error) throw directory.error;
  return text(directory.data?.yayasan);
}

async function canAccess(current: Caller, row: any) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role === 'ADMIN') return pairAllowed(current, row.SPPG, row.YAYASAN);
  return lower(row.User) === current.email;
}
"""
if 'async function resolveYayasan' not in source:
    if anchor not in source:
        raise SystemExit('Resolver insertion anchor not found')
    source = source.replace(anchor, resolver, 1)

old_add = """async function addTransaction(data: any, current: Caller) {
  const sppg = ['ADMIN', 'SUPER_ADMIN'].includes(current.role) ? text(data.sppg || current.sppg) : current.sppg;
  const yayasan = ['ADMIN', 'SUPER_ADMIN'].includes(current.role) ? text(data.yayasan || current.yayasan) : current.yayasan;
  if (!sppg || !yayasan) throw new Error('SPPG dan YAYASAN wajib tersedia.');
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
"""
new_add = """async function addTransaction(data: any, current: Caller) {
  const sppg = ['ADMIN', 'SUPER_ADMIN'].includes(current.role) ? text(data.sppg || current.sppg) : current.sppg;
  if (!sppg) throw new Error('SPPG wajib tersedia.');
  const yayasan = await resolveYayasan(sppg, data.yayasan, current);
  if (!yayasan) throw new Error(`Yayasan untuk SPPG ${sppg} belum terdaftar di database.`);
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
"""
if old_add in source:
    source = source.replace(old_add, new_add, 1)
elif 'const yayasan = await resolveYayasan(sppg, data.yayasan, current);' not in source:
    raise SystemExit('Add transaction anchor not found')

old_edit = """  const sppg = text(patch.SPPG ?? old.SPPG);
  const yayasan = text(patch.YAYASAN ?? old.YAYASAN);
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
"""
new_edit = """  const sppg = text(patch.SPPG ?? old.SPPG);
  const requestedYayasan = Object.prototype.hasOwnProperty.call(patch, 'YAYASAN')
    ? patch.YAYASAN
    : (sameText(sppg, old.SPPG) ? old.YAYASAN : '');
  const yayasan = await resolveYayasan(sppg, requestedYayasan, current);
  if (!yayasan) throw new Error(`Yayasan untuk SPPG ${sppg} belum terdaftar di database.`);
  if (['ADMIN', 'SUPER_ADMIN'].includes(current.role)) patch.YAYASAN = yayasan;
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
"""
if old_edit in source:
    source = source.replace(old_edit, new_edit, 1)
elif "const requestedYayasan = Object.prototype.hasOwnProperty.call(patch, 'YAYASAN')" not in source:
    raise SystemExit('Edit transaction anchor not found')

source = source.replace('    version: 6,', '    version: 7,', 1)
old_meta = "    documentReadSource: T.DA,\n    writeMode: 'normalized-atomic',"
new_meta = "    documentReadSource: T.DA,\n    yayasanResolutionSource: T.S,\n    writeMode: 'normalized-atomic',"
if old_meta in source:
    source = source.replace(old_meta, new_meta, 1)

if source == original:
    raise SystemExit('No changes applied')

path.write_text(source, encoding='utf-8')
print('Applied automatic SPPG to Yayasan resolver.')
