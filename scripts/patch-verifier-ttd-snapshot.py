# Deterministic patch for verifier TTD state preservation.
from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "var currentVerifikasiTxId = null;\nvar currentVerifikasiNominal = 0;\nvar verifCatatanTemp = '';",
        "var currentVerifikasiTxId = null;\nvar currentVerifikasiNominal = 0;\nvar verifCatatanTemp = '';\nvar verifTtdBase64Temp = '';"
    ),
    (
        "  // Simpan catatan sementara karena modal verifikasi akan ditutup, lalu modal konfirmasi nominal dibuka\n  verifCatatanTemp = $('verifCatatan') ? $('verifCatatan').value : '';",
        "  // Snapshot TTD sebelum membuka modal konfirmasi. Canvas dapat kehilangan state\n  // ketika modal bertumpuk/berpindah, terutama pada browser mobile.\n  verifTtdBase64Temp = ttdCanvas.toDataURL('image/png').split(',')[1];\n  verifCatatanTemp = $('verifCatatan') ? $('verifCatatan').value : '';"
    ),
    (
        "function doSubmitVerifikasiPembayaran() {\n  var ttdCanvas = $('verifTtdCanvas');\n  if (!ttdCanvas || isCanvasBlank('verifTtdCanvas')) {\n    showToast('error', 'Validasi', 'Tanda tangan verifikator wajib diisi'); return;\n  }\n  var ttdBase64 = ttdCanvas.toDataURL('image/png').split(',')[1];",
        "function doSubmitVerifikasiPembayaran() {\n  var ttdBase64 = verifTtdBase64Temp || '';\n  if (!ttdBase64) {\n    showToast('error', 'Validasi', 'Snapshot tanda tangan verifikator tidak tersedia. Silakan tanda tangan ulang.'); return;\n  }"
    ),
    (
        "                showToast('success', 'Sukses', result.message);\n                loadApprovalData();",
        "                verifTtdBase64Temp = '';\n                showToast('success', 'Sukses', result.message);\n                loadApprovalData();"
    ),
    (
        "        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');\n      }\n    );\n}\n\n// ============================================================\n// 12. MASTER BAHAN BAKU",
        "        showLoading(false);\n        showToast('error', 'Gagal', (err && err.message) ? err.message : 'Terjadi kesalahan');\n      }\n    );\n}\n\n// ============================================================\n// 12. MASTER BAHAN BAKU"
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

required = [
    "var verifTtdBase64Temp = '';",
    "verifTtdBase64Temp = ttdCanvas.toDataURL('image/png').split(',')[1];",
    "var ttdBase64 = verifTtdBase64Temp || '';",
    "Snapshot tanda tangan verifikator tidak tersedia",
]
for marker in required:
    if marker not in text:
        raise SystemExit(f'Missing marker: {marker}')

path.write_text(text, encoding='utf-8')
