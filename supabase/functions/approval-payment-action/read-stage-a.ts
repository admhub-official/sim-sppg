import { normalizeStatus, sb, TABLE, text } from './client.ts';
import { canAccess, type Caller } from './auth.ts';
import { enrich, inferMime, proofRows, summarize } from './proofs.ts';
import { getTransactions } from './read.ts';

const TX_COLUMNS = 'ID,"Kode Pemasukan",Tanggal,Kategori,"Jenis Kategori",SPPG,YAYASAN,Nominal,Catatan,User,"Nama Item/ Bahan Baku","Metode Transaksi","SUPPLIER ID","NAMA SUPPLIER","NAMA BANK SUPPLIER","NO REKENING SUPPLIER","ATAS NAMA REKENING SUPPLIER","SUMBER SUPPLIER","APPROVED BY","WAKTU APPROVE",Catatan_1,"Catatan Approval"';
const DOC_COLUMNS = 'transaksi_id,document_type,storage_bucket,storage_path,mime_type,original_file_name,updated_at';
const DOC = { foto:'FOTO_TRANSAKSI', file:'FILE_TRANSAKSI', approval:'BUKTI_APPROVAL_LEGACY', nota:'NOTA_PEMBELIAN', ttdUser:'TTD_USER', ttdVerif:'TTD_VERIFIKATOR_LEGACY' } as const;

function metadata(row:any, fallbackBucket='') {
  const path=text(row?.storage_path || row?.path);
  if(!path) return null;
  const bucket=text(row?.storage_bucket || row?.bucket || fallbackBucket);
  return { path, bucket, name:text(row?.original_file_name)||path.split('/').pop()||'File', mimeType:inferMime(path,row?.mime_type), accessMode:'on-demand' };
}

function mapTx(row:any, docs:Map<string,any>, user:any) {
  const path=(type:string)=>text(docs.get(type)?.storage_path);
  const method=normalizeStatus(row['Metode Transaksi']);
  const isBelumBayar=method==='BELUM_BAYAR';
  const hasBukti=!!(path(DOC.foto)||path(DOC.file));
  const hasNota=!!path(DOC.nota), hasTtd=!!path(DOC.ttdUser);
  const missing=[] as string[];
  // BELUM_BAYAR memang belum memiliki bukti pembayaran/transaksi pada tahap ini.
  // Dokumen wajibnya hanya Nota Pembelian + TTD User.
  if(!isBelumBayar&&!hasBukti)missing.push('Bukti Transaksi');
  if(!hasNota)missing.push('Nota Pembelian');
  if(!hasTtd)missing.push('TTD User');
  return {
    id:text(row.ID),kode:text(row['Kode Pemasukan']),tanggal:text(row.Tanggal),kategori:text(row.Kategori),jenisKategori:text(row['Jenis Kategori']),sppg:text(row.SPPG),yayasan:text(row.YAYASAN),nominal:Number(row.Nominal)||0,
    uploadFoto:path(DOC.foto),uploadFile:path(DOC.file),catatan:text(row.Catatan),user:text(user?.EMAIL||row.User),userEmail:text(user?.EMAIL||row.User),userName:text(user?.['NAMA LENGKAP'])||text(row.User)||'-',item:text(row['Nama Item/ Bahan Baku']),namaItem:text(row['Nama Item/ Bahan Baku']),
    supplierId:text(row['SUPPLIER ID']),supplierName:text(row['NAMA SUPPLIER']),supplierBankName:text(row['NAMA BANK SUPPLIER']),supplierAccountNumber:text(row['NO REKENING SUPPLIER']),supplierAccountHolder:text(row['ATAS NAMA REKENING SUPPLIER']),supplierSource:text(row['SUMBER SUPPLIER']),
    metodeTransaksi:method,ttdVerifikator:path(DOC.ttdVerif),ttdUser:path(DOC.ttdUser),notaPembelian:path(DOC.nota),approvedBy:text(row['APPROVED BY']),waktuApprove:text(row['WAKTU APPROVE']),catatanApproval:text(row['Catatan Approval']||row.Catatan_1),
    hasBuktiTransaksi:hasBukti,hasNotaPembelian:hasNota,hasTtdUser:hasTtd,statusDokumen:missing.length?`Dokumen Tidak Lengkap: ${missing.join(', ')}`:'Dokumen Lengkap'
  };
}

export { getTransactions };

export async function getTransactionDetail(parameters:any[], current:Caller) {
  const id=text(parameters[0]);
  const tx=await sb.from(TABLE.tx).select(TX_COLUMNS).eq('ID',id).maybeSingle();
  if(tx.error)throw tx.error;if(!tx.data)throw new Error('Transaksi tidak ditemukan.');if(!(await canAccess(current,tx.data)))throw new Error('Akses transaksi ditolak.');
  const docsQ=await sb.from(TABLE.docsAvailable).select(DOC_COLUMNS).eq('transaksi_id',id).order('updated_at',{ascending:true});if(docsQ.error)throw docsQ.error;
  const docs=new Map<string,any>();for(const d of docsQ.data||[])docs.set(text(d.document_type),d);
  const userQ=await sb.from(TABLE.users).select('EMAIL,"NAMA LENGKAP"').eq('EMAIL',text(tx.data.User)).maybeSingle();
  const proofs=await proofRows([id]);
  const normalized=(proofs||[]).map((p:any)=>({id:p.id,paymentSequence:Number(p.payment_sequence)||0,nominal:Number(p.nominal)||0,status:normalizeStatus(p.status),submittedBy:text(p.submitted_by),submittedAt:text(p.submitted_at),verifiedBy:text(p.verified_by),verifiedAt:text(p.verified_at),verificationNotes:text(p.verification_notes),originalFileName:text(p.original_file_name),mimeType:inferMime(p.storage_path,p.mime_type),file:metadata(p,'bukti-payment'),verifierSignature:p.verifier_signature_path?metadata({storage_path:p.verifier_signature_path,mime_type:'image/png',original_file_name:'TTD Verifikator'},'paraf-verifikator'):null}));
  const pending=normalized.filter((p:any)=>p.status==='MENUNGGU_VERIFIKASI');const latest=pending[pending.length-1]||normalized[normalized.length-1]||null;
  return {...enrich(mapTx(tx.data,docs,userQ.data),summarize(proofs)),fileBuktiFoto:metadata(docs.get(DOC.foto)),fileBuktiFile:metadata(docs.get(DOC.file)),fileBuktiApproval:metadata(docs.get(DOC.approval)),fileNota:metadata(docs.get(DOC.nota)),fileTtdUser:metadata(docs.get(DOC.ttdUser)),fileTtdVerif:metadata(docs.get(DOC.ttdVerif)),paymentProofs:normalized,fileBuktiUser:latest?.file||null,submittedByUser:latest?.submittedBy||'',submittedAt:latest?.submittedAt||'',pendingPaymentProofCount:pending.length,hasPendingPaymentProof:pending.some((p:any)=>!!p.file?.path)};
}
