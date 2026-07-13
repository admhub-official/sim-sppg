const CACHE = 'simsppg-v10';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const APP_SCRIPT = new URL('app.js?v=10', SCOPE).href;
const ASSETS = [HOME, new URL('manifest.json', SCOPE).href, APP_SCRIPT];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function normalizeIndexHtml(html) {
  return html
    .replace(/[\u2028\u2029\u200B\u200C\u200D\u2060]/g, '')
    .replace('<base target="_top">', '<base href="./" target="_top">')
    .replace(/<base\s+target=["']_blank["']\s*\/?>/i, '')
    .replace('href="/manifest.json"', 'href="manifest.json"')
    .replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' })")
    .replace(
      '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; } 28px; text-align: center; }',
      '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; }'
    );
}

const AUTH_FALLBACK = `<script>
(function(){
  if(typeof window.showRegister!=='function')window.showRegister=function(){var a=document.getElementById('loginForm'),b=document.getElementById('registerForm');if(a)a.classList.add('hidden');if(b)b.classList.remove('hidden');};
  if(typeof window.showLogin!=='function')window.showLogin=function(){var a=document.getElementById('loginForm'),b=document.getElementById('registerForm');if(a)a.classList.remove('hidden');if(b)b.classList.add('hidden');};
  if(typeof window.togglePw!=='function')window.togglePw=function(id,btn){var input=document.getElementById(id);if(!input)return;input.type=input.type==='password'?'text':'password';};
  if(typeof window.doLogin!=='function')window.doLogin=function(){
    var u=document.getElementById('loginUsername'),p=document.getElementById('loginPassword'),b=document.getElementById('btnLogin'),e=document.getElementById('loginError');
    var email=u?u.value.trim().toLowerCase():'',password=p?p.value:'';
    function fail(msg){if(b){b.disabled=false;b.innerHTML='<i class="fas fa-sign-in-alt"></i><span>Masuk</span>';}if(e){var s=e.querySelector('span');if(s)s.textContent=msg;e.classList.add('show');}}
    if(!email||!password){fail('Email dan password wajib diisi.');return;}
    if(b){b.disabled=true;b.innerHTML='<i class="fas fa-circle-notch fa-spin"></i><span>Memverifikasi...</span>';}
    fetch('https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({function:'loginUser',parameters:[email,password]})})
      .then(function(r){return r.text().then(function(t){var j={};try{j=t?JSON.parse(t):{};}catch(_){throw new Error('Respons server tidak valid');}if(!r.ok&&!j.error)throw new Error('HTTP '+r.status);return j;});})
      .then(function(j){var result=j&&Object.prototype.hasOwnProperty.call(j,'result')?j.result:j;if(j&&j.error)throw new Error(j.error);if(!result||!result.success){fail(result&&result.message?result.message:'Login gagal.');return;}try{if(result.token)localStorage.setItem('sppg_jwt',result.token);localStorage.setItem('sppg_session',JSON.stringify({user:result.user,expiry:result.sessionExpiry}));}catch(_){}location.reload();})
      .catch(function(err){fail(err&&err.message?err.message:'Tidak dapat terhubung ke server.');});
  };
})();
<\/script>`;

async function prepareHtml(response) {
  if (!response) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = normalizeIndexHtml(await response.text());
  if (!html.includes('app.js')) html = html.replace(/<\/body>/i, `<script src="${APP_SCRIPT}" defer></script></body>`);
  if (!html.includes('AUTH_FALLBACK_V10')) html = html.replace(/<\/body>/i, `<!-- AUTH_FALLBACK_V10 -->${AUTH_FALLBACK}</body>`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(prepareHtml).catch(async () => prepareHtml(await caches.match(HOME))));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })));
});

function targetUrl(value) { try { return new URL(value || './', SCOPE).href; } catch (_) { return HOME; } }

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : 'Ada notifikasi baru.' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SIM-SPPG', {
    body: data.body || 'Ada aktivitas baru yang perlu diperiksa.',
    icon: data.icon || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    badge: data.badge || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    tag: data.tag || 'sim-sppg-notif', data: { url: targetUrl(data.url) }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) { if ('navigate' in client) client.navigate(url); if ('focus' in client) return client.focus(); }
    return clients.openWindow ? clients.openWindow(url) : undefined;
  }));
});
