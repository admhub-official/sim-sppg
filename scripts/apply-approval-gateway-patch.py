from pathlib import Path

app = Path('app.js')
text = app.read_text(encoding='utf-8')
old = """  'transaction-action': {
    getTransactions:1, getTransactionDetail:1, addTransaction:1, editTransaction:1,
    approveTransaction:1, submitUserBuktiPembayaran:1, verifyUserPayment:1,
    sendCatatanApproval:1, uploadTxFile:1, deleteTransaction:1
  },"""
new = """  'transaction-action': {
    addTransaction:1, editTransaction:1, sendCatatanApproval:1,
    uploadTxFile:1, deleteTransaction:1
  },
  'approval-payment-action': {
    getTransactions:1, getTransactionDetail:1, approveTransaction:1,
    submitUserBuktiPembayaran:1, verifyUserPayment:1
  },"""
if new not in text:
    if old not in text:
        raise SystemExit('API_ROUTES baseline berubah; patch dihentikan.')
    text = text.replace(old, new, 1)
app.write_text(text, encoding='utf-8')

gate = Path('.github/workflows/frontend-quality-gate.yml')
g = gate.read_text(encoding='utf-8')
marker = '            transaction-action \\\n'
addition = marker + '            approval-payment-action \\\n'
if '            approval-payment-action \\\n' not in g:
    if marker not in g:
        raise SystemExit('Daftar slug quality gate berubah.')
    g = g.replace(marker, addition, 1)
gate.write_text(g, encoding='utf-8')
