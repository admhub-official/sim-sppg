import {CORS,json,text,sb,getCaller,applyRoleFilter,handlerError} from '../_shared/chattrx.ts';

const COLUMNS='transaksi_id,draft_id,jenis_transaksi,kategori,nama_item,keterangan,nominal,status_pembayaran,tanggal_transaksi,penerima,foto_nota_url,foto_bukti_bayar_url,verifikasi_nota,verifikasi_bukti_bayar,created_at,updated_at';
const scope={owner:'user_id',sppg:'sppg',yayasan:'yayasan'};

async function findRecord(id:string,c:any){
  const q:any=sb.from('CHATTRX_TRANSAKSI').select(COLUMNS).eq('transaksi_id',id).maybeSingle();
  const r=await applyRoleFilter(q,c,scope);if(r.error)throw r.error;
  if(!r.data)throw new Error('Transaksi MyTrx tidak ditemukan atau akses ditolak.');
  return r.data;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);
  try{
    const c=await getCaller(req),body=await req.json(),fn=text(body.function),p=Array.isArray(body.parameters)?body.parameters[0]||{}:body;

    if(fn==='listMyTrx'){
      const page=Math.max(1,Number(p.page)||1),limit=Math.min(100,Math.max(10,Number(p.limit)||25)),from=(page-1)*limit;
      const search=text(p.search).replaceAll(',',' '),jenis=text(p.jenis).toLowerCase();
      let q:any=sb.from('CHATTRX_TRANSAKSI').select(COLUMNS,{count:'exact'}).order('created_at',{ascending:false}).range(from,from+limit-1);
      if(search)q=q.or(`kategori.ilike.%${search}%,nama_item.ilike.%${search}%,keterangan.ilike.%${search}%,penerima.ilike.%${search}%`);
      if(['pemasukan','pengeluaran'].includes(jenis))q=q.eq('jenis_transaksi',jenis);
      const r=await applyRoleFilter(q,c,scope);if(r.error)throw r.error;

      const totals=await sb.rpc('get_chattrx_totals',{
        p_role:c.role,p_user_id:c.id,p_email:c.email,p_search:search,p_jenis:['pemasukan','pengeluaran'].includes(jenis)?jenis:''
      });
      if(totals.error)throw totals.error;
      const summary=Array.isArray(totals.data)?totals.data[0]||{}:totals.data||{};

      return json({result:{
        data:r.data||[],count:Number(summary.total_count??r.count??0),page,limit,
        summary:{
          totalCount:Number(summary.total_count??r.count??0),
          totalIncome:Number(summary.total_income)||0,
          totalOutcome:Number(summary.total_outcome)||0
        }
      }});
    }

    const id=text(p.transaksiId);if(!id)throw new Error('ID transaksi wajib diisi.');
    const current=await findRecord(id,c);

    if(fn==='updateMyTrx'){
      const patch={
        jenis_transaksi:text(p.jenis_transaksi).toLowerCase(),
        kategori:text(p.kategori),
        nama_item:text(p.nama_item),
        penerima:text(p.penerima)||null,
        tanggal_transaksi:text(p.tanggal_transaksi),
        keterangan:text(p.keterangan),
        nominal:Number(p.nominal),
        status_pembayaran:text(p.status_pembayaran).toLowerCase()
      };
      const updated=await sb.rpc('update_chattrx_atomic',{p_transaksi_id:id,p_patch:patch});
      if(updated.error)throw updated.error;
      return json({result:{success:true,message:'Transaksi MyTrx berhasil diperbarui.'}});
    }

    if(fn==='deleteMyTrx'){
      const d=await sb.from('CHATTRX_TRANSAKSI').delete().eq('transaksi_id',id);if(d.error)throw d.error;
      return json({result:{success:true,message:'Transaksi MyTrx berhasil dihapus.'}});
    }

    void current;
    throw new Error('Aksi MyTrx tidak dikenal.');
  }catch(e){return handlerError(e)}
});
