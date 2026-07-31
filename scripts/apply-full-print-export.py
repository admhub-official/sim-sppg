from pathlib import Path
import re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

# Approval print must request the complete server-side filtered queue. The API
# already supports approvalOnly + exportAll and applies role scope, dates,
# search, SPPG, category, supplier, and document-completeness filters.
approval_filter = r'''  if (page === 'approval') {
    var aq = low(val('apprSearchInput'));
    var asppg = val('apprFilterSPPG');
    var ajenis = val('apprFilterJenisKat');
    var asupplier = val('apprFilterSupplier');
    var lengkap = val('apprFilterKelengkapan');
    return rows.filter(function(x) {
      var haystack = low((x.kode || '') + ' ' + (x.item || x.namaItem || '') + ' ' +
        (x.userName || x.namaPenginput || '') + ' ' + (x.userEmail || x.user || '') + ' ' +
        (x.sppg || '') + ' ' + (x.supplierName || '') + ' ' + (x.supplierAccountNumber || ''));
      if (aq && haystack.indexOf(aq) < 0) return false;
      if (asppg && asppg !== 'ALL' && String(x.sppg || '') !== asppg) return false;
      if (ajenis && ajenis !== 'ALL' && String(x.jenisKategori || '') !== ajenis) return false;
      if (asupplier && asupplier !== 'ALL' && String(x.supplierName || '') !== asupplier) return false;
      if (lengkap && lengkap !== 'ALL' && String(_approvalDocStatus(x).status || '') !== lengkap) return false;
      return isApprovalQueueTransaction(x);
    });
  }
'''
if "if (page === 'approval')" not in s:
    marker = "  if (page === 'master-bahan') {"
    if marker not in s:
        raise SystemExit('filterPrintRows insertion point not found')
    s = s.replace(marker, approval_filter + marker, 1)

approval_spec = """    'approval':['getTransactions',[{approvalOnly:true,exportAll:true,search:$('apprSearchInput')?$('apprSearchInput').value.trim():'',sppg:($('apprFilterSPPG')&&$('apprFilterSPPG').value!=='ALL')?$('apprFilterSPPG').value:'',jenisKategori:($('apprFilterJenisKat')&&$('apprFilterJenisKat').value!=='ALL')?$('apprFilterJenisKat').value:'',supplier:($('apprFilterSupplier')&&$('apprFilterSupplier').value!=='ALL')?$('apprFilterSupplier').value:'',kelengkapan:($('apprFilterKelengkapan')&&$('apprFilterKelengkapan').value!=='ALL')?$('apprFilterKelengkapan').value:'',dateStart:$('apprFilterTglStart')?$('apprFilterTglStart').value:'',dateEnd:$('apprFilterTglEnd')?$('apprFilterTglEnd').value:''}]],
"""
if "'approval':['getTransactions'" not in s:
    marker = "    'transaksi':['getTransactions'"
    pos = s.find(marker)
    if pos < 0:
        raise SystemExit('preparePrintDataset map not found')
    s = s[:pos] + approval_spec + s[pos:]

old_direct = """  if (currentPage === 'approval') {
    exportApprovalReportPDF(filteredApprovalData || [], 'Laporan Approval Transaksi');
    return;
  }
"""
new_direct = """  if (currentPage === 'approval') {
    preparePrintDataset(function(rows) {
      if (rows === null) return;
      exportApprovalReportPDF(rows, 'Laporan Approval Transaksi');
    });
    return;
  }
"""
if old_direct in s:
    s = s.replace(old_direct, new_direct, 1)
elif new_direct not in s:
    raise SystemExit('approval print route not found')

# Keep the legacy browser-print renderer correct as a fallback. Include the
# supplier and a single readable recipient-account description.
old_header = "<th>Item</th><th>Supplier</th><th>Nominal</th><th>Metode</th><th>Penginput</th>"
new_header = "<th>Item</th><th>Supplier / Penjual</th><th>Rekening Penerima</th><th>Nominal</th><th>Metode</th><th>Penginput</th>"
s = s.replace(old_header, new_header)
old_row = "esc(tx.supplierName||'-') + '</td><td>' + formatRupiah(tx.nominal)"
new_row = "esc(tx.supplierName||'-') + '</td><td>' + esc(((tx.supplierBankName||'-') + ' - ' + (tx.supplierAccountNumber||'-') + ' a.n ' + (tx.supplierAccountHolder||'-'))) + '</td><td>' + formatRupiah(tx.nominal)"
s = s.replace(old_row, new_row)

# The professional Approval report already carries Supplier/Penjual, Bank,
# Nomor Rekening, and Atas Nama Rekening as dedicated columns. Add a combined
# description too, so printed output remains readable when columns are narrow.
model_token = "      atasNama: String(tx.supplierAccountHolder || '-'),\n      nominal: Number(tx.nominal) || 0,"
model_repl = "      atasNama: String(tx.supplierAccountHolder || '-'),\n      rekeningPenerima: String((tx.supplierBankName || '-') + ' - ' + (tx.supplierAccountNumber || '-') + ' a.n ' + (tx.supplierAccountHolder || '-')),\n      nominal: Number(tx.nominal) || 0,"
if model_token in s:
    s = s.replace(model_token, model_repl, 1)

# Add the combined column to the Approval CSV/print detail when that exact
# professional-report header is present.
header_token = "'Jenis Kategori', 'Nama Item', 'Supplier / Penjual', 'Bank', 'Nomor Rekening', 'Atas Nama Rekening',\n    'Nominal (Rp)'"
header_repl = "'Jenis Kategori', 'Nama Item', 'Supplier / Penjual', 'Rekening Penerima', 'Bank', 'Nomor Rekening', 'Atas Nama Rekening',\n    'Nominal (Rp)'"
if header_token in s:
    s = s.replace(header_token, header_repl, 1)
value_token = "row.supplier, row.bank, row.rekening, row.atasNama,\n      Math.round(row.nominal)"
value_repl = "row.supplier, row.rekeningPenerima, row.bank, row.rekening, row.atasNama,\n      Math.round(row.nominal)"
if value_token in s:
    s = s.replace(value_token, value_repl, 1)

for token in [
    "'approval':['getTransactions'",
    "approvalOnly:true,exportAll:true",
    "preparePrintDataset(function(rows)",
    "Supplier / Penjual",
    "Rekening Penerima",
    "rekeningPenerima: String"
]:
    if token not in s:
        raise SystemExit('validation failed: ' + token)

p.write_text(s, encoding='utf-8')
