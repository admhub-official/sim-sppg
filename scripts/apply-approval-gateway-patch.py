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
