import {CORS,json,text,sb,getCaller,applyRoleFilter,handlerError} from '../_shared/chattrx.ts';

const FIELDS=['jenis_transaksi','kategori','nama_item','keterangan','nominal','status_pembayaran'] as const;
const SYSTEM=`Kamu adalah ChatGPT untuk ChatTrx, asisten ekstraksi data transaksi keuangan organisasi SPPG/Yayasan. Pandu percakapan santai berbahasa Indonesia: jenis transaksi -> kategori -> nama item, keterangan, nominal -> konfirmasi natural -> foto nota -> status pembayaran -> jika lunas foto bukti pembayaran -> ringkasan akhir.
Jika user memberi beberapa informasi sekaligus, ekstrak semuanya dan jangan tanya ulang. Foto wajib dibaca nominal, tanggal, item, kejernihan dan indikasi manipulasi; tolak jika tidak meyakinkan atau berbeda signifikan. Jangan pernah melompati verifikasi foto. Balas ramah dan singkat. Keluarkan JSON saja sesuai schema yang diminta.`;
function nextState(d:any){if(!d.jenis_transaksi)return'jenis_transaksi';if(!d.kategori)return'kategori';if(!d.nama_item||!d.keterangan||!Number(d.nominal))return'detail';if(!d.detail_confirmed)return'konfirmasi_detail';if(!d.foto_nota_url||d.verifikasi_nota?.valid!==true)return'nota';if(!d.status_pembayaran)return'status_pembayaran';if(d.status_pembayaran==='sudah_dibayar'&&(!d.foto_bukti_bayar_url||d.verifikasi_bukti_bayar?.valid!==true))return'bukti_bayar';return'ringkasan';}
function normalizedField(field:string,value:unknown){const v=text(value).toLowerCase();if(field==='jenis_transaksi')return v.includes('pengeluaran')?'pengeluaran':v.includes('pemasukan')?'pemasukan':'';if(field==='status_pembayaran')return v.includes('belum')?'belum_dibayar':(/sudah|lunas/.test(v)?'sudah_dibayar':'');return field==='nominal'?Number(value):v;}
function chips(state:string,categories:any[]){if(state==='jenis_transaksi')return['Pemasukan','Pengeluaran'];if(state==='kategori')return categories.slice(0,6).map(x=>x.nama_kategori);if(state==='konfirmasi_detail')return['Ya, sudah benar'];if(state==='status_pembayaran')return['Sudah Dibayar/Lunas','Belum Dibayar'];return[]}
function stateReply(state:string,d:any){
  if(state==='jenis_transaksi')return'Transaksi ini Pemasukan atau Pengeluaran?';
  if(state==='kategori')return'Baik, sebutkan kategori transaksinya.';
  if(state==='detail'){const missing=[];if(!d.nama_item)missing.push('nama item');if(!d.keterangan)missing.push('keterangan');if(!Number(d.nominal))missing.push('nominal');return`Data belum disimpan. Mohon lengkapi ${missing.join(', ')} transaksi.`}
  if(state==='konfirmasi_detail')return`Mohon konfirmasi: ${d.nama_item} — ${d.keterangan}, nominal Rp${Number(d.nominal).toLocaleString('id-ID')}. Apakah rincian ini sudah benar?`;
  if(state==='nota')return'Detail sudah dikonfirmasi. Silakan unggah foto nota yang jelas.';
  if(state==='status_pembayaran')return'Nota sudah terverifikasi. Status pembayarannya Lunas atau Belum Dibayar?';
  if(state==='bukti_bayar')return'Silakan unggah bukti pembayaran. Jika nota yang sama juga merupakan bukti pembayaran, tulis “pakai nota yang sama”.';
  return'Data sudah lengkap, tetapi belum disimpan permanen. Periksa ringkasan, bubuhkan TTD, lalu tekan tombol Simpan.';
}
function outputText(raw:any){
  if(text(raw?.output_text))return text(raw.output_text);
  for(const item of raw?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&text(part?.text))return text(part.text);
  return'';
}
function inputAttachment(im:any,index:number){
  if(!im?.base64||!im?.mimeType)return null;
  const mime=text(im.mimeType).toLowerCase();
  const raw=String(im.base64);
  const dataUrl=raw.startsWith('data:')?raw:`data:${mime};base64,${raw}`;
  if(mime==='application/pdf')return{type:'input_file',filename:`chattrx-${index+1}.pdf`,file_data:dataUrl};
  return{type:'input_image',image_url:dataUrl,detail:'high'};
}
async function openai(prompt:string,images:any[]){
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)throw new Error('OPENAI_API_KEY belum dikonfigurasi pada Supabase Edge Function.');
  const model=Deno.env.get('OPENAI_MODEL')||'gpt-5.6-terra';
  const content:any[]=[{type:'input_text',text:prompt}];
  for(let i=0;i<(images||[]).length;i++){const attachment=inputAttachment(images[i],i);if(attachment)content.push(attachment)}
  const verificationObject={type:'object',additionalProperties:false,properties:{valid:{type:'boolean'},score:{type:'number'},reason:{type:'string'},nominal_terbaca:{type:['number','null']},tanggal_terbaca:{type:['string','null']},item_terbaca:{type:['string','null']}},required:['valid','score','reason','nominal_terbaca','tanggal_terbaca','item_terbaca']};
  const schema={type:'object',additionalProperties:false,properties:{reply:{type:'string'},data:{type:'object',additionalProperties:false,properties:{jenis_transaksi:{type:['string','null']},kategori:{type:['string','null']},nama_item:{type:['string','null']},keterangan:{type:['string','null']},nominal:{type:['number','null']},status_pembayaran:{type:['string','null']},detail_confirmed:{type:['boolean','null']}},required:['jenis_transaksi','kategori','nama_item','keterangan','nominal','status_pembayaran','detail_confirmed']},image_type:{type:['string','null']},verification:{anyOf:[verificationObject,{type:'null'}]}},required:['reply','data','image_type','verification']};
  const payload={model,store:false,reasoning:{effort:'low'},input:[{role:'system',content:[{type:'input_text',text:SYSTEM}]},{role:'user',content}],text:{format:{type:'json_schema',name:'chattrx_transaction_extraction',strict:true,schema}},max_output_tokens:1200};
  let lastError='ChatGPT gagal memproses pesan.';
  for(let attempt=0;attempt<2;attempt++){
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const raw=await r.json().catch(()=>({}));
    if(r.ok){const value=outputText(raw);if(!value)throw new Error('ChatGPT tidak mengembalikan data yang dapat diproses.');try{return JSON.parse(value)}catch{throw new Error('Respons ChatGPT tidak valid.')}}
    lastError=text(raw?.error?.message)||lastError;
    if(![429,500,502,503,504].includes(r.status))throw new Error(lastError);
    if(attempt===0)await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('ChatGPT sedang sibuk. Silakan kirim ulang pesan beberapa saat lagi.');
}
async function storeImages(c:any,draftId:string,images:any[]){const out=[];for(let i=0;i<(images||[]).length;i++){const im=images[i];if(!im?.base64)continue;const ext=im.mimeType==='image/png'?'png':im.mimeType==='image/webp'?'webp':im.mimeType==='application/pdf'?'pdf':'jpg';const path=`${c.id}/${draftId}/${crypto.randomUUID()}.${ext}`;const bytes=Uint8Array.from(atob(String(im.base64).replace(/^data:[^,]+,/,'')),x=>x.charCodeAt(0));const u=await sb.storage.from('chattrx-evidence').upload(path,bytes,{contentType:im.mimeType,upsert:false});if(u.error)throw u.error;out.push(path)}return out}
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({error:'Method tidak didukung.'},405);try{
  const c=await getCaller(req),raw=await req.json(),body=Array.isArray(raw?.parameters)?raw.parameters[0]||{}:raw;let draft:any=null;
  if(body.draftId){let q:any=sb.from('CHATTRX_DRAFT').select('*').eq('draft_id',text(body.draftId)).maybeSingle();const r=await applyRoleFilter(q,c);if(r.error)throw r.error;draft=r.data;if(!draft)throw new Error('Draft tidak ditemukan atau akses ditolak.');}
  if(!draft&&body.resume===true){const r=await sb.from('CHATTRX_DRAFT').select('*').eq('user_id',c.id).eq('status','in_progress').order('updated_at',{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;draft=r.data}
  if(!draft){const r=await sb.from('CHATTRX_DRAFT').insert({user_id:c.id,sppg:c.sppg,yayasan:c.yayasan}).select('*').single();if(r.error)throw r.error;draft=r.data}
  let cq:any=sb.from('CHATTRX_KATEGORI').select('nama_kategori,jumlah_pemakaian').order('jumlah_pemakaian',{ascending:false}).limit(8);const cr=await applyRoleFilter(cq,c,{owner:'',sppg:'sppg',yayasan:'yayasan'});if(cr.error)throw cr.error;
  if(!text(body.message)&&!(body.images||[]).length){const state=nextState(draft);return json({result:{success:true,draftId:draft.draft_id,state,reply:stateReply(state,draft),chips:chips(state,cr.data||[]),data:draft}})}
  const paths=await storeImages(c,draft.draft_id,body.images||[]);const ai=await openai(`State saat ini: ${draft.current_state}. Data draft: ${JSON.stringify(draft)}. Pesan user: ${text(body.message)||'(lampiran saja)'}. ${paths.length?'Analisis lampiran sebagai nota atau bukti pembayaran sesuai state.':''}`,body.images||[]);
  const patch:any={};for(const f of FIELDS)if(ai.data?.[f]!==null&&ai.data?.[f]!==undefined&&text(ai.data[f])){const value=normalizedField(f,ai.data[f]);if(value!==''&&value!==null)patch[f]=value;}
  if(ai.data?.detail_confirmed===true||(draft.current_state==='konfirmasi_detail'&&/^(ya|iya|sip|oke|ok|benar|sesuai)\b/i.test(text(body.message))))patch.detail_confirmed=true;
  if(paths.length){const kind=ai.image_type==='payment'||draft.current_state==='bukti_bayar'?'payment':'nota';if(kind==='nota'){patch.foto_nota_url=paths[0];patch.verifikasi_nota=ai.verification||{valid:false,reason:'Foto belum dapat diverifikasi.'};if(paths[1]){patch.foto_bukti_bayar_url=paths[1];patch.verifikasi_bukti_bayar=ai.verification||{valid:false,reason:'Bukti pembayaran belum dapat diverifikasi.'}}}else{patch.foto_bukti_bayar_url=paths[0];patch.verifikasi_bukti_bayar=ai.verification||{valid:false,reason:'Foto belum dapat diverifikasi.'}}}
  if(!paths.length&&draft.current_state==='bukti_bayar'&&draft.foto_nota_url&&/nota.*sama|foto.*(atas|sama)|pakai.*(nota|foto)/i.test(text(body.message))){patch.foto_bukti_bayar_url=draft.foto_nota_url;patch.verifikasi_bukti_bayar=draft.verifikasi_nota}
  const merged={...draft,...patch};patch.current_state=nextState(merged);const reply=stateReply(patch.current_state,merged);patch.chat_history=[...(Array.isArray(draft.chat_history)?draft.chat_history:[]),{at:new Date().toISOString(),role:'user',text:text(body.message),attachments:paths},{at:new Date().toISOString(),role:'assistant',text:reply,state:patch.current_state}];patch.updated_at=new Date().toISOString();
  const u=await sb.from('CHATTRX_DRAFT').update(patch).eq('draft_id',draft.draft_id).eq('user_id',draft.user_id).select('*').single();if(u.error)throw u.error;
  if(patch.kategori)await sb.from('CHATTRX_KATEGORI').upsert({nama_kategori:patch.kategori,jenis_transaksi:patch.jenis_transaksi||u.data.jenis_transaksi||'keduanya',sppg:u.data.sppg,yayasan:u.data.yayasan},{onConflict:'nama_kategori,jenis_transaksi,sppg,yayasan'});
  return json({result:{success:true,draftId:draft.draft_id,state:patch.current_state,reply,chips:chips(patch.current_state,cr.data||[]),data:u.data}})
}catch(e){return handlerError(e)}});
