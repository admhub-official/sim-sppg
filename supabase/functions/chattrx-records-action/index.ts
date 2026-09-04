import {CORS,json,text,sb,getCaller,applyRoleFilter,handlerError} from '../_shared/chattrx.ts';

const COLUMNS='transaksi_id,draft_id,jenis_transaksi,kategori,nama_item,keterangan,nominal,status_pembayaran,tanggal_transaksi,penerima,foto_nota_url,foto_bukti_bayar_url,verifikasi_nota,verifikasi_bukti_bayar,created_at,updated_at';
const scope={owner:'user_id',sppg:'sppg',yayasan:'yayasan'};

async function findRecord(id:string,c:any){
  const q:any=sb.from('CHATTRX_TRANSAKSI').select(COLUMNS).eq('transaksi_id',id).maybeSingle();
  const r=await applyRoleFilter(q,c,scope);if(r.error)throw r.error;
  if(!r.data)throw new Error('Transaksi MyTrx tidak ditemukan atau akses ditolak.');
  return r.data;
}

Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);try{
  const c=await getCaller(req),body=await req.json(),fn=text(body.function),p=Array.isArray(body.parameters)?body.parameters[0]||{}:body;
  if(fn==='listMyTrx'){
    const page=Math.max(1,Number(p.page)||1),limit=Math.min(100,Math.max(10,Number(p.limit)||25)),from=(page-1)*limit;
    let q:any=sb.from('CHATTRX_TRANSAKSI').select(COLUMNS,{count:'exact'}).order('created_at',{ascending:false}).range(from,from+limit-1);
    if(text(p.search)){const s=text(p.search).replaceAll(',',' ');q=q.or(`kategori.ilike.%${s}%,nama_item.ilike.%${s}%,keterangan.ilike.%${s}%,penerima.ilike.%${s}%`)}
    if(['pemasukan','pengeluaran'].includes(text(p.jenis)))q=q.eq('jenis_transaksi',text(p.jenis));
    const r=await applyRoleFilter(q,c,scope);if(r.error)throw r.error;
    return json({result:{data:r.data||[],count:r.count||0,page,limit}});
  }
  const id=text(p.transaksiId);if(!id)throw new Error('ID transaksi wajib diisi.');const current=await findRecord(id,c);
  if(fn==='updateMyTrx'){
    const jenis=text(p.jenis_transaksi).toLowerCase(),status=text(p.status_pembayaran).toLowerCase(),nominal=Number(p.nominal);
    if(!['pemasukan','pengeluaran'].includes(jenis))throw new Error('Jenis transaksi tidak valid.');
    if(!['sudah_dibayar','belum_dibayar'].includes(status))throw new Error('Status pembayaran tidak valid.');
    if(!Number.isFinite(nominal)||nominal<=0)throw new Error('Nominal harus lebih dari 0.');
    const tanggal=new Date(text(p.tanggal_transaksi));if(Number.isNaN(tanggal.getTime()))throw new Error('Tanggal transaksi tidak valid.');
    const patch={jenis_transaksi:jenis,kategori:text(p.kategori),nama_item:text(p.nama_item),penerima:text(p.penerima)||null,tanggal_transaksi:tanggal.toISOString(),keterangan:text(p.keterangan),nominal,status_pembayaran:status,updated_at:new Date().toISOString()};
    if(!patch.kategori||!patch.nama_item)throw new Error('Kategori dan item wajib diisi.');
    const u=await sb.from('CHATTRX_TRANSAKSI').update(patch).eq('transaksi_id',id);if(u.error)throw u.error;
    if(current.draft_id){const d=await sb.from('CHATTRX_DRAFT').update({...patch,updated_at:new Date().toISOString()}).eq('draft_id',current.draft_id);if(d.error)throw d.error}
    return json({result:{success:true,message:'Transaksi MyTrx berhasil diperbarui.'}});
  }
  if(fn==='deleteMyTrx'){
    const d=await sb.from('CHATTRX_TRANSAKSI').delete().eq('transaksi_id',id);if(d.error)throw d.error;
    return json({result:{success:true,message:'Transaksi MyTrx berhasil dihapus.'}});
  }
  throw new Error('Aksi MyTrx tidak dikenal.');
}catch(e){return handlerError(e)}});
