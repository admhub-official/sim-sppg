import { Caller, fmt, getAssignments, iso, norm, paymentStatus, s, visibleTransactions } from './core.ts';

function isApprovedExpense(row: any) {
  return norm(row.Kategori) === 'PENGELUARAN' &&
    paymentStatus(row['Metode Transaksi']) === 'SUDAH_DIBAYAR';
}

export async function getDashboardKPI(p: any[], c: Caller) {
  const rows = await visibleTransactions(c);
  let totalIn = 0, totalOut = 0, belum = 0, antrian = 0, approvedExpenseCount = 0;
  const sppg = new Set<string>(), yayasan = new Set<string>();
  for (const row of rows) {
    const nominal = Number(row.Nominal) || 0;
    const kategori = norm(row.Kategori);
    const status = paymentStatus(row['Metode Transaksi']);
    if (kategori === 'PEMASUKAN') totalIn += nominal;
    else if (isApprovedExpense(row)) {
      totalOut += nominal;
      approvedExpenseCount++;
    }
    if (kategori === 'PENGELUARAN' && status !== 'SUDAH_DIBAYAR') {
      belum += nominal;
      antrian++;
    }
    if (s(row.SPPG)) sppg.add(s(row.SPPG));
    if (s(row.YAYASAN)) yayasan.add(s(row.YAYASAN));
  }
  const assignments = c.role === 'ADMIN' ? await getAssignments(c) : [];
  return {
    success: true,
    totalPemasukan: totalIn,
    totalPengeluaran: totalOut,
    saldoBerjalan: totalIn - totalOut,
    approvedExpenseCount,
    totalBelumBayar: belum,
    antrianApproval: antrian,
    calculationMode: 'ALL_TIME_APPROVED_EXPENSES',
    scope: {
      role: c.role, assignmentCount: assignments.length, transactionCount: rows.length,
      sppgCount: sppg.size, yayasanCount: yayasan.size,
    },
  };
}

export async function getChartData(p: any[], c: Caller) {
  const filter = p[0] || {};
  let rows = await visibleTransactions(c);
  if (filter.sppgFilter) rows = rows.filter((x: any) => norm(x.SPPG) === norm(filter.sppgFilter));
  const start = iso(filter.dateStart), end = iso(filter.dateEnd);
  if (start) rows = rows.filter((x: any) => s(x.Tanggal) >= start);
  if (end) rows = rows.filter((x: any) => s(x.Tanggal) <= end);
  const map = new Map<string, { tanggal: string; pemasukan: number; pengeluaran: number }>();
  for (const row of rows) {
    const key = s(row.Tanggal);
    const value = map.get(key) || { tanggal: fmt(key), pemasukan: 0, pengeluaran: 0 };
    const nominal = Number(row.Nominal) || 0;
    if (norm(row.Kategori) === 'PEMASUKAN') value.pemasukan += nominal;
    else if (isApprovedExpense(row)) value.pengeluaran += nominal;
    map.set(key, value);
  }
  let saldo = 0;
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => ({ ...value, saldo: saldo += value.pemasukan - value.pengeluaran }));
}

export async function getSPPGData(p: any[], c: Caller) {
  let rows = await visibleTransactions(c);
  const start = iso(p[0]), end = iso(p[1]);
  if (start) rows = rows.filter((x: any) => s(x.Tanggal) >= start);
  if (end) rows = rows.filter((x: any) => s(x.Tanggal) <= end);
  const map = new Map<string, any>();
  for (const row of rows) {
    const key = s(row.SPPG);
    const value = map.get(key) || {
      name: key, timestamp: fmt(new Date()), pemasukan: 0, pengeluaran: 0,
      belumBayar: 0, lunas: 0, saldo: 0,
    };
    const nominal = Number(row.Nominal) || 0;
    const kategori = norm(row.Kategori);
    const approved = paymentStatus(row['Metode Transaksi']) === 'SUDAH_DIBAYAR';
    if (kategori === 'PEMASUKAN') value.pemasukan += nominal;
    if (kategori === 'PENGELUARAN' && approved) {
      value.pengeluaran += nominal;
      value.lunas += nominal;
    } else if (kategori === 'PENGELUARAN') {
      value.belumBayar += nominal;
    }
    value.saldo = value.pemasukan - value.pengeluaran;
    map.set(key, value);
  }
  return [...map.values()];
}

export async function getRekapHarian(p: any[], c: Caller) {
  const rows = await visibleTransactions(c);
  const map = new Map<string, { tanggal: string; pemasukan: number; pengeluaran: number }>();
  for (const row of rows) {
    const key = s(row.Tanggal);
    const value = map.get(key) || { tanggal: key, pemasukan: 0, pengeluaran: 0 };
    const nominal = Number(row.Nominal) || 0;
    if (norm(row.Kategori) === 'PEMASUKAN') value.pemasukan += nominal;
    else if (isApprovedExpense(row)) value.pengeluaran += nominal;
    map.set(key, value);
  }
  let saldo = 0;
  const all = [...map.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((value) => {
    const harian = value.pemasukan - value.pengeluaran;
    saldo += harian;
    return {
      tanggal: fmt(value.tanggal), raw: value.tanggal, pemasukan: value.pemasukan,
      pengeluaran: value.pengeluaran, saldoHarian: harian, saldoBerjalan: saldo,
    };
  });
  const start = iso(p[0]), end = iso(p[1]);
  return all.filter((x) => (!start || x.raw >= start) && (!end || x.raw <= end))
    .map(({ raw, ...value }) => value);
}

export async function getFilterOptions(_p: any[], c: Caller) {
  const rows = await visibleTransactions(c);
  return {
    sppg: [...new Set(rows.map((x: any) => s(x.SPPG)).filter(Boolean))].sort(),
    jenisKategori: [...new Set(rows.map((x: any) => s(x['Jenis Kategori'])).filter(Boolean))].sort(),
    items: [...new Set(rows.map((x: any) => s(x['Nama Item/ Bahan Baku'])).filter(Boolean))].sort(),
  };
}
