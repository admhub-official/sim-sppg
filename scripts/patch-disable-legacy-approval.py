from pathlib import Path

path = Path('supabase/functions/transaction-action/index.ts')
text = path.read_text(encoding='utf-8')
old = "const H:any={getTransactions:(p:any[],c:Caller)=>list(p[0]||{},c),getTransactionDetail:(p:any[],c:Caller)=>detail(s(p[0]),c),addTransaction:(p:any[],c:Caller)=>add(p[0]||{},c),editTransaction:(p:any[],c:Caller)=>edit(s(p[0]),p[1]||{},c),approveTransaction:(p:any[],c:Caller)=>approve(p[0]||{},c),submitUserBuktiPembayaran:(p:any[],c:Caller)=>submitPayment(p[0]||{},c),verifyUserPayment:(p:any[],c:Caller)=>verify(p[0]||{},c),sendCatatanApproval:note,uploadTxFile:uploadFile,deleteTransaction:(p:any[],c:Caller)=>del(s(p[0]),c)};"
new = "const H:any={getTransactions:(p:any[],c:Caller)=>list(p[0]||{},c),getTransactionDetail:(p:any[],c:Caller)=>detail(s(p[0]),c),addTransaction:(p:any[],c:Caller)=>add(p[0]||{},c),editTransaction:(p:any[],c:Caller)=>edit(s(p[0]),p[1]||{},c),sendCatatanApproval:note,uploadTxFile:uploadFile,deleteTransaction:(p:any[],c:Caller)=>del(s(p[0]),c)};"
if new not in text:
    if old not in text:
        raise SystemExit('Handler map baseline berubah; patch dihentikan.')
    text = text.replace(old, new, 1)
for name in ('approveTransaction:', 'submitUserBuktiPembayaran:', 'verifyUserPayment:'):
    if name in text[text.index('const H:any='):]:
        raise SystemExit(f'Legacy handler masih terdaftar: {name}')
path.write_text(text, encoding='utf-8')
