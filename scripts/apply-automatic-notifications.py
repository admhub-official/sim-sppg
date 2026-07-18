from pathlib import Path
import re

TX = Path('supabase/functions/transaction-action/index.ts')
DISPATCH = Path('supabase/functions/notification-dispatch-action/index.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'Missing anchor: {label}')


def insert_after(text: str, pattern: str, addition: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    match = re.search(pattern, text, flags=re.S)
    if not match:
        raise SystemExit(f'Missing anchor: {label}')
    return text[:match.end()] + addition + text[match.end():]

# Read both files first. Nothing is written until every patch validates.
d = DISPATCH.read_text(encoding='utf-8')
t = TX.read_text(encoding='utf-8')

# Ensure dispatcher internal route is present.
d = replace_once(
    d,
    "const c=await caller(req),b=await req.json();\n    if(b?.function!=='dispatchNotification')return out({error:'Fungsi tidak diizinkan.'},404);\n    return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});",
    "const b=await req.json();\n    const auth=req.headers.get('Authorization')||'';\n    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';\n    if(b?.function==='dispatchSystemNotification'){\n      if(auth!==`Bearer ${service}`)return out({error:'Akses internal ditolak.'},403);\n      const c={id:'system',email:'system@sim-sppg.local',role:'SUPER_ADMIN',sppg:'',yayasan:''};\n      return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});\n    }\n    const c=await caller(req);\n    if(b?.function!=='dispatchNotification')return out({error:'Fungsi tidak diizinkan.'},404);\n    return out({result:await dispatch(c,Array.isArray(b.parameters)?b.parameters[0]||{}:{})});",
    'dispatcher internal route',
)

helper = """
async function systemNotify(payload:any){
  try{
    const base=Deno.env.get('SUPABASE_URL')||'';
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!base||!service)return;
    const r=await fetch(base+'/functions/v1/notification-dispatch-action',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+service},
      body:JSON.stringify({function:'dispatchSystemNotification',parameters:[payload]})
    });
    if(!r.ok)console.error('notification dispatch failed',r.status,await r.text());
  }catch(e){console.error('notification dispatch error',e)}
}

"""
if 'async function systemNotify(payload:any)' not in t:
    anchor = 'async function add(d:any,c:Caller){'
    if anchor not in t:
        raise SystemExit('Missing anchor: transaction notification helper')
    t = t.replace(anchor, helper + anchor, 1)

# Insert hooks immediately after successful audit calls. Regex tolerates formatting changes.
t = insert_after(
    t,
    r"await audit\(id,'ADD',c,\{sp,ya,orphanCleanup:true\}\);",
    "\n    await systemNotify({mode:'pair',sppg:sp,yayasan:ya,title:'Transaksi baru',body:`Transaksi ${id} sebesar Rp ${Number(d.nominal).toLocaleString('id-ID')} telah dibuat.`,url:'/?page=transaksi'});",
    "title:'Transaksi baru'",
    'add transaction hook',
)
t = insert_after(
    t,
    r"await audit\(r\.ID,'APPROVE',c,\{bp,tt\}\);",
    "await systemNotify({mode:'email',email:s(r.User),title:'Transaksi disetujui',body:`Transaksi ${r.ID} telah disetujui.`,url:'/?page=transaksi'});",
    "title:'Transaksi disetujui'",
    'approve transaction hook',
)
t = insert_after(
    t,
    r"await audit\(r\.ID,'USER_SUBMIT_BUKTI',c,\{seq:x\.paymentSequence,nominal,total:x\.totalDibayar,status:x\.status,atomic:true\}\);",
    "\n    await systemNotify({mode:'pair',sppg:s(r.SPPG),yayasan:s(r.YAYASAN),title:'Bukti pembayaran baru',body:`Bukti pembayaran transaksi ${r.ID} menunggu verifikasi.`,url:'/?page=transaksi'});",
    "title:'Bukti pembayaran baru'",
    'payment submission hook',
)
t = insert_after(
    t,
    r"await audit\(r\.ID,'VERIFY_USER_PAYMENT',c,\{proofId:p\.data\.id,ok,total:x\.totalVerified,status:x\.status,atomic:true\}\);",
    "\n    await systemNotify({mode:'email',email:s(r.User),title:ok?'Pembayaran diverifikasi':'Pembayaran ditolak',body:`Bukti pembayaran transaksi ${r.ID} ${ok?'telah diverifikasi':'ditolak'}.`,url:'/?page=transaksi'});",
    "'Pembayaran diverifikasi':'Pembayaran ditolak'",
    'payment verification hook',
)

# Write atomically only after all anchors have passed.
DISPATCH.write_text(d, encoding='utf-8')
TX.write_text(t, encoding='utf-8')
print('Automatic notification hooks applied atomically.')
