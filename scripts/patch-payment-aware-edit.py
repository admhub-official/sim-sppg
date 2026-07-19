from pathlib import Path
import re

path = Path('supabase/functions/transaction-action/index.ts')
text = path.read_text(encoding='utf-8')

block = "  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)&&status(old['Metode Transaksi'])==='SUDAH_DIBAYAR')throw new Error('Transaksi yang sudah dibayar tidak dapat diedit.');\n"
if block in text:
    text = text.replace(block, '', 1)

anchor = "  if(!['ADMIN','SUPER_ADMIN'].includes(c.role)){delete patch.SPPG;delete patch.YAYASAN;delete patch['Metode Transaksi']}\n"
addition = anchor + """  const proofState=await sb.from(T.P).select('nominal,status').eq('transaksi_id',id);
  if(proofState.error)throw proofState.error;
  let submitted=0,verified=0,pendingCount=0;
  for(const proof of proofState.data||[]){const amount=Number(proof.nominal)||0,proofStatus=status(proof.status);if(proofStatus!=='DITOLAK')submitted+=amount;if(proofStatus==='TERVERIFIKASI')verified+=amount;if(proofStatus==='MENUNGGU_VERIFIKASI')pendingCount++;}
  const targetNominal=Object.prototype.hasOwnProperty.call(patch,'Nominal')?Number(patch.Nominal):Number(old.Nominal);
  if(!(targetNominal>0))throw new Error('Nominal transaksi harus lebih dari 0.');
  if(targetNominal<submitted)throw new Error('Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.');
  if((proofState.data||[]).length){if(verified>=targetNominal)patch['Metode Transaksi']='SUDAH_DIBAYAR';else if(submitted>=targetNominal&&pendingCount>0)patch['Metode Transaksi']='MENUNGGU_VERIFIKASI';else patch['Metode Transaksi']='BELUM_LUNAS';}
"""
if addition not in text:
    if anchor not in text:
        raise SystemExit('Baseline editTransaction berubah; patch dihentikan.')
    text = text.replace(anchor, addition, 1)

if 'Transaksi yang sudah dibayar tidak dapat diedit.' in text:
    raise SystemExit('Guard edit transaksi lunas masih ada.')
if text.count("Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.") != 1:
    raise SystemExit('Guard nominal payment ledger tidak tunggal.')

path.write_text(text, encoding='utf-8')
