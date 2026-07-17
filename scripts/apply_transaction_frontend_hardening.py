from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
original = text

replacements = [
    (
        "renderFilePreview(tx.fileBukti, 'Bukti Transaksi Saat Ini', 'fa-camera') +\n          renderFilePreview(tx.fileNota, 'Nota Pembelian Saat Ini', 'fa-receipt') +",
        "renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi Saat Ini', 'fa-camera') +\n          renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi Saat Ini', 'fa-file') +\n          renderFilePreview(tx.fileBuktiApproval, 'Bukti Pembayaran Admin Saat Ini', 'fa-money-check-alt') +\n          renderFilePreview(tx.fileNota, 'Nota Pembelian Saat Ini', 'fa-receipt') +",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileBukti, 'Bukti Transaksi', 'fa-camera');\n  docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');",
        "docsHtml += renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi', 'fa-camera');\n  docsHtml += renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi', 'fa-file');\n  docsHtml += renderFilePreview(tx.fileBuktiApproval, 'Bukti Pembayaran Admin', 'fa-money-check-alt');\n  docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');",
    ),
    (
        "var uploadsPending = 0;\n\n  var _submitAttempt = 0;",
        "var uploadsPending = 0;\n  var uploadErrors = [];\n\n  function finishRequiredUpload(label, up, applyResult) {\n    if (up && up.success && up.fileName) applyResult(up);\n    else uploadErrors.push(label + ' gagal diunggah');\n    uploadsPending--;\n    if (!uploadsPending) {\n      if (uploadErrors.length) {\n        showLoading(false);\n        showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Transaksi tidak disimpan.');\n        return;\n      }\n      doSubmit();\n    }\n  }\n\n  function failRequiredUpload(label, err) {\n    uploadErrors.push(label + ' gagal diunggah' + (err && err.message ? ': ' + err.message : ''));\n    uploadsPending--;\n    if (!uploadsPending) {\n      showLoading(false);\n      showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Transaksi tidak disimpan.');\n    }\n  }\n\n  var _submitAttempt = 0;",
    ),
    (
        "if (up.success) data.uploadFoto = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();\n      }, null);",
        "finishRequiredUpload('Foto bukti transaksi', up, function(result) { data.uploadFoto = result.fileName; });\n      }, function(err) { failRequiredUpload('Foto bukti transaksi', err); });",
    ),
    (
        "if (up.success) data.notaPembelian = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();\n      }, null);",
        "finishRequiredUpload('Nota pembelian', up, function(result) { data.notaPembelian = result.fileName; });\n      }, function(err) { failRequiredUpload('Nota pembelian', err); });",
    ),
    (
        "if (up.success) data.ttdUser = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();\n      }, null);",
        "finishRequiredUpload('TTD user', up, function(result) { data.ttdUser = result.fileName; });\n      }, function(err) { failRequiredUpload('TTD user', err); });",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Pattern tidak ditemukan:\n{old[:160]}')
    text = text.replace(old, new, 1)

# Edit modal: stop submission when any selected replacement upload fails.
text = text.replace(
    "var uploadsPending = 0;\n\n  function doSubmit() {\n    callApi('editTransaction'",
    "var uploadsPending = 0;\n  var uploadErrors = [];\n\n  function finishEditUpload(label, up, applyResult) {\n    if (up && up.success && up.fileName) applyResult(up);\n    else uploadErrors.push(label + ' gagal diunggah');\n    uploadsPending--;\n    if (!uploadsPending) {\n      if (uploadErrors.length) {\n        showLoading(false);\n        showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Perubahan tidak disimpan.');\n        return;\n      }\n      doSubmit();\n    }\n  }\n\n  function failEditUpload(label, err) {\n    uploadErrors.push(label + ' gagal diunggah' + (err && err.message ? ': ' + err.message : ''));\n    uploadsPending--;\n    if (!uploadsPending) {\n      showLoading(false);\n      showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Perubahan tidak disimpan.');\n    }\n  }\n\n  function doSubmit() {\n    callApi('editTransaction'",
    1,
)
text = text.replace(
    "if (up.success) fields['Upload Foto'] = up.fileName;\n        uploadsPending--; if (!uploadsPending) doSubmit();\n      }, null);",
    "finishEditUpload('Foto bukti transaksi', up, function(result) { fields['Upload Foto'] = result.fileName; });\n      }, function(err) { failEditUpload('Foto bukti transaksi', err); });",
    1,
)
text = text.replace(
    "if (up.success) fields['Nota Pembelian'] = up.fileName;\n        uploadsPending--; if (!uploadsPending) doSubmit();\n      }, null);",
    "finishEditUpload('Nota pembelian', up, function(result) { fields['Nota Pembelian'] = result.fileName; });\n      }, function(err) { failEditUpload('Nota pembelian', err); });",
    1,
)
text = text.replace(
    "if (up.success) fields['TTD User'] = up.fileName;\n      uploadsPending--; if (!uploadsPending) doSubmit();\n    }, null);",
    "finishEditUpload('TTD user', up, function(result) { fields['TTD User'] = result.fileName; });\n    }, function(err) { failEditUpload('TTD user', err); });",
    1,
)

# Report wording must follow the same completeness definition used by backend/database.
text = text.replace(
    'TTD User diasumsikan selalu ada dan tidak dihitung sebagai kekurangan',
    'Dokumen lengkap wajib memiliki bukti transaksi, nota pembelian, dan TTD User',
)

if text == original:
    raise SystemExit('Tidak ada perubahan yang diterapkan.')

path.write_text(text, encoding='utf-8')
print('app.js berhasil diperbarui')
