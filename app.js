/* SIM-SPPG SINGLE JAVASCRIPT BUNDLE
 * Seluruh logika lokal aplikasi dipusatkan dalam file ini.
 * UI, UX, markup, dan CSS berada di index.html.
 */

/* ===== INLINE MODULE 1 ===== */
(function(){
  function iconsConverted(){
    // Kalau SVG+JS berhasil, <i class="fas ..."> sudah diganti jadi <svg class="svg-inline--fa">
    return document.querySelectorAll('svg.svg-inline--fa').length > 0;
  }
  function fontLoaded(){
    try { return document.fonts.check('900 1em "Font Awesome 6 Free"'); }
    catch(e){ return false; }
  }
  function fallbackCDN(){
    var link = document.getElementById('faCssLink');
    if (link && link.getAttribute('data-fallback-applied') !== '1') {
      link.setAttribute('data-fallback-applied','1');
      link.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
    }
  }
  setTimeout(function(){
    if (!iconsConverted() && !fontLoaded()) {
      fallbackCDN();
      setTimeout(function(){
        if (!iconsConverted() && !fontLoaded()) {
          console.warn('Font Awesome gagal dimuat dari semua sumber. Cek koneksi internet / firewall / ad-blocker.');
        }
      }, 2500);
    }
  }, 2500);
})();

/* ===== INLINE MODULE 2 ===== */
// ============================================================
// ============================================================
// 0. API HELPER — langsung ke Supabase Edge Function
// ============================================================
var SUPABASE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action';
// Expose anon key untuk modul Laporan (REST API langsung)
window._supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanNndGljaHJmeGh5eXdzdHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MTU2MTUsImV4cCI6MjA5ODM5MTYxNX0.D_ZJ286uSpLeZEsg_vSf3iEoG-SnokHV62X6hPXreHM';

var PUBLIC_FN = {
  registerUser:1, verifyRegistrationOtp:1, resendRegistrationOtp:1,
  loginUser:1, checkSession:1, recoverPassword:1, recoverUsername:1,
  recoverToken:1, getAppConfig:1, getDropdownOptions:1
};

function getJwtToken() {
  try { return localStorage.getItem('sppg_jwt') || ''; } catch(e) { return ''; }
}

/**
 * callApi(fnName, params, onSuccess, onFailure)
 * - fnName   : string — nama fungsi backend (sama persis dengan key di AUTHENTICATED_FUNCTIONS / PUBLIC_HANDLERS di index.ts)
 * - params   : array — argumen fungsi (tanpa caller, server isi dari JWT)
 * - onSuccess: function(result) — dipanggil jika sukses
 * - onFailure: function(err)    — dipanggil jika gagal (opsional)
 */
function callApi(fnName, params, onSuccess, onFailure) {
  var headers = { 'Content-Type': 'application/json' };
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }

  var TIMEOUT_MS = 20000;
  var MAX_RETRY  = 2;

  function doFetch(attempt) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tid = controller ? setTimeout(function(){ controller.abort(); }, TIMEOUT_MS) : null;

    fetch(SUPABASE_FN_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ function: fnName, parameters: params }),
      signal: controller ? controller.signal : undefined
    })
    .then(function(res) {
      if (tid) clearTimeout(tid);
      return res.text().then(function(text) {
        var json;
        try { json = text ? JSON.parse(text) : {}; } catch(e) { throw new Error('Server error (HTTP ' + res.status + ')'); }
        if (!res.ok && !json.error) throw new Error('Server error (HTTP ' + res.status + ')');
        return json;
      });
    })
    .then(function(json) {
      if (json && json.error) {
        if (onFailure) onFailure(new Error(json.error));
        else console.error('callApi error (' + fnName + '):', json.error);
        return;
      }
      var result = (json && Object.prototype.hasOwnProperty.call(json, 'result')) ? json.result : json;
      if (fnName === 'loginUser' && result && result.success && result.token) {
        try { localStorage.setItem('sppg_jwt', result.token); } catch(e) {}
        try { window._supabaseToken = result.token; } catch(e) {}
      }
      if (onSuccess) onSuccess(result);
    })
    .catch(function(err) {
      if (tid) clearTimeout(tid);
      var isNet = err && (err.name === 'AbortError' || err.name === 'TypeError');
      if (isNet && attempt < MAX_RETRY) { setTimeout(function(){ doFetch(attempt+1); }, 800*(attempt+1)); return; }
      if (err && err.name === 'AbortError') err = new Error('Koneksi ke server timeout, silakan coba lagi.');
      if (onFailure) onFailure(err);
      else console.error('callApi fetch failed (' + fnName + '):', err);
    });
  }
  doFetch(0);
}

// ============================================================
// 1. STATE MANAGEMENT
// ============================================================
var SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 jam
var ITEMS_PER_PAGE = 15;
var CFG_SPPG_FALLBACK = ['DARMARAJA','CIAMIS','TANJUNG MEDAR','PAKUALAM','KIRISIK','CIBUNAR','CINTA JAYA'];

var currentUser = null;
var sessionExpiry = 0;
var currentPage = 'dashboard';
var sidebarCollapsed = false;

// Data stores
var allTransactions = [];
var filteredTransactions = [];
var allUsers = [];
var filteredUsers = [];
var allMasterBB = [];
var filteredMasterBB = [];
var allSuppliers = [];
var filteredSuppliers = [];
var allSurvei = [];
var filteredSurvei = [];
var allSerahTerima = [];
var filteredSerahTerima = [];
var allMenuMBG = [];
var allPending = [];
var dropdownOptions = {};

// Pagination state
var txPage = 1, usersPage = 1, bbPage = 1, supplierPage = 1;
var surveiPage = 1, stPage = 1, menuMBGPage = 1, pendingPage = 1;
var approvalPage = 1;
var filteredApprovalData = [];
var selectedApprovalIds = new Set();
var bulkApprovalMode = false;
var verifikasiPembayaranMode = false;
var uploadBuktiModeEnabled = false;
var currentUserBuktiTxId = null;
var userBuktiFileData = null;
var currentVerifikasiTxId = null;
var verifCatatanTemp = '';

// Modal / form state
var currentTrxId = null;
var currentEditRow = null;
var approvalFileData = null;
var chartInstance = null;
var menuItems = [];

// Notifikasi lonceng
var notifList = [];
var notifPollTimer = null;

// ============================================================
// 2. UTILITY FUNCTIONS
// ============================================================
function $(id) { return document.getElementById(id); }
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatRupiah(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID');
}
function formatDate(d) {
  if (!d) return '-';
  var date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return String(date.getDate()).padStart(2,'0') + '/' + String(date.getMonth()+1).padStart(2,'0') + '/' + date.getFullYear();
}
function formatDateInput(d) {
  var date = d ? new Date(d) : new Date();
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}
function showLoading(show) {
  var el = $('loadingOverlay');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}
function safeStorage(action, key, value) {
  try {
    if (action === 'set') { localStorage.setItem(key, value); return true; }
    if (action === 'get') { return localStorage.getItem(key); }
    if (action === 'remove') { localStorage.removeItem(key); return true; }
  } catch(e) { return action === 'get' ? null : false; }
}

function updateFileLabel(input, labelId) {
  var label = $(labelId);
  if (!label) return;
  if (input.files && input.files[0]) {
    label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + input.files[0].name + '</span>';
  }
}

/* ===== Format Nominal Rupiah Real-time ===== */
function handleNominalInput(input) {
  // Hapus semua karakter bukan digit
  var raw = input.value.replace(/[^0-9]/g, '');
  input.setAttribute('data-raw', raw || '0');
  // Tampilkan dengan titik pemisah ribuan saat mengetik
  if (raw) {
    input.value = Number(raw).toLocaleString('id-ID');
  } else {
    input.value = '';
  }
  // Update konfirmasi
  var confirm = $('addTxNominalConfirm');
  if (confirm) {
    var num = parseInt(raw) || 0;
    confirm.textContent = num > 0 ? 'Nominal: Rp ' + num.toLocaleString('id-ID') : '';
  }
}

function formatNominalOnBlur(input) {
  var raw = input.getAttribute('data-raw') || '0';
  var num = parseInt(raw) || 0;
  if (num > 0) {
    input.value = 'Rp ' + num.toLocaleString('id-ID');
  } else {
    input.value = '';
  }
  var confirm = $('addTxNominalConfirm');
  if (confirm) confirm.textContent = num > 0 ? 'Nominal: Rp ' + num.toLocaleString('id-ID') : '';
}

function getNominalRaw() {
  var input = $('addTxNominal');
  if (!input) return 0;
  var raw = input.getAttribute('data-raw') || '0';
  return parseInt(raw.replace(/[^0-9]/g, '')) || 0;
}

/* ===== Autocomplete Jenis Kategori ===== */
function handleJenisKatAutocomplete(input) {
  var dropdown = $('jenisKatDropdown');
  var val = input.value.trim().toLowerCase();
  // Kumpulkan dari data transaksi
  var sources = [];
  if (dropdownOptions.txJenisKategori) sources = sources.concat(dropdownOptions.txJenisKategori);
  // Tambahkan saran default
  var defaults = ['Operasional', 'Belanja Bahan Baku', 'Transportasi', 'Gaji', 'Utilitas', 'Lain-lain', 'Anggaran MBG', 'Dana Pemerintah'];
  defaults.forEach(function(d) { if (sources.indexOf(d) === -1) sources.push(d); });

  if (!val) { dropdown.classList.remove('active'); return; }
  var matches = sources.filter(function(s) { return s.toLowerCase().indexOf(val) > -1; }).slice(0, 8);
  if (!matches.length) { dropdown.classList.remove('active'); return; }
  var html = '';
  matches.forEach(function(m) {
    html += '<div class="autocomplete-item" onclick="selectJenisKat(\'' + esc(m) + '\')">' + esc(m) + '</div>';
  });
  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectJenisKat(val) {
  $('addTxJenisKat').value = val;
  $('jenisKatDropdown').classList.remove('active');
  // Setelah pilih jenis kategori, update hint di field Nama Item
  updateItemFieldHint();
}

// Update hint dan placeholder field Nama Item sesuai Jenis Kategori
function updateItemFieldHint() {
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  var itemInput = $('addTxItem');
  var itemHint  = $('addTxItemHint');
  if (!itemInput) return;

  if (jenisKat === 'BELANJA BAHAN BAKU') {
    itemInput.placeholder = 'Ketik untuk cari, atau klik untuk tampilkan semua bahan baku...';
    if (itemHint) {
      itemHint.innerHTML = '<i class="fas fa-info-circle" style="color:var(--primary);margin-right:4px;"></i>' +
                           'Pilih dari <strong>Master Bahan Baku</strong> — format: Nama - Kode';
    }
    // Kosongkan dan langsung tampilkan dropdown
    itemInput.value = '';
    handleItemAutocomplete(itemInput);
  } else {
    itemInput.placeholder = 'Ketik nama item atau bahan baku...';
    if (itemHint) itemHint.innerHTML = '';
    $('itemDropdown').classList.remove('active');
  }
}

/* ===== Autocomplete Nama Item — conditional ref ke Master BB ===== */
function handleItemAutocomplete(input) {
  var dropdown = $('itemDropdown');
  var val = input.value.trim().toLowerCase();
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  var isBelanjaBB = (jenisKat === 'BELANJA BAHAN BAKU');

  // Tampilkan dropdown bahkan saat val kosong jika BELANJA BAHAN BAKU (langsung tampil saat fokus)
  if (!val && !isBelanjaBB) { dropdown.classList.remove('active'); return; }

  var html = '';

  if (isBelanjaBB) {
    // Mode: ref ke Master Bahan Baku — format "Nama - KodeBahan"
    var bb = dropdownOptions.bahanBaku || [];
    var matches = val
      ? bb.filter(function(b) {
          var haystack = ((b.nama || '') + ' ' + (b.kode || '') + ' ' + (b.kategori || '')).toLowerCase();
          return haystack.indexOf(val) > -1;
        })
      : bb; // tampilkan semua jika val kosong

    // Tidak dibatasi saat val kosong, dibatasi 50 saat ada pencarian
    if (val) matches = matches.slice(0, 50);

    if (!matches.length) {
      dropdown.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--slate-400);text-align:center;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Data bahan baku belum dimuat. Coba refresh halaman.</div>';
      dropdown.classList.add('active');
      return;
    }

    // Header penanda mode — tampilkan jumlah total
    html += '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
            'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
            'display:flex;justify-content:space-between;align-items:center;">' +
            '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
            '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' dari ' + bb.length + ' item</span>' +
            '</div>';

    matches.forEach(function(b) {
      var label = esc(b.nama) + ' <span style="color:var(--slate-400);font-size:11px;">— ' + esc(b.kode) + '</span>';
      var labelKat = b.kategori
        ? '<span style="float:right;font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>'
        : '';
      // data-value menyimpan format final: "Nama - Kode"
      var dataVal = b.nama + ' - ' + b.kode;
      html += '<div class="autocomplete-item" ' +
              'style="display:flex;justify-content:space-between;align-items:center;" ' +
              'onclick="selectItem(\'' + esc(dataVal) + '\')">' +
              '<span>' + label + '</span>' + labelKat +
              '</div>';
    });

  } else {
    // Mode: enum bebas dari histori transaksi + saran umum
    if (!val) { dropdown.classList.remove('active'); return; }

    var sources = new Set();
    // Dari histori transaksi yang sudah ada
    allTransactions.forEach(function(t) {
      if (t.item && t.item !== '-') sources.add(t.item);
      if (t.namaItem && t.namaItem !== '-') sources.add(t.namaItem);
    });
    // Juga sertakan nama dari master BB sebagai fallback
    if (dropdownOptions.bahanBaku) {
      dropdownOptions.bahanBaku.forEach(function(b) { if (b.nama) sources.add(b.nama); });
    }

    var matches = Array.from(sources)
      .filter(function(s) { return s.toLowerCase().indexOf(val) > -1; })
      .slice(0, 10);

    if (!matches.length) { dropdown.classList.remove('active'); return; }

    matches.forEach(function(m) {
      html += '<div class="autocomplete-item" onclick="selectItem(\'' + esc(m) + '\')">' + esc(m) + '</div>';
    });
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectItem(val) {
  $('addTxItem').value = val;
  $('itemDropdown').classList.remove('active');
}

// Trigger autocomplete saat field item difokus (untuk mode BELANJA BAHAN BAKU langsung tampil list)
function onItemFocus() {
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  if (jenisKat === 'BELANJA BAHAN BAKU') {
    handleItemAutocomplete($('addTxItem'));
  }
}

function handleCatatanAutocomplete(input) {
  var dropdown = $('catatanDropdown');
  if (!dropdown) return;
  var val = input.value.trim().toLowerCase();
  if (!val) { dropdown.classList.remove('active'); return; }
  var sources = new Set();
  allTransactions.forEach(function(t) {
    if (t.catatan && t.catatan.trim() && t.catatan !== '-') sources.add(t.catatan.trim());
  });
  var matches = Array.from(sources)
    .filter(function(s) { return s.toLowerCase().indexOf(val) > -1; })
    .slice(0, 8);
  if (!matches.length) { dropdown.classList.remove('active'); return; }
  var html = '';
  matches.forEach(function(m) {
    html += '<div class="autocomplete-item" onclick="selectCatatan(\'' + esc(m) + '\')">' + esc(m) + '</div>';
  });
  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectCatatan(val) {
  var el = $('addTxCatatan');
  if (el) el.value = val;
  var dd = $('catatanDropdown');
  if (dd) dd.classList.remove('active');
}

/* ===== Konfirmasi nominal live ===== */
function updateNominalConfirm(input, confirmId) {
  var val = parseFloat(input.value) || 0;
  var el = $(confirmId);
  if (el) el.textContent = val > 0 ? 'Konfirmasi: ' + formatRupiah(val) : '';
}

/* ===== SISTEM TTD CANVAS TERPUSAT (Responsif: PC, Tablet, HP) ===== */

var _ttdInstances = {}; // menyimpan state setiap canvas

/**
 * Inisialisasi canvas TTD manapun secara responsif.
 * @param {string} canvasId - ID elemen canvas
 * @param {number} lineWidth - ketebalan garis (default 2)
 */
function initTtdCanvas(canvasId, lineWidth) {
  var canvas = $(canvasId);
  if (!canvas) return;
  lineWidth = lineWidth || 2;

  // Setiap canvas punya state sendiri
  _ttdInstances[canvasId] = { drawing: false, ctx: null, lastX: 0, lastY: 0 };
  var state = _ttdInstances[canvasId];

  // Sesuaikan ukuran canvas ke wrapper agar tidak blur / meleset
  function resizeCanvas() {
    var wrap = canvas.parentElement;
    if (!wrap) return;
    var w = wrap.clientWidth || 300;
    var h = parseInt(window.getComputedStyle(canvas).height) || 160;
    // Simpan gambar yang sudah ada sebelum resize
    var tempImg = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { tempImg = canvas.toDataURL(); } catch(e) {}
    }
    canvas.width  = w;
    canvas.height = h;
    // Setup context ulang
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    state.ctx = ctx;
    // Kembalikan gambar jika ada
    if (tempImg) {
      var img = new Image();
      img.onload = function() { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
      img.src = tempImg;
    }
  }

  resizeCanvas();

  // Re-resize jika ukuran berubah (orientasi HP berputar, dll)
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() { resizeCanvas(); });
    ro.observe(canvas.parentElement || canvas);
    canvas._ttdResizeObserver = ro;
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  /**
   * Hitung posisi pointer/jari relatif terhadap canvas,
   * memperhitungkan skala CSS (canvas.width vs getBoundingClientRect).
   */
  function getPos(e) {
    var r   = canvas.getBoundingClientRect();
    var scX = canvas.width  / r.width;
    var scY = canvas.height / r.height;
    var clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - r.left) * scX,
      y: (clientY - r.top)  * scY
    };
  }

  function onStart(e) {
    e.preventDefault();
    e.stopPropagation();
    state.drawing = true;
    var p = getPos(e);
    state.lastX = p.x;
    state.lastY = p.y;
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // Buat titik kecil jika hanya klik/tap tanpa gerak
    ctx.arc(p.x, p.y, ctx.lineWidth / 4, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e) {
    if (!state.drawing) return;
    e.preventDefault();
    e.stopPropagation();
    var p   = getPos(e);
    var ctx = state.ctx;
    if (!ctx) return;
    // Gunakan quadratic curve untuk garis lebih halus
    var midX = (state.lastX + p.x) / 2;
    var midY = (state.lastY + p.y) / 2;
    ctx.quadraticCurveTo(state.lastX, state.lastY, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    state.lastX = p.x;
    state.lastY = p.y;
  }

  function onEnd(e) {
    if (!state.drawing) return;
    e.preventDefault();
    state.drawing = false;
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.stroke();
    ctx.beginPath();
  }

  // Hapus event lama jika ada (mencegah duplikasi saat modal dibuka ulang)
  canvas.removeEventListener('mousedown',  canvas._ttdStart);
  canvas.removeEventListener('mousemove',  canvas._ttdMove);
  canvas.removeEventListener('mouseup',    canvas._ttdEnd);
  canvas.removeEventListener('mouseleave', canvas._ttdEnd);
  canvas.removeEventListener('touchstart', canvas._ttdStart);
  canvas.removeEventListener('touchmove',  canvas._ttdMove);
  canvas.removeEventListener('touchend',   canvas._ttdEnd);

  // Simpan referensi handler agar bisa dihapus nanti
  canvas._ttdStart = onStart;
  canvas._ttdMove  = onMove;
  canvas._ttdEnd   = onEnd;

  // Daftarkan event
  canvas.addEventListener('mousedown',  onStart, { passive: false });
  canvas.addEventListener('mousemove',  onMove,  { passive: false });
  canvas.addEventListener('mouseup',    onEnd,   { passive: false });
  canvas.addEventListener('mouseleave', onEnd,   { passive: false });
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onEnd,   { passive: false });
}

/**
 * Bersihkan canvas TTD manapun.
 * @param {string} canvasId
 */
function clearTtdCanvas(canvasId) {
  var canvas = $(canvasId);
  if (!canvas) return;
  var state = _ttdInstances[canvasId];
  var ctx   = state ? state.ctx : canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Cek apakah canvas TTD kosong (belum ditandatangani).
 * @param {HTMLCanvasElement|string} canvasOrId
 * @returns {boolean}
 */
function isCanvasBlank(canvasOrId) {
  var canvas = (typeof canvasOrId === 'string') ? $(canvasOrId) : canvasOrId;
  if (!canvas) return true;
  try {
    var buf = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buf.some(function(c) { return c !== 0; });
  } catch(e) { return true; }
}

/* ── Alias tipis agar semua onclick="..." lama di HTML tetap berfungsi ──
   Semua fungsi di bawah hanya memanggil initTtdCanvas()/clearTtdCanvas() generik. */
var initAddTxTtd      = function() { initTtdCanvas('addTxTtdCanvas'); };
var clearAddTxTtd      = function() { clearTtdCanvas('addTxTtdCanvas'); };
var initApprovalCanvas = function() { initTtdCanvas('approvalTtdCanvas'); };
var clearApprovalCanvas = function() { clearTtdCanvas('approvalTtdCanvas'); };
var initSupTtdCanvas  = function() { initTtdCanvas('supTtdCanvas'); };
var initStTtdCanvas   = function() { initTtdCanvas('stTtdPenerimaCanvas'); initTtdCanvas('stTtdSupplierCanvas'); };
function clearStTtd(id) { clearTtdCanvas(id); }


// ============================================================
// 3. TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, message) {
  var container = $('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
  toast.innerHTML =
    '<div class="toast-icon"><i class="fas ' + icon + '"></i></div>' +
    '<div class="toast-content"><h4>' + esc(title) + '</h4><p>' + esc(message) + '</p></div>';
  container.appendChild(toast);
  requestAnimationFrame(function() { toast.classList.add('show'); });
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }, 4000);
}

// ============================================================
// 4. AUTHENTICATION
// ============================================================
function showLogin() {
  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');
  $('loginError').classList.remove('show');
  $('recoveryLinks').classList.remove('show'); // Sembunyikan link recovery
}

function showRegister() {
  $('loginForm').classList.add('hidden');
  $('registerForm').classList.remove('hidden');
  $('regError').classList.remove('show');
}
function togglePw(fieldId, btn) {
  var input = $(fieldId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}
function checkPasswordStrength() {
  var pw = $('regPassword').value;
  var bars = $('strengthBar').querySelectorAll('span');
  bars.forEach(function(b) { b.className = ''; });
  var score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  for (var i = 0; i < score && i < 4; i++) {
    bars[i].className = score <= 2 ? 'weak' : score === 3 ? 'medium' : 'strong';
  }
}
function previewRegFoto(input) {
  var file = input.files[0];
  if (file) {
    $('regFotoText').textContent = file.name;
    var reader = new FileReader();
    reader.onload = function(e) { $('regFotoPreview').src = e.target.result; $('regFotoPreview').classList.remove('hidden'); };
    reader.readAsDataURL(file);
  }
}
function previewEditFoto(input) {
  var file = input.files[0];
  if (!file) return;
  var label = $('editFotoLabel');
  if (label) label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + esc(file.name) + '</span>';
  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = $('editFotoPreview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    preview.style.cursor = 'pointer';
    preview.onclick = function() { openLightbox(e.target.result); };
  };
  reader.readAsDataURL(file);
}


/* ============================================================
     AUTHENTICATION & SESSION
     ============================================================ */
function doLogin() {
  var username = $('loginUsername').value.trim().toLowerCase();
  var password = $('loginPassword').value;
  var btn = $('btnLogin');

  if (!username || !password) {
    $('loginError').querySelector('span').textContent = 'Email dan password wajib diisi.';
    $('loginError').classList.add('show');
    $('recoveryLinks').classList.add('show');
    return;
  }
  if (!username.includes('@')) {
    $('loginError').querySelector('span').textContent = 'Masukkan alamat email yang valid.';
    $('loginError').classList.add('show');
    $('recoveryLinks').classList.add('show');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Memverifikasi...</span>';

    callApi('loginUser', [
      username,
      password
    ], function(result) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Masuk</span>';
              if (result.success) {
                currentUser = result.user;
                sessionExpiry = result.sessionExpiry;
                safeStorage('set', 'sppg_session', JSON.stringify({ user: currentUser, expiry: sessionExpiry }));
                $('authOverlay').classList.add('hidden');
                $('appContainer').classList.remove('hidden');
                initApp();
                showToast('success', 'Login Berhasil', 'Selamat datang, ' + currentUser.namaLengkap);
              } else {
                $('loginError').querySelector('span').textContent = result.message || 'Login gagal.';
                $('loginError').classList.add('show');
                $('recoveryLinks').classList.add('show');
              }
      },
      function(err) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Masuk</span>';
              $('loginError').querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              $('loginError').classList.add('show');
              $('recoveryLinks').classList.add('show');
      }
    );
}

// ============================================================
// SPPG AUTOCOMPLETE — dipakai di form Daftar & Edit Profil
// ============================================================
var SPPG_MASTER = [
  'DARMARAJA','CIAMIS','TANJUNG MEDAR','PAKUALAM','KIRISIK','CIBUNAR','CINTA JAYA'
];

function showSppgSuggestions(inputId, listId) {
  var input = $(inputId);
  var list  = $(listId);
  if (!input || !list) return;

  var val = input.value.trim().toUpperCase();
  var matches = SPPG_MASTER.filter(function(s) {
    return s.includes(val);
  });

  if (matches.length === 0 || val === '') {
    // Tampilkan semua saat kosong
    matches = SPPG_MASTER.slice();
  }

  list.innerHTML = matches.map(function(s) {
    // Highlight bagian yang cocok
    var highlighted = s;
    if (val && s.includes(val)) {
      highlighted = s.replace(val, '<span class="sppg-match">' + val + '</span>');
    }
    return '<li onmousedown="selectSppg(\'' + inputId + '\',\'' + listId + '\',\'' + s + '\')">'
         + '<i class="fas fa-map-marker-alt"></i>' + highlighted + '</li>';
  }).join('');

  list.classList.remove('hidden');
}

function hideSppgSuggestions(listId) {
  // Delay agar onmousedown sempat jalan sebelum blur menyembunyikan list
  setTimeout(function() {
    var list = $(listId);
    if (list) list.classList.add('hidden');
  }, 180);
}

function selectSppg(inputId, listId, value) {
  var input = $(inputId);
  var list  = $(listId);
  if (input) input.value = value;
  if (list)  list.classList.add('hidden');
}

function doRegister() {
  var nama     = $('regNama').value.trim();
  var email    = $('regEmail').value.trim();
  var jabatan  = $('regJabatan').value;
  var sppg     = $('regSPPG').value.trim().toUpperCase();
  var yayasan  = $('regYayasan').value.trim();
  var username = $('regUsername').value.trim();
  var password = $('regPassword').value;
  var password2 = $('regPassword2').value;
  var err = $('regError');

  if (!nama || !email || !jabatan || !sppg || !username || !password) {
    err.querySelector('span').textContent = 'Semua field wajib diisi (SPPG termasuk).'; err.classList.add('show'); return;
  }
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    err.querySelector('span').textContent = 'Email harus @gmail.com'; err.classList.add('show'); return;
  }
  if (username.length < 6 || username !== username.toLowerCase()) {
    err.querySelector('span').textContent = 'Username min 6 karakter, huruf kecil.'; err.classList.add('show'); return;
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
    err.querySelector('span').textContent = 'Password harus ada huruf besar, kecil, dan angka.'; err.classList.add('show'); return;
  }
  if (password !== password2) {
    err.querySelector('span').textContent = 'Password tidak cocok.'; err.classList.add('show'); return;
  }

  var data = { namaLengkap: nama, email: email, jabatan: jabatan, sppg: sppg, namaYayasan: yayasan, username: username, password: password, fotoProfil: '' };

  // Handle foto profil upload
  var fotoFile = $('regFoto').files[0];
  if (fotoFile) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      data.fotoProfilBase64 = base64;
      data.fotoMimeType = fotoFile.type;
      data.fotoFileName = fotoFile.name;
      submitRegister(data);
    };
    reader.readAsDataURL(fotoFile);
  } else {
    submitRegister(data);
  }
}

function submitRegister(data) {
  var btn = $('btnRegister');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Mendaftarkan...</span>';

    callApi('registerUser', [data], function(result) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-user-plus"></i><span>Daftar</span>';
              if (result.success) {
                showToast('success', 'Registrasi Berhasil', result.message);
                pendingOtpEmail = data.email;
                pendingOtpUsername = data.username;
                showOtpVerification(data.email);
              } else {
                $('regError').querySelector('span').textContent = result.message || 'Registrasi gagal.';
                $('regError').classList.add('show');
              }
      },
      function(err) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-user-plus"></i><span>Daftar</span>';
              $('regError').querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              $('regError').classList.add('show');
      }
    );
}

var pendingOtpEmail = '';
var pendingOtpUsername = '';

function showOtpVerification(email) {
  $('loginForm').classList.add('hidden');
  $('registerForm').classList.add('hidden');
  $('otpForm').classList.remove('hidden');
  $('otpEmailLabel').textContent = email;
  $('otpCode').value = '';
  $('otpError').classList.remove('show');
}

function doVerifyOtp() {
  var otp = $('otpCode').value.trim();
  var btn = $('btnVerifyOtp');
  var err = $('otpError');

  if (!otp || otp.length !== 6) {
    err.querySelector('span').textContent = 'Masukkan kode OTP 6 digit.';
    err.classList.add('show');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Memverifikasi...</span>';

    callApi('verifyRegistrationOtp', [
      pendingOtpEmail,
      otp
    ], function(result) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-check-circle"></i><span>Verifikasi</span>';
              if (result.success) {
                showToast('success', 'Verifikasi Berhasil', result.message);
                $('otpForm').classList.add('hidden');
                showLogin();
                $('loginUsername').value = pendingOtpUsername;
              } else {
                err.querySelector('span').textContent = result.message || 'Verifikasi gagal.';
                err.classList.add('show');
              }
      },
      function(e) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-check-circle"></i><span>Verifikasi</span>';
              err.querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              err.classList.add('show');
      }
    );
}

function doResendOtp() {
  if (!pendingOtpEmail) return;
    callApi('resendRegistrationOtp', [pendingOtpEmail], function(result) {
        if (result && result.success) {
                showToast('success', 'Terkirim', result.message || 'Kode OTP baru telah dikirim ke email Anda.');
              } else {
                showToast('error', 'Gagal', (result && result.message) || 'Gagal mengirim ulang OTP.');
              }
      },
      function(err) {
        showToast('error', 'Gagal', 'Terjadi kesalahan sistem saat mengirim ulang OTP.');
      }
    );
}

function checkSession() {
  try {
    var stored = safeStorage('get', 'sppg_session');
    if (!stored) return false;
    var session = JSON.parse(stored);
    if (!session || !session.expiry || Date.now() > session.expiry) {
      safeStorage('remove', 'sppg_session');
      return false;
    }
    currentUser = session.user;
    sessionExpiry = session.expiry;
    return true;
    try { window._supabaseToken = safeStorage('get', 'sppg_jwt') || ''; } catch(e) {}
  } catch(e) { return false; }
}

function logout() { $('modalLogout').classList.remove('hidden'); }
function executeLogout() {
  safeStorage('remove', 'sppg_session');
  try { localStorage.removeItem('sppg_jwt'); } catch(e) {}
  if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
  currentUser = null;
  $('appContainer').classList.add('hidden');
  $('authOverlay').classList.remove('hidden');
  var appLoadingEl = $('appLoadingOverlay');
  if (appLoadingEl) appLoadingEl.classList.add('hidden');
  showLogin();
  closeModal('modalLogout');
  showToast('success', 'Logout', 'Anda telah keluar.');
}

// ============================================================
// 5. SIDEBAR & NAVIGATION
// ============================================================

var MENU_CONFIG = {
  SUPER_ADMIN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'users', label: 'Manajemen Users', icon: 'fa-users' },
    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'audit-log', label: 'Riwayat Aktivitas', icon: 'fa-history' },
    { page: 'admin-assignment', label: 'Konfigurasi Admin', icon: 'fa-user-shield' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
    ,{ page: 'laporan', label: 'Laporan', icon: 'fa-file-alt' }
  ],
  ADMIN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'users', label: 'Manajemen Users', icon: 'fa-users' },
    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'audit-log', label: 'Riwayat Aktivitas', icon: 'fa-history' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
    ,{ page: 'laporan', label: 'Laporan', icon: 'fa-file-alt' }
  ],
  AKUNTAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],
  LAPANGAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'transaksi', label: 'Transaksi Saya', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],

PIC: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'transaksi', label: 'Transaksi Saya', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],

  WAKIL_LAPANGAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],
  AHLI_GIZI: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ]
};

function buildSidebar() {
  var role = currentUser ? currentUser.role : '';
 var menus = MENU_CONFIG[role] || MENU_CONFIG['SUPER_ADMIN'] || MENU_CONFIG['LAPANGAN'];
  var bottomNavPages = BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['SUPER_ADMIN'] || BOTTOM_NAV_CONFIG['LAPANGAN'];

  // Di desktop (>= 768px) tidak ada bottom nav, jadi semua menu tampil di sidebar.
  // Di mobile, item yang sudah ada di bottom nav disembunyikan dari sidebar
  // agar tidak duplikat, lalu header section yang jadi kosong ikut dibuang.
  var isDesktop = window.innerWidth >= 768;
  var filtered = [];
  var pendingHeader = null;
  menus.forEach(function(item) {
    if (item.isHeader) { pendingHeader = item; return; }
    if (item.action === 'logout') {
      if (pendingHeader) { filtered.push(pendingHeader); pendingHeader = null; }
      filtered.push(item);
      return;
    }
    if (!isDesktop && bottomNavPages.indexOf(item.page) !== -1) return; // mobile: skip jika sudah di bottom nav
    if (pendingHeader) { filtered.push(pendingHeader); pendingHeader = null; }
    filtered.push(item);
  });

  var html = '';
  filtered.forEach(function(item) {
    if (item.isHeader) {
      html += '<div class="menu-label">' + esc(item.label) + '</div>';
      return;
    }
    if (item.action === 'logout') {
      html += '<a class="menu-item" onclick="logout()">' +
        '<i class="fas ' + item.icon + '"></i>' +
        '<span class="menu-item-text">' + esc(item.label) + '</span>' +
        '<span class="sidebar-tooltip">' + esc(item.label) + '</span></a>';
      return;
    }
    var isActive = currentPage === item.page ? 'active' : '';
    var badgeHtml = item.badge ? '<span class="menu-badge" id="' + item.badge + 'Sidebar" style="display:none;">0</span>' : '';
    html += '<a class="menu-item ' + isActive + '" onclick="switchPage(\'' + item.page + '\', this)" data-page="' + item.page + '">' +
      '<i class="fas ' + item.icon + '"></i>' +
      '<span class="menu-item-text">' + esc(item.label) + '</span>' +
      badgeHtml +
      '<span class="sidebar-tooltip">' + esc(item.label) + '</span></a>';
  });
  $('sidebarMenu').innerHTML = html;
}

// ============================================================
// BOTTOM NAV, FAB, MORE-SHEET, QUICK ACCESS — Mobile Navigation
// ============================================================

// Tab utama per role (4 item permanen: Beranda, Transaksi, Approval/menu utama, Profil)
var BOTTOM_NAV_CONFIG = {
  SUPER_ADMIN:    ['dashboard', 'transaksi', 'approval', 'profil'],
  ADMIN:          ['dashboard', 'transaksi', 'approval', 'profil'],
  AKUNTAN:        ['dashboard', 'transaksi', 'master-bahan', 'profil'],
  LAPANGAN:       ['dashboard', 'transaksi', 'approval', 'profil'],
  WAKIL_LAPANGAN: ['dashboard', 'transaksi', 'serah-terima', 'profil'],
  AHLI_GIZI:      ['dashboard', 'transaksi', 'menu-mbg', 'profil']
};

var BNAV_ICON_LABEL = {
  'dashboard':       { icon: 'fa-th-large',        label: 'Beranda' },
  'transaksi':        { icon: 'fa-exchange-alt',    label: 'Transaksi' },
  'approval':         { icon: 'fa-clipboard-check', label: 'Approval' },
  'profil':           { icon: 'fa-user-circle',     label: 'Profil' },
  'master-bahan':     { icon: 'fa-boxes',           label: 'Bahan Baku' },
  'survei':           { icon: 'fa-search-dollar',   label: 'Survei' },
  'serah-terima':     { icon: 'fa-dolly',           label: 'Serah Trm' },
  'menu-mbg':         { icon: 'fa-utensils',        label: 'Menu MBG' }
};

function buildBottomNav() {
  if (!currentUser) return;
  var role = currentUser.role;
  var tabs = BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN'];
  var html = '';

  // 5 item navigation tanpa FAB dan tanpa "Lainnya"
  tabs.forEach(function(page) {
    var meta = BNAV_ICON_LABEL[page] || { icon: 'fa-circle', label: page };
    var isActive = currentPage === page ? 'active' : '';
    var badgeHtml = (page === 'approval') ? '<span class="bnav-badge" id="bnavApprovalBadge" style="display:none;">0</span>' : '';
    html += '<button class="bnav-item ' + isActive + '" data-page="' + page + '" onclick="switchPage(\'' + page + '\')">' +
      badgeHtml +
      '<i class="fas ' + meta.icon + '"></i><span>' + meta.label + '</span></button>';
  });

  $('bottomNavInner').innerHTML = html;
  syncApprovalBadgeToBottomNav();
}

function updateBottomNavActive() {
  document.querySelectorAll('.bnav-item[data-page]').forEach(function(item) {
    item.classList.toggle('active', item.getAttribute('data-page') === currentPage);
  });
}

function syncApprovalBadgeToBottomNav() {
  var src = $('approvalCount');
  var dst = $('bnavApprovalBadge');
  if (!src || !dst) return;
  dst.textContent = src.textContent;
  dst.style.display = (parseInt(src.textContent) > 0) ? 'flex' : 'none';
}

// ── Bottom Sheet "Lainnya" — sisa menu sesuai role yang tidak ada di bottom nav ──
function openMoreSheet() {
  if (!currentUser) return;
  var role = currentUser.role;
  var menus = MENU_CONFIG[role] || MENU_CONFIG['LAPANGAN'];
  var mainTabs = BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN'];
  var html = '';
  var currentGroup = '';
  menus.forEach(function(item) {
    if (item.isHeader) { currentGroup = item.label; return; }
    if (item.action === 'logout') {
      html += '<div class="more-sheet-title">AKUN</div>';
      html += '<div class="more-sheet-item" onclick="closeMoreSheet();logout();"><i class="fas ' + item.icon + '"></i><span>' + esc(item.label) + '</span></div>';
      return;
    }
    if (mainTabs.indexOf(item.page) > -1) return; // sudah ada di bottom nav, skip
    html += '<div class="more-sheet-item" onclick="closeMoreSheet();switchPage(\'' + item.page + '\');"><i class="fas ' + item.icon + '"></i><span>' + esc(item.label) + '</span></div>';
  });
  $('moreSheetBox').innerHTML = '<div class="more-sheet-title">Menu Lainnya</div>' + html;
  $('moreSheetOverlay').classList.add('active');
}
function closeMoreSheet() { $('moreSheetOverlay').classList.remove('active'); }

// ── FAB "Tambah" — routing per halaman aktif ──
var FAB_ACTION_MAP = {
  'transaksi':     function() { openAddTransaksiModal(); },
  'master-bahan':  function() { openAddMasterBBModal(); },
  'master-supplier': function() { openAddSupplierModal(); },
  'survei':        function() { openAddSurveiModal(); },
  'serah-terima':  function() { openAddSerahTerimaModal(); },
  'menu-mbg':      function() { openAddMenuMBGModal(); },
  'pending-payment': function() { openAddPendingModal(); }
};
function handleFabAdd() {
  var fn = FAB_ACTION_MAP[currentPage];
  if (fn) { fn(); return; }
  // Fallback: jika halaman aktif tidak punya aksi tambah spesifik,
  // arahkan ke Tambah Transaksi sebagai aksi default paling umum.
  openAddTransaksiModal();
}
function updateFabVisibility() {
  // Tombol .fab-add (bulat mengambang lama) - hanya tampil jika ada aksi spesifik
  var fab = $('fabAdd');
  var shouldShow = !!FAB_ACTION_MAP[currentPage];
  if (fab) fab.classList.toggle('show', shouldShow);

  // Tombol .bnav-fab (FAB tengah di bottom nav) - SELALU tampil di semua halaman,
  // karena ini bagian tetap dari struktur navigasi, bukan tombol kontekstual.
  var bnavFabs = document.querySelectorAll('.bnav-fab');
  bnavFabs.forEach(function(bnavFab) {
    bnavFab.style.display = 'flex';
  });
}

// R4: Breadcrumb Navigation — update berdasarkan halaman aktif
function updateBreadcrumb(page, pageLabel) {
  var breadcrumb = $('breadcrumbNav');
  var current = $('breadcrumbCurrent');
  if (!breadcrumb || !current) return;
  // Dashboard = root, tidak perlu breadcrumb
  if (page === 'dashboard') {
    breadcrumb.style.display = 'none';
    return;
  }
  breadcrumb.style.display = 'flex';
  breadcrumb.classList.remove('hidden');
  var html = '<a onclick="switchPage(\'dashboard\')"><i class="fas fa-home" style="font-size:10px;"></i> Dashboard</a><span class="separator">/</span>';
  // Untuk halaman transaksi yang sedang detail, gunakan format spesial
  html += '<span id="breadcrumbCurrent">' + esc(pageLabel) + '</span>';
  breadcrumb.innerHTML = html;
}

// R7: Highlight tombol "Lainnya" saat halaman aktif ada di more-sheet
function syncMoreButtonActive(page) {
  var role = currentUser ? currentUser.role : '';
  var mainTabs = BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN'];
  // Jika halaman tidak ada di bottom nav utama, berarti ada di "Lainnya"
  var isInMainTabs = mainTabs.indexOf(page) > -1;
  var moreBtn = document.querySelector('.bnav-item:last-child');
  if (!moreBtn) return;
  // Update dot indicator pada "Lainnya" jika ada approval pending
  var approvalCountVal = parseInt($('approvalCount') ? $('approvalCount').textContent : '0') || 0;
  var approvalInMore = mainTabs.indexOf('approval') === -1 && approvalCountVal > 0;
  moreBtn.classList.toggle('has-dot', approvalInMore);
  // Toggle active state
  moreBtn.classList.toggle('is-more-active', !isInMainTabs);
  
  // Juga update FAB visibility saat halaman berubah
  updateFabVisibility();
}

// ── Quick Access grid di Dashboard ──
var QUICK_ACCESS_CONFIG = {
  ADMIN:          ['approval', 'survei', 'master-supplier', 'serah-terima'],
  AKUNTAN:        ['survei', 'master-supplier', 'serah-terima', 'menu-mbg'],
  LAPANGAN:       ['approval', 'survei', 'serah-terima', 'master-supplier'],
  WAKIL_LAPANGAN: ['serah-terima'],
  AHLI_GIZI:      ['menu-mbg', 'master-bahan']
};
var QA_ICON_LABEL = {
  'approval':         { icon: 'fa-clipboard-check', label: 'Approval' },
  'survei':           { icon: 'fa-search-dollar',   label: 'Survei Harga' },
  'master-supplier':  { icon: 'fa-truck',           label: 'Supplier' },
  'serah-terima':     { icon: 'fa-dolly',           label: 'Serah Terima' },
  'menu-mbg':         { icon: 'fa-utensils',        label: 'Menu MBG' },
  'master-bahan':     { icon: 'fa-boxes',           label: 'Bahan Baku' }
};
function renderQuickAccess() {
  var container = $('quickAccessSection');
  if (!container || !currentUser) return;
  var pages = QUICK_ACCESS_CONFIG[currentUser.role] || [];
  if (!pages.length) { container.innerHTML = ''; return; }
  var html = '<div class="quick-access-title">Akses Cepat</div><div class="quick-access-grid">';
  pages.forEach(function(page) {
    var meta = QA_ICON_LABEL[page] || { icon: 'fa-circle', label: page };
    var badgeHtml = (page === 'approval') ? '<span class="qa-badge" id="qaApprovalBadge" style="display:none;">0</span>' : '';
    html += '<div class="qa-card" onclick="switchPage(\'' + page + '\')">' +
      badgeHtml +
      '<i class="fas ' + meta.icon + '"></i>' +
      '<span>' + meta.label + '</span>' +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  syncApprovalBadgeToQuickAccess();
}
function syncApprovalBadgeToQuickAccess() {
  var src = $('approvalCount');
  var dst = $('qaApprovalBadge');
  if (!src || !dst) return;
  dst.textContent = src.textContent;
  dst.style.display = (parseInt(src.textContent) > 0) ? 'flex' : 'none';
}

function goToTransaksiFiltered(kategori) {
  switchPage('transaksi');
  setTimeout(function() {
    if ($('txFilterKategori')) {
      $('txFilterKategori').value = kategori;
      filterTransaksi();
    }
  }, 150);
}

// ============================================================
// FILTER TANGGAL GLOBAL (berlaku ke semua menu: Beranda, Transaksi,
// Approval, Rekap Harian, Rekap SPPG). Disimpan di localStorage agar
// persist antar sesi. null/null = tanpa batas (semua data).
// ============================================================
var globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };

function loadGlobalDateFilterState() {
  try {
    var saved = safeStorage('get', 'globalDateFilter');
    if (saved) {
      var parsed = JSON.parse(saved);
      globalDateFilter = parsed;
      $('globalDateStart').value = parsed.start || '';
      $('globalDateEnd').value = parsed.end || '';
      $('globalDateFilterLabel').textContent = parsed.label || 'Semua Tanggal';
    }
  } catch (e) { /* biarkan default jika parsing gagal */ }
}

function saveGlobalDateFilterState() {
  safeStorage('set', 'globalDateFilter', JSON.stringify(globalDateFilter));
}

function toggleGlobalDateFilterPanel() {
  $('globalDateFilterPanel').classList.toggle('hidden');
}

function closeGlobalDateFilterPanel() {
  $('globalDateFilterPanel').classList.add('hidden');
}

function setGlobalDatePreset(preset) {
  var end = new Date();
  var start = new Date();
  var label = 'Semua Tanggal';

  if (preset === 'today') { label = 'Hari Ini'; }
  else if (preset === '7d') { start.setDate(start.getDate() - 6); label = '7 Hari Terakhir'; }
  else if (preset === '30d') { start.setDate(start.getDate() - 29); label = '30 Hari Terakhir'; }
  else if (preset === 'month') { start = new Date(end.getFullYear(), end.getMonth(), 1); label = 'Bulan Ini'; }
  else if (preset === 'all') {
    globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };
    $('globalDateStart').value = '';
    $('globalDateEnd').value = '';
    $('globalDateFilterLabel').textContent = 'Semua Tanggal';
    saveGlobalDateFilterState();
    closeGlobalDateFilterPanel();
    applyGlobalDateFilter();
    return;
  }

  var startStr = formatDateInput(start);
  var endStr = formatDateInput(end);
  globalDateFilter = { start: startStr, end: endStr, label: label };
  $('globalDateStart').value = startStr;
  $('globalDateEnd').value = endStr;
  $('globalDateFilterLabel').textContent = label;
  saveGlobalDateFilterState();
  closeGlobalDateFilterPanel();
  applyGlobalDateFilter();
}

function applyGlobalDateFilterCustom() {
  var start = $('globalDateStart').value || null;
  var end = $('globalDateEnd').value || null;
  var label = (start || end) ? (formatTglLabel(start) + ' - ' + formatTglLabel(end)) : 'Semua Tanggal';
  globalDateFilter = { start: start, end: end, label: label };
  $('globalDateFilterLabel').textContent = label;
  saveGlobalDateFilterState();
  closeGlobalDateFilterPanel();
  applyGlobalDateFilter();
}

function formatTglLabel(dateStr) {
  if (!dateStr) return '...';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0].slice(2);
}

// Dipanggil setiap kali globalDateFilter berubah — reload data halaman
// yang sedang aktif saja (bukan semua halaman sekaligus, demi performa).
function applyGlobalDateFilter() {
  if (currentPage === 'dashboard') loadDashboardData();
  else if (currentPage === 'transaksi') loadTransactions();
  else if (currentPage === 'approval') loadApprovalData();
}

// Tutup panel jika klik di luar area filter
document.addEventListener('click', function(e) {
  var bar = $('globalDateFilterBar');
  if (bar && !bar.contains(e.target)) closeGlobalDateFilterPanel();
});


/* ============================================================
     APP SHELL & NAVIGATION
     ============================================================ */
function switchPage(page, el) {
  // SAFETY NET: pastikan body tidak terkunci sisa dari modal yang gagal
  // ditutup dengan benar (mis. alur Approval->PIN atau Verifikasi->PIN
  // yang terinterupsi). Tanpa ini, overflow:hidden bisa "nyangkut" dan
  // membuat halaman utama (Transaksi, dll) tidak bisa di-scroll via touch.
  _openModalCount = 0;
  document.body.style.overflow = '';

  // Hide all pages
  var pages = document.querySelectorAll('.page-section');
  pages.forEach(function(p) { p.classList.add('hidden'); });
  // Show target page
  var target = $('page-' + page);
    if (target) { target.classList.remove('hidden'); target.style.animation = 'none'; target.offsetHeight; target.style.animation = ''; }
  // Update menu active
  document.querySelectorAll('.menu-item').forEach(function(m) { m.classList.remove('active'); });
  if (el) el.classList.add('active');
  else {
    var menuItem = document.querySelector('.menu-item[data-page="' + page + '"]');
    if (menuItem) menuItem.classList.add('active');
  }
  currentPage = page;
  // Update title
  var titles = {
    'dashboard': 'Dashboard', 'profil': 'Profil', 'users': 'Manajemen Users', 'laporan': 'Laporan',
    'transaksi': currentUser && currentUser.role === 'ADMIN' ? 'Semua Transaksi' : 'Transaksi Saya',
    'approval': 'Approval',
    'pending-payment': 'Pending Payment', 'master-bahan': 'Master Bahan Baku',
    'master-supplier': 'Data Supplier', 'survei': 'Survei Harga',
    'serah-terima': 'Serah Terima', 'menu-mbg': 'Data Menu MBG',
    'audit-log': 'Riwayat Aktivitas', 'admin-assignment': 'Konfigurasi Admin'
  };
  $('pageTitle').textContent = titles[page] || 'Dashboard';
  // R4: Update breadcrumb
  updateBreadcrumb(page, titles[page] || 'Dashboard');
  // R7: Deteksi apakah halaman termasuk menu "Lainnya" di bottom nav
  syncMoreButtonActive(page);
  closeMobileSidebar();
  updateBottomNavActive();
  updateFabVisibility();
  // Page-specific init
  if (page === 'dashboard') { loadDashboardData(); updateChart(); renderQuickAccess(); }
  if (page === 'users' && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) loadUsers();
  if (page === 'transaksi') { loadTransactions(); restoreFilterBarState('txFilterBar'); }
  if (page === 'approval') { loadApprovalData(); restoreFilterBarState('apprFilterBar'); }
  if (page === 'users') { restoreFilterBarState('usersFilterBar'); }
  if (page === 'master-bahan') { loadMasterBB(); restoreFilterBarState('bbFilterBar'); }
  if (page === 'master-supplier') { loadSuppliers(); restoreFilterBarState('supplierFilterBar'); }
  if (page === 'survei') { loadSurvei(); restoreFilterBarState('surveiFilterBar'); }
  if (page === 'serah-terima') { loadSerahTerima(); restoreFilterBarState('stFilterBar'); }
  if (page === 'menu-mbg') loadMenuMBG();
  if (page === 'pending-payment') loadPendingPayment();
  if (page === 'audit-log' && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) { loadAuditLog(); restoreFilterBarState('auditFilterBar'); }
  if (page === 'admin-assignment' && currentUser.role === 'SUPER_ADMIN') { loadAdminAssignments(); }
  if (page === 'laporan') { loadRiwayatLaporan(); }
    if (page === 'profil') renderProfil();
  
  // Hide/show local print buttons for non-admin/akuntan
  var isAdminOrAkuntan = currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'AKUNTAN');
  document.querySelectorAll('.admin-print-btn').forEach(function(btn) {
    btn.style.display = isAdminOrAkuntan ? 'inline-flex' : 'none';
  });
}

// ===== DARK MODE =====
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode');
  var icon = $('themeToggleIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  safeStorage('set', 'darkMode', isDark ? '1' : '0');
}
function applyStoredTheme() {
  try {
    if (safeStorage('get', 'darkMode') === '1') {
      document.body.classList.add('dark-mode');
      var icon = $('themeToggleIcon');
      if (icon) icon.className = 'fas fa-sun';
    }
  } catch(e) {}
}

function toggleFilterBar(barId) {
  var bar = $(barId);
  if (!bar) return;
  var collapsed = bar.classList.toggle('collapsed');
  safeStorage('set', 'filterCollapsed_' + barId, collapsed ? '1' : '0');
}

function restoreFilterBarState(barId) {
  var bar = $(barId);
  if (!bar) return;
  var saved = safeStorage('get', 'filterCollapsed_' + barId);
  // Default: mobile (<=768px) selalu ciut kecuali user pernah membuka manual (saved === '0')
  var isMobile = window.innerWidth <= 768;
  var shouldCollapse = saved === '1' || (saved === null && isMobile);
  bar.classList.toggle('collapsed', shouldCollapse);
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  $('mainSidebar').classList.toggle('collapsed', sidebarCollapsed);
  $('mainWrapper').classList.toggle('sidebar-collapsed', sidebarCollapsed);
  safeStorage('set', 'sidebarCollapsed', sidebarCollapsed ? '1' : '0');
}
function openMobileSidebar() {
  $('mainSidebar').classList.add('mobile-open');
  $('sidebarOverlay').classList.add('active');
  var bnav = $('bottomNav');
  if (bnav) bnav.style.display = 'none';
}
function closeMobileSidebar() {
  $('mainSidebar').classList.remove('mobile-open');
  $('sidebarOverlay').classList.remove('active');
  var bnav = $('bottomNav');
  if (bnav) bnav.style.display = '';
}

// Modal helpers
var _openModalCount = 0;
var _savedScrollY = 0;

// Paksa iframe Google Sites melebar penuh saat modal dibuka,
// supaya footer/tombol Simpan tidak terpotong di luar area iframe.
function _forceIframeFullHeight() {
  try {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      window.innerHeight,
      900
    );
    window.parent.postMessage({ type: 'iframeResize', height: h + 100 }, '*');
  } catch(e) {}
}

// Kembalikan tinggi iframe ke ukuran normal (sesuai konten asli) saat modal ditutup.
function _restoreIframeHeight() {
  try {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'iframeResize', height: h }, '*');
  } catch(e) {}
}

function openModal(id) {
  var el = $(id);
  if (!el) { console.error('openModal: elemen #' + id + ' tidak ditemukan'); return; }
  el.classList.remove('hidden');
  _openModalCount++;
  _forceIframeFullHeight();
  // Hanya lock scroll body di desktop — di mobile biarkan natural
  // agar keyboard virtual tidak menggeser posisi tombol footer
  if (window.innerWidth >= 640) {
    _savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(id) {
  var el = $(id);
  if (!el) return;
  el.classList.add('hidden');
  _openModalCount = Math.max(0, _openModalCount - 1);
  if (_openModalCount === 0) {
    document.body.style.overflow = '';
    if (window.innerWidth >= 640 && _savedScrollY) {
      window.scrollTo(0, _savedScrollY);
    }
    setTimeout(_restoreIframeHeight, 200);
  }
}

var _waReminderPendingId = null;

function sendWAReminderPending(id) {
  var p = allPending.find(function(x) { return x.id === id; });
  if (!p) { showToast('error', 'Error', 'Data pending tidak ditemukan'); return; }
  _waReminderPendingId = id;

  $('detailBody').innerHTML =
    '<div class="info-card" style="margin-bottom:16px;">' +
      infoRow('Referensi', esc(p.transaksiRef || '-')) +
      infoRow('Deskripsi', esc(p.deskripsi || '-')) +
      infoRow('Tanggal Pending', esc(p.tanggalPending || '-')) +
      infoRow('Rencana Pembayaran', esc(p.tanggalPayment || '-')) +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nomor WhatsApp Tujuan <span class="req">*</span></label>' +
      '<input type="text" id="waReminderNomor" class="form-input" placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx" inputmode="numeric">' +
      '<p class="form-hint">Nomor diawali 08 akan otomatis dikonversi ke format 628.</p>' +
    '</div>';
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fab fa-whatsapp" style="color:#22c55e;margin-right:8px;"></i>Kirim Reminder WhatsApp';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Masukkan nomor tujuan untuk mengirim pengingat pembayaran';
  $('modalDetail').querySelector('.modal-footer').innerHTML =
    '<button onclick="closeModal(\'modalDetail\')" class="btn btn-outline">Batal</button>' +
    '<button onclick="executeWAReminder()" class="btn btn-success"><i class="fab fa-whatsapp"></i> Buka WhatsApp</button>';
  openModal('modalDetail');
}

function executeWAReminder() {
  var p = allPending.find(function(x) { return x.id === _waReminderPendingId; });
  if (!p) { showToast('error', 'Error', 'Data pending tidak ditemukan'); return; }
  var nomorWA = $('waReminderNomor').value.trim();
  if (!nomorWA) { showToast('error', 'Validasi', 'Nomor WhatsApp wajib diisi'); return; }

  var nomorClean = nomorWA.replace(/[^0-9]/g, '');
  if (nomorClean.indexOf('0') === 0) nomorClean = '62' + nomorClean.substring(1);

  var pesan = 'Halo, ini pengingat pembayaran dari SIM-SPPG.\n\n' +
    'Referensi: ' + (p.transaksiRef || '-') + '\n' +
    'Deskripsi: ' + (p.deskripsi || '-') + '\n' +
    'Tanggal Pending: ' + (p.tanggalPending || '-') + '\n' +
    'Rencana Pembayaran: ' + (p.tanggalPayment || '-') + '\n\n' +
    'Mohon segera diproses. Terima kasih.';

  var waUrl = 'https://wa.me/' + nomorClean + '?text=' + encodeURIComponent(pesan);
  window.open(waUrl, '_blank');
  closeModal('modalDetail');
}

// ============================================================
// 6. APP INITIALIZATION
// ============================================================
var _appLoadingProgressTimer = null;
function startAppLoadingProgress() {
  var fill = $('appLoadingProgressFill');
  var text = $('appLoadingProgressText');
  if (!fill || !text) return;
  var progress = 0;
  fill.style.width = '0%';
  text.textContent = '0%';
  if (_appLoadingProgressTimer) clearInterval(_appLoadingProgressTimer);
  // Naik cepat di awal, melambat mendekati 90% (menunggu data asli selesai)
  _appLoadingProgressTimer = setInterval(function() {
    var remaining = 90 - progress;
    progress += Math.max(0.5, remaining * 0.08);
    if (progress >= 90) progress = 90;
    fill.style.width = progress + '%';
    text.textContent = Math.round(progress) + '%';
    if (progress >= 90) clearInterval(_appLoadingProgressTimer);
  }, 100);
}
function finishAppLoadingProgress() {
  if (_appLoadingProgressTimer) { clearInterval(_appLoadingProgressTimer); _appLoadingProgressTimer = null; }
  var fill = $('appLoadingProgressFill');
  var text = $('appLoadingProgressText');
  if (fill) fill.style.width = '100%';
  if (text) text.textContent = '100%';
}


/* ============================================================
     APPLICATION INITIALIZATION
     ============================================================ */
function initApp() {
  if (!currentUser) return;

  var appLoadingEl = $('appLoadingOverlay');
  if (appLoadingEl) appLoadingEl.classList.remove('hidden');
  startAppLoadingProgress();

  loadGlobalDateFilterState();

  buildSidebar();
  buildBottomNav();
  updateFabVisibility();
  initNotifBell();
  if (_swRegistration) initPushNotification();

// Load foto profil ke icon menu (sidebar & bottom-nav) sejak awal, bukan hanya saat buka halaman Profil
  if (currentUser.fotoProfil && String(currentUser.fotoProfil).trim() !== '' && currentUser.fotoProfil !== '-') {
    callApi('getFileUrl', ['FOTO_PROFIL', currentUser.fotoProfil], function(res) {
      var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
      if (fotoUrl) updateMenuProfilAvatar(fotoUrl);
    }, null);
  }

  // Rebuild sidebar saat resize agar filter bottom-nav ikut menyesuaikan
  window.addEventListener('resize', function() {
    if (currentUser) buildSidebar();
  });
  // Pre-populate SPPG dengan fallback langsung (tidak tunggu API) agar
  // select sudah ada isinya saat user buka modal tambah transaksi pertama kali
  populateSPPGSelects();

  // Gunakan requestAnimationFrame agar DOM selesai render (termasuk ukuran
  // canvas) sebelum chart dan data dimuat. Ini mencegah Quick Access kosong,
  // KPI stuck di "Rp 0", dan chart kosong saat pertama masuk.
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      try { initChart(); } catch(e) { console.error('initChart error:', e); }
      renderQuickAccess();
      Promise.all([
        loadDashboardData(),
        loadDropdownOptions(),
        loadUsers(true),
        loadSuppliers(true)
      ]).then(function() {
        try { updateChart(); } catch(e) { console.error('updateChart error:', e); }
        renderQuickAccess();
        finishAppLoadingProgress();
        setTimeout(function() { if (appLoadingEl) appLoadingEl.classList.add('hidden'); }, 300);
      }).catch(function(e) {
        console.error('initApp load error:', e);
        finishAppLoadingProgress();
        setTimeout(function() { if (appLoadingEl) appLoadingEl.classList.add('hidden'); }, 300);
      });
    });
  });

  if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
    var selDashSppg = $('dashFilterSPPG');
    if (selDashSppg) {
      selDashSppg.classList.remove('hidden');
      var sppgListInit = CFG_SPPG_FALLBACK;
      var htmlOpt = '<option value="ALL">Semua SPPG</option>';
      sppgListInit.forEach(function(s) { htmlOpt += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
      selDashSppg.innerHTML = htmlOpt;
    }
  }

  // Set default dates
  $('addTxTanggal').value = formatDateInput();
  $('addMenuTanggal').value = formatDateInput();
  $('addPendingTglPending').value = formatDateInput();
}

function loadDropdownOptions() {
  return new Promise(function(resolve) {
    callApi('getDropdownOptions', [], function(result) {
        if (result.success) {
                  dropdownOptions = result;
                  populateSPPGSelects();
                  populateSupplierSelects();
                  populateKategoriFilters();
                  populateMenuMBGSelect();
                }
                resolve();
      },
      function(err) {
        resolve();
      }
    );
  });
}

function populateSPPGSelects() {
  var lists = ['addTxSPPG'];
  var sppgList = dropdownOptions.sppgList && dropdownOptions.sppgList.length
    ? dropdownOptions.sppgList
    : CFG_SPPG_FALLBACK;
  lists.forEach(function(id) {
    var sel = $(id);
    if (!sel) return;
    var currentVal = sel.value; // simpan nilai aktif sebelum rebuild
    var html = '<option value="">Pilih SPPG</option>';
    sppgList.forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    sel.innerHTML = html;
    if (currentVal) sel.value = currentVal; // restore nilai setelah rebuild
  });
}
function populateSupplierSelects() {
  var suppliers = dropdownOptions.suppliers || [];
  var lists = ['addBBSupplier', 'addSTSupplier'];
  lists.forEach(function(id) {
    var sel = $(id);
    if (!sel) return;
    var html = id === 'addBBSupplier' ? '<option value="">Pilih Supplier</option>' : '<option value="">Pilih Supplier</option>';
    suppliers.forEach(function(s) { html += '<option value="' + esc(s.nama) + '">' + esc(s.nama) + '</option>'; });
    sel.innerHTML = html;
  });
}

function populateKategoriFilters() {
  var kat = dropdownOptions.kategori || [];
  var sel = $('bbFilterKategori');
  if (!sel) return;
  var html = '<option value="ALL">Semua Kategori</option>';
  kat.forEach(function(k) { html += '<option value="' + esc(k) + '">' + esc(k) + '</option>'; });
  sel.innerHTML = html;
}
function populateMenuMBGSelect() {
  var bb = dropdownOptions.bahanBaku || [];
  var sel = $('addMenuList');
  if (!sel) return;
  var html = '';
  bb.forEach(function(b) { html += '<option value="' + esc(b.nama) + '">' + esc(b.nama) + ' (' + esc(b.satuan) + ')</option>'; });
  sel.innerHTML = html;
}
function populatePendingTransaksiSelect() {
  var sel = $('addPendingTransaksi');
  if (!sel || !allTransactions.length) return;
  var html = '<option value="">Pilih Transaksi</option>';
  allTransactions.forEach(function(t) {
    html += '<option value="' + esc(t.kode || t.id) + '">' + esc(t.kode || t.id) + ' - ' + esc(t.item || '-') + ' (' + formatRupiah(t.nominal) + ')</option>';
  });
  sel.innerHTML = html;
}

// ============================================================
// 7. DASHBOARD
// ============================================================

/* ============================================================
     DASHBOARD
     ============================================================ */
function loadDashboardData() {
  return new Promise(function(resolve) {
    if (!currentUser) { resolve(); return; }
    // R3: Tampilkan skeleton screen, sembunyikan stat cards sementara
    var skeleton = $('skeletonDashboard');
    var statCards = $('dashboardStats');
    if (skeleton && statCards) { skeleton.classList.remove('hidden'); statCards.classList.add('hidden'); }
    showLoading(true);
    callApi('getDashboardKPI', [
      globalDateFilter.start,
      globalDateFilter.end
    ], function(result) {
        showLoading(false);
                // R3: Sembunyikan skeleton, tampilkan stat cards
                if (skeleton && statCards) { skeleton.classList.add('hidden'); statCards.classList.remove('hidden'); }
                if (result.success) {
                  $('statSaldo').textContent = formatRupiah(result.saldoBerjalan);
                  $('statPemasukan').textContent = formatRupiah(result.totalPemasukan);
                  $('statPengeluaran').textContent = formatRupiah(result.totalPengeluaran);
                  $('statAntrian').textContent = result.antrianApproval || 0;
                  $('statAntrianNominal').textContent = formatRupiah(result.totalBelumBayar);
                  // Update badge
                  var cnt = result.antrianApproval || 0;
                  var badge = $('approvalCount');
                  if (badge) { badge.textContent = cnt; badge.style.display = cnt > 0 ? 'inline-flex' : 'none'; }
                  var badgeSidebar = $('approvalCountSidebar');
                  if (badgeSidebar) { badgeSidebar.textContent = cnt; badgeSidebar.style.display = cnt > 0 ? 'inline-flex' : 'none'; }
                  syncApprovalBadgeToBottomNav();
                  syncApprovalBadgeToQuickAccess();
                }
                resolve();
      },
      function(err) {
        showLoading(false); resolve();
      }
    );
  });
}

function initChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  var canvasEl = $('cashFlowChart');
  if (!canvasEl) return; // Canvas dashboard tidak ada di halaman ini — hindari crash
  var ctx = canvasEl.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Pemasukan', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6 },
        { label: 'Pengeluaran', data: [], borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6 },
        { label: 'Saldo', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', tension: 0.3, fill: false, borderDash: [5,5], pointRadius: 3, pointHoverRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8, callbacks: { label: function(c) { return c.dataset.label + ': ' + formatRupiah(c.raw); } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: function(v) { if (Math.abs(v) >= 1000000) return (v/1000000).toFixed(0)+'jt'; if (Math.abs(v) >= 1000) return (v/1000).toFixed(0)+'rb'; return v; } } }
      }
    }
  });
}

// Helper: konversi string tanggal format DD/MM/YYYY menjadi objek Date,
// dipakai khusus untuk sorting label chart di renderLaporanCharts().
function parseDate(str) {
  if (!str || str === '-') return new Date(0);
  var parts = String(str).split('/');
  if (parts.length !== 3) return new Date(0);
  var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function updateChart() {
  if (!chartInstance || !currentUser) return;
  var periodeSel = $('dashFilterPeriode');
  var days = periodeSel ? parseInt(periodeSel.value) || 30 : 30;
  var end = new Date();
  var start = new Date(); start.setDate(start.getDate() - days);
  var filters = { dateStart: formatDateInput(start), dateEnd: formatDateInput(end) };

  var sppgSel = $('dashFilterSPPG');
  var sppgFilterVal = (sppgSel && sppgSel.value !== 'ALL') ? sppgSel.value : '';

    callApi('getChartData', [
      { sppgFilter: sppgFilterVal },
      filters
    ], function(data) {
        if (!data || !data.length) { $('chartDataCount').textContent = '0 data'; chartInstance.data.labels = []; chartInstance.data.datasets.forEach(function(ds){ ds.data = []; }); chartInstance.update(); return; }
              $('chartDataCount').textContent = data.length + ' data';
              chartInstance.data.labels = data.map(function(d) { return d.tanggal; });
              chartInstance.data.datasets[0].data = data.map(function(d) { return d.pemasukan; });
              chartInstance.data.datasets[1].data = data.map(function(d) { return d.pengeluaran; });
              chartInstance.data.datasets[2].data = data.map(function(d) { return d.saldo; });
              chartInstance.update();
      },
      function(err) {
        console.error(err);
      }
    );
}

// ============================================================
// 7b. NOTIFIKASI LONCENG (ADMIN / SUPER_ADMIN)
// ============================================================
function initNotifBell() {
  var wrap = $('notifBellWrap');
  if (!wrap) return;
  var isAdminRole = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');
  if (!isAdminRole) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  loadNotifications();
  if (notifPollTimer) clearInterval(notifPollTimer);
  notifPollTimer = setInterval(loadNotifications, 60000); // refresh tiap 60 detik
}

var _lastUnreadCount = null; // null = belum pernah load (hindari bunyi saat pertama buka app)

function loadNotifications() {
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) return;
  callApi('getNotifications', [], function(result) {
      if (result && result.success) {
        notifList = result.data || [];
        var unreadCount = result.unreadCount || 0;
        renderNotifBadge(unreadCount);
        renderNotifPanel();
        // Bunyikan suara jika unread bertambah dibanding polling sebelumnya
        // (mis. ada aksi ADD/EDIT/DELETE baru masuk saat app sedang dibuka)
        if (_lastUnreadCount !== null && unreadCount > _lastUnreadCount) {
          playNotifSound();
        }
        _lastUnreadCount = unreadCount;
      }
    }, null);
}

function renderNotifBadge(count) {
  var badge = $('notifBellBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifPanel() {
  var listEl = $('notifPanelList');
  if (!listEl) return;
  if (!notifList.length) {
    listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Tidak ada notifikasi</p></div>';
    return;
  }
  var html = '';
  notifList.forEach(function(n, idx) {
    var actionClass = n.actionType === 'DELETE' ? 'action-delete' : (n.actionType === 'EDIT' ? 'action-edit' : 'action-add');
    html += '<div class="notif-item ' + (n.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + idx + ')">' +
      '<div class="notif-item-icon ' + actionClass + '"><i class="fas ' + esc(n.icon || 'fa-bell') + '"></i></div>' +
      '<div class="notif-item-content">' +
        '<div class="notif-item-title">' + esc(n.label || 'Aktivitas Baru') + '</div>' +
        '<div class="notif-item-desc">' + esc(n.deskripsi || '-') + '</div>' +
        '<div class="notif-item-time"><i class="fas fa-clock" style="margin-right:3px;"></i>' + esc(n.waktu || '-') + ' oleh ' + esc(n.pelaku || '-') + '</div>' +
      '</div>' +
    '</div>';
  });
  listEl.innerHTML = html;
}

function toggleNotifPanel() {
  var panel = $('notifPanel');
  if (!panel) return;
  var willOpen = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (willOpen) loadNotifications();
}

function closeNotifPanel() {
  var panel = $('notifPanel');
  if (panel) panel.classList.add('hidden');
}

// Tutup panel notifikasi saat klik di luar area
document.addEventListener('click', function(e) {
  var wrap = $('notifBellWrap');
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

// Peta halaman notifikasi -> fungsi highlight baris terkait setelah pindah halaman
var NOTIF_PAGE_HANDLER = {
  'users': function(recordId) {
    var row = allUsers.find(function(u) { return String(u.id) === String(recordId); });
    highlightRowById('usersTableBody', row ? row._row : null);
  },
  'transaksi': function(recordId) {
    openDetailTransaksi(recordId);
  },
  'master-bahan': function(recordId) {
    highlightRowById('masterBBTableBody', recordId, true);
  },
  'master-supplier': function(recordId) {
    highlightRowById('supplierTableBody', recordId, true);
  },
  'survei': function(recordId) {
    highlightRowById('surveiTableBody', recordId, true);
  },
  'serah-terima': function(recordId) {
    highlightRowById('serahTerimaTableBody', recordId, true);
  },
  'menu-mbg': function(recordId) {
    // Menu MBG tidak render by-id di DOM, cukup buka halamannya
  }
};

// Cari baris tabel berdasarkan ID (baik _row numerik atau ID string) lalu scroll+highlight
function highlightRowById(tbodyId, matchId, isStringId) {
  setTimeout(function() {
    var tbody = $(tbodyId);
    if (!tbody || matchId === null || matchId === undefined) return;
    var rows = tbody.querySelectorAll('tr');
    var target = null;
    if (isStringId) {
      // Cocokkan lewat tombol aksi yang memuat ID di onclick (delete/edit) sebagai fallback pencarian teks
      rows.forEach(function(tr) {
        if (!target && tr.innerHTML.indexOf(matchId) > -1) target = tr;
      });
    } else {
      rows.forEach(function(tr) {
        var editBtn = tr.querySelector('[onclick*="openEditUserModal(' + matchId + ')"]');
        if (editBtn) target = tr;
      });
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.transition = 'background 0.3s';
      target.style.background = '#fef3c7';
      setTimeout(function() { target.style.background = ''; }, 2500);
    }
  }, 400);
}

function handleNotifClick(idx) {
  var n = notifList[idx];
  if (!n) return;
  closeNotifPanel();

  // Tandai sudah dibaca (optimistic update di UI + kirim ke server)
  if (!n.isRead) {
    n.isRead = true;
    renderNotifPanel();
    renderNotifBadge(notifList.filter(function(x) { return !x.isRead; }).length);
    callApi('markNotificationRead', [n.logId], null, null);
  }

  // Navigasi ke halaman terkait
  switchPage(n.page);
  var handler = NOTIF_PAGE_HANDLER[n.page];
  if (handler) {
    setTimeout(function() { handler(n.recordId); }, 350);
  }
}

function markAllNotifRead() {
  if (!notifList.some(function(n) { return !n.isRead; })) return;
  notifList.forEach(function(n) { n.isRead = true; });
  renderNotifPanel();
  renderNotifBadge(0);
  callApi('markAllNotificationsRead', [], function(result) {
      if (!result || !result.success) loadNotifications(); // fallback: reload jika gagal
    }, function(err) {
      loadNotifications();
    });
}

// ============================================================
// 8. PROFIL
// ============================================================

// Mengganti icon fa-user-circle di sidebar & bottom-nav dengan foto profil user (jika ada)
function updateMenuProfilAvatar(url) {
  var sidebarIcon = document.querySelector('#sidebarMenu .menu-item[data-page="profil"] i.fas');
  var bnavIcon = document.querySelector('#bottomNavInner .bnav-item[data-page="profil"] i.fas');
  [sidebarIcon, bnavIcon].forEach(function(icon) {
    if (!icon) return;
    var parent = icon.parentElement;
    if (!parent) return;
    var existingImg = parent.querySelector('img.menu-avatar-img');
    if (url) {
      if (existingImg) {
        existingImg.src = url;
      } else {
        var img = document.createElement('img');
        img.className = 'menu-avatar-img';
        img.src = url;
        img.alt = 'Profil';
        img.style.cssText = 'width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;';
        icon.style.display = 'none';
        parent.insertBefore(img, icon);
      }
    } else {
      if (existingImg) existingImg.remove();
      icon.style.display = '';
    }
  });
}


/* ============================================================
     PROFILE
     ============================================================ */
function renderProfil() {
  if (!currentUser) return;
  $('profilNama').textContent = currentUser.namaLengkap || currentUser.username;
  $('profilEmail').textContent = currentUser.email || '-';
  $('profilJabatanBadge').textContent = currentUser.jabatan || '-';
  $('profilSPPGBadge').textContent = currentUser.sppg || '-';
  $('profilRoleBadge').textContent = currentUser.role || '-';

  $('profilNamaLengkap').textContent = currentUser.namaLengkap || '-';
  $('profilEmailVal').textContent = currentUser.email || '-';
  $('profilJabatan').textContent = currentUser.jabatan || '-';
  $('profilSPPG').textContent = currentUser.sppg || '-';
  $('profilRole').textContent = currentUser.role || '-';
  $('profilUsername').textContent = currentUser.username || '-';
  $('profilYayasan').textContent = currentUser.namaYayasan || '-';
  $('profilTimestamp').textContent = currentUser.timestamp ? formatDate(currentUser.timestamp) : '-';

  var fotoPath = currentUser.fotoProfil;
  var fallbackAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.namaLengkap || currentUser.username) + '&background=1e6f9c&color=fff&size=200&rounded=true';
  $('profilAvatar').src = fallbackAvatarUrl;
  $('profilAvatar').onerror = function() { this.src = fallbackAvatarUrl; };
  if (fotoPath && String(fotoPath).trim() !== '' && fotoPath !== '-') {
    callApi('getFileUrl', [
      'FOTO_PROFIL',
      fotoPath
    ], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
          $('profilAvatar').src = fotoUrl;
          updateMenuProfilAvatar(fotoUrl);
        }
      }, null);
  } else {
    updateMenuProfilAvatar('');
  }
}

function openEditProfilModal() {
  if (!currentUser) return;
  $('editNama').value    = currentUser.namaLengkap || '';
  $('editJabatan').value = currentUser.jabatan || '';
  $('editSPPG').value    = currentUser.sppg || '';
  $('editYayasan').value = currentUser.namaYayasan || '';
  $('editFotoPreview').classList.add('hidden');
  // Sembunyikan dropdown list kalau masih terbuka
  var editList = $('editSppgList');
  if (editList) editList.classList.add('hidden');
  openModal('modalEditProfil');
}
function saveEditProfil() {
  var nama    = $('editNama').value.trim();
  var jabatan = $('editJabatan').value;
  var sppg    = $('editSPPG').value.trim().toUpperCase();
  var yayasan = $('editYayasan').value.trim();
  if (!nama) { showToast('error', 'Error', 'Nama tidak boleh kosong'); return; }
  var updateData = { 'NAMA LENGKAP': nama };
  if (jabatan) updateData['JABATAN'] = jabatan;
  if (sppg)    updateData['SPPG'] = sppg;
  updateData['NAMA YAYASAN'] = yayasan;
  if (jabatan) updateData['JABATAN'] = jabatan;
  if (sppg) updateData['SPPG'] = sppg;
  updateData['NAMA YAYASAN'] = yayasan;
  var fotoFile = $('editFoto').files[0];
  if (fotoFile) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      showLoading(true);
    callApi('uploadFotoProfil', [
      currentUser.username,
      base64,
      fotoFile.type,
      fotoFile.name
    ], function(up) {
        showLoading(false);
                  if (up.success) {
                    // Simpan fileId ke currentUser dan updateData
                    updateData['FOTO PROFIL'] = up.fileId;
                    currentUser.fotoProfil = up.fileId;
                    doUpdateProfil(updateData);
                  } else {
                    showToast('error', 'Gagal Upload', up.message || 'Upload foto gagal');
                  }
      },
      function(err) {
        showLoading(false);
                  showToast('error', 'Gagal', 'Terjadi kesalahan saat upload foto');
      }
    );
    };
    reader.readAsDataURL(fotoFile);
  } else {
    doUpdateProfil(updateData);
  }
}

function doUpdateProfil(updateData) {
  showLoading(true);
    callApi('updateUserProfile', [
      currentUser.username,
      updateData
    ], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Sukses', result.message);
                currentUser.namaLengkap = updateData['NAMA LENGKAP'] || currentUser.namaLengkap;
                if (updateData['FOTO PROFIL']) currentUser.fotoProfil = updateData['FOTO PROFIL'];
                if (updateData['JABATAN']) currentUser.jabatan = updateData['JABATAN'];
                if (updateData['SPPG']) currentUser.sppg = updateData['SPPG'];
                if (updateData['NAMA YAYASAN'] !== undefined) currentUser.namaYayasan = updateData['NAMA YAYASAN'];
                safeStorage('set', 'sppg_session', JSON.stringify({ user: currentUser, expiry: sessionExpiry }));
                renderProfil();
                closeModal('modalEditProfil');
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false);
              showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 9. USERS (ADMIN)
// ============================================================
function loadUsers(silent) {
  return new Promise(function(resolve) {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) { resolve(); return; }
    if (!silent) showLoading(true);
    callApi('getAllUsers', [], function(result) {
        if (!silent) showLoading(false);
                if (result.success) {
                  allUsers = result.data || [];
                  filteredUsers = allUsers.slice();
                  populateUsersFilterOptions();
                  usersPage = 1;
                  renderUsersTable();
                }
                resolve();
      },
      function(err) {
        if (!silent) { showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data users'); }
                resolve();
      }
    );
  });
}
function renderUsersTable() {
  var tbody = $('usersTableBody');
  if (!filteredUsers.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-users"></i></div><h4>Tidak Ada Users</h4></div></td></tr>'; renderPagination('usersPagination', 1, 0, 'goUsersPage'); return; }
  var totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  if (usersPage > totalPages) usersPage = totalPages;
  var start = (usersPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(u, i) {
    var avatarFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.namaLengkap || u.username) + '&background=1e6f9c&color=fff&size=60&rounded=true';
    var avatarImgId = 'userAvatar_' + esc(u.username);
    html += '<tr>' +
      '<td style="text-align:center;">' + (start + i + 1) + '</td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<img id="' + avatarImgId + '" src="' + esc(avatarFallback) + '" style="width:36px;height:36px;border-radius:10px;object-fit:cover;border:2px solid var(--slate-200);flex-shrink:0;" alt="' + esc(u.namaLengkap) + '" onerror="this.src=\'' + avatarFallback + '\'">' +
          '<div><div style="font-weight:600;color:var(--slate-800);">' + esc(u.namaLengkap) + '</div><div style="font-size:11px;color:var(--slate-400);">@' + esc(u.username) + '</div></div>' +
        '</div></td>' +
      '<td>' + esc(u.email) + '</td>' +
      '<td><span class="badge badge-blue">' + esc(u.jabatan) + '</span></td>' +
      '<td><span class="badge badge-outline">' + esc(u.sppg) + '</span></td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn edit" onclick="openEditUserModal(' + u._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' +
          '<button class="action-btn delete" onclick="confirmHapus(\'user\',0,\'' + esc(u.username) + '\',\'user ' + esc((u.namaLengkap||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' +
        '</div></td></tr>';
  });

  tbody.innerHTML = html;
  renderPagination('usersPagination', usersPage, totalPages, 'goUsersPage');

  pageData.forEach(function(u) {
    if (u.fotoProfil && String(u.fotoProfil).trim() !== '' && u.fotoProfil !== '-') {
    callApi('getFileUrl', [
      'FOTO_PROFIL',
      u.fotoProfil
    ], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
                    var img = document.getElementById('userAvatar_' + u.username);
                    if (img) img.src = fotoUrl;
                  }
      }, null);
    }
  });
}

function filterUsers() {
  var search = $('usersSearchInput').value.toLowerCase().trim();
  var sppg = $('usersFilterSppg').value;
  var role = $('usersFilterRole').value;
  filteredUsers = allUsers.filter(function(u) {
    var teks = (u.namaLengkap || '') + ' ' + (u.username || '') + ' ' + (u.email || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (sppg !== 'ALL' && u.sppg !== sppg) return false;
    if (role !== 'ALL' && u.role !== role) return false;
    return true;
  });
  usersPage = 1;
  renderUsersTable();
}
function populateUsersFilterOptions() {
  var sppgSel = $('usersFilterSppg'), roleSel = $('usersFilterRole');
  var sppgSet = {}, roleSet = {};
  allUsers.forEach(function(u) { if (u.sppg) sppgSet[u.sppg] = true; if (u.role) roleSet[u.role] = true; });
  sppgSel.innerHTML = '<option value="ALL">Semua SPPG</option>' + Object.keys(sppgSet).sort().map(function(s){ return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  roleSel.innerHTML = '<option value="ALL">Semua Role</option>' + Object.keys(roleSet).sort().map(function(r){ return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');
}

function goUsersPage(p) { usersPage = p; renderUsersTable(); }
function openEditUserModal(rowNum) {
  var user = allUsers.find(function(u) { return u._row === rowNum; });
  if (!user) return;
  currentEditRow = rowNum;
  $('editUserRow').value = rowNum;
  $('editUserNama').value = user.namaLengkap || '';
  $('editUserEmail').value = user.email || '';
  $('editUserJabatan').value = user.jabatan || '';
  $('editUserSPPG').value = user.sppg || '';
  $('editUserYayasan').value = user.namaYayasan || '';
  var roleWrap = $('editUserRoleWrap');
  if (currentUser && currentUser.role === 'SUPER_ADMIN') {
    if (roleWrap) roleWrap.classList.remove('hidden');
    $('editUserRole').value = user.role || 'LAPANGAN';
  } else {
    if (roleWrap) roleWrap.classList.add('hidden');
  }
  openModal('modalEditUser');
}
function saveEditUser() {
  var sppgVal = $('editUserSPPG').value.trim().toUpperCase();
  var fields = {
    'NAMA LENGKAP': $('editUserNama').value.trim(),
    'EMAIL': $('editUserEmail').value.trim(),
    'JABATAN': $('editUserJabatan').value,
    'SPPG': sppgVal,
    'NAMA YAYASAN': $('editUserYayasan').value.trim(),
    _isAdmin: true
  };
  if (sppgVal && SPPG_MASTER.indexOf(sppgVal) === -1) SPPG_MASTER.push(sppgVal);
  if (currentUser && currentUser.role === 'SUPER_ADMIN') {
    fields['ROLE'] = $('editUserRole').value;
  }
    callApi('updateUserProfile', [
      allUsers.find(function(u) { return u._row == currentEditRow; }).username,
      fields
    ], function(result) {
        if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditUser'); loadUsers(); }
              else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 10. TRANSAKSI
// ============================================================

/* ============================================================
     TRANSACTIONS
     ============================================================ */
function loadTransactions() {
  if (!currentUser) return;
  showLoading(true);
  // R3: Tampilkan skeleton placeholder di tabel body sementara
  var tbody = $('transaksiTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="skeleton-screen" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>' +
      '</div></td></tr>';
  }

  var isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  var isAdmin = currentUser.role === 'ADMIN';
  var filters = {
    callerRole: currentUser.role,
    callerUser: (isSuperAdmin || isAdmin) ? '' : currentUser.email
  };
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;

    callApi('getTransactions', [filters], function(data) {
        showLoading(false);
              if (!data || !Array.isArray(data)) {
                showToast('error', 'Gagal', 'Data transaksi tidak valid. Coba refresh.');
                allTransactions = [];
                filteredTransactions = [];
                renderTransaksiTable();
                return;
              }
              allTransactions = data;
              filteredTransactions = allTransactions.slice();
              txPage = 1;
              populateSPPGFilter();
              populatePendingTransaksiSelect();
              renderTransaksiTable();
      },
      function(err) {
        showLoading(false);
              showToast('error', 'Gagal', 'Tidak dapat memuat transaksi: ' + (err.message || ''));
              allTransactions = [];
              filteredTransactions = [];
              renderTransaksiTable();
      }
    );
}

function populateSPPGFilter() {
  var sel = $('txFilterSPPG');
  if (!sel) return;
  var sppgSet = {};
  allTransactions.forEach(function(t) { if (t.sppg) sppgSet[t.sppg] = true; });
  var html = '<option value="ALL">Semua SPPG</option>';
  Object.keys(sppgSet).sort().forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sel.innerHTML = html;
}

function renderTransaksiTable() {
  var tbody = $('transaksiTableBody');
  var count = filteredTransactions.length;
  if (!count) {
    var canAdd = currentUser && currentUser.role; // semua role yang punya akses halaman ini boleh tambah
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-inbox"></i></div><h4>Tidak Ada Transaksi</h4><p>Belum ada transaksi yang tercatat di sini.</p>' +
      (canAdd ? '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openAddTransaksiModal()"><i class="fas fa-plus"></i> Tambah Transaksi Pertama</button>' : '') +
      '</div></td></tr>';
    $('txPagination').innerHTML = ''; return;
  }
  var totalPages = Math.ceil(count / ITEMS_PER_PAGE);
  if (txPage > totalPages) txPage = totalPages;
  var start = (txPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  var isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');
    pageData.forEach(function(tx, idx) {
    var no = start + idx + 1;
    var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
    var isPaid = metode === 'SUDAH_DIBAYAR';
    var rowClass = isPaid ? 'row-paid' : '';
    html += '<tr class="' + rowClass + '" data-id="' + esc(tx.id) + '">' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + no + '</td>' +
      '<td><strong style="color:var(--slate-800);font-size:12px;">' + esc(tx.kode || '-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal || '-') + '</td>' +
      '<td><span class="badge ' + (tx.kategori === 'PENGELUARAN' ? 'badge-red' : 'badge-green') + '">' + esc(tx.kategori || '-') + '</span></td>' +
      '<td><span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span></td>' +
      '<td><strong style="color:var(--slate-700);">' + esc(tx.item || '-') + '</strong></td>' +
      '<td><strong style="color:var(--slate-800);">' + formatRupiah(tx.nominal) + '</strong></td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailTransaksi(\'' + esc(tx.id) + '\')" title="Detail Transaksi"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (isAdmin && !isPaid ? '<button class="action-btn approve" onclick="openApprovalModal(\'' + esc(tx.id) + '\')" title="Approve"><i class="fas fa-check"></i><span class="tooltip">Approve</span></button>' : '') +
          (isAdmin ? '<button class="action-btn edit" onclick="openEditTransaksi(\'' + esc(tx.id) + '\')" title="Edit Transaksi"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (isAdmin ? '<button class="action-btn delete" onclick="confirmHapus(\'transaksi\',0,\'' + esc(tx.id) + '\',\'transaksi ' + esc((tx.kode||'').substring(0,15)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('txPagination', txPage, totalPages, 'goTxPage');
}
function goTxPage(p) { txPage = p; renderTransaksiTable(); }

function filterTransaksi() {
  var search = $('txSearchInput').value.toLowerCase().trim();
  var sppg = $('txFilterSPPG').value;
  var kategori = $('txFilterKategori').value;
  var status = $('txFilterStatus').value;
  filteredTransactions = allTransactions.filter(function(tx) {
    if (search) {
      var s = ((tx.kode || '') + ' ' + (tx.item || '') + ' ' + (tx.user || '') + ' ' + (tx.sppg || '')).toLowerCase();
      if (s.indexOf(search) === -1) return false;
    }
    if (sppg !== 'ALL' && tx.sppg !== sppg) return false;
    if (kategori !== 'ALL' && tx.kategori !== kategori) return false;
    // Normalisasi metodeTransaksi untuk perbandingan yang aman
    var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
    if (status === 'PENDING') {
      if (metode === 'SUDAH_DIBAYAR') return false;
    }
    if (status === 'SUDAH_DIBAYAR' && metode !== 'SUDAH_DIBAYAR') return false;
    return true;
  });
  txPage = 1;
  renderTransaksiTable();
}

function openEditTransaksi(id) {
  var tx = allTransactions.find(function(t) { return t.id === id; });
  if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
  $('editTxId').value = tx.id;
  $('editTxTanggal').value = tx.tanggal ? tx.tanggal.split('/').reverse().join('-') : '';
  $('editTxKategori').value = tx.kategori || 'PENGELUARAN';
  $('editTxJenisKat').value = tx.jenisKategori || '';
  $('editTxSPPG').value = tx.sppg || '';
  $('editTxItem').value = tx.item || '';
  $('editTxNominal').value = tx.nominal || '';
  $('editTxCatatan').value = tx.catatan || '';
  $('editTxMetode').value = tx.metodeTransaksi || 'BELUM_BAYAR';
  openModal('modalEditTransaksi');
}
function saveEditTransaksi() {
  var id = $('editTxId').value;
  var fields = {
    'Tanggal': $('editTxTanggal').value,
    'Kategori': $('editTxKategori').value,
    'Jenis Kategori': $('editTxJenisKat').value,
    'SPPG': $('editTxSPPG').value,
    'Nama Item/Bahan Baku': $('editTxItem').value,
    'Nominal': parseFloat($('editTxNominal').value) || 0,
    'Catatan': $('editTxCatatan').value,
    'Metode Transaksi': $('editTxMetode').value
  };
  showLoading(true);
    callApi('editTransaction', [
      id,
      fields
    ], function(result) {
        showLoading(false);
              if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditTransaksi'); loadTransactions(); loadDashboardData(); }
              else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

function getMetodeBadge(m) {
  var metode = String(m || '').trim().toUpperCase();
  if (!metode || metode === '-') return '<span class="badge badge-slate">-</span>';
  if (metode === 'SUDAH_DIBAYAR') return '<span class="badge badge-green"><i class="fas fa-check-double" style="font-size:8px"></i> Sudah Dibayar</span>';
  if (metode === 'MENUNGGU_VERIFIKASI') return '<span class="badge badge-orange"><i class="fas fa-stamp" style="font-size:8px"></i> Menunggu TTD Verifikator</span>';
  if (metode === 'BELUM_LUNAS') return '<span class="badge badge-amber"><i class="fas fa-exclamation-circle" style="font-size:8px"></i> Belum Lunas</span>';
  if (metode === 'TRANSFER') return '<span class="badge badge-blue">Transfer</span>';
  if (metode === 'CASH') return '<span class="badge badge-green">Cash</span>';
  if (metode === 'BELUM_BAYAR') return '<span class="badge badge-red">Belum Bayar</span>';
  return '<span class="badge badge-slate">' + esc(m) + '</span>';
}

function openAddTransaksiModal() {
  $('addTxTanggal').value = formatDateInput();

  // Pastikan data bahan baku sudah dimuat sebelum modal dibuka
  if (!dropdownOptions.bahanBaku || dropdownOptions.bahanBaku.length === 0) {
    showLoading(true);
    callApi('getDropdownOptions', [], function(result) {
        showLoading(false);
                if (result.success) {
                  dropdownOptions = result;
                  populateSPPGSelects();
                  populateSupplierSelects();
                  populateKategoriFilters();
                  populateMenuMBGSelect();
                }
      },
      function(err) {
        showLoading(false);
      }
    );
  }

  $('addTxKategori').value = 'PENGELUARAN';
  $('addTxJenisKat').value = '';
  // Set SPPG default dari user, setelah datalist dipastikan terisi
  (function() {
    var sppgVal = currentUser ? (currentUser.sppg || '') : '';
    var sppgInput = $('addTxSPPG');
    if (!sppgInput) return;
    if (dropdownOptions.sppgList && dropdownOptions.sppgList.length) {
      sppgInput.value = sppgVal;
    } else {
      // Datalist belum terisi — tunggu loadDropdownOptions selesai
      sppgInput.value = sppgVal;
      // Fallback: isi datalist dengan CFG_SPPG_FALLBACK sekarang
      var dl = $('sppgDatalist');
      if (dl && !dl.children.length) {
        dl.innerHTML = CFG_SPPG_FALLBACK.map(function(s) { return '<option value="' + esc(s) + '">'; }).join('');
      }
    }
  })();
  $('addTxItem').value = '';
  $('addTxCatatan').value = '';
  $('addTxMetodeTransaksi').value = 'BELUM_BAYAR';
  $('addTxNominal').value = '';
  $('addTxNominal').setAttribute('data-raw', '0');
  var nomConf = $('addTxNominalConfirm'); if (nomConf) nomConf.textContent = '';
  var itemHint = $('addTxItemHint'); if (itemHint) itemHint.innerHTML = '';
  $('addTxFoto').value = '';
  var lf = $('labelFoto'); if (lf) lf.innerHTML = '<i class="fas fa-camera"></i><span>Kamera / Galeri / File</span>';
  $('addTxNota').value = '';
  openModal('modalAddTransaksi');
  setTimeout(initAddTxTtd, 100);
}

function saveAddTransaksi() {
  var data = {
    tanggal: $('addTxTanggal').value,
    kategori: $('addTxKategori').value,
    jenisKategori: $('addTxJenisKat').value,
    sppg: $('addTxSPPG').value,
    namaItem: $('addTxItem').value,
    nominal: getNominalRaw(),
    catatan: $('addTxCatatan').value,
    metodeTransaksi: $('addTxMetodeTransaksi').value,
    };
  if (!data.tanggal || !data.sppg || !data.namaItem || !data.nominal) {
    showToast('error', 'Validasi', 'Tanggal, SPPG, Nama Item, dan Nominal wajib diisi'); return;
  }
  showLoading(true);

  var fotoFile = $('addTxFoto').files[0];
  var notaFile = $('addTxNota') ? $('addTxNota').files[0] : null;
  var ttdCanvas = $('addTxTtdCanvas');
  var uploadsPending = 0;

  var _submitAttempt = 0;
  function doSubmit() {
    _submitAttempt++;
    var attemptNum = _submitAttempt;

    // Tampilkan pesan loading kontekstual
    var loadingMsg = attemptNum > 1
      ? 'Mencoba ulang (' + attemptNum + '/3)...'
      : 'Menyimpan transaksi...';
    showToast('warning', 'Mohon Tunggu', loadingMsg);

    // Timeout manual: jika 45 detik tidak ada response, anggap gagal
    var timeoutHandle = setTimeout(function() {
      showLoading(false);
      if (_submitAttempt === attemptNum) {
        // Belum ada response — tawarkan retry
        showToast('error', 'Koneksi Lambat',
          'Server tidak merespons. Coba klik Simpan lagi atau periksa koneksi.');
        // Re-enable tombol save
        var btnSave = document.querySelector('#modalAddTransaksi .btn-primary');
        if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
      }
    }, 45000);

    // Nonaktifkan tombol save agar tidak double submit
    var btnSave = document.querySelector('#modalAddTransaksi .btn-primary');
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...'; }

    callApi('addTransaction', [data], function(result) {
        clearTimeout(timeoutHandle);
                showLoading(false);
                // Re-enable tombol
                if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
        
                if (result && result.success) {
                  showToast('success', 'Tersimpan!', result.message || 'Transaksi berhasil ditambahkan.');
                  closeModal('modalAddTransaksi');
                  // Reset semua filter
                  if ($('txSearchInput')) $('txSearchInput').value = '';
                  if ($('txFilterSPPG')) $('txFilterSPPG').value = 'ALL';
                  if ($('txFilterKategori')) $('txFilterKategori').value = 'ALL';
                  if ($('txFilterStatus')) $('txFilterStatus').value = 'ALL';
                  txPage = 1;
                  // Optimistic update: langsung muat ulang tanpa mengosongkan tabel dulu,
                  // jadi user tidak melihat tabel "kosong sesaat" lalu terisi lagi 6 detik kemudian.
                  loadTransactions();
                  loadDashboardData();
                  updateChart();
                } else {
                  var errMsg = (result && result.message) ? result.message : 'Terjadi kesalahan tidak diketahui.';
                  showToast('error', 'Gagal Menyimpan', errMsg);
                }
      },
      function(err) {
        clearTimeout(timeoutHandle);
                showLoading(false);
                if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
                var errDetail = err && err.message ? err.message : 'Periksa koneksi internet Anda.';
                showToast('error', 'Koneksi Gagal', errDetail + ' — Coba tekan Simpan lagi.');
      }
    );
  }

  if (fotoFile) {
    uploadsPending++;
    var r = new FileReader();
    r.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
    callApi('uploadTxFile', [
      b64,
      fotoFile.type,
      fotoFile.name,
      'foto'
    ], function(up) {
        if (up.success) data.uploadFoto = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();
      }, null);
    };
    r.readAsDataURL(fotoFile);
  }

  if (notaFile) {
    uploadsPending++;
    var r3 = new FileReader();
    r3.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
    callApi('uploadTxFile', [
      b64,
      notaFile.type,
      notaFile.name,
      'nota'
    ], function(up) {
        if (up.success) data.notaPembelian = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();
      }, null);
    };
    r3.readAsDataURL(notaFile);
  }
  if (ttdCanvas && !isCanvasBlank('addTxTtdCanvas')) {
    var ttdDataUrl = ttdCanvas.toDataURL('image/png');
    var ttdBase64 = ttdDataUrl.split(',')[1];
    uploadsPending++;
    callApi('uploadTxFile', [
      ttdBase64,
      'image/png',
      'TTD_USER_' + Date.now() + '.png',
      'ttdUser'
    ], function(up) {
        if (up.success) data.ttdUser = up.fileName; uploadsPending--; if (!uploadsPending) doSubmit();
      }, null);
  }
  if (!uploadsPending) doSubmit();
}

function openDetailTransaksi(id) {
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              renderDetailTransaksi(tx);
              openModal('modalDetail');
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat detail');
      }
    );
}

function openDetailSupplier(rowNum) {
  var s = allSuppliers.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var nama    = s['NAMA SUPPLIER']  || s['Nama Supplier'] || '-';
  var wa      = s['NO WHATSAPP']    || s['No WhatsApp']   || '-';
  var email   = s['EMAIL']          || s['Email']         || '-';
  var alamat  = s['ALAMAT TOKO']    || s['Alamat']        || '-';
  var status  = s['STATUS']         || s['Status']        || '-';
  var statusBadge = status === 'Aktif' ? 'badge-green' : status === 'Suspend' ? 'badge-red' : 'badge-amber';
  var html =
    '<div class="info-card">' +
      infoRow('Nama Supplier', '<strong style="font-size:15px;color:var(--slate-800);">' + esc(nama) + '</strong>') +
      infoRow('No WhatsApp', wa !== '-'
        ? '<a href="https://wa.me/' + esc(wa.replace(/[^0-9]/g,'')) + '" target="_blank" style="color:var(--emerald);font-weight:600;"><i class="fab fa-whatsapp"></i> ' + esc(wa) + '</a>'
        : '-') +
      infoRow('Email', esc(email)) +
      infoRow('Alamat Toko', esc(alamat)) +
      infoRow('Status', '<span class="badge ' + statusBadge + '">' + esc(status) + '</span>') +
    '</div>';
  $('detailBody').innerHTML = '<div style="margin-bottom:8px;"><div class="detail-section-title"><i class="fas fa-truck" style="margin-right:6px;"></i>Informasi Supplier</div></div>' + html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-truck" style="color:var(--primary);margin-right:8px;"></i>Detail Supplier';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data supplier';
  openModal('modalDetail');
}

function renderDetailTransaksi(tx) {
  resetDetailModalFooter();
  var isLengkap = tx.statusDokumen && tx.statusDokumen.indexOf('Lengkap') > -1 && tx.statusDokumen.indexOf('Tidak') === -1;
  var docsHtml = '';
  docsHtml += renderFilePreview(tx.fileBukti, 'Bukti Transaksi', 'fa-camera');
  docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');
  docsHtml += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature');
  docsHtml += renderFilePreview(tx.fileTtdVerif, 'TTD Verifikator', 'fa-shield-alt');

  $('detailBody').innerHTML =
    '<div style="margin-bottom:20px;">' +
      '<div class="detail-section-title"><i class="fas fa-info-circle" style="margin-right:6px;"></i>Informasi Umum</div>' +
      '<div class="info-card">' +
        infoRow('ID', '<span style="font-family:monospace;font-size:11px;">' + esc(tx.id) + '</span>') +
        infoRow('Kode', esc(tx.kode || '-')) +
        infoRow('Tanggal', esc(tx.tanggal || '-')) +
        infoRow('Kategori', '<span class="badge ' + (tx.kategori === 'PENGELUARAN' ? 'badge-red' : 'badge-green') + '">' + esc(tx.kategori) + '</span>') +
        infoRow('Jenis', esc(tx.jenisKategori || '-')) +
        infoRow('SPPG', '<span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span>') +
        infoRow('Item', '<strong style="font-size:14px;color:var(--slate-800);">' + esc(tx.item || '-') + '</strong>') +
        infoRow('Nominal', '<strong style="font-size:18px;">' + formatRupiah(tx.nominal) + '</strong>') +
        infoRow('Metode', getMetodeBadge(tx.metodeTransaksi)) +
        (tx.catatan && tx.catatan !== '-' ? infoRow('Catatan', '<span style="color:var(--slate-600);font-style:italic;">' + esc(tx.catatan) + '</span>') : '') +
      '</div></div>' +
    '<div style="margin-bottom:20px;">' +
      '<div class="detail-section-title"><i class="fas fa-clipboard-check" style="margin-right:6px;"></i>Status Dokumen</div>' +
      '<div class="detail-doc-item ' + (isLengkap ? 'doc-ok' : 'doc-missing') + '">' +
        '<div class="detail-doc-icon"><i class="fas ' + (isLengkap ? 'fa-check' : 'fa-exclamation-triangle') + '"></i></div>' +
        '<div><div class="detail-doc-label">Status</div><div class="detail-doc-status">' + esc(tx.statusDokumen || 'Belum dicek') + '</div></div>' +
      '</div></div>' +
    docsHtml +
    '<div style="margin-bottom:10px;">' +
      '<div class="detail-section-title"><i class="fas fa-user" style="margin-right:6px;"></i>Penginput & Approval</div>' +
      '<div class="info-card" style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-color:#bae6fd;">' +
        infoRow('Penginput', esc(tx.user || '-')) +
        infoRow('Approved By', esc(tx.approvedBy || '-')) +
        infoRow('Waktu Approve', esc(tx.waktuApprove || '-')) +
        (tx.catatanApproval ? infoRow('Catatan Approval', '<span style="color:var(--amber);font-weight:600;">' + esc(tx.catatanApproval) + '</span>') : '') +
      '</div></div>';
}

function infoRow(label, value) {
  return '<div class="info-row"><span class="info-label">' + esc(label) + '</span><span class="info-value">' + value + '</span></div>';
}

// Kembalikan footer modalDetail ke kondisi default (tombol "Tutup" saja).
// Dipanggil oleh setiap fungsi openDetailXxx() sebelum mengisi konten baru,
// supaya footer custom dari alur lain (mis. WA Reminder) tidak nyangkut.
function resetDetailModalFooter() {
  var modal = $('modalDetail');
  if (!modal) return;
  var footer = modal.querySelector('.modal-footer');
  if (footer) footer.innerHTML = '<button onclick="closeModal(\'modalDetail\')" class="btn btn-outline">Tutup</button>';
}

function renderFilePreview(fileInfo, title, iconClass) {
  if (!fileInfo) {
    return '<div style="margin-bottom:16px;">' +
      '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
      '<div class="detail-doc-item doc-missing">' +
        '<div class="detail-doc-icon"><i class="fas fa-times"></i></div>' +
        '<div><div class="detail-doc-label">' + esc(title) + '</div><div class="detail-doc-status">Belum diupload</div></div>' +
      '</div></div>';
  }
  var url = fileInfo.signedUrl || fileInfo.previewUrl || fileInfo.viewUrl || '';
  var thumbUrl = fileInfo.signedThumbnailUrl || url;
  var isImage = fileInfo.mimeType && fileInfo.mimeType.indexOf('image') > -1;
  var isPdf = fileInfo.mimeType === 'application/pdf';

  if (isImage && url) {
    var safeUrl = esc(url);
    var safeThumb = esc(thumbUrl);
    return '<div style="margin-bottom:16px;">' +
      '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
      '<img src="' + safeThumb + '" class="img-preview" style="cursor:pointer;max-height:200px;border-radius:8px;object-fit:cover;" onclick="openLightbox(\'' + safeUrl + '\')" alt="' + esc(title) + '" loading="lazy">' +
      '</div>';
  }

  // Non-gambar (PDF, dsb): tampilkan sebagai kartu file yang bisa diklik,
  // bukan link teks polos — tetap terlihat jelas jenis filenya.
  var fileIcon = isPdf ? 'fa-file-pdf' : 'fa-file';
  var fileLabel = isPdf ? 'Dokumen PDF' : (fileInfo.name || 'File');
  var clickAction = isPdf
    ? 'openLightbox(\'' + esc(url) + '\')'
    : 'window.open(\'' + esc(url) + '\', \'_blank\')';
  return '<div style="margin-bottom:16px;">' +
    '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
    '<div class="detail-doc-item" style="cursor:pointer;" onclick="' + clickAction + '">' +
      '<div class="detail-doc-icon"><i class="fas ' + fileIcon + '"></i></div>' +
      '<div><div class="detail-doc-label">' + esc(fileLabel) + '</div><div class="detail-doc-status" style="color:var(--primary);">' + esc(fileInfo.name || '') + '</div></div>' +
    '</div></div>';
}

// ============================================================
// 11. APPROVAL
// ============================================================

/* ============================================================
     APPROVAL & PAYMENT VERIFICATION
     ============================================================ */
function loadApprovalData() {
  showLoading(true);
  // R3: Tampilkan skeleton placeholder
  var tbody = $('approvalTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="skeleton-screen" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div></div>' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div></div>' +
      '</div></td></tr>';
  }
  selectedApprovalIds.clear();
  loadUploadBuktiMode();
  var filters = {
    callerRole: currentUser.role,
    callerUser: currentUser.role === 'ADMIN' ? '' : currentUser.email
  };
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
    callApi('getTransactions', [filters], function(data) {
        showLoading(false);
              if (!data || !Array.isArray(data)) {
                showToast('error', 'Gagal', 'Data approval tidak valid.');
                allTransactions = [];
                populateApprovalFilters();
                filterApproval();
                return;
              }
              allTransactions = data;
              populateApprovalFilters();
              filterApproval();
      },
      function(err) {
        showLoading(false);
              showToast('error', 'Gagal', 'Tidak dapat memuat data approval.');
              populateApprovalFilters();
              filterApproval();
      }
    );
}

function renderApprovalTable() {
  var approvalData = filteredApprovalData;
  var tbody = $('approvalTableBody');
  if (!approvalData.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-check-circle"></i></div><h4>Semua Lunas!</h4><p>Tidak ada transaksi yang menunggu approval.</p></div></td></tr>'; $('approvalPagination').innerHTML = ''; updateApprovalBulkBar(); return; }
  var totalPages = Math.ceil(approvalData.length / ITEMS_PER_PAGE);
  if (approvalPage > totalPages) approvalPage = totalPages;
  var start = (approvalPage - 1) * ITEMS_PER_PAGE;
  var pageData = approvalData.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  var isAdmin = currentUser && currentUser.role === 'ADMIN';
  // R2: Status class mapping untuk left border indicator
  function getStatusRowClass(metode) {
    var m = String(metode || '').trim().toUpperCase();
    if (m === 'BELUM_BAYAR') return 'status-belum-bayar';
    if (m === 'MENUNGGU_VERIFIKASI') return 'status-menunggu-verifikasi';
    if (m === 'BELUM_LUNAS') return 'status-belum-lunas';
    if (m === 'TRANSFER') return 'status-transfer';
    if (m === 'CASH') return 'status-cash';
    return '';
  }
  pageData.forEach(function(tx, idx) {
    var no = start + idx + 1;
    var isChecked = selectedApprovalIds.has(tx.id);
    var statusClass = getStatusRowClass(tx.metodeTransaksi);
    html += '<tr data-id="' + esc(tx.id) + '" class="' + esc(statusClass) + '">' +
      '<td style="text-align:center;">' +
        (isAdmin ? '<input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onchange="toggleApprovalSelect(this)" ' + (isChecked ? 'checked' : '') + '>' : '') +
      '</td>' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + no + '</td>' +
      '<td><strong style="color:var(--slate-800);font-size:12px;">' + esc(tx.kode || '-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal || '-') + '</td>' +
      '<td><span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span></td>' +
      '<td><strong style="color:var(--slate-700);">' + esc(tx.item || '-') + '</strong></td>' +
      '<td><strong style="color:var(--slate-800);">' + formatRupiah(tx.nominal) + '</strong></td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td>' + esc(tx.user || '-') + '</td>' +
      '<td style="max-width:160px;"><span style="color:var(--slate-500);font-size:12px;font-style:italic;">' + esc(tx.catatan && tx.catatan !== '-' ? tx.catatan : '-') + '</span></td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailTransaksi(\'' + esc(tx.id) + '\')" title="Detail"><i class="fas fa-eye"></i></button>' +
          (isAdmin
            ? (String(tx.metodeTransaksi||'').toUpperCase() === 'MENUNGGU_VERIFIKASI'
                ? '<button class="action-btn approve" onclick="openVerifikasiModal(\'' + esc(tx.id) + '\')" title="Verifikasi & TTD"><i class="fas fa-stamp"></i></button>'
                : '<button class="action-btn approve" onclick="openApprovalModal(\'' + esc(tx.id) + '\')" title="Approve"><i class="fas fa-check"></i></button>')
            : (uploadBuktiModeEnabled && tx.user === currentUser.email && ['BELUM_BAYAR','BELUM_LUNAS'].indexOf(String(tx.metodeTransaksi||'').toUpperCase()) > -1
                ? '<button class="action-btn edit" onclick="openUserBuktiModal(\'' + esc(tx.id) + '\')" title="Kirim Bukti Pembayaran"><i class="fas fa-upload"></i></button>'
                : '')) +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('approvalPagination', approvalPage, totalPages, 'goApprovalPage');

  var selAll = $('apprSelectAll');
  if (selAll) {
    selAll.checked = approvalData.length > 0 && approvalData.every(function(tx) { return selectedApprovalIds.has(tx.id); });
  }
  updateApprovalBulkBar();
}
function goApprovalPage(p) { approvalPage = p; renderApprovalTable(); }

// ===== CEKLIS / BULK ACTION APPROVAL =====
function toggleApprovalSelect(checkbox) {
  var id = checkbox.getAttribute('data-id');
  if (checkbox.checked) selectedApprovalIds.add(id);
  else selectedApprovalIds.delete(id);
  var selAll = $('apprSelectAll');
  if (selAll) {
    selAll.checked = filteredApprovalData.length > 0 && filteredApprovalData.every(function(tx) { return selectedApprovalIds.has(tx.id); });
  }
  updateApprovalBulkBar();
}

function toggleSelectAllApproval(checkbox) {
  if (checkbox.checked) {
    filteredApprovalData.forEach(function(tx) { selectedApprovalIds.add(tx.id); });
  } else {
    filteredApprovalData.forEach(function(tx) { selectedApprovalIds.delete(tx.id); });
  }
  renderApprovalTable();
}

function clearApprovalSelection() {
  selectedApprovalIds.clear();
  renderApprovalTable();
}

function updateApprovalBulkBar() {
  var bar = $('apprBulkBar');
  if (!bar) return;
  var count = selectedApprovalIds.size;
  if (count > 0) {
    bar.classList.remove('hidden');
    var countEl = $('apprBulkCount');
    if (countEl) countEl.textContent = count;
  } else {
    bar.classList.add('hidden');
  }
}

function openBulkApprovalPin() {
  if (!selectedApprovalIds.size) { showToast('warning', 'Perhatian', 'Pilih minimal satu transaksi.'); return; }
  bulkApprovalMode = true;
  document.querySelectorAll('.pin-input').forEach(function(p) { p.value = ''; });
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function submitBulkApproval(pin) {
  var ids = Array.from(selectedApprovalIds);
  if (!ids.length) return;
  showLoading(true);
  var total = ids.length;
  var done = 0, success = 0, failed = 0;
  var pinRejectedCount = 0;
  var approvedByName = currentUser ? (currentUser.namaLengkap || currentUser.username) : 'Admin';

  function next() {
    if (done >= total) {
      showLoading(false);
      selectedApprovalIds.clear();
      if (pinRejectedCount > 0 && success === 0) {
        // Semua gagal karena PIN salah — beri tahu spesifik & buka ulang modal PIN
        showToast('error', 'PIN Salah', 'Bulk approve dibatalkan, PIN tidak valid.');
      } else {
        showToast(failed ? 'warning' : 'success', 'Bulk Approve Selesai',
          success + ' berhasil, ' + failed + ' gagal dari ' + total + ' transaksi.');
      }
      loadTransactions();
      loadDashboardData();
      loadApprovalData();
      return;
    }
    var id = ids[done];
    callApi('approveTransaction', [
      { id: id, approvalPin: pin, approvedBy: approvedByName, ttdBase64: '', catatanApproval: '' }
    ], function(result) {
        if (result && result.success) {
                  success++;
                } else {
                  failed++;
                  if (result && result.message && result.message.toLowerCase().indexOf('pin') > -1) pinRejectedCount++;
                }
                done++;
                next();
      },
      function(err) {
        failed++; done++; next();
      }
    );
  }
  next();
}

function printSelectedApprovalData() {
  if (!selectedApprovalIds.size) { showToast('warning', 'Perhatian', 'Pilih minimal satu transaksi untuk dicetak.'); return; }
  var data = filteredApprovalData.filter(function(tx) { return selectedApprovalIds.has(tx.id); });
  if (!data.length) { showToast('warning', 'Perhatian', 'Tidak ada data terpilih.'); return; }

  var metodeSummary = {};
  var grandTotal = 0;
  var grandCount = 0;
  data.forEach(function(tx) {
    var m = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var label = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    if (!metodeSummary[label]) metodeSummary[label] = { count: 0, total: 0 };
    metodeSummary[label].count++;
    metodeSummary[label].total += parseFloat(tx.nominal) || 0;
    grandTotal += parseFloat(tx.nominal) || 0;
    grandCount++;
  });

  exportApprovalPDF(data, metodeSummary, grandTotal, grandCount, 'Approval (Terpilih)');
}

function populateApprovalFilters() {
  var base = allTransactions.filter(function(t) {
    var metode = String(t.metodeTransaksi || '').trim().toUpperCase();
    return metode !== 'SUDAH_DIBAYAR' && t.kategori === 'PENGELUARAN';
  });
  var sppgSet = {}, jenisSet = {};
  base.forEach(function(t) {
    if (t.sppg) sppgSet[t.sppg] = true;
    if (t.jenisKategori) jenisSet[t.jenisKategori] = true;
  });
  var selSppg = $('apprFilterSPPG');
  if (selSppg) {
    var prevSppg = selSppg.value || 'ALL';
    var html = '<option value="ALL">Semua SPPG</option>';
    Object.keys(sppgSet).sort().forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    selSppg.innerHTML = html;
    if (Object.keys(sppgSet).indexOf(prevSppg) > -1 || prevSppg === 'ALL') selSppg.value = prevSppg;
  }
  var selJenis = $('apprFilterJenisKat');
  if (selJenis) {
    var prevJenis = selJenis.value || 'ALL';
    var html2 = '<option value="ALL">Semua Jenis Kategori</option>';
    Object.keys(jenisSet).sort().forEach(function(s) { html2 += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    selJenis.innerHTML = html2;
    if (Object.keys(jenisSet).indexOf(prevJenis) > -1 || prevJenis === 'ALL') selJenis.value = prevJenis;
  }
}

function filterApproval() {
  var search = $('apprSearchInput') ? $('apprSearchInput').value.toLowerCase().trim() : '';
  var sppg = $('apprFilterSPPG') ? $('apprFilterSPPG').value : 'ALL';
  var jenisKat = $('apprFilterJenisKat') ? $('apprFilterJenisKat').value : 'ALL';
  var dateStart = $('apprFilterTglStart') ? $('apprFilterTglStart').value : '';
  var dateEnd = $('apprFilterTglEnd') ? $('apprFilterTglEnd').value : '';

  var approvalBase = allTransactions.filter(function(t) {
    var metode = String(t.metodeTransaksi || '').trim().toUpperCase();
    return metode !== 'SUDAH_DIBAYAR' && t.kategori === 'PENGELUARAN';
  });

  filteredApprovalData = approvalBase.filter(function(tx) {
    if (search) {
      var s = ((tx.kode || '') + ' ' + (tx.item || '') + ' ' + (tx.user || '') + ' ' + (tx.sppg || '')).toLowerCase();
      if (s.indexOf(search) === -1) return false;
    }
    if (sppg !== 'ALL' && tx.sppg !== sppg) return false;
    if (jenisKat !== 'ALL' && tx.jenisKategori !== jenisKat) return false;
    if (dateStart || dateEnd) {
      var parts = (tx.tanggal || '').split('/');
      if (parts.length === 3) {
        var txDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (dateStart) {
          var ds = new Date(dateStart); ds.setHours(0,0,0,0);
          if (txDate < ds) return false;
        }
        if (dateEnd) {
          var de = new Date(dateEnd); de.setHours(23,59,59,999);
          if (txDate > de) return false;
        }
      }
    }
    return true;
  });

  approvalPage = 1;
  renderApprovalTable();
}

function resetApprovalFilter() {
  if ($('apprSearchInput')) $('apprSearchInput').value = '';
  if ($('apprFilterSPPG')) $('apprFilterSPPG').value = 'ALL';
  if ($('apprFilterJenisKat')) $('apprFilterJenisKat').value = 'ALL';
  if ($('apprFilterTglStart')) $('apprFilterTglStart').value = '';
  if ($('apprFilterTglEnd')) $('apprFilterTglEnd').value = '';
  filterApproval();
}

// ============================================================
// EXPORT APPROVAL — CSV & PDF
// ============================================================
function exportApproval(format) {
  var approvalData = filteredApprovalData;
  if (!approvalData.length) {
    showToast('warning', 'Tidak Ada Data', 'Tidak ada transaksi yang menunggu approval.');
    return;
  }
  var metodeSummary = {};
  var grandTotal = 0;
  var grandCount = 0;
  approvalData.forEach(function(tx) {
    var m = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var label = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    if (!metodeSummary[label]) metodeSummary[label] = { count: 0, total: 0 };
    metodeSummary[label].count++;
    metodeSummary[label].total += parseFloat(tx.nominal) || 0;
    grandTotal += parseFloat(tx.nominal) || 0;
    grandCount++;
  });
  if (format === 'csv') {
    exportApprovalCSV(approvalData, metodeSummary, grandTotal, grandCount);
  } else {
    exportApprovalPDF(approvalData, metodeSummary, grandTotal, grandCount);
  }
}

function _approvalDocStatus(tx) {
  var ada = function(v) { return v && String(v).trim() !== '' && String(v).trim() !== '-'; };
  var bukti = ada(tx.uploadFoto) || ada(tx.uploadFile);
  var nota  = ada(tx.notaPembelian);
  var ttd   = ada(tx.ttdUser);
  return {
    bukti:  bukti ? 'Ada' : 'Tidak Ada',
    nota:   nota  ? 'Ada' : 'Tidak Ada',
    ttd:    ttd   ? 'Ada' : 'Tidak Ada',
    status: (bukti && nota && ttd) ? 'Lengkap' : 'Tidak Lengkap'
  };
}

function exportApprovalCSV(data, metodeSummary, grandTotal, grandCount) {
  var sep = ';';
  var csv = '\uFEFF';
  csv += ['"No"','"Kode Transaksi"','"Tanggal"','"SPPG"','"Item/Bahan Baku"','"Nominal (Rp)"',
          '"Metode Transaksi"','"Penginput"',
          '"Ada Bukti Transaksi"','"Ada Nota Pembelian"','"Ada TTD User"','"Status Kelengkapan"']
         .join(sep) + '\r\n';
  data.forEach(function(tx, i) {
    var doc = _approvalDocStatus(tx);
    var m   = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var mLabel = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    csv += [
      i + 1,
      '"' + esc(tx.kode || '-') + '"',
      '"' + esc(tx.tanggal || '-') + '"',
      '"' + esc(tx.sppg || '-') + '"',
      '"' + esc(tx.item || '-') + '"',
      Math.round(tx.nominal || 0),
      '"' + mLabel + '"',
      '"' + esc(tx.user || '-') + '"',
      '"' + doc.bukti + '"',
      '"' + doc.nota + '"',
      '"' + doc.ttd + '"',
      '"' + doc.status + '"'
    ].join(sep) + '\r\n';
  });
  // Hitung rekap kelengkapan
  var totalLengkap = 0, totalTdkLengkap = 0;
  var totalTanpaBukti = 0, totalTanpaNota = 0;
  var nominalLengkap = 0, nominalTdkLengkap = 0;
  var nominalTanpaBukti = 0, nominalTanpaNota = 0;
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    if (doc.status === 'Lengkap') {
      totalLengkap++; nominalLengkap += nom;
    } else {
      totalTdkLengkap++; nominalTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { totalTanpaBukti++; nominalTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { totalTanpaNota++;  nominalTanpaNota  += nom; }
    }
  });

  // Hitung rekap per SPPG
  var sppgSummary = {};
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    var sppg = String(tx.sppg || '-').trim();
    if (!sppgSummary[sppg]) sppgSummary[sppg] = { count: 0, total: 0, lengkap: 0, tdkLengkap: 0, tanpaBukti: 0, tanpaNota: 0, nomLengkap: 0, nomTdkLengkap: 0, nomTanpaBukti: 0, nomTanpaNota: 0 };
    sppgSummary[sppg].count++;
    sppgSummary[sppg].total += nom;
    if (doc.status === 'Lengkap') {
      sppgSummary[sppg].lengkap++;
      sppgSummary[sppg].nomLengkap += nom;
    } else {
      sppgSummary[sppg].tdkLengkap++;
      sppgSummary[sppg].nomTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { sppgSummary[sppg].tanpaBukti++; sppgSummary[sppg].nomTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { sppgSummary[sppg].tanpaNota++;  sppgSummary[sppg].nomTanpaNota  += nom; }
    }
  });

  csv += '\r\n';
  csv += '"=== RINGKASAN 1: KUMULATIF PER METODE TRANSAKSI ==="' + sep + sep + sep + '\r\n';
  csv += '"Metode Transaksi"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + '\r\n';
  Object.keys(metodeSummary).forEach(function(label) {
    var s = metodeSummary[label];
    csv += '"' + label + '"' + sep + s.count + sep + Math.round(s.total) + '\r\n';
  });
  csv += '"TOTAL KESELURUHAN"' + sep + grandCount + sep + Math.round(grandTotal) + '\r\n';

  csv += '\r\n';
  csv += '"=== RINGKASAN 2: STATUS KELENGKAPAN DOKUMEN ==="' + sep + sep + sep + '\r\n';
  csv += '"Status Kelengkapan"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + sep + '"Keterangan"' + '\r\n';
  csv += '"Dokumen Lengkap"'                + sep + totalLengkap    + sep + Math.round(nominalLengkap)    + sep + '"Bukti + Nota + TTD semua ada"' + '\r\n';
  csv += '"Dokumen Tidak Lengkap"'          + sep + totalTdkLengkap + sep + Math.round(nominalTdkLengkap) + sep + '"Ada dokumen yang kurang"' + '\r\n';
  csv += '"  \u2514 Tanpa Bukti Transaksi"' + sep + totalTanpaBukti + sep + Math.round(nominalTanpaBukti) + sep + '"Belum upload foto/file bukti"' + '\r\n';
  csv += '"  \u2514 Tanpa Nota Pembelian"'  + sep + totalTanpaNota  + sep + Math.round(nominalTanpaNota)  + sep + '"Belum upload nota pembelian"' + '\r\n';
  csv += '"TOTAL KESELURUHAN"'              + sep + grandCount      + sep + Math.round(grandTotal)        + sep + '"All approval pending"' + '\r\n';

  csv += '\r\n';
  csv += '"=== RINGKASAN 3: KUMULATIF PER SPPG ==="' + sep + sep + sep + sep + sep + sep + '\r\n';
  csv += '"SPPG"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + sep + '"Dok. Lengkap"' + sep + '"Nominal Lengkap"' + sep + '"Dok. Tidak Lengkap"' + sep + '"Nominal Tdk Lengkap"' + sep + '"Tanpa Bukti"' + sep + '"Nominal Tanpa Bukti"' + sep + '"Tanpa Nota"' + sep + '"Nominal Tanpa Nota"' + '\r\n';
  Object.keys(sppgSummary).sort().forEach(function(sppg) {
    var s = sppgSummary[sppg];
    csv += '"' + sppg + '"' + sep +
      s.count + sep +
      Math.round(s.total) + sep +
      s.lengkap + sep +
      Math.round(s.nomLengkap) + sep +
      s.tdkLengkap + sep +
      Math.round(s.nomTdkLengkap) + sep +
      s.tanpaBukti + sep +
      Math.round(s.nomTanpaBukti) + sep +
      s.tanpaNota + sep +
      Math.round(s.nomTanpaNota) + '\r\n';
  });
  csv += '"TOTAL"' + sep + grandCount + sep + Math.round(grandTotal) + sep + totalLengkap + sep + Math.round(nominalLengkap) + sep + totalTdkLengkap + sep + Math.round(nominalTdkLengkap) + sep + totalTanpaBukti + sep + Math.round(nominalTanpaBukti) + sep + totalTanpaNota + sep + Math.round(nominalTanpaNota) + '\r\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'Approval_Transaksi_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('success', 'Export CSV', 'File berhasil diunduh.');
}

function exportApprovalPDF(data, metodeSummary, grandTotal, grandCount, pageLabel) {
  var now = new Date();
  var tgl = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  var jam = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  var printedBy = currentUser ? (currentUser.namaLengkap + ' (' + currentUser.role + ')') : '-';
  var pageTitle = pageLabel || 'Approval Transaksi';
  var rowsHtml = '';
  data.forEach(function(tx, i) {
    var doc = _approvalDocStatus(tx);
    var m   = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var mLabel = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    var mColor = m === 'BELUM_BAYAR' ? '#be123c' : m === 'TRANSFER' ? '#1e40af' : m === 'CASH' ? '#047857' : '#334155';
    var statusColor = doc.status === 'Lengkap' ? '#047857' : '#be123c';
    var buktiColor  = doc.bukti === 'Ada' ? '#047857' : '#be123c';
    var notaColor   = doc.nota  === 'Ada' ? '#047857' : '#be123c';
    var ttdColor    = doc.ttd   === 'Ada' ? '#047857' : '#be123c';
    rowsHtml +=
      '<tr>' +
      '<td style="text-align:center;">' + (i+1) + '</td>' +
      '<td><strong>' + esc(tx.kode||'-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal||'-') + '</td>' +
      '<td>' + esc(tx.sppg||'-') + '</td>' +
      '<td>' + esc(tx.item||'-') + '</td>' +
      '<td style="text-align:right;font-weight:600;">Rp ' + Math.round(tx.nominal||0).toLocaleString('id-ID') + '</td>' +
      '<td style="color:' + mColor + ';font-weight:600;">' + mLabel + '</td>' +
      '<td>' + esc(tx.user||'-') + '</td>' +
      '<td style="text-align:center;color:' + buktiColor + ';font-weight:600;">' + doc.bukti + '</td>' +
      '<td style="text-align:center;color:' + notaColor  + ';font-weight:600;">' + doc.nota  + '</td>' +
      '<td style="text-align:center;color:' + ttdColor   + ';font-weight:600;">' + doc.ttd   + '</td>' +
      '<td style="text-align:center;color:' + statusColor + ';font-weight:600;">' + doc.status + '</td>' +
      '</tr>';
  });
  // Hitung rekap kelengkapan
  var totalLengkap = 0, totalTdkLengkap = 0;
  var totalTanpaBukti = 0, totalTanpaNota = 0;
  var nominalLengkap = 0, nominalTdkLengkap = 0;
  var nominalTanpaBukti = 0, nominalTanpaNota = 0;
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    if (doc.status === 'Lengkap') {
      totalLengkap++; nominalLengkap += nom;
    } else {
      totalTdkLengkap++; nominalTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { totalTanpaBukti++; nominalTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { totalTanpaNota++;  nominalTanpaNota  += nom; }
    }
  });

  // Hitung rekap per SPPG
  var sppgSummary = {};
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    var sppg = String(tx.sppg || '-').trim();
    if (!sppgSummary[sppg]) sppgSummary[sppg] = { count: 0, total: 0, lengkap: 0, tdkLengkap: 0, tanpaBukti: 0, tanpaNota: 0, nomLengkap: 0, nomTdkLengkap: 0, nomTanpaBukti: 0, nomTanpaNota: 0 };
    sppgSummary[sppg].count++;
    sppgSummary[sppg].total += nom;
    if (doc.status === 'Lengkap') {
      sppgSummary[sppg].lengkap++;
      sppgSummary[sppg].nomLengkap += nom;
    } else {
      sppgSummary[sppg].tdkLengkap++;
      sppgSummary[sppg].nomTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { sppgSummary[sppg].tanpaBukti++; sppgSummary[sppg].nomTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { sppgSummary[sppg].tanpaNota++;  sppgSummary[sppg].nomTanpaNota  += nom; }
    }
  });

  // Baris tabel rekap SPPG
  var sppgRows = '';
  var sppgKeys = Object.keys(sppgSummary).sort();
  sppgKeys.forEach(function(sppg, idx) {
    var s = sppgSummary[sppg];
    var bg = idx % 2 === 0 ? '' : 'background:#fafafa;';
    sppgRows +=
      '<tr style="' + bg + '">' +
      '<td style="font-weight:600;">' + esc(sppg) + '</td>' +
      '<td style="text-align:center;">' + s.count + '</td>' +
      '<td style="text-align:right;font-weight:600;">Rp ' + Math.round(s.total).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#047857;">' + s.lengkap + '</td>' +
      '<td style="text-align:right;color:#047857;">Rp ' + Math.round(s.nomLengkap).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#be123c;">' + s.tdkLengkap + '</td>' +
      '<td style="text-align:right;color:#be123c;">Rp ' + Math.round(s.nomTdkLengkap).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#92400e;">' + s.tanpaBukti + '</td>' +
      '<td style="text-align:center;color:#92400e;">' + s.tanpaNota + '</td>' +
      '</tr>';
  });
  sppgRows +=
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#047857;">' + totalLengkap + '</td>' +
    '<td style="text-align:right;color:#047857;">Rp ' + Math.round(nominalLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#be123c;">' + totalTdkLengkap + '</td>' +
    '<td style="text-align:right;color:#be123c;">Rp ' + Math.round(nominalTdkLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#92400e;">' + totalTanpaBukti + '</td>' +
    '<td style="text-align:center;color:#92400e;">' + totalTanpaNota + '</td>' +
    '</tr>';

  var summaryRows = '';
  Object.keys(metodeSummary).forEach(function(label) {
    var s = metodeSummary[label];
    summaryRows +=
      '<tr>' +
      '<td>' + label + '</td>' +
      '<td style="text-align:center;">' + s.count + '</td>' +
      '<td style="text-align:right;color:#be123c;font-weight:600;">Rp ' + Math.round(s.total).toLocaleString('id-ID') + '</td>' +
      '</tr>';
  });
  summaryRows +=
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL KESELURUHAN</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;color:#0f172a;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '</tr>';

  var kelengkapanRows =
    '<tr style="background:#f0fdf4;">' +
    '<td style="color:#047857;font-weight:600;">Dokumen Lengkap</td>' +
    '<td style="text-align:center;color:#047857;font-weight:600;">' + totalLengkap + '</td>' +
    '<td style="text-align:right;color:#047857;font-weight:600;">Rp ' + Math.round(nominalLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#64748b;font-size:9px;">Bukti + Nota + TTD semua ada</td>' +
    '</tr>' +
    '<tr style="background:#fff1f2;">' +
    '<td style="color:#be123c;font-weight:600;">Dokumen Tidak Lengkap</td>' +
    '<td style="text-align:center;color:#be123c;font-weight:600;">' + totalTdkLengkap + '</td>' +
    '<td style="text-align:right;color:#be123c;font-weight:600;">Rp ' + Math.round(nominalTdkLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#64748b;font-size:9px;">Ada dokumen yang kurang</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding-left:20px;color:#64748b;">&nbsp;&nbsp;&#x2514; Tanpa Bukti Transaksi</td>' +
    '<td style="text-align:center;color:#64748b;">' + totalTanpaBukti + '</td>' +
    '<td style="text-align:right;color:#64748b;">Rp ' + Math.round(nominalTanpaBukti).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#94a3b8;font-size:9px;">Belum upload foto/file bukti</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding-left:20px;color:#64748b;">&nbsp;&nbsp;&#x2514; Tanpa Nota Pembelian</td>' +
    '<td style="text-align:center;color:#64748b;">' + totalTanpaNota + '</td>' +
    '<td style="text-align:right;color:#64748b;">Rp ' + Math.round(nominalTanpaNota).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#94a3b8;font-size:9px;">Belum upload nota pembelian</td>' +
    '</tr>' +
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL KESELURUHAN</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;color:#0f172a;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '<td></td>' +
    '</tr>';
  var html =
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<title>Approval Transaksi</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:10px;color:#0f172a;margin:0;padding:16px;}' +
    'h2{font-size:15px;margin:0 0 2px 0;text-align:center;}' +
    '.meta{font-size:10px;color:#64748b;text-align:center;margin-bottom:14px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:18px;}' +
    'thead th{background:#f1f5f9;padding:6px 8px;text-align:left;border:1px solid #cbd5e1;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;}' +
    'tbody td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:middle;}' +
    'tbody tr:nth-child(even){background:#fafafa;}' +
    '.section-title{font-size:11px;font-weight:700;margin:0 0 6px 0;color:#334155;border-left:3px solid #10b981;padding-left:8px;}' +
    '@media print{@page{size:A4 landscape;margin:10mm;}}' +
    '</style></head><body>' +
    '<h2>Laporan ' + pageTitle + '</h2>' +
    '<div class="meta">Dicetak oleh: ' + printedBy + ' &nbsp;|&nbsp; Tanggal: ' + tgl + ' ' + jam + ' &nbsp;|&nbsp; Total: ' + grandCount + ' transaksi</div>' +
    '<table>' +
    '<thead><tr>' +
    '<th style="width:22px;">No</th>' +
    '<th>Kode</th>' +
    '<th>Tanggal</th>' +
    '<th>SPPG</th>' +
    '<th>Item / Bahan Baku</th>' +
    '<th style="text-align:right;">Nominal</th>' +
    '<th>Metode</th>' +
    '<th>Penginput</th>' +
    '<th style="text-align:center;">Bukti</th>' +
    '<th style="text-align:center;">Nota</th>' +
    '<th style="text-align:center;">TTD</th>' +
    '<th style="text-align:center;">Kelengkapan</th>' +
    '</tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 1 — Kumulatif per Metode Transaksi</p>' +
    '<table style="max-width:440px;">' +
    '<thead><tr>' +
    '<th>Metode Transaksi</th>' +
    '<th style="text-align:center;">Jumlah Transaksi</th>' +
    '<th style="text-align:right;">Total Nominal (Rp)</th>' +
    '</tr></thead>' +
    '<tbody>' + summaryRows + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 2 — Status Kelengkapan Dokumen</p>' +
    '<p style="font-size:9px;color:#64748b;margin:0 0 6px 0;">&#9432; TTD User diasumsikan selalu ada dan tidak dihitung sebagai kekurangan</p>' +
    '<table style="max-width:640px;">' +
    '<thead><tr>' +
    '<th>Status Kelengkapan</th>' +
    '<th style="text-align:center;">Jumlah</th>' +
    '<th style="text-align:right;">Total Nominal (Rp)</th>' +
    '<th>Keterangan</th>' +
    '</tr></thead>' +
    '<tbody>' + kelengkapanRows + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 3 — Kumulatif per SPPG</p>' +
    '<table style="width:100%;">' +
    '<thead><tr>' +
    '<th>SPPG</th>' +
    '<th style="text-align:center;">Total Trx</th>' +
    '<th style="text-align:right;">Total Nominal</th>' +
    '<th style="text-align:center;color:#047857;">Dok. Lengkap</th>' +
    '<th style="text-align:right;color:#047857;">Nominal Lengkap</th>' +
    '<th style="text-align:center;color:#be123c;">Dok. Tdk Lengkap</th>' +
    '<th style="text-align:right;color:#be123c;">Nominal Tdk Lengkap</th>' +
    '<th style="text-align:center;color:#92400e;">Tanpa Bukti</th>' +
    '<th style="text-align:center;color:#92400e;">Tanpa Nota</th>' +
    '</tr></thead>' +
    '<tbody>' + sppgRows + '</tbody>' +
    '</table>' +
    '</body></html>';
  var win = window.open('', '_blank');
  if (!win) {
    showToast('error', 'Gagal', 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = function() { win.print(); };
  showToast('success', 'Export PDF', 'Jendela cetak/simpan PDF telah dibuka.');
}

function openApprovalModal(id) {
  currentTrxId = id;
  approvalFileData = null;
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              renderApprovalForm(tx);
              openModal('modalApproval');
              setTimeout(initApprovalCanvas, 100);
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat data');
      }
    );
}

function renderApprovalForm(tx) {
  var docsPreview = '';
  docsPreview += renderFilePreview(tx.fileBukti, 'Bukti Transaksi', 'fa-camera');
  docsPreview += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');
  docsPreview += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature');

  $('approvalBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-color:#86efac;">' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Transaksi</span><span class="info-value">' + esc(tx.kode || '-') + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Item</span><span class="info-value" style="font-size:14px;">' + esc(tx.item || '-') + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Nominal</span><span class="info-value" style="font-size:18px;color:#047857;">' + formatRupiah(tx.nominal) + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Status Dokumen</span><span>' + getStatusDokumenBadge(tx.statusDokumen) + '</span></div>' +
    '</div>' +
    '<div style="margin-bottom:20px;">' + docsPreview + '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nominal yang Harus Dibayar</label>' +
      '<input type="text" class="form-input" value="' + esc(formatRupiah(tx.nominal)) + '" readonly>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Upload Bukti Pembayaran (Foto / File)</label>' +
      '<input type="file" id="approvalFileInput" class="form-input" accept="image/*,.pdf" capture="environment" onchange="handleApprovalFile(this)">' +
      '<p class="form-hint"><i class="fas fa-info-circle"></i> Di HP akan langsung membuka kamera. Di desktop akan membuka file browser.</p>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Catatan Approval (Opsional)</label>' +
      '<textarea id="approvalCatatan" class="form-input" placeholder="Catatan untuk user..."></textarea>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Tanda Tangan Digital Verifikator</label>' +
      '<div class="canvas-container" id="approvalTtdWrap"><canvas id="approvalTtdCanvas"></canvas></div>' +
      '<div class="canvas-actions">' +
        '<button type="button" onclick="clearApprovalCanvas()"><i class="fas fa-eraser"></i> Hapus</button>' +
      '</div>' +
    '</div>';
}

function getStatusDokumenBadge(status) {
  if (!status) return '<span class="badge badge-slate">-</span>';
  if (status.indexOf('Lengkap') > -1 && status.indexOf('Tidak') === -1)
    return '<span class="badge badge-green"><i class="fas fa-check" style="font-size:8px"></i> Lengkap</span>';
  return '<span class="badge badge-red"><i class="fas fa-times" style="font-size:8px"></i> Tidak Lengkap</span>';
}

// initApprovalCanvas & clearApprovalCanvas sudah didefinisikan
// di sistem TTD terpusat di atas — tidak perlu duplikasi di sini.

function handleApprovalFile(input) {
  var file = input.files[0];
  if (file) {
    var r = new FileReader();
    r.onload = function(e) { approvalFileData = { base64: e.target.result.split(',')[1], mimeType: file.type, fileName: file.name }; };
    r.readAsDataURL(file);
  }
}

function preSubmitApproval() {
  // Show PIN modal
  document.querySelectorAll('.pin-input').forEach(function(p) { p.value = ''; });
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function submitApprovalWithPin() {
  var pin = Array.from(document.querySelectorAll('.pin-input')).map(function(p) { return p.value; }).join('');
  var pinErrorEl = $('pinError');

  if (pin.length !== 6) { pinErrorEl.style.display = 'block'; return; }

  // PIN TIDAK divalidasi di client. PIN dikirim ke server (approveTransaction / submitBulkApproval)
  // dan server yang menentukan benar/salah. Ini mencegah PIN ter-expose di DevTools/View Source.
  closeModal('modalPin');

  if (verifikasiPembayaranMode) {
    verifikasiPembayaranMode = false;
    verifPinTemp = pin;
    doSubmitVerifikasiPembayaran();
    return;
  }

  if (bulkApprovalMode) {
    bulkApprovalMode = false;
    submitBulkApproval(pin);
    return;
  }

  closeModal('modalApproval');
  showLoading(true);

  var ttdCanvas = $('approvalTtdCanvas');
  var ttdBase64 = (ttdCanvas && !isCanvasBlank('approvalTtdCanvas'))
    ? ttdCanvas.toDataURL('image/png').split(',')[1]
    : '';

  var data = {
    id: currentTrxId,
    approvalPin: pin,
    approvedBy: currentUser ? currentUser.namaLengkap || currentUser.username : 'Admin',
    ttdBase64: ttdBase64,
    catatanApproval: $('approvalCatatan') ? $('approvalCatatan').value : ''
  };
  if (approvalFileData) {
    data.buktiBase64 = approvalFileData.base64;
    data.buktiMimeType = approvalFileData.mimeType;
    data.buktiFileName = approvalFileData.fileName;
  }

    callApi('approveTransaction', [data], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Sukses', result.message);
                loadTransactions();
                loadDashboardData();
              } else {
                // PIN salah atau gagal lain dari server — buka kembali modal PIN agar user bisa coba lagi
                showToast('error', 'Gagal', result.message);
                if (result.message && result.message.toLowerCase().indexOf('pin') > -1) {
                  document.querySelectorAll('.pin-input').forEach(function(p) { p.value = ''; });
                  openModal('modalPin');
                  var firstPin = document.querySelector('.pin-input[data-index="0"]');
                  if (firstPin) setTimeout(function(){ firstPin.focus(); }, 200);
                }
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

function handlePinInput(input, e) {
  var val = input.value;
  if (val.length >= 1) {
    var idx = parseInt(input.getAttribute('data-index'));
    var next = document.querySelector('.pin-input[data-index="' + (idx + 1) + '"]');
    if (next) next.focus();
  }
  if (e.inputType === 'deleteContentBackward') {
    var idx = parseInt(input.getAttribute('data-index'));
    var prev = document.querySelector('.pin-input[data-index="' + (idx - 1) + '"]');
    if (prev) prev.focus();
  }
}

// ===== MODE UPLOAD BUKTI MANDIRI (ON/OFF) =====
function loadUploadBuktiMode() {
    callApi('getUploadBuktiMode', [], function(result) {
        uploadBuktiModeEnabled = !!(result && result.enabled);
              renderModeToggleUI();
              if (currentPage === 'approval') renderApprovalTable();
      },
      function(err) {
        uploadBuktiModeEnabled = false; renderModeToggleUI();
      }
    );
}

function renderModeToggleUI() {
  var wrap = $('apprModeToggleWrap');
  if (!wrap) return;
  if (currentUser && currentUser.role === 'ADMIN') {
    wrap.classList.remove('hidden');
    var sw = $('apprModeToggleSwitch');
    var lbl = $('apprModeToggleLabel');
    if (sw) sw.classList.toggle('active', uploadBuktiModeEnabled);
    if (lbl) lbl.textContent = uploadBuktiModeEnabled ? 'Upload Mandiri: ON' : 'Upload Mandiri: OFF';
  } else {
    wrap.classList.add('hidden');
  }
}

function toggleUploadBuktiMode() {
  if (!currentUser || currentUser.role !== 'ADMIN') return;
  var newState = !uploadBuktiModeEnabled;
  var confirmMsg = newState
    ? 'Aktifkan mode upload bukti mandiri? User pemilik transaksi akan bisa mengupload bukti pembayarannya sendiri.'
    : 'Nonaktifkan mode upload bukti mandiri? User tidak akan bisa lagi mengupload bukti pembayaran sendiri.';
  if (!confirm(confirmMsg)) return;
  showLoading(true);
    callApi('setUploadBuktiMode', [newState], function(result) {
        showLoading(false);
              if (result.success) {
                uploadBuktiModeEnabled = result.enabled;
                renderModeToggleUI();
                showToast('success', 'Mode Diperbarui', uploadBuktiModeEnabled ? 'Upload bukti mandiri diaktifkan.' : 'Upload bukti mandiri dinonaktifkan.');
                renderApprovalTable();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ===== USER KIRIM BUKTI PEMBAYARAN MANDIRI =====
function openUserBuktiModal(id) {
  var tx = allTransactions.find(function(t) { return t.id === id; }) ||
           filteredApprovalData.find(function(t) { return t.id === id; });
  if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
  currentUserBuktiTxId = id;
  userBuktiFileData = null;
  var sudahDibayar = parseFloat(tx.nominalDibayar) || 0;
  var sisaBayar = Math.max(0, (parseFloat(tx.nominal) || 0) - sudahDibayar);
  $('userBuktiBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-color:#bae6fd;">' +
      infoRow('Transaksi', esc(tx.kode || '-')) +
      infoRow('Item', esc(tx.item || '-')) +
      infoRow('Nominal Total', '<strong style="font-size:16px;">' + formatRupiah(tx.nominal) + '</strong>') +
      (sudahDibayar > 0 ? infoRow('Sudah Dibayar Sebelumnya', formatRupiah(sudahDibayar)) : '') +
      infoRow('Sisa yang Harus Dibayar', '<strong style="color:var(--rose);font-size:16px;">' + formatRupiah(sisaBayar) + '</strong>') +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nominal yang Dibayarkan <span class="req">*</span></label>' +
      '<input type="number" id="userBuktiNominal" class="form-input" placeholder="0" value="' + sisaBayar + '">' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="$(\'userBuktiNominal\').value=' + sisaBayar + ';">' +
          '<i class="fas fa-coins"></i> Bayar Penuh (' + formatRupiah(sisaBayar) + ')' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Upload Bukti Pembayaran <span class="req">*</span></label>' +
      '<div class="file-input-wrap">' +
        '<input type="file" id="userBuktiFile" accept="image/*,.pdf" onchange="handleUserBuktiFile(this)">' +
        '<div class="file-input-label" id="labelUserBukti"><i class="fas fa-receipt"></i><span>Pilih bukti pembayaran</span></div>' +
      '</div>' +
    '</div>';
  openModal('modalUserBukti');
}

function handleUserBuktiFile(input) {
  var file = input.files[0];
  if (!file) return;
  var label = $('labelUserBukti');
  if (label) label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + esc(file.name) + '</span>';
  var r = new FileReader();
  r.onload = function(e) {
    userBuktiFileData = { base64: e.target.result.split(',')[1], mimeType: file.type, fileName: file.name };
  };
  r.readAsDataURL(file);
}

function submitUserBukti() {
  var nominal = parseFloat($('userBuktiNominal').value) || 0;
  if (!nominal || nominal <= 0) { showToast('error', 'Validasi', 'Nominal yang dibayarkan wajib diisi'); return; }
  if (!userBuktiFileData) { showToast('error', 'Validasi', 'Bukti pembayaran wajib diupload'); return; }

  showLoading(true);
    callApi('submitUserBuktiPembayaran', [
      {       txId: currentUserBuktiTxId,       nominalDibayar: nominal,       buktiBase64: userBuktiFileData.base64,       buktiMimeType: userBuktiFileData.mimeType,       buktiFileName: userBuktiFileData.fileName     }
    ], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Terkirim', result.message);
                closeModal('modalUserBukti');
                loadApprovalData();
                loadTransactions();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ===== ADMIN VERIFIKASI PEMBAYARAN MANDIRI USER =====
function openVerifikasiModal(id) {
  currentVerifikasiTxId = id;
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              renderVerifikasiForm(tx);
              openModal('modalVerifikasiPembayaran');
              setTimeout(function() { initTtdCanvas('verifTtdCanvas'); }, 100);
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat data');
      }
    );
}

function renderVerifikasiForm(tx) {
  var buktiPreviewHtml = renderFilePreview(tx.fileBuktiUser, 'Bukti Pembayaran dari User', 'fa-receipt');

  $('verifikasiBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#fefce8 0%,#fef9c3 100%);border-color:#fde68a;">' +
      infoRow('Transaksi', esc(tx.kode || '-')) +
      infoRow('Item', esc(tx.item || '-')) +
      infoRow('Nominal Total', '<strong>' + formatRupiah(tx.nominal) + '</strong>') +
      infoRow('Nominal Dibayarkan User', '<strong style="color:var(--emerald);">' + formatRupiah(tx.nominalDibayar) + '</strong>') +
      infoRow('Dikirim oleh', esc(tx.submittedByUser || tx.user || '-')) +
      infoRow('Waktu Kirim', esc(tx.submittedAt || '-')) +
    '</div>' +
    buktiPreviewHtml +
    '<div class="form-group">' +
      '<label class="form-label">Catatan (Opsional)</label>' +
      '<textarea id="verifCatatan" class="form-input" placeholder="Catatan verifikasi..."></textarea>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Tanda Tangan Digital Verifikator <span class="req">*</span></label>' +
      '<div class="canvas-container" id="verifTtdWrap"><canvas id="verifTtdCanvas"></canvas></div>' +
      '<div class="canvas-actions">' +
        '<button type="button" onclick="clearTtdCanvas(\'verifTtdCanvas\')"><i class="fas fa-eraser"></i> Hapus</button>' +
      '</div>' +
    '</div>';
}

var verifPinTemp = '';

function submitVerifikasiPembayaran() {
  var ttdCanvas = $('verifTtdCanvas');
  if (!ttdCanvas || isCanvasBlank('verifTtdCanvas')) {
    showToast('error', 'Validasi', 'Tanda tangan verifikator wajib diisi'); return;
  }
  // Simpan catatan sementara karena modal approval akan ditutup, lalu modal PIN dibuka
  verifCatatanTemp = $('verifCatatan') ? $('verifCatatan').value : '';
  verifikasiPembayaranMode = true;
  document.querySelectorAll('.pin-input').forEach(function(p) { p.value = ''; });
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function doSubmitVerifikasiPembayaran() {
  var ttdCanvas = $('verifTtdCanvas');
  if (!ttdCanvas || isCanvasBlank('verifTtdCanvas')) {
    showToast('error', 'Validasi', 'Tanda tangan verifikator wajib diisi'); return;
  }
  var ttdBase64 = ttdCanvas.toDataURL('image/png').split(',')[1];
  closeModal('modalVerifikasiPembayaran');
  showLoading(true);
    callApi('verifyUserPayment', [
      {       txId: currentVerifikasiTxId,       approvalPin: verifPinTemp,       ttdBase64: ttdBase64,       catatanApproval: verifCatatanTemp,       approvedBy: currentUser ? (currentUser.namaLengkap || currentUser.username) : 'Admin'     }
    ], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Sukses', result.message);
                loadApprovalData();
                loadTransactions();
                loadDashboardData();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 12. MASTER BAHAN BAKU
// ============================================================

/* ============================================================
     MASTER DATA - BAHAN BAKU
     ============================================================ */
function loadMasterBB() {
  showLoading(true);
    callApi('getMasterBahanBaku', [], function(result) {
        showLoading(false);
              if (result.success) {
                allMasterBB = result.data || [];
                filteredMasterBB = allMasterBB.slice();
                bbPage = 1;
                renderMasterBBTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data');
      }
    );
}
function renderMasterBBTable() {
  var tbody = $('masterBBTableBody');
  if (!filteredMasterBB.length) {
    var canAddBB = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'AKUNTAN');
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-boxes"></i></div><h4>Tidak Ada Data</h4><p>Belum ada bahan baku yang terdaftar.</p>' +
      (canAddBB ? '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openAddMasterBBModal()"><i class="fas fa-plus"></i> Tambah Bahan Baku Pertama</button>' : '') +
      '</div></td></tr>';
    $('bbPagination').innerHTML = ''; return;
  }
  var totalPages = Math.ceil(filteredMasterBB.length / ITEMS_PER_PAGE);
  if (bbPage > totalPages) bbPage = totalPages;
  var start = (bbPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredMasterBB.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  var canEdit = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'AKUNTAN');
  pageData.forEach(function(b, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(b['KODE BAHAN'] || b['Kode Bahan'] || '-') + '</strong></td>' +
      '<td><span class="badge badge-outline">' + esc(b['KATEGORI BAHAN BAKU'] || b['Kategori'] || '-') + '</span></td>' +
      '<td>' + esc(b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '-') + '</td>' +
      '<td><strong>' + formatRupiah(b['HARGA BAHAN BAKU'] || b['Harga'] || 0) + '</strong></td>' +
      '<td>' + esc(b['SATUAN'] || b['Satuan'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          (canEdit ? '<button class="action-btn edit" onclick="openEditMasterBB(' + b._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn delete" onclick="confirmHapus(\'masterBB\',' + b._row + ',\'\',\'bahan baku ' + esc((b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('bbPagination', bbPage, totalPages, 'goBBPage');
}
function goBBPage(p) { bbPage = p; renderMasterBBTable(); }
function filterMasterBB() {
  var search = $('bbSearchInput').value.toLowerCase().trim();
  var kat = $('bbFilterKategori').value;
  filteredMasterBB = allMasterBB.filter(function(b) {
    var nama = b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '';
    var kode = b['KODE BAHAN'] || b['Kode Bahan'] || '';
    if (search && (nama + ' ' + kode).toLowerCase().indexOf(search) === -1) return false;
    if (kat !== 'ALL' && (b['KATEGORI BAHAN BAKU'] || b['Kategori']) !== kat) return false;
    return true;
  });
  bbPage = 1;
  renderMasterBBTable();
}
function openAddMasterBBModal() { $('addBBKode').value = ''; $('addBBKategori').value = ''; $('addBBNama').value = ''; $('addBBHarga').value = ''; $('addBBSatuan').value = 'Kg'; openModal('modalAddMasterBB'); }
function saveAddMasterBB() {
  var data = {
    KODE_BAHAN: $('addBBKode').value.trim(),
    KATEGORI_BAHAN_BAKU: $('addBBKategori').value.trim(),
    NAMA_BAHAN_BAKU: $('addBBNama').value.trim(),
    HARGA_BAHAN_BAKU: parseFloat($('addBBHarga').value) || 0,
    SATUAN: $('addBBSatuan').value,
    SUPPLIER: $('addBBSupplier').value
  };
  if (!data.KODE_BAHAN || !data.NAMA_BAHAN_BAKU) { showToast('error', 'Validasi', 'Kode dan Nama wajib diisi'); return; }
  showLoading(true);
    callApi('addMasterBahanBaku', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddMasterBB'); loadMasterBB(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
// ===== HAPUS UNIVERSAL =====
var hapusTarget = { type: '', rowNum: 0, id: '' };

function confirmHapus(type, rowNum, id, desc) {
  hapusTarget = { type: type, rowNum: rowNum, id: id };
  // Transaksi yang sudah SUDAH_DIBAYAR butuh konfirmasi lebih ketat (ketik "HAPUS")
  // karena data finansial yang sudah final lebih berisiko kalau terhapus tidak sengaja.
  var tx = (type === 'transaksi') ? allTransactions.find(function(t) { return t.id === id; }) : null;
  var isApprovedTx = tx && String(tx.metodeTransaksi || '').toUpperCase() === 'SUDAH_DIBAYAR';

  if (isApprovedTx) {
    $('hapusDesc').innerHTML = 'Transaksi <strong>' + esc(tx.kode || id) + '</strong> ini sudah <strong style="color:var(--emerald);">LUNAS/disetujui</strong>. ' +
      'Menghapusnya akan menghilangkan jejak transaksi finansial. Ketik <strong>HAPUS</strong> untuk konfirmasi:' +
      '<input type="text" id="hapusConfirmText" class="form-input" style="margin-top:10px;text-align:center;font-weight:700;letter-spacing:2px;" placeholder="Ketik HAPUS" oninput="document.getElementById(\'btnExecuteHapus\').disabled = (this.value.trim().toUpperCase() !== \'HAPUS\');">';
    $('btnExecuteHapus').disabled = true;
  } else {
    $('hapusDesc').textContent = 'Yakin hapus ' + (desc || 'data ini') + '?';
    $('btnExecuteHapus').disabled = false;
  }
  openModal('modalHapus');
}

function executeHapus() {
  closeModal('modalHapus');
  showLoading(true);
  var caller = { role: currentUser.role, user: currentUser.email };
  if (hapusTarget.type === 'masterBB') {
    callApi('deleteMasterBahanBaku', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadMasterBB();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'supplier') {
    callApi('deleteSupplier', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSuppliers();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'survei') {
    callApi('deleteSurvei', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSurvei();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'serahTerima') {
    callApi('deleteSerahTerima', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSerahTerima();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'menuMBG') {
    callApi('deleteMenuMBG', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadMenuMBG();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'transaksi') {
    callApi('deleteTransaction', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadTransactions();loadDashboardData();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'pending') {
    callApi('deletePendingPayment', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadPendingPayment();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'user') {
    callApi('deleteUser', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadUsers();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else {
    showLoading(false);
  }
}

// ===== EDIT MASTER BB =====
function openEditMasterBB(rowNum) {
  var b = allMasterBB.find(function(x){ return x._row === rowNum; });
  if (!b) return;
  $('editBBRow').value = rowNum;
  $('editBBKode').value     = b['KODE BAHAN'] || b['Kode Bahan'] || '';
  $('editBBKategori').value = b['KATEGORI BAHAN BAKU'] || b['Kategori'] || '';
  $('editBBNama').value     = b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '';
  $('editBBHarga').value    = b['HARGA BAHAN BAKU'] || b['Harga'] || 0;
  $('editBBSatuan').value   = b['SATUAN'] || b['Satuan'] || 'Kg';
  $('editBBSupplier').value = b['SUPPLIER'] || b['Supplier'] || '';
  openModal('modalEditMasterBB');
}
function saveEditMasterBB() {
  var rowNum = parseInt($('editBBRow').value);
  var fields = {
    'KODE BAHAN': $('editBBKode').value.trim(),
    'KATEGORI BAHAN BAKU': $('editBBKategori').value.trim(),
    'NAMA  BAHAN BAKU': $('editBBNama').value.trim(),
    'HARGA BAHAN BAKU': parseFloat($('editBBHarga').value) || 0,
    'SATUAN': $('editBBSatuan').value,
    'SUPPLIER': $('editBBSupplier').value.trim()
  };
  if (!fields['NAMA  BAHAN BAKU']) { showToast('error','Validasi','Nama wajib diisi'); return; }
  showLoading(true);
    callApi('updateMasterBahanBaku', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditMasterBB');loadMasterBB();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SUPPLIER =====
function openEditSupplierModal(rowNum) {
  var s = allSuppliers.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSupRow').value = rowNum;
  $('editSupNama').value      = s['NAMA SUPPLIER'] || s['Nama Supplier'] || '';
  $('editSupWAEdit').value    = s['NO WHATSAPP'] || s['No WhatsApp'] || '';
  $('editSupEmailEdit').value = s['EMAIL'] || s['Email'] || '';
  $('editSupStatusEdit').value= s['STATUS'] || s['Status'] || 'Aktif';
  $('editSupAlamatEdit').value= s['ALAMAT TOKO'] || s['Alamat'] || '';
  openModal('modalEditSupplier');
}
function saveEditSupplier() {
  var rowNum = parseInt($('editSupRow').value);
  var fields = {
    'NAMA SUPPLIER': $('editSupNama').value.trim(),
    'NO WHATSAPP':   $('editSupWAEdit').value.trim(),
    'EMAIL':         $('editSupEmailEdit').value.trim(),
    'STATUS':        $('editSupStatusEdit').value,
    'ALAMAT TOKO':   $('editSupAlamatEdit').value.trim()
  };
  if (!fields['NAMA SUPPLIER']) { showToast('error','Validasi','Nama Supplier wajib diisi'); return; }
  showLoading(true);
    callApi('updateMasterSupplier', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSupplier');loadSuppliers();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SURVEI =====
function openEditSurveiModal(rowNum) {
  var s = allSurvei.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSurveiRow').value = rowNum;
  $('editSurveiKode').value        = s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '';
  $('editSurveiNamaBB').value      = s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '';
  $('editSurveiHargaPasar').value  = s['HARGA PASAR'] || s['Harga Pasar'] || 0;
  $('editSurveiAlamatEdit').value  = s['ALAMAT SURVEI'] || s['Alamat Survei'] || '';
  openModal('modalEditSurvei');
}
function saveEditSurvei() {
  var rowNum = parseInt($('editSurveiRow').value);
  var fields = {
    'HARGA PASAR': parseFloat($('editSurveiHargaPasar').value) || 0,
    'ALAMAT SURVEI': $('editSurveiAlamatEdit').value.trim()
  };
  showLoading(true);
    callApi('updateSurvei', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSurvei');loadSurvei();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SERAH TERIMA =====
function openEditSerahTerimaModal(rowNum) {
  var s = allSerahTerima.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSTRow').value = rowNum;
  $('editSTPenerima').value = s['PENERIMA'] || s['Penerima'] || '';
  $('editSTKondisi').value  = s['KONDISI BAHAN BAKU'] || s['Kondisi'] || 'Baik';
  $('editSTCatatn').value   = s['CATATAN'] || s['Catatan'] || '';
  openModal('modalEditSerahTerima');
}
function saveEditSerahTerima() {
  var rowNum = parseInt($('editSTRow').value);
  var fields = {
    'PENERIMA': $('editSTPenerima').value.trim(),
    'KONDISI BAHAN BAKU': $('editSTKondisi').value,
    'CATATAN': $('editSTCatatn').value
  };
  if (!fields['PENERIMA']) { showToast('error','Validasi','Penerima wajib diisi'); return; }
  showLoading(true);
    callApi('updateSerahTerima', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSerahTerima');loadSerahTerima();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT MENU MBG =====
function openEditMenuMBGModal(arrayIdx) {
  var m = allMenuMBG[arrayIdx];
  if (!m) return;
  $('editMenuRow').value = arrayIdx;
  $('editMenuTanggal').value = m.tanggal ? m.tanggal.split('/').reverse().join('-') : '';
  $('editMenuKPMEdit').value = m.jumlahKpm || 0;
  $('editMenuNama').value    = m.menu || '';
  openModal('modalEditMenuMBG');
}
function saveEditMenuMBG() {
  var arrayIdx = parseInt($('editMenuRow').value);
  var m = allMenuMBG[arrayIdx];
  if (!m) return;
  var fields = {
    'JUMLAH KPM': parseInt($('editMenuKPMEdit').value) || 0,
    'MENU': $('editMenuNama').value.trim()
  };
  if (!fields['MENU']) { showToast('error', 'Validasi', 'Menu tidak boleh kosong'); return; }
  showLoading(true);
    callApi('updateMenuMBG', [
      m._row,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditMenuMBG');loadMenuMBG();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

function exportMasterBB(format) {
  if (format === 'csv') {
    downloadCSV(filteredMasterBB || [], [
      {key:'KODE BAHAN', label:'Kode Bahan'},
      {key:'KATEGORI BAHAN BAKU', label:'Kategori'},
      {key:'NAMA  BAHAN BAKU', label:'Nama Bahan Baku'},
      {key:'HARGA BAHAN BAKU', label:'Harga'},
      {key:'SATUAN', label:'Satuan'},
      {key:'SUPPLIER', label:'Supplier'}
    ], 'Master_Bahan_Baku');
  } else {
    printCurrentPage();
  }
}

// ============================================================
// 13. SUPPLIER
// ============================================================

/* ============================================================
     MASTER DATA - SUPPLIER
     ============================================================ */
function loadSuppliers(silent) {
  return new Promise(function(resolve) {
    if (!currentUser) { resolve(); return; }
    if (!silent) showLoading(true);
    callApi('getMasterSupplier', [], function(result) {
        if (!silent) showLoading(false);
                if (result.success) {
                  allSuppliers = result.data || [];
                  filteredSuppliers = allSuppliers.slice();
                  supplierPage = 1;
                  renderSupplierTable();
                }
                resolve();
      },
      function(err) {
        if (!silent) { showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data supplier'); }
                resolve();
      }
    );
  });
}
function renderSupplierTable() {
  var tbody = $('supplierTableBody');
  if (!filteredSuppliers.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-truck"></i></div><h4>Tidak Ada Supplier</h4></div></td></tr>'; $('supplierPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
  if (supplierPage > totalPages) supplierPage = totalPages;
  var start = (supplierPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredSuppliers.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    var statusBadge = s.STATUS === 'Aktif' ? 'badge-green' : s.STATUS === 'Suspend' ? 'badge-red' : 'badge-amber';
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['NAMA SUPPLIER'] || s['Nama Supplier'] || '-') + '</strong></td>' +
      '<td>' + esc(s['NO WHATSAPP'] || s['No WhatsApp'] || '-') + '</td>' +
      '<td>' + esc(s['EMAIL'] || s['Email'] || '-') + '</td>' +
      '<td>' + esc(s['ALAMAT TOKO'] || s['Alamat'] || '-') + '</td>' +
      '<td><span class="badge ' + statusBadge + '">' + esc(s['STATUS'] || s['Status'] || '-') + '</span></td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSupplier(' + (s._row || idx) + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn edit" onclick="openEditSupplierModal(' + (s._row || idx) + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn delete" onclick="confirmHapus(\'supplier\',' + (s._row || idx) + ',\'\',\'supplier ' + esc((s['NAMA SUPPLIER']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('supplierPagination', supplierPage, totalPages, 'goSupplierPage');
}

function filterSupplier() {
  var search = $('supplierSearchInput').value.toLowerCase().trim();
  var status = $('supplierFilterStatus').value;
  filteredSuppliers = allSuppliers.filter(function(s) {
    var teks = (s['NAMA SUPPLIER'] || s['Nama Supplier'] || '') + ' ' + (s['NO WHATSAPP'] || s['No WhatsApp'] || '') + ' ' + (s['EMAIL'] || s['Email'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (status !== 'ALL' && (s['STATUS'] || s['Status']) !== status) return false;
    return true;
  });
  supplierPage = 1;
  renderSupplierTable();
}

function goSupplierPage(p) { supplierPage = p; renderSupplierTable(); }
function openDetailSurvei(rowNum) {
  var s = allSurvei.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var kode      = s['KODE BAHAN BAKU']    || s['Kode Bahan Baku']    || '-';
  var waktu     = s['WAKTU SURVEI']       || s['Waktu Survei']       || '-';
  var kat       = s['KATEGORI BAHAN BAKU']|| s['Kategori']           || '-';
  var nama      = s['NAMA BAHAN BAKU']    || s['Nama Bahan Baku']    || '-';
  var hargaRAB  = s['HARGA RAB']          || s['Harga RAB']          || 0;
  var hargaPasar= s['HARGA PASAR']        || s['Harga Pasar']        || 0;
  var lokasi    = s['LOKASI SURVEI']      || s['Lokasi Survei']      || '-';
  var alamat    = s['ALAMAT SURVEI']      || s['Alamat Survei']      || '-';
  var user      = s['USER']               || s['User']               || '-';
  var selisih   = parseFloat(hargaPasar) - parseFloat(hargaRAB);
  var selisihColor = selisih > 0 ? 'var(--rose)' : 'var(--emerald)';
  var selisihText  = selisih > 0 ? '▲ ' : '▼ ';
  var mapsHtml = lokasi !== '-'
    ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lokasi) + '" target="_blank" class="detail-link"><i class="fas fa-map-marker-alt"></i> ' + esc(lokasi) + '</a>'
    : '-';
  var html =
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-boxes" style="margin-right:6px;"></i>Data Bahan Baku</div>' +
    '<div class="info-card">' +
      infoRow('Kode Bahan', '<strong style="font-family:monospace;">' + esc(kode) + '</strong>') +
      infoRow('Kategori', '<span class="badge badge-outline">' + esc(kat) + '</span>') +
      infoRow('Nama Bahan', '<strong style="font-size:14px;">' + esc(nama) + '</strong>') +
    '</div></div>' +
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-search-dollar" style="margin-right:6px;"></i>Data Survei Harga</div>' +
    '<div class="info-card">' +
      infoRow('Waktu Survei', esc(waktu)) +
      infoRow('Harga RAB (Referensi)', '<span style="font-weight:600;">' + formatRupiah(hargaRAB) + '</span>') +
      infoRow('Harga Pasar', '<strong style="font-size:16px;color:var(--rose);">' + formatRupiah(hargaPasar) + '</strong>') +
      infoRow('Selisih', '<strong style="color:' + selisihColor + ';">' + selisihText + formatRupiah(Math.abs(selisih)) + '</strong>') +
      infoRow('Alamat Survei', esc(alamat)) +
      infoRow('Lokasi GPS', mapsHtml) +
      infoRow('Surveyor', esc(user)) +
    '</div></div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-search-dollar" style="color:var(--primary);margin-right:8px;"></i>Detail Survei Harga';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data survei harga bahan baku';
  openModal('modalDetail');
}

function openDetailSerahTerima(rowNum) {
  var s = allSerahTerima.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var kode    = s['KODE BAHAN BAKU']    || s['Kode Bahan']        || '-';
  var nama    = s['NAMA BAHAN BAKU']    || s['Nama Bahan Baku']   || '-';
  var kat     = s['KATEGORI BAHAN BAKU']|| s['Kategori']          || '-';
  var penerima= s['PENERIMA']           || s['Penerima']          || '-';
  var supplier= s['SUPPLIER']           || s['Supplier']          || '-';
  var kondisi = s['KONDISI BAHAN BAKU'] || s['Kondisi']           || '-';
  var lokasi  = s['LOKASI']             || s['Lokasi']            || '-';
  var catatan = s['CATATAN']            || s['Catatan']           || '-';
  var user    = s['USER']               || s['User']              || '-';
  var kondisiColor = kondisi === 'Baik' ? 'badge-green' : kondisi === 'Cukup Baik' ? 'badge-blue' : kondisi === 'Rusak Ringan' ? 'badge-amber' : 'badge-red';
  var mapsHtml = lokasi !== '-'
    ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lokasi) + '" target="_blank" class="detail-link"><i class="fas fa-map-marker-alt"></i> ' + esc(lokasi) + '</a>'
    : '-';
  var html =
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-boxes" style="margin-right:6px;"></i>Data Bahan Baku</div>' +
    '<div class="info-card">' +
      infoRow('Kode Bahan', '<strong style="font-family:monospace;">' + esc(kode) + '</strong>') +
      infoRow('Kategori', '<span class="badge badge-outline">' + esc(kat) + '</span>') +
      infoRow('Nama Bahan', '<strong style="font-size:14px;">' + esc(nama) + '</strong>') +
      infoRow('Kondisi', '<span class="badge ' + kondisiColor + '">' + esc(kondisi) + '</span>') +
    '</div></div>' +
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-handshake" style="margin-right:6px;"></i>Informasi Serah Terima</div>' +
    '<div class="info-card">' +
      infoRow('Penerima', '<strong>' + esc(penerima) + '</strong>') +
      infoRow('Supplier', esc(supplier)) +
      infoRow('Lokasi', mapsHtml) +
      infoRow('Catatan', esc(catatan)) +
      infoRow('Input oleh', esc(user)) +
    '</div></div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-dolly" style="color:var(--primary);margin-right:8px;"></i>Detail Serah Terima';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data serah terima bahan baku';
  openModal('modalDetail');
}

function openDetailPending(id) {
  var p = allPending.find(function(x){ return x.id === id; });
  if (!p) return;
  resetDetailModalFooter();
  var statusBadge = p.status === 'LUNAS' ? 'badge-green' : 'badge-red';
  var html =
    '<div class="detail-section-title"><i class="fas fa-hand-holding-usd" style="margin-right:6px;"></i>Informasi Pending Payment</div>' +
    '<div class="info-card">' +
      infoRow('ID', '<span style="font-family:monospace;font-size:11px;">' + esc(p.id) + '</span>') +
      infoRow('Referensi Transaksi', esc(p.transaksiRef || '-')) +
      infoRow('Deskripsi', esc(p.deskripsi || '-')) +
      infoRow('Tanggal Pending', esc(p.tanggalPending || '-')) +
      infoRow('Rencana Pembayaran', esc(p.tanggalPayment || '-')) +
      infoRow('Status', '<span class="badge ' + statusBadge + '">' + esc(p.status || 'HUTANG') + '</span>') +
      infoRow('Tanggal Lunas', esc(p.tanggalLunas || '-')) +
      infoRow('Catatan', esc(p.catatan || '-')) +
      infoRow('Input oleh', esc(p.user || '-')) +
    '</div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-hand-holding-usd" style="color:var(--amber);margin-right:8px;"></i>Detail Pending Payment';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data pending payment';
  openModal('modalDetail');
}
function exportSupplier(format) {
  if (format === 'csv') {
    downloadCSV(allSuppliers || [], [
      {key:'NAMA SUPPLIER', label:'Nama Supplier'},
      {key:'NO WHATSAPP', label:'No WhatsApp'},
      {key:'EMAIL', label:'Email'},
      {key:'ALAMAT TOKO', label:'Alamat Toko'},
      {key:'STATUS', label:'Status'}
    ], 'Master_Supplier');
  } else {
    printCurrentPage();
  }
}

function openAddSupplierModal() {
  openModal('modalAddSupplier');
  setTimeout(function() { initSupTtdCanvas(); }, 120);
}

function saveAddSupplier() {
  var data = {
    NAMA_SUPPLIER: $('addSupNama').value.trim(),
    NO_WHATSAPP: $('addSupWA').value.trim(),
    EMAIL: $('addSupEmail').value.trim(),
    ALAMAT_TOKO: $('addSupAlamat').value.trim(),
    STATUS: $('addSupStatus').value
  };
  if (!data.NAMA_SUPPLIER || !data.ALAMAT_TOKO) { showToast('error', 'Validasi', 'Nama dan Alamat wajib diisi'); return; }
  // Handle foto, MOU, TTD uploads
  showLoading(true);
    callApi('addMasterSupplier', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSupplier'); loadSuppliers(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

function getGeocodeForSupplier() {
  var alamat = $('addSupAlamat').value.trim();
  if (!alamat) { showToast('warning', 'Perhatian', 'Isi alamat terlebih dahulu'); return; }
  showLoading(true);
    callApi('geocodeAlamat', [alamat], function(result) {
        showLoading(false);
              if (result.success) {
                $('supGeoResult').classList.remove('hidden');
                $('supGeoText').innerHTML = '<a href="' + esc(result.mapsLink) + '" target="_blank" style="color:var(--primary);">' + esc(result.formattedAddress) + ' <i class="fas fa-external-link-alt"></i></a>';
              } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Geocoding gagal');
      }
    );
}

function clearSupTtd() { clearTtdCanvas('supTtdCanvas'); }

// ============================================================
// 14. SURVEI HARGA
// ============================================================

/* ============================================================
     SURVEY
     ============================================================ */
function loadSurvei() {
  showLoading(true);
    callApi('getSurveiBahanBaku', [], function(result) {
        showLoading(false);
              if (result.success) {
                allSurvei = result.data || [];
                filteredSurvei = allSurvei.slice();
                populateSurveiFilterOptions();
                surveiPage = 1;
                renderSurveiTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data survei');
      }
    );
}
function renderSurveiTable() {
  var tbody = $('surveiTableBody');
  if (!filteredSurvei.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-search-dollar"></i></div><h4>Tidak Ada Data Survei</h4></div></td></tr>'; $('surveiPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil(filteredSurvei.length / ITEMS_PER_PAGE);
  if (surveiPage > totalPages) surveiPage = totalPages;
  var start = (surveiPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredSurvei.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '-') + '</strong></td>' +
      '<td>' + esc(s['WAKTU SURVEI'] || s['Waktu Survei'] || '-') + '</td>' +
      '<td>' + esc(s['KATEGORI BAHAN BAKU'] || s['Kategori'] || '-') + '</td>' +
      '<td>' + esc(s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '-') + '</td>' +
      '<td>' + formatRupiah(s['HARGA RAB'] || s['Harga RAB'] || 0) + '</td>' +
      '<td><strong style="color:var(--rose);">' + formatRupiah(s['HARGA PASAR'] || s['Harga Pasar'] || 0) + '</strong></td>' +
      '<td>' + esc(s['LOKASI SURVEI'] || s['Lokasi Survei'] || '-') + '</td>' +
      '<td>' + esc(s['USER'] || s['User'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSurvei(' + s._row + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn edit" onclick="openEditSurveiModal(' + s._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn delete" onclick="confirmHapus(\'survei\',' + s._row + ',\'\',\'survei ' + esc((s['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('surveiPagination', surveiPage, totalPages, 'goSurveiPage');
}

function filterSurvei() {
  var search = $('surveiSearchInput').value.toLowerCase().trim();
  var kat = $('surveiFilterKategori').value;
  filteredSurvei = allSurvei.filter(function(s) {
    var teks = (s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '') + ' ' + (s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (kat !== 'ALL' && (s['KATEGORI BAHAN BAKU'] || s['Kategori']) !== kat) return false;
    return true;
  });
  surveiPage = 1;
  renderSurveiTable();
}
function populateSurveiFilterOptions() {
  var katSel = $('surveiFilterKategori');
  var katSet = {};
  allSurvei.forEach(function(s) { var k = s['KATEGORI BAHAN BAKU'] || s['Kategori']; if (k) katSet[k] = true; });
  katSel.innerHTML = '<option value="ALL">Semua Kategori</option>' + Object.keys(katSet).sort().map(function(k){ return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
}

function goSurveiPage(p) { surveiPage = p; renderSurveiTable(); }
function exportSurvei(format) {
  if (format === 'csv') {
    downloadCSV(allSurvei || [], [
      {key:'KODE BAHAN BAKU', label:'Kode Bahan'},
      {key:'WAKTU SURVEI', label:'Waktu Survei'},
      {key:'KATEGORI BAHAN BAKU', label:'Kategori'},
      {key:'NAMA BAHAN BAKU', label:'Nama Bahan'},
      {key:'HARGA RAB', label:'Harga RAB'},
      {key:'HARGA PASAR', label:'Harga Pasar'},
      {key:'LOKASI SURVEI', label:'Lokasi'},
      {key:'USER', label:'User'}
    ], 'Survei_Harga');
  } else {
    printCurrentPage();
  }
}

function openAddSurveiModal() {
  $('addSurveiKode').value = '';
  $('addSurveiNama').value = '';
  $('addSurveiKategori').value = '';
  $('addSurveiHargaRAB').value = '';
  $('addSurveiHargaPasar').value = '';
  $('addSurveiAlamat').value = '';
  var geoBox = $('surveiGeoBox');
  geoBox.innerHTML = '<i class="fas fa-location-arrow"></i><span>Klik tombol untuk mendapatkan lokasi GPS</span>';
  geoBox.removeAttribute('data-lat');
  geoBox.removeAttribute('data-lng');
  geoBox.removeAttribute('data-coord');
  $('addSurveiFoto').value = '';
  $('bbAutocompleteDropdown').classList.remove('active');
  var btn = document.querySelector('[onclick="getGPSForSurvei()"]');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
  openModal('modalAddSurvei');
}

function handleBahanBakuAutocomplete(input) {
  var dropdown = $('bbAutocompleteDropdown');
  var val = input.value.trim().toLowerCase();
  var bb = dropdownOptions.bahanBaku || [];

  if (!bb.length) { dropdown.classList.remove('active'); return; }

  var matches = val
    ? bb.filter(function(b) {
        var haystack = ((b.kode || '') + ' ' + (b.nama || '') + ' ' + (b.kategori || '')).toLowerCase();
        return haystack.indexOf(val) > -1;
      })
    : bb;

  if (!matches.length) { dropdown.classList.remove('active'); return; }

  var html = '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
    'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
    'display:flex;justify-content:space-between;">' +
    '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
    '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' item</span></div>';

  matches.forEach(function(b) {
    html += '<div class="autocomplete-item" style="display:flex;justify-content:space-between;align-items:center;"' +
      ' onclick="selectSurveiBB(\'' + esc(b.kode) + '\',\'' + esc(b.nama) + '\',\'' + esc(b.kategori) + '\',' + (b.harga || 0) + ')">' +
      '<span><strong>' + esc(b.kode) + '</strong> — ' + esc(b.nama) + '</span>' +
      '<span style="font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>' +
      '</div>';
  });

  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectSurveiBB(kode, nama, kat, harga) {
  $('addSurveiKode').value = kode;
  $('addSurveiNama').value = nama;
  $('addSurveiKategori').value = kat;
  $('addSurveiHargaRAB').value = formatRupiah(harga);
  $('bbAutocompleteDropdown').classList.remove('active');
}

function getGPSForSurvei() {
  if (!navigator.geolocation) {
    showToast('error', 'Error', 'Browser tidak mendukung GPS. Gunakan browser modern atau aktifkan lokasi.');
    return;
  }
  var btn = document.querySelector('[onclick="getGPSForSurvei()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengambil lokasi...'; }
  $('surveiGeoBox').innerHTML = '<i class="fas fa-location-arrow" style="animation:spin 1s linear infinite;"></i><span>Sedang mengambil koordinat GPS...</span>';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = Math.round(pos.coords.accuracy);
      var mapsLink = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      var coordText = lat.toFixed(6) + ', ' + lng.toFixed(6);

      $('surveiGeoBox').innerHTML =
        '<i class="fas fa-map-marker-alt" style="color:var(--emerald);"></i>' +
        '<span>' + coordText + ' <span style="color:var(--slate-400);font-size:11px;">(±' + acc + 'm)</span>' +
        ' <a href="' + mapsLink + '" target="_blank" style="color:var(--primary);font-weight:600;margin-left:8px;">' +
        '<i class="fas fa-external-link-alt"></i> Lihat Maps</a></span>';

      // Simpan nilai bersih di attribute untuk diambil saat save
      $('surveiGeoBox').setAttribute('data-lat', lat);
      $('surveiGeoBox').setAttribute('data-lng', lng);
      $('surveiGeoBox').setAttribute('data-coord', coordText);

      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Perbarui Lokasi GPS'; }
      showToast('success', 'GPS Berhasil', 'Koordinat: ' + coordText);
    },
    function(err) {
      var msg = 'Tidak dapat mendapatkan lokasi.';
      if (err.code === 1) msg = 'Akses lokasi ditolak. Izinkan lokasi di pengaturan browser.';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
      else if (err.code === 3) msg = 'Waktu habis. Coba lagi di tempat terbuka.';
      $('surveiGeoBox').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--rose);"></i><span style="color:var(--rose);">' + msg + '</span>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
      showToast('error', 'GPS Gagal', msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function saveAddSurvei() {
  var geoBox = $('surveiGeoBox');
  var coordSaved = geoBox.getAttribute('data-coord') || '';
  var lokasiSurvei = coordSaved
    ? 'Lat: ' + geoBox.getAttribute('data-lat') + ', Lng: ' + geoBox.getAttribute('data-lng')
    : '';
  var data = {
    KODE_BAHAN_BAKU: $('addSurveiKode').value,
    NAMA_BAHAN_BAKU: $('addSurveiNama').value,
    KATEGORI_BAHAN_BAKU: $('addSurveiKategori').value,
    HARGA_RAB: $('addSurveiHargaRAB').value.replace(/[^0-9]/g, '') || 0,
    HARGA_PASAR: parseFloat($('addSurveiHargaPasar').value) || 0,
    ALAMAT_SURVEI: $('addSurveiAlamat').value,
    LOKASI_SURVEI: lokasiSurvei
  };

  if (!data.KODE_BAHAN_BAKU || !data.HARGA_PASAR || !data.ALAMAT_SURVEI) { showToast('error', 'Validasi', 'Kode Bahan, Harga Pasar, dan Alamat wajib diisi'); return; }
  showLoading(true);

  var fotoFile = $('addSurveiFoto').files[0];
  if (fotoFile) {
    var r = new FileReader();
    r.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
    callApi('uploadFotoSurvei', [
      b64,
      fotoFile.type,
      fotoFile.name
    ], function(up) {
        if (up.success) data.FOTO_BAHAN_BAKU = up.fileName;
                  submitSurveiData(data);
      }, null);
    };
    r.readAsDataURL(fotoFile);
  } else {
    submitSurveiData(data);
  }
}
function submitSurveiData(data) {
    callApi('addSurveiBahanBaku', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSurvei'); loadSurvei(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 15. SERAH TERIMA
// ============================================================

/* ============================================================
     SERAH TERIMA
     ============================================================ */
function loadSerahTerima() {
  showLoading(true);
    callApi('getSerahTerima', [], function(result) {
        showLoading(false);
              if (result.success) {
                allSerahTerima = result.data || [];
                filteredSerahTerima = allSerahTerima.slice();
                stPage = 1;
                renderSerahTerimaTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data');
      }
    );
}
function renderSerahTerimaTable() {
  var tbody = $('serahTerimaTableBody');
  if (!filteredSerahTerima.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-dolly"></i></div><h4>Tidak Ada Data</h4></div></td></tr>'; $('serahTerimaPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil(filteredSerahTerima.length / ITEMS_PER_PAGE);
  if (stPage > totalPages) stPage = totalPages;
  var start = (stPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredSerahTerima.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['KODE BAHAN BAKU'] || s['Kode Bahan'] || '-') + '</strong></td>' +
      '<td>' + esc(s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '-') + '</td>' +
      '<td>' + esc(s['PENERIMA'] || s['Penerima'] || '-') + '</td>' +
      '<td>' + esc(s['SUPPLIER'] || s['Supplier'] || '-') + '</td>' +
      '<td><span class="badge ' + ((s['KONDISI BAHAN BAKU'] || s['Kondisi']) === 'Baik' ? 'badge-green' : 'badge-amber') + '">' + esc(s['KONDISI BAHAN BAKU'] || s['Kondisi'] || '-') + '</span></td>' +
      '<td>' + esc(s['LOKASI'] || s['Lokasi'] || '-') + '</td>' +
      '<td>' + esc(s['USER'] || s['User'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSerahTerima(' + s._row + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn edit" onclick="openEditSerahTerimaModal(' + s._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (currentUser && currentUser.role === 'ADMIN' ? '<button class="action-btn delete" onclick="confirmHapus(\'serahTerima\',' + s._row + ',\'\',\'serah terima ' + esc((s['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('serahTerimaPagination', stPage, totalPages, 'goSTPage');
}

function filterSerahTerima() {
  var search = $('stSearchInput').value.toLowerCase().trim();
  var kondisi = $('stFilterKondisi').value;
  filteredSerahTerima = allSerahTerima.filter(function(s) {
    var teks = (s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '') + ' ' + (s['PENERIMA'] || s['Penerima'] || '') + ' ' + (s['SUPPLIER'] || s['Supplier'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (kondisi !== 'ALL' && (s['KONDISI BAHAN BAKU'] || s['Kondisi']) !== kondisi) return false;
    return true;
  });
  stPage = 1;
  renderSerahTerimaTable();
}

function goSTPage(p) { stPage = p; renderSerahTerimaTable(); }
function exportSerahTerima(format) {
  if (format === 'csv') {
    downloadCSV(allSerahTerima || [], [
      {key:'KODE BAHAN BAKU', label:'Kode Bahan'},
      {key:'NAMA BAHAN BAKU', label:'Nama Bahan'},
      {key:'PENERIMA', label:'Penerima'},
      {key:'SUPPLIER', label:'Supplier'},
      {key:'KONDISI BAHAN BAKU', label:'Kondisi'},
      {key:'LOKASI', label:'Lokasi'},
      {key:'USER', label:'User'}
    ], 'Serah_Terima');
  } else {
    printCurrentPage();
  }
}

function openAddSerahTerimaModal() {
  $('addSTKodeInput').value = '';
  $('addSTKode').value = '';
  $('addSTNama').value = '';
  $('addSTKategori').value = '';
  $('stBBAutocompleteDropdown').classList.remove('active');
  var stGeo = $('stGeoBox');
  stGeo.innerHTML = '<i class="fas fa-location-arrow"></i><span>Klik tombol untuk mendapatkan lokasi GPS</span>';
  stGeo.removeAttribute('data-lat');
  stGeo.removeAttribute('data-lng');
  stGeo.removeAttribute('data-coord');
  var btn = document.querySelector('[onclick="getGPSForST()"]');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
  openModal('modalAddSerahTerima');
  setTimeout(function() { initStTtdCanvas(); }, 120);
}

function handleSTBahanBakuAutocomplete(input) {
  var dropdown = $('stBBAutocompleteDropdown');
  var val = input.value.trim().toLowerCase();
  var bb = dropdownOptions.bahanBaku || [];

  if (!bb.length) { dropdown.classList.remove('active'); return; }

  var matches = val
    ? bb.filter(function(b) {
        var haystack = ((b.kode || '') + ' ' + (b.nama || '') + ' ' + (b.kategori || '')).toLowerCase();
        return haystack.indexOf(val) > -1;
      })
    : bb;

  if (!matches.length) { dropdown.classList.remove('active'); return; }

  var html = '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
    'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
    'display:flex;justify-content:space-between;">' +
    '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
    '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' item</span></div>';

  matches.forEach(function(b) {
    html += '<div class="autocomplete-item" style="display:flex;justify-content:space-between;align-items:center;"' +
      ' onclick="selectSTBB(\'' + esc(b.kode) + '\',\'' + esc(b.nama) + '\',\'' + esc(b.kategori) + '\')">' +
      '<span><strong>' + esc(b.kode) + '</strong> — ' + esc(b.nama) + '</span>' +
      '<span style="font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>' +
      '</div>';
  });

  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectSTBB(kode, nama, kat) {
  $('addSTKodeInput').value = kode + ' — ' + nama;
  $('addSTKode').value = kode + '|' + nama + '|' + kat;
  $('addSTNama').value = nama;
  $('addSTKategori').value = kat;
  $('stBBAutocompleteDropdown').classList.remove('active');
}
function getGPSForST() {
  if (!navigator.geolocation) {
    showToast('error', 'Error', 'Browser tidak mendukung GPS. Gunakan browser modern atau aktifkan lokasi.');
    return;
  }
  var btn = document.querySelector('[onclick="getGPSForST()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengambil lokasi...'; }
  $('stGeoBox').innerHTML = '<i class="fas fa-location-arrow" style="animation:spin 1s linear infinite;"></i><span>Sedang mengambil koordinat GPS...</span>';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = Math.round(pos.coords.accuracy);
      var mapsLink = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      var coordText = lat.toFixed(6) + ', ' + lng.toFixed(6);

      $('stGeoBox').innerHTML =
        '<i class="fas fa-map-marker-alt" style="color:var(--emerald);"></i>' +
        '<span>' + coordText + ' <span style="color:var(--slate-400);font-size:11px;">(±' + acc + 'm)</span>' +
        ' <a href="' + mapsLink + '" target="_blank" style="color:var(--primary);font-weight:600;margin-left:8px;">' +
        '<i class="fas fa-external-link-alt"></i> Lihat Maps</a></span>';

      $('stGeoBox').setAttribute('data-lat', lat);
      $('stGeoBox').setAttribute('data-lng', lng);
      $('stGeoBox').setAttribute('data-coord', coordText);

      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Perbarui Lokasi GPS'; }
      showToast('success', 'GPS Berhasil', 'Koordinat: ' + coordText);
    },
    function(err) {
      var msg = 'Tidak dapat mendapatkan lokasi.';
      if (err.code === 1) msg = 'Akses lokasi ditolak. Izinkan lokasi di pengaturan browser.';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
      else if (err.code === 3) msg = 'Waktu habis. Coba lagi di tempat terbuka.';
      $('stGeoBox').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--rose);"></i><span style="color:var(--rose);">' + msg + '</span>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
      showToast('error', 'GPS Gagal', msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function saveAddSerahTerima() {
  var kodeVal = $('addSTKode').value;
  var kodeParts = kodeVal ? kodeVal.split('|') : ['', '', ''];
  var data = {
    KODE_BAHAN_BAKU: kodeParts[0],
    NAMA_BAHAN_BAKU: $('addSTNama').value,
    KATEGORI_BAHAN_BAKU: $('addSTKategori').value,
    KONDISI_BAHAN_BAKU: $('addSTKondisi').value,
    PENERIMA: $('addSTPenerima').value.trim(),
    SUPPLIER: $('addSTSupplier').value,
    CATATAN: $('addSTCatatan').value,
    LOKASI: $('stGeoBox').getAttribute('data-coord')
      ? 'Lat: ' + $('stGeoBox').getAttribute('data-lat') + ', Lng: ' + $('stGeoBox').getAttribute('data-lng')
      : ''
  };
  if (!data.PENERIMA || !data.KODE_BAHAN_BAKU) { showToast('error', 'Validasi', 'Penerima dan Bahan Baku wajib diisi'); return; }
  showLoading(true);
    callApi('addSerahTerima', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSerahTerima'); loadSerahTerima(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
// ============================================================
// 16. MENU MBG (AHLI GIZI)
// ============================================================

/* ============================================================
     MENU MBG
     ============================================================ */
function loadMenuMBG() {
  showLoading(true);
    callApi('getMenuHarian', [{}], function(result) {
        showLoading(false);
              if (result.success) {
                allMenuMBG = result.data || [];
                menuMBGPage = 1;
                renderMenuMBGTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data menu');
      }
    );
}
function renderMenuMBGTable() {
  var tbody = $('menuMBGTableBody');
  if (!allMenuMBG.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-utensils"></i></div><h4>Tidak Ada Data Menu</h4></div></td></tr>'; $('menuMBGPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil(allMenuMBG.length / ITEMS_PER_PAGE);
  if (menuMBGPage > totalPages) menuMBGPage = totalPages;
  var start = (menuMBGPage - 1) * ITEMS_PER_PAGE;
  var pageData = allMenuMBG.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(m, idx) {
    var detailText = '';
    if (m.detail && m.detail.length) {
      detailText = m.detail.map(function(d) { return esc(d.namaItem) + ' (' + d.jumlah + ' ' + esc(d.satuan) + ')'; }).join(', ');
    }
    var canEditMenu = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'AHLI_GIZI');
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(m.tanggal) + '</strong></td>' +
      '<td>' + (m.jumlahKpm || 0) + ' orang</td>' +
      '<td>' + esc(m.menu) + '</td>' +
      '<td>' + (detailText || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" title="Detail" onclick="showMenuDetail(' + (start + idx) + ')"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (canEditMenu ? '<button class="action-btn edit" onclick="openEditMenuMBGModal(' + (start + idx) + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (canEditMenu ? '<button class="action-btn delete" onclick="confirmHapus(\'menuMBG\',' + (m._row || (start+idx+2)) + ',\'\',\'menu ' + esc((m.menu||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('menuMBGPagination', menuMBGPage, totalPages, 'goMenuMBGPage');
}
function goMenuMBGPage(p) { menuMBGPage = p; renderMenuMBGTable(); }
function exportMenuMBG(format) {
  if (format === 'csv') {
    var flat = [];
    (allMenuMBG || []).forEach(function(m){
      if (m.detail && m.detail.length) {
        m.detail.forEach(function(d){
          flat.push({ tanggal:m.tanggal, jumlahKpm:m.jumlahKpm, menu:m.menu, namaItem:d.namaItem, jumlah:d.jumlah, satuan:d.satuan, hargaSatuan:d.hargaSatuan, totalHarga:d.totalHarga });
        });
      } else {
        flat.push({ tanggal:m.tanggal, jumlahKpm:m.jumlahKpm, menu:m.menu, namaItem:'', jumlah:'', satuan:'', hargaSatuan:'', totalHarga:'' });
      }
    });
    downloadCSV(flat, [
      {key:'tanggal', label:'Tanggal'},
      {key:'jumlahKpm', label:'Jumlah KPM'},
      {key:'menu', label:'Menu'},
      {key:'namaItem', label:'Nama Item'},
      {key:'jumlah', label:'Jumlah'},
      {key:'satuan', label:'Satuan'},
      {key:'hargaSatuan', label:'Harga Satuan'},
      {key:'totalHarga', label:'Total Harga'}
    ], 'Menu_MBG');
  } else {
    printCurrentPage();
  }
}
function showMenuDetail(idx) {
  var m = allMenuMBG[idx];
  if (!m) return;
  resetDetailModalFooter();
  var detailHtml = '';
  if (m.detail && m.detail.length) {
    m.detail.forEach(function(d) {
      detailHtml += '<div class="detail-doc-item doc-ok">' +
        '<div class="detail-doc-icon"><i class="fas fa-utensils"></i></div>' +
        '<div><div class="detail-doc-label">' + esc(d.namaItem) + '</div>' +
        '<div class="detail-doc-status">' + d.jumlah + ' ' + esc(d.satuan) + ' — ' + formatRupiah(d.totalHarga) + '</div></div>' +
        '</div>';
    });
  } else {
    detailHtml = '<p style="color:var(--slate-400);font-size:13px;">Tidak ada detail item.</p>';
  }
  $('detailBody').innerHTML =
    '<div class="info-card">' +
      infoRow('Tanggal', esc(m.tanggal)) +
      infoRow('Jumlah KPM', (m.jumlahKpm || 0) + ' orang') +
      infoRow('Menu', esc(m.menu)) +
    '</div>' +
    '<div class="detail-section-title"><i class="fas fa-list" style="margin-right:6px;"></i>Detail Item</div>' +
    detailHtml;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-utensils" style="color:var(--primary);margin-right:8px;"></i>Detail Menu MBG';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Detail bahan baku dan item menu';
  openModal('modalDetail');
}

function openAddMenuMBGModal() {
  $('addMenuTanggal').value = formatDateInput();
  $('addMenuKPM').value = '';
  populateMenuMBGSelect();
  menuItems = [];
  renderMenuItems();
  openModal('modalAddMenuMBG');
}
function addMenuItemRow() {
  menuItems.push({ namaItem: '', jumlah: 1, satuan: 'Kg', hargaSatuan: 0 });
  renderMenuItems();
}
function removeMenuItem(i) { menuItems.splice(i, 1); renderMenuItems(); }
function renderMenuItems() {
  var container = $('menuItemsList');
  if (!menuItems.length) { container.innerHTML = '<p style="color:var(--slate-400);font-size:12px;">Belum ada item. Klik "Tambah Item".</p>'; return; }
  var bb = dropdownOptions.bahanBaku || [];
  var html = '';
  menuItems.forEach(function(item, i) {
    var options = bb.map(function(b) { return '<option value="' + esc(b.nama) + '" ' + (b.nama === item.namaItem ? 'selected' : '') + '>' + esc(b.nama) + ' (' + esc(b.satuan) + ')</option>'; }).join('');
    html += '<div class="form-row" style="margin-bottom:8px;align-items:end;">' +
      '<div class="form-group" style="margin-bottom:0;">' +
        '<select class="form-input" onchange="updateMenuItem(' + i + ', \'namaItem\', this.value)">' +
          '<option value="">Pilih Bahan</option>' + options + '</select></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 80px;">' +
        '<input type="number" class="form-input" value="' + item.jumlah + '" min="1" onchange="updateMenuItem(' + i + ', \'jumlah\', this.value)" placeholder="Qty"></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 100px;">' +
        '<input type="text" class="form-input" value="' + esc(item.satuan) + '" onchange="updateMenuItem(' + i + ', \'satuan\', this.value)" placeholder="Satuan"></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 140px;">' +
        '<input type="number" class="form-input" value="' + item.hargaSatuan + '" onchange="updateMenuItem(' + i + ', \'hargaSatuan\', this.value)" placeholder="Harga"></div>' +
      '<button type="button" class="action-btn delete" onclick="removeMenuItem(' + i + ')" style="margin-bottom:4px;"><i class="fas fa-trash"></i></button>' +
      '</div>';
  });
  container.innerHTML = html;
}
function updateMenuItem(i, field, val) {
  if (field === 'namaItem') {
    menuItems[i].namaItem = val;
    // Auto-fill satuan from dropdown options
    var bb = dropdownOptions.bahanBaku || [];
    var found = bb.find(function(b) { return b.nama === val; });
    if (found) { menuItems[i].satuan = found.satuan || 'Kg'; menuItems[i].hargaSatuan = found.harga || 0; }
  } else if (field === 'jumlah') menuItems[i].jumlah = parseInt(val) || 1;
  else if (field === 'satuan') menuItems[i].satuan = val;
  else if (field === 'hargaSatuan') menuItems[i].hargaSatuan = parseFloat(val) || 0;
  renderMenuItems();
}
function saveAddMenuMBG() {
  var menuSel = $('addMenuList');
  var selectedMenus = Array.from(menuSel.selectedOptions).map(function(o) { return o.value; }).join(', ');
  var data = {
    tanggal: $('addMenuTanggal').value,
    jumlahKpm: parseInt($('addMenuKPM').value) || 0,
    menu: selectedMenus,
    items: menuItems.filter(function(i) { return i.namaItem; })
  };
  if (!data.tanggal || !data.jumlahKpm || !data.menu) { showToast('error', 'Validasi', 'Tanggal, Jumlah KPM, dan Menu wajib diisi'); return; }
  showLoading(true);
    callApi('addMenuHarian', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddMenuMBG'); loadMenuMBG(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 17. PENDING PAYMENT
// ============================================================

/* ============================================================
     PENDING PAYMENT
     ============================================================ */
function loadPendingPayment() {
  showLoading(true);
    callApi('getPendingPayments', [], function(data) {
        showLoading(false);
              allPending = data || [];
              pendingPage = 1;
              renderPendingTable();
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data');
      }
    );
}
function renderPendingTable() {
  var tbody = $('pendingTableBody');
  if (!allPending.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-hand-holding-usd"></i></div><h4>Tidak Ada Pending Payment</h4></div></td></tr>'; $('pendingPagination').innerHTML = ''; return; }
  var isAdmin = currentUser && currentUser.role === 'ADMIN';
  var totalPages = Math.ceil(allPending.length / ITEMS_PER_PAGE);
  if (pendingPage > totalPages) pendingPage = totalPages;
  var start = (pendingPage - 1) * ITEMS_PER_PAGE;
  var pageData = allPending.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(p, idx) {
    var statusBadge = p.status === 'LUNAS' ? 'badge-green' : 'badge-red';
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(p.id) + '</strong></td>' +
      '<td>' + esc(p.transaksiRef || '-') + '</td>' +
      '<td>' + esc(p.deskripsi || '-') + '</td>' +
      '<td>' + esc(p.tanggalPending || '-') + '</td>' +
      '<td>' + esc(p.tanggalPayment || '-') + '</td>' +
      '<td><span class="badge ' + statusBadge + '">' + esc(p.status || 'HUTANG') + '</span></td>' +
      '<td>' + esc(p.tanggalLunas || '-') + '</td>' +
      '<td>' + esc(p.catatan || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailPending(\'' + esc(p.id) + '\')" title="Detail"><i class="fas fa-eye"></i></button>' +
          (isAdmin && p.status !== 'LUNAS' ? '<button class="action-btn" style="color:#22c55e;border:1px solid #bbf7d0;" onclick="sendWAReminderPending(\'' + esc(p.id) + '\')" title="Kirim Reminder WA"><i class="fab fa-whatsapp"></i><span class="tooltip">Reminder WA</span></button>' : '') +
          (isAdmin ? '<button class="action-btn edit" onclick="openEditPendingModal(\'' + esc(p.id) + '\')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (isAdmin ? '<button class="action-btn delete" onclick="confirmHapus(\'pending\',0,\'' + esc(p.id) + '\',\'pending ' + esc((p.id||'').substring(0,10)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('pendingPagination', pendingPage, totalPages, 'goPendingPage');
}
function goPendingPage(p) { pendingPage = p; renderPendingTable(); }

function openAddPendingModal() {
  populatePendingTransaksiSelect();
  openModal('modalAddPending');
}
function saveAddPending() {
  var data = {
    transaksiRef: $('addPendingTransaksi').value,
    deskripsi: $('addPendingDeskripsi').value.trim(),
    tanggalPending: $('addPendingTglPending').value,
    tanggalPayment: $('addPendingTglPayment').value
  };
  if (!data.deskripsi || !data.tanggalPending) { showToast('error', 'Validasi', 'Deskripsi dan Tanggal Pending wajib diisi'); return; }
  showLoading(true);
    callApi('addPendingPayment', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddPending'); loadPendingPayment(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
function openEditPendingModal(id) {
  var p = allPending.find(function(x) { return x.id === id; });
  if (!p) return;
  $('editPendingId').value = id;
  $('editPendingStatus').value = p.status || 'HUTANG';
  $('editPendingTglLunas').value = p.tanggalLunas ? formatDateInput(p.tanggalLunas) : '';
  $('editPendingCatatan').value = p.catatan || '';
  openModal('modalEditPending');
}

function toggleTglLunas() {
  var status = $('editPendingStatus').value;
  var tglEl = $('editPendingTglLunas');
  if (status === 'LUNAS') {
    tglEl.value = tglEl.value || formatDateInput();
  }
}

function saveEditPending() {
  var id = $('editPendingId').value;
  var updateData = {
    status: $('editPendingStatus').value,
    tanggalLunas: $('editPendingTglLunas').value,
    catatan: $('editPendingCatatan').value
  };
  showLoading(true);
    callApi('updatePendingPayment', [
      id,
      updateData
    ], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditPending'); loadPendingPayment(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}


// ============================================================
// 17b. AUDIT LOG (RIWAYAT AKTIVITAS) — ADMIN
// ============================================================
var allAuditLog = [];
var filteredAuditLog = [];
var auditLogPage = 1;


/* ============================================================
     AUDIT LOG & NOTIFICATIONS
     ============================================================ */
function loadAuditLog() {
  if (!currentUser || currentUser.role !== 'ADMIN') return;
  showLoading(true);
    callApi('getAuditLog', [{}], function(result) {
        showLoading(false);
              if (result.success) {
                allAuditLog = result.data || [];
                populateAuditActionFilter();
                filteredAuditLog = allAuditLog.slice();
                auditLogPage = 1;
                renderAuditLogTable();
              } else {
                showToast('error', 'Gagal', result.message || 'Tidak dapat memuat riwayat aktivitas');
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat riwayat aktivitas');
      }
    );
}

function populateAuditActionFilter() {
  var sel = $('auditFilterAction');
  if (!sel) return;
  var actions = {};
  allAuditLog.forEach(function(a) { if (a.actionType) actions[a.actionType] = true; });
  var html = '<option value="ALL">Semua Aksi</option>';
  Object.keys(actions).sort().forEach(function(a) { html += '<option value="' + esc(a) + '">' + esc(a) + '</option>'; });
  sel.innerHTML = html;
}

function renderAuditLogTable() {
  var tbody = $('auditLogTableBody');
  if (!filteredAuditLog.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-history"></i></div><h4>Belum Ada Riwayat</h4></div></td></tr>';
    $('auditLogPagination').innerHTML = '';
    return;
  }
  var totalPages = Math.ceil(filteredAuditLog.length / ITEMS_PER_PAGE);
  if (auditLogPage > totalPages) auditLogPage = totalPages;
  var start = (auditLogPage - 1) * ITEMS_PER_PAGE;
  var pageData = filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(a, idx) {
    var actionColor = 'badge-slate';
    if (a.actionType.indexOf('DELETE') > -1) actionColor = 'badge-red';
    else if (a.actionType.indexOf('APPROVE') > -1 || a.actionType.indexOf('VERIFY') > -1) actionColor = 'badge-green';
    else if (a.actionType.indexOf('ADD') > -1) actionColor = 'badge-blue';
    else if (a.actionType.indexOf('EDIT') > -1 || a.actionType.indexOf('UPDATE') > -1) actionColor = 'badge-amber';
    else if (a.actionType.indexOf('FAILED') > -1) actionColor = 'badge-red';
    html += '<tr>' +
      '<td style="text-align:center;color:var(--slate-400);">' + (start + idx + 1) + '</td>' +
      '<td style="white-space:nowrap;font-size:11px;">' + esc(a.waktu) + '</td>' +
      '<td>' + esc(a.pelaku) + '</td>' +
      '<td><span class="badge ' + actionColor + '">' + esc(a.actionType) + '</span></td>' +
      '<td>' + esc(a.tableName) + '</td>' +
      '<td style="font-family:monospace;font-size:11px;">' + esc(a.recordId) + '</td>' +
      '<td>' + esc(a.fieldChanged) + '</td>' +
      '<td style="font-size:11px;color:var(--slate-500);">' + esc(a.deskripsi) + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  renderPagination('auditLogPagination', auditLogPage, totalPages, 'goAuditLogPage');
}
function goAuditLogPage(p) { auditLogPage = p; renderAuditLogTable(); }

function filterAuditLog() {
  var search = $('auditSearchInput').value.toLowerCase().trim();
  var action = $('auditFilterAction').value;
  var dateStart = $('auditFilterTglStart').value;
  var dateEnd = $('auditFilterTglEnd').value;
  filteredAuditLog = allAuditLog.filter(function(a) {
    if (search) {
      var s = (a.pelaku + ' ' + a.tableName + ' ' + a.recordId + ' ' + a.deskripsi).toLowerCase();
      if (s.indexOf(search) === -1) return false;
    }
    if (action !== 'ALL' && a.actionType !== action) return false;
    if (dateStart || dateEnd) {
      var parts = a.waktu.split(' ')[0].split('/');
      if (parts.length === 3) {
        var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (dateStart) { var ds = new Date(dateStart); ds.setHours(0,0,0,0); if (d < ds) return false; }
        if (dateEnd) { var de = new Date(dateEnd); de.setHours(23,59,59,999); if (d > de) return false; }
      }
    }
    return true;
  });
  auditLogPage = 1;
  renderAuditLogTable();
}

function resetAuditFilter() {
  $('auditSearchInput').value = '';
  $('auditFilterAction').value = 'ALL';
  $('auditFilterTglStart').value = '';
  $('auditFilterTglEnd').value = '';
  filterAuditLog();
}

// ============================================================
// 17b. ADMIN ASSIGNMENT (SUPER_ADMIN) — konfigurasi cakupan ADMIN
// ============================================================
var allAdminAssignments = [];
var _aaEmailDebounce = null;

function loadAdminAssignments() {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
  var targetEmail = ($('adminAssignmentEmailInput') && $('adminAssignmentEmailInput').value.trim()) || '';
  showLoading(true);
  callApi('getAdminAssignments', [targetEmail], function(result) {
    showLoading(false);
    if (result.success) {
      allAdminAssignments = result.data || [];
      renderAdminAssignmentTable();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat memuat data assignment');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memuat data assignment: ' + (err.message || ''));
  });
}

function handleAdminAssignmentEmailInput() {
  if (_aaEmailDebounce) clearTimeout(_aaEmailDebounce);
  _aaEmailDebounce = setTimeout(function() { loadAdminAssignments(); }, 400);
}

function renderAdminAssignmentTable() {
  var tbody = $('adminAssignmentTableBody');
  if (!tbody) return;
  if (!allAdminAssignments.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-user-shield"></i></div><h4>Belum Ada Assignment</h4><p>Cari email admin di atas atau tambahkan assignment baru.</p></div></td></tr>';
    return;
  }
  var html = '';
  allAdminAssignments.forEach(function(a, idx) {
    html += '<tr>' +
      '<td style="text-align:center;color:var(--slate-400);">' + (idx + 1) + '</td>' +
      '<td>' + esc(a.admin_email) + '</td>' +
      '<td>' + esc(a.sppg) + '</td>' +
      '<td>' + esc(a.yayasan) + '</td>' +
      '<td style="white-space:nowrap;font-size:11px;">' + esc(a.created_at ? String(a.created_at).substring(0, 10) : '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<button class="btn btn-icon" onclick="openEditAdminAssignmentModal(\'' + a.id + '\',\'' + esc(a.admin_email) + '\',\'' + esc(a.sppg) + '\',\'' + esc(a.yayasan) + '\')" title="Edit" style="margin-right:4px;">' +
          '<i class="fas fa-edit"></i>' +
        '</button>' +
        '<button class="btn btn-icon btn-danger-outline" onclick="deleteAdminAssignmentRow(\'' + a.id + '\')" title="Hapus">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

function openEditAdminAssignmentModal(id, adminEmail, sppg, yayasan) {
  $('editAaId').value = id;
  $('editAaEmailDisplay').value = adminEmail;
  var sppgSel = $('editAaSppgInput');
  var sppgList = (dropdownOptions.sppgList && dropdownOptions.sppgList.length) ? dropdownOptions.sppgList : [];
  var opts = '<option value="">-- Pilih SPPG --</option>';
  sppgList.forEach(function(s) { opts += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sppgSel.innerHTML = opts;
  sppgSel.value = sppg;
  $('editAaYayasanInput').value = yayasan;
  openModal('modalEditAdminAssignment');
}

function submitEditAdminAssignment() {
  var id = $('editAaId').value;
  var sppg = $('editAaSppgInput').value;
  var yayasan = $('editAaYayasanInput').value.trim();
  if (!sppg || !yayasan) {
    showToast('error', 'Gagal', 'SPPG dan Yayasan wajib diisi.');
    return;
  }
  showLoading(true);
  callApi('updateAdminAssignment', [id, sppg, yayasan], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil diperbarui.');
      closeModal('modalEditAdminAssignment');
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat memperbarui assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memperbarui assignment: ' + (err.message || ''));
  });
}

function openAddAdminAssignmentModal() {
  $('aaEmailInput').value = '';
  $('aaYayasanInput').value = '';
  var sppgSel = $('aaSppgInput');
  var sppgList = (dropdownOptions.sppgList && dropdownOptions.sppgList.length) ? dropdownOptions.sppgList : [];
  var opts = '<option value="">-- Pilih SPPG --</option>';
  sppgList.forEach(function(s) { opts += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sppgSel.innerHTML = opts;
  openModal('modalAddAdminAssignment');
}

function submitAddAdminAssignment() {
  var email = $('aaEmailInput').value.trim();
  var sppg = $('aaSppgInput').value;
  var yayasan = $('aaYayasanInput').value.trim();
  if (!email || !sppg || !yayasan) {
    showToast('error', 'Gagal', 'Email admin, SPPG, dan Yayasan wajib diisi.');
    return;
  }
  showLoading(true);
  callApi('addAdminAssignment', [email, sppg, yayasan], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil ditambahkan.');
      closeModal('modalAddAdminAssignment');
      $('adminAssignmentEmailInput').value = email;
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat menambahkan assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat menambahkan assignment: ' + (err.message || ''));
  });
}

function deleteAdminAssignmentRow(assignmentId) {
  if (!confirm('Hapus assignment ini? Admin terkait tidak akan bisa lagi mengakses data SPPG/Yayasan ini.')) return;
  showLoading(true);
  callApi('deleteAdminAssignment', [assignmentId], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil dihapus.');
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat menghapus assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat menghapus assignment: ' + (err.message || ''));
  });
}

// ============================================================
// 18. REKAP
// ============================================================
function openLightbox(src) {
  var isPdf = src && src.toLowerCase().indexOf('.pdf') > -1;
  var imgEl = $('lightboxImage');
  var pdfEl = $('lightboxPdf');
  if (isPdf) {
    pdfEl.src = src;
    pdfEl.classList.remove('hidden');
    imgEl.classList.add('hidden');
    imgEl.src = '';
  } else {
    imgEl.src = src;
    imgEl.classList.remove('hidden');
    pdfEl.classList.add('hidden');
    pdfEl.src = '';
  }
  $('modalLightbox').classList.remove('hidden');
}
function closeLightbox() {
  $('modalLightbox').classList.add('hidden');
  $('lightboxImage').src = '';
  $('lightboxPdf').src = '';
}

function refreshData() {
  var icon = $('refreshIcon');
  var btn  = $('refreshBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  icon.classList.add('fa-spin');

  var done = 0;
  var total = 1;

  function checkDone() {
    done++;
    if (done >= total) {
      icon.classList.remove('fa-spin');
      btn.disabled = false;
      showToast('success', 'Refresh', 'Data diperbarui');
    }
  }

  if (currentPage === 'dashboard') {
    callApi('getDashboardKPI', [], function(result) {
        if (result.success) {
                  $('statSaldo').textContent = formatRupiah(result.saldoBerjalan);
                  $('statPemasukan').textContent = formatRupiah(result.totalPemasukan);
                  $('statPengeluaran').textContent = formatRupiah(result.totalPengeluaran);
                  $('statAntrian').textContent = result.antrianApproval || 0;
                  $('statAntrianNominal').textContent = formatRupiah(result.totalBelumBayar);
                  var cnt2 = result.antrianApproval || 0;
                  var badge = $('approvalCount');
                  if (badge) { badge.textContent = cnt2; badge.style.display = cnt2 > 0 ? 'inline-flex' : 'none'; }
                  var badgeSidebar = $('approvalCountSidebar');
                  if (badgeSidebar) { badgeSidebar.textContent = cnt2; badgeSidebar.style.display = cnt2 > 0 ? 'inline-flex' : 'none'; }
                  syncApprovalBadgeToBottomNav();
                  syncApprovalBadgeToQuickAccess();
                }
                updateChart();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'transaksi') {
    var isAdminRefresh = currentUser.role === 'ADMIN';
    var filters = { callerRole: currentUser.role, callerUser: isAdminRefresh ? '' : currentUser.email };
    callApi('getTransactions', [filters], function(data) {
        allTransactions = data || [];
                filteredTransactions = allTransactions.slice();
                txPage = 1;
                populateSPPGFilter();
                renderTransaksiTable();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'approval') {
    var isAdminApproval = currentUser.role === 'ADMIN';
    var filters = { callerRole: currentUser.role, callerUser: isAdminApproval ? '' : currentUser.email };
    selectedApprovalIds.clear();
    callApi('getTransactions', [filters], function(data) {
        allTransactions = data || [];
                populateApprovalFilters();
                filterApproval();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'master-bahan') {
    callApi('getMasterBahanBaku', [], function(result) {
        if (result.success) {
                  allMasterBB = result.data || [];
                  filteredMasterBB = allMasterBB.slice();
                  bbPage = 1;
                  renderMasterBBTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'master-supplier') {
    callApi('getMasterSupplier', [], function(result) {
        if (result.success) {
                  allSuppliers = result.data || [];
                  supplierPage = 1;
                  renderSupplierTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'survei') {
    callApi('getSurveiBahanBaku', [], function(result) {
        if (result.success) {
                  allSurvei = result.data || [];
                  filteredSurvei = allSurvei.slice();
                populateSurveiFilterOptions();
                  surveiPage = 1;
                  renderSurveiTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'serah-terima') {
    callApi('getSerahTerima', [], function(result) {
        if (result.success) {
                  allSerahTerima = result.data || [];
                  filteredSerahTerima = allSerahTerima.slice();
                  stPage = 1;
                  renderSerahTerimaTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'menu-mbg') {
    callApi('getMenuHarian', [{}], function(result) {
        if (result.success) {
                  allMenuMBG = result.data || [];
                  menuMBGPage = 1;
                  renderMenuMBGTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'pending-payment') {
    callApi('getPendingPayments', [], function(data) {
        allPending = data || [];
                pendingPage = 1;
                renderPendingTable();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'users') {
    callApi('getAllUsers', [currentUser.role], function(result) {
        if (result.success) {
                  allUsers = result.data || [];
                  usersPage = 1;
                  renderUsersTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else {
    checkDone();
  }
}

function downloadCSV(rows, headers, filename) {
  if (!rows || !rows.length) { showToast('warning', 'Perhatian', 'Tidak ada data untuk diexport'); return; }
  var csv = '\uFEFF';
  csv += headers.map(function(h){ return '"' + String(h.label).replace(/"/g, '""') + '"'; }).join(';') + '\r\n';
  rows.forEach(function(row){
    csv += headers.map(function(h){
      var val = row[h.key];
      if (val === null || val === undefined) val = '';
      return '"' + String(val).replace(/"/g, '""') + '"';
    }).join(';') + '\r\n';
  });
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  var url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename + '_' + new Date().toISOString().slice(0,10) + '.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('success', 'Export CSV', 'File berhasil diunduh');
}

function printCurrentPage() {
  if (!currentPage) return;
  var originalTitle = document.title;
  var pageTitleText = $('pageTitle').textContent || 'SPPG';
  document.title = pageTitleText + ' - ' + (currentUser ? currentUser.namaLengkap : 'Print');

  // Dashboard & Profil: pakai print normal (cetak konten halaman apa adanya)
  var normalPrintPages = ['dashboard', 'profil'];
  if (normalPrintPages.indexOf(currentPage) > -1) {
    setTimeout(function() {
      window.print();
      document.title = originalTitle;
    }, 250);
    return;
  }

  // Print SEMUA data hasil filter (bukan hanya halaman aktif)
  var printBody = $('printAllBody');
  var printAllMeta = $('printAllMeta');
  if (!printBody) { window.print(); document.title = originalTitle; return; }

  var now = new Date();
  var dateStr = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  var timeStr = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  var filterInfo = getActiveFilterInfo();
  printAllMeta.textContent = 'Dicetak oleh: ' +
    (currentUser ? currentUser.namaLengkap + ' (' + currentUser.role + ')' : '-') +
    ' | Tanggal: ' + dateStr + ' ' + timeStr + ' | Halaman: ' + pageTitleText +
    (filterInfo ? ' | Filter: ' + filterInfo : '');

  var pm = $('printMeta');
  if (pm) pm.textContent = printAllMeta.textContent;

  printBody.innerHTML = buildPrintAllTable();

  document.body.classList.add('printing-all');
  setTimeout(function() {
    window.print();
    document.body.classList.remove('printing-all');
    document.title = originalTitle;
  }, 300);
}

function getActiveFilterInfo() {
  var info = [];
  if (currentPage === 'transaksi') {
    if ($('txFilterSPPG').value !== 'ALL') info.push('SPPG=' + $('txFilterSPPG').value);
    if ($('txFilterKategori').value !== 'ALL') info.push('Kat=' + $('txFilterKategori').value);
    if ($('txFilterStatus').value !== 'ALL') info.push('Status=' + $('txFilterStatus').value);
    if ($('txSearchInput').value.trim()) info.push('Cari=' + $('txSearchInput').value.trim());
  }
  if (currentPage === 'master-bahan') {
    if ($('bbFilterKategori').value !== 'ALL') info.push('Kat=' + $('bbFilterKategori').value);
    if ($('bbSearchInput').value.trim()) info.push('Cari=' + $('bbSearchInput').value.trim());
  }
  return info.length ? info.join(', ') : '';
}

function buildPrintAllTable() {
  var html = '';
  if (currentPage === 'transaksi') {
    var data = filteredTransactions || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' transaksi</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Tanggal</th><th>Kategori</th><th>SPPG</th><th>Item</th><th>Nominal</th><th>Metode</th><th>Penginput</th></tr></thead><tbody>';
    data.forEach(function(tx, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(tx.kode||'-') + '</td><td>' + esc(tx.tanggal||'-') + '</td><td>' + esc(tx.kategori||'-') + '</td><td>' + esc(tx.sppg||'-') + '</td><td>' + esc(tx.item||'-') + '</td><td>' + formatRupiah(tx.nominal) + '</td><td>' + esc(tx.metodeTransaksi||'-') + '</td><td>' + esc(tx.user||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'master-bahan') {
    var data = filteredMasterBB || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' bahan baku</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Kategori</th><th>Nama</th><th>Harga</th><th>Satuan</th><th>Supplier</th></tr></thead><tbody>';
    data.forEach(function(b, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(b['KODE BAHAN']||b['Kode Bahan']||'-') + '</td><td>' + esc(b['KATEGORI BAHAN BAKU']||b['Kategori']||'-') + '</td><td>' + esc(b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||b['Nama Bahan Baku']||'-') + '</td><td>' + formatRupiah(b['HARGA BAHAN BAKU']||b['Harga']||0) + '</td><td>' + esc(b['SATUAN']||b['Satuan']||'-') + '</td><td>' + esc(b['SUPPLIER']||b['Supplier']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'master-supplier') {
    var data = allSuppliers || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' supplier</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Nama</th><th>WA</th><th>Email</th><th>Alamat</th><th>Status</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['NAMA SUPPLIER']||s['Nama Supplier']||'-') + '</td><td>' + esc(s['NO WHATSAPP']||s['No WhatsApp']||'-') + '</td><td>' + esc(s['EMAIL']||s['Email']||'-') + '</td><td>' + esc(s['ALAMAT TOKO']||s['Alamat']||'-') + '</td><td>' + esc(s['STATUS']||s['Status']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'survei') {
    var data = allSurvei || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' survei</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Waktu</th><th>Kategori</th><th>Nama</th><th>Harga RAB</th><th>Harga Pasar</th><th>Lokasi</th><th>User</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['KODE BAHAN BAKU']||s['Kode Bahan Baku']||'-') + '</td><td>' + esc(s['WAKTU SURVEI']||s['Waktu Survei']||'-') + '</td><td>' + esc(s['KATEGORI BAHAN BAKU']||s['Kategori']||'-') + '</td><td>' + esc(s['NAMA BAHAN BAKU']||s['Nama Bahan Baku']||'-') + '</td><td>' + formatRupiah(s['HARGA RAB']||s['Harga RAB']||0) + '</td><td>' + formatRupiah(s['HARGA PASAR']||s['Harga Pasar']||0) + '</td><td>' + esc(s['LOKASI SURVEI']||s['Lokasi Survei']||'-') + '</td><td>' + esc(s['USER']||s['User']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'serah-terima') {
    var data = allSerahTerima || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' serah terima</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Nama Bahan</th><th>Penerima</th><th>Supplier</th><th>Kondisi</th><th>Lokasi</th><th>User</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['KODE BAHAN BAKU']||s['Kode Bahan']||'-') + '</td><td>' + esc(s['NAMA BAHAN BAKU']||s['Nama Bahan Baku']||'-') + '</td><td>' + esc(s['PENERIMA']||s['Penerima']||'-') + '</td><td>' + esc(s['SUPPLIER']||s['Supplier']||'-') + '</td><td>' + esc(s['KONDISI BAHAN BAKU']||s['Kondisi']||'-') + '</td><td>' + esc(s['LOKASI']||s['Lokasi']||'-') + '</td><td>' + esc(s['USER']||s['User']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'menu-mbg') {
    var data = allMenuMBG || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' menu</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Tanggal</th><th>Jumlah KPM</th><th>Menu</th><th>Detail Item</th></tr></thead><tbody>';
    data.forEach(function(m, i) {
      var detail = (m.detail && m.detail.length) ? m.detail.map(function(d){ return esc(d.namaItem) + ' (' + d.jumlah + ' ' + esc(d.satuan) + ')'; }).join(', ') : '-';
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(m.tanggal) + '</td><td>' + (m.jumlahKpm||0) + '</td><td>' + esc(m.menu) + '</td><td>' + detail + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'pending-payment') {
    var data = allPending || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' pending</strong></div>';
    html += '<table><thead><tr><th>No</th><th>ID</th><th>Transaksi</th><th>Deskripsi</th><th>Tgl Pending</th><th>Status</th><th>Tgl Lunas</th></tr></thead><tbody>';
    data.forEach(function(p, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(p.id) + '</td><td>' + esc(p.transaksiRef||'-') + '</td><td>' + esc(p.deskripsi||'-') + '</td><td>' + esc(p.tanggalPending||'-') + '</td><td>' + esc(p.status||'HUTANG') + '</td><td>' + esc(p.tanggalLunas||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'users') {
    var data = allUsers || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' users</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Nama</th><th>Email</th><th>Jabatan</th><th>SPPG</th><th>Username</th></tr></thead><tbody>';
    data.forEach(function(u, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(u.namaLengkap||'-') + '</td><td>' + esc(u.email||'-') + '</td><td>' + esc(u.jabatan||'-') + '</td><td>' + esc(u.sppg||'-') + '</td><td>' + esc(u.username||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'approval') {
    var data = filteredApprovalData || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' menunggu approval</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Tanggal</th><th>SPPG</th><th>Item</th><th>Nominal</th><th>Metode</th><th>Penginput</th></tr></thead><tbody>';
    data.forEach(function(tx, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(tx.kode||'-') + '</td><td>' + esc(tx.tanggal||'-') + '</td><td>' + esc(tx.sppg||'-') + '</td><td>' + esc(tx.item||'-') + '</td><td>' + formatRupiah(tx.nominal) + '</td><td>' + esc(tx.metodeTransaksi||'-') + '</td><td>' + esc(tx.user||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  return html || '<p style="text-align:center;padding:40px;">Tidak ada data.</p>';
}

// ============================================================
// 20. PAGINATION HELPER
// ============================================================
function renderPagination(containerId, currentPageNum, totalPages, callbackName) {
  var container = $(containerId);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  var html = '';
  html += '<button class="page-btn" onclick="' + callbackName + '(' + (currentPageNum - 1) + ')" ' + (currentPageNum === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
  var maxVis = 5, startP = Math.max(1, currentPageNum - Math.floor(maxVis / 2)), endP = Math.min(totalPages, startP + maxVis - 1);
  if (endP - startP + 1 < maxVis) startP = Math.max(1, endP - maxVis + 1);
  if (startP > 1) html += '<button class="page-btn" onclick="' + callbackName + '(1)">1</button><span style="color:var(--slate-400);padding:0 4px;">...</span>';
  for (var i = startP; i <= endP; i++) html += '<button class="page-btn ' + (i === currentPageNum ? 'active' : '') + '" onclick="' + callbackName + '(' + i + ')">' + i + '</button>';
  if (endP < totalPages) html += '<span style="color:var(--slate-400);padding:0 4px;">...</span><button class="page-btn" onclick="' + callbackName + '(' + totalPages + ')">' + totalPages + '</button>';
  html += '<button class="page-btn" onclick="' + callbackName + '(' + (currentPageNum + 1) + ')" ' + (currentPageNum === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
  container.innerHTML = html;
}


// ============================================================
// RECOVERY (LUPA PASSWORD / USERNAME / TOKEN)
// ============================================================
var currentRecoveryType = '';

function showRecoveryModal(type) {
  currentRecoveryType = type;
  var title = '';
  var html = '';

  if (type === 'password') {
    title = 'Lupa Kata Sandi';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Masukkan username Anda. Link reset kata sandi akan dikirim ke email yang terdaftar.</p>' +
      '<div class="form-group"><label class="form-label">Username <span class="req">*</span></label><input type="text" id="recUsername" class="form-input" placeholder="Username"></div>';
  } else if (type === 'username') {
    title = 'Lupa Username';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Masukkan email terdaftar Anda. Username dan link reset kata sandi akan dikirim ke email tersebut.</p>' +
      '<div class="form-group"><label class="form-label">Email <span class="req">*</span></label><input type="email" id="recEmail" class="form-input" placeholder="...@gmail.com"></div>';
  } else if (type === 'token') {
    title = 'Fitur Tidak Tersedia';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Fitur token login sudah tidak digunakan pada sistem saat ini. Silakan gunakan menu "Lupa Password" untuk reset kata sandi via email.</p>';
  }

  document.getElementById('recoveryTitle').textContent = title;
  document.getElementById('recoveryBody').innerHTML = html + '<div id="recoveryError" class="form-error" style="margin-top:10px;"><i class="fas fa-exclamation-circle"></i><span></span></div>';
  var submitBtn = document.getElementById('btnRecoverySubmit');
  if (submitBtn) submitBtn.style.display = (type === 'token') ? 'none' : '';
  openModal('modalRecovery');
}

function submitRecovery() {
  var errorEl = $('recoveryError');
  errorEl.classList.remove('show');

  // "token" mode sudah tidak fungsional di backend — tombol Verifikasi disembunyikan untuk mode ini.
  if (currentRecoveryType === 'token') {
    return;
  }

  var btn = $('btnRecoverySubmit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memverifikasi...';

  var data = {};

  if (currentRecoveryType === 'password') {
    data = { username: $('recUsername').value.trim() };
    if (!data.username) {
      errorEl.querySelector('span').textContent = 'Username wajib diisi.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.innerHTML = 'Verifikasi';
      return;
    }
  } else if (currentRecoveryType === 'username') {
    data = { email: $('recEmail').value.trim() };
    if (!data.email) {
      errorEl.querySelector('span').textContent = 'Email wajib diisi.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.innerHTML = 'Verifikasi';
      return;
    }
  }

  var backendFn = currentRecoveryType === 'password' ? 'recoverPassword' : 'recoverUsername';

    callApi(backendFn, [data], function(result) {
        btn.disabled = false;
              btn.innerHTML = 'Verifikasi';
              if (result.success) {
                closeModal('modalRecovery');
                showToast('success', 'Berhasil', result.message || 'Silakan cek email Anda.');
              } else {
                errorEl.querySelector('span').textContent = result.message || 'Verifikasi gagal.';
                errorEl.classList.add('show');
              }
      },
      function(err) {
        btn.disabled = false;
              btn.innerHTML = 'Verifikasi';
              errorEl.querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              errorEl.classList.add('show');
      }
    );
}

// ============================================================
// MOBILE UX: Swipe Sidebar, Back Button Android, iframe Resize
// ============================================================
(function() {
  // --- iframe ResizeObserver: kirim tinggi konten ke parent (Google Sites) ---
  function sendHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    try { window.parent.postMessage({ type: 'iframeResize', height: h }, '*'); } catch(e) {}
  }
  if (window.ResizeObserver) {
    new ResizeObserver(sendHeight).observe(document.body);
  } else {
    window.addEventListener('resize', sendHeight);
    setInterval(sendHeight, 1000);
  }
  sendHeight();

  // --- Swipe gesture untuk buka/tutup sidebar di mobile ---
  var _swipeStartX = 0, _swipeStartY = 0, _swipeActive = false;
  var SWIPE_THRESHOLD = 60, SWIPE_EDGE = 24;

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
    _swipeActive = true;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!_swipeActive) return;
    _swipeActive = false;
    var dx = e.changedTouches[0].clientX - _swipeStartX;
    var dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) return; // vertikal dominan, skip
    var sidebar = document.getElementById('mainSidebar');
    if (!sidebar) return;
    var isOpen = sidebar.classList.contains('mobile-open');
    // Swipe kanan dari edge kiri: buka sidebar
    if (!isOpen && _swipeStartX < SWIPE_EDGE && dx > SWIPE_THRESHOLD) {
      if (window.innerWidth < 768) openMobileSidebar();
    }
    // Swipe kiri saat sidebar terbuka: tutup
    if (isOpen && dx < -SWIPE_THRESHOLD) {
      closeMobileSidebar();
    }
  }, { passive: true });

  // --- Android back button: tutup modal/sidebar yang terbuka ---
  window.addEventListener('popstate', function() {
    // Tutup modal yang terbuka
    var openModal = document.querySelector('.modal-overlay:not(.hidden)');
    if (openModal) {
      var modalWrap = openModal.closest('[id]');
      if (modalWrap) { closeModal(modalWrap.id); history.pushState(null, '', location.href); return; }
    }
    // Tutup lightbox
    if (!document.getElementById('modalLightbox').classList.contains('hidden')) {
      closeLightbox(); history.pushState(null, '', location.href); return;
    }
    // Tutup sidebar mobile
    var sb = document.getElementById('mainSidebar');
    if (sb && sb.classList.contains('mobile-open')) {
      closeMobileSidebar(); history.pushState(null, '', location.href); return;
    }
  });
  // Push state awal agar back button bisa ditangkap
  history.pushState(null, '', location.href);
})();

// ============================================================
// 20b. MOBILE KEYBOARD UX — Auto-scroll field ke atas keyboard
// ============================================================
(function() {
  // Saat input/select/textarea difokus di dalam modal, scroll agar tidak tertutup keyboard
  function onFocusInModal(e) {
    var target = e.target;
    if (!target) return;
    var tagName = target.tagName.toLowerCase();
    if (!['input', 'textarea', 'select'].includes(tagName)) return;

    // Cek apakah di dalam modal
    var modalBody = target.closest('.modal-body');
    if (!modalBody) return;

    // Delay kecil agar keyboard sudah muncul
    setTimeout(function() {
      // Scroll element agar terlihat, dengan offset ekstra untuk footer
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(e) {
        target.scrollIntoView(false);
      }
    }, 350);
  }

  // Visual Viewport API — hanya scroll field aktif ke tengah, tidak ubah layout
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      // Scroll field yang sedang aktif ke posisi terlihat
      var focused = document.activeElement;
      if (!focused) return;
      var tag = focused.tagName.toLowerCase();
      if (!['input','textarea','select'].includes(tag)) return;
      var modalBody = focused.closest('.modal-body');
      if (!modalBody) return;
      setTimeout(function() {
        try { focused.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      }, 100);
    });
  }

  // Tambahkan listener fokus ke semua modal
  document.addEventListener('focusin', onFocusInModal, true);
})();

  // ============================================================
  // PWA — Install Prompt & Service Worker Registration
  // ============================================================
  var _pwaInstallEvent = null;
  var _pwaInstalled = false;

  // Tangkap event beforeinstallprompt (Chrome/Edge/Android)
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _pwaInstallEvent = e;
    // Tampilkan tombol install hanya jika belum terinstall
    if (!_pwaInstalled) {
      var btn = document.getElementById('btnInstallPWA');
      if (btn) btn.classList.add('show');
    }
  });

  // Deteksi jika sudah berjalan sebagai PWA standalone
  (function() {
    var isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0;
    if (isStandalone) {
      _pwaInstalled = true;
      var btn = document.getElementById('btnInstallPWA');
      if (btn) btn.classList.remove('show');
    }
  })();

  // Setelah install berhasil, sembunyikan tombol
  window.addEventListener('appinstalled', function() {
    _pwaInstalled = true;
    var btn = document.getElementById('btnInstallPWA');
    if (btn) btn.classList.remove('show');
    showToast('success', 'Berhasil Diinstall!', 'SIM-SPPG kini dapat dibuka seperti aplikasi native.');
    _pwaInstallEvent = null;
  });

  function triggerPWAInstall() {
    if (_pwaInstallEvent) {
      _pwaInstallEvent.prompt();
      _pwaInstallEvent.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
          showToast('success', 'Menginstall...', 'SIM-SPPG sedang ditambahkan ke layar utama.');
        } else {
          showToast('warning', 'Dibatalkan', 'Install dibatalkan. Kamu bisa install kapan saja.');
        }
        _pwaInstallEvent = null;
        var btn = document.getElementById('btnInstallPWA');
        if (btn) btn.classList.remove('show');
      });
    } else {
      // Fallback manual untuk iOS Safari & browser lain yang tidak support prompt
      showIOSInstallGuide();
    }
  }

  function showIOSInstallGuide() {
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    var isAndroid = /android/i.test(ua);

    var msg = '';
    if (isIOS && isSafari) {
      msg = 'Di Safari: ketuk ikon Bagikan (⬆️) → pilih "Tambahkan ke Layar Utama" → ketuk Tambahkan.';
    } else if (isAndroid) {
      msg = 'Di Chrome: ketuk menu ⋮ → pilih "Tambahkan ke layar utama" atau "Install aplikasi".';
    } else {
      msg = 'Di Chrome Desktop: klik ikon ⊕ di address bar, atau menu ⋮ → "Install SIM-SPPG".';
    }

    // Tampilkan sebagai toast informatif
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = '#3b82f6';
    toast.innerHTML =
      '<div class="toast-icon" style="background:#dbeafe;color:#1e40af;"><i class="fas fa-mobile-alt"></i></div>' +
      '<div class="toast-content">' +
        '<h4>Cara Install Manual</h4>' +
        '<p style="font-size:11px;line-height:1.5;">' + msg + '</p>' +
      '</div>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 8000); // tampilkan lebih lama karena instruksi panjang
  }

  // Register Service Worker (file statis /sw.js — WAJIB file nyata, bukan
  // Blob URL, supaya push notification bisa diterima walau app tertutup)
  var _swRegistration = null;
  /* Service worker lama dihapus: aplikasi sekarang memakai satu app.js. */

  // ============================================================
  // PUSH NOTIFICATION — aktivasi izin, subscribe, kirim ke backend
  // ============================================================
  var PUBLIC_VAPID_KEY = null; // diisi dari backend saat initPushNotification()

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function deviceLabel() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone/iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Macintosh/.test(ua)) return 'Mac';
    return 'Browser';
  }

  function sendSubscriptionToServer(subscriptionJson) {
    if (!currentUser) return;
    callApi('savePushSubscription', [subscriptionJson, deviceLabel()], function(result) {
      // Berhasil disimpan — tidak perlu toast tiap kali agar tidak mengganggu
    }, function(err) {
      console.error('Gagal simpan push subscription:', err);
    });
  }

  function updatePushButtonUI() {
    var btn = document.getElementById('btnEnablePush');
    if (!btn) return;
    if (!('Notification' in window) || !('PushManager' in window)) {
      btn.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted') {
      btn.classList.add('hidden'); // sudah aktif, sembunyikan tombol
    } else {
      btn.classList.remove('hidden'); // 'default' atau 'denied' — tampilkan supaya user bisa aksi
    }
  }

  function initPushNotification() {
    updatePushButtonUI();
    if (!_swRegistration || !('PushManager' in window)) return;
    if (!currentUser) return;

    // Ambil VAPID public key dari backend (sekali per sesi)
    callApi('getPushPublicKey', [], function(result) {
      if (!result || !result.success || !result.data || !result.data.publicKey) return;
      PUBLIC_VAPID_KEY = result.data.publicKey;

      // Cek subscription yang sudah ada
      _swRegistration.pushManager.getSubscription().then(function(existingSub) {
        if (existingSub) {
          sendSubscriptionToServer(existingSub.toJSON());
          return;
        }
        // Belum ada subscription — minta izin & subscribe
        if (Notification.permission === 'granted') {
          subscribeUserToPush();
        }
        // Jika permission masih 'default', tunggu user klik tombol aktifkan
        // notifikasi (lihat promptEnablePushNotification()) agar tidak
        // langsung memunculkan dialog izin tanpa konteks.
      });
    }, null);
  }

  function subscribeUserToPush() {
    if (!_swRegistration || !PUBLIC_VAPID_KEY) return;
    _swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    }).then(function(sub) {
      sendSubscriptionToServer(sub.toJSON());
      updatePushButtonUI();
      showToast('success', 'Notifikasi Aktif', 'Anda akan menerima notifikasi push di perangkat ini.');
    }).catch(function(err) {
      console.error('Gagal subscribe push:', err);
      updatePushButtonUI();
    });
  }

  // Dipanggil dari tombol UI (lonceng / pengaturan) untuk meminta izin secara eksplisit
  function promptEnablePushNotification() {
    if (!('Notification' in window)) {
      showToast('warning', 'Tidak Didukung', 'Browser ini tidak mendukung notifikasi push.');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('warning', 'Izin Diblokir', 'Aktifkan izin notifikasi lewat pengaturan browser/aplikasi Anda.');
      return;
    }
    if (Notification.permission === 'granted') {
      subscribeUserToPush();
      return;
    }
    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        subscribeUserToPush();
      } else {
        showToast('warning', 'Izin Ditolak', 'Anda tidak akan menerima notifikasi push.');
      }
      updatePushButtonUI();
    });
  }
 
  // ============================================================
  // SUARA NOTIFIKASI (untuk saat app sedang dibuka — lonceng in-app)
  // ============================================================
  var _notifAudioCtx = null;
  function playNotifSound() {
    try {
      if (!_notifAudioCtx) {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        _notifAudioCtx = new AudioCtx();
      }
      var ctx = _notifAudioCtx;
      var now = ctx.currentTime;
      [880, 1108].forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.3);
      });
    } catch (e) { /* noop jika browser blokir autoplay audio */ }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var lpwd = document.getElementById('loginPassword');
    if (lpwd) lpwd.addEventListener('keypress', function(e) { if (e.key === 'Enter') doLogin(); });
  });

  document.addEventListener('click', function(e) {
    var boxes = document.querySelectorAll('.autocomplete-box');
    boxes.forEach(function(box) {
      if (!box.contains(e.target)) {
        var dd = box.querySelector('.autocomplete-dropdown');
        if (dd) dd.classList.remove('active');
      }
    });
  });

  try {
    if (safeStorage('get', 'sidebarCollapsed') === '1') {
      sidebarCollapsed = true;
      document.getElementById('mainSidebar').classList.add('collapsed');
      document.getElementById('mainWrapper').classList.add('sidebar-collapsed');
    }
  } catch(e) {}

  document.body.style.overflow = '';
  document.body.style.position = '';

  if (checkSession()) {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    initApp();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeLightbox();
      // Tutup modal teratas yang sedang terbuka (selain lightbox, yang sudah ditangani di atas)
      var openModals = document.querySelectorAll('[id^="modal"]:not(.hidden)');
      if (openModals.length > 0) {
        var topModal = openModals[openModals.length - 1];
        closeModal(topModal.id);
      }
    }
  });

/* ===== INLINE MODULE 3 ===== */
/* ===== INLINE: app.js ===== */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.id = 'sim-sppg-runtime-fixes';
  style.textContent = [
    '.auth-container .auth-sub{color:var(--slate-400);font-size:13px;margin-bottom:24px;text-align:center;line-height:1.5}',
    '#btnLogin{touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:46px}',
    '.quick-access-section{margin-bottom:24px}',
    '.stat-card{background:#fff;border-radius:20px;padding:18px 16px;display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.stat-icon{width:56px;height:56px;min-width:56px;display:flex;align-items:center;justify-content:center}',
    '.notif-item{position:relative;display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--slate-100);background:var(--white);transition:.2s ease;cursor:pointer}',
    '.notif-item:hover,.notif-item:focus-visible{background:var(--slate-50);outline:none}',
    '.notif-item.unread{background:linear-gradient(90deg,#eff8ff 0%,#fff 70%);box-shadow:inset 3px 0 0 var(--primary)}',
    '.notif-item.unread:after{content:"";position:absolute;right:12px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--primary)}',
    '.notif-item-icon{width:40px;height:40px;min-width:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px}',
    '.notif-item-icon.action-add{background:#dcfce7;color:#15803d}.notif-item-icon.action-edit{background:#fef3c7;color:#b45309}.notif-item-icon.action-delete{background:#ffe4e6;color:#be123c}',
    '.notif-item-content{min-width:0;flex:1}.notif-item-head{display:flex;align-items:center;gap:8px;padding-right:14px;margin-bottom:5px}',
    '.notif-item-title{font-weight:700;color:var(--slate-800);font-size:13px;line-height:1.35;flex:1}',
    '.notif-action-chip{font-size:9px;font-weight:800;letter-spacing:.35px;text-transform:uppercase;padding:3px 7px;border-radius:999px;white-space:nowrap}',
    '.notif-action-chip.add{background:#dcfce7;color:#166534}.notif-action-chip.edit{background:#fef3c7;color:#92400e}.notif-action-chip.delete{background:#ffe4e6;color:#9f1239}',
    '.notif-item-desc{font-size:12px;line-height:1.5;color:var(--slate-600);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}',
    '.notif-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:10px;color:var(--slate-400)}.notif-item-meta span{display:inline-flex;align-items:center;gap:4px}.notif-item-arrow{margin-left:auto;color:var(--slate-300)}',
    '.notif-empty{padding:34px 18px;text-align:center;color:var(--slate-400)}.notif-empty i{font-size:28px;margin-bottom:10px}.notif-empty strong{display:block;color:var(--slate-600);font-size:13px;margin-bottom:3px}',
    '@media(max-width:600px){#notifPanel{position:fixed!important;left:10px!important;right:10px!important;top:calc(var(--header-height) + 8px)!important;width:auto!important;max-height:calc(100dvh - var(--header-height) - 24px)!important}.notif-item{padding:13px 14px}.notif-item-icon{width:38px;height:38px;min-width:38px}}'
  ].join('');
  document.head.appendChild(style);

  function setExternalLinkTargets() {
    var currentOrigin = location.origin;
    document.querySelectorAll('a[href]').forEach(function (link) {
      try {
        var url = new URL(link.getAttribute('href'), location.href);
        if (/^(https?:)$/.test(url.protocol) && url.origin !== currentOrigin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (_) {}
    });
  }

  function normalizeAllUsersCall() {
    if (typeof window.callApi !== 'function' || window.callApi.__allUsersFixed) return;
    var original = window.callApi;
    function wrapped(action, args) {
      var forwarded = Array.prototype.slice.call(arguments);
      if (action === 'getAllUsers' && (!Array.isArray(args) || args.length === 0)) {
        var role = window.currentUser && window.currentUser.role ? window.currentUser.role : '';
        forwarded[1] = role ? [role] : [];
      }
      return original.apply(this, forwarded);
    }
    wrapped.__allUsersFixed = true;
    window.callApi = wrapped;
  }

  var lastSppgSignature = '';
  function populateSppgDatalist() {
    var datalist = document.getElementById('sppgDatalist');
    if (!datalist || !Array.isArray(window.sppgList)) return;
    var values = window.sppgList.map(function (item) {
      return typeof item === 'string' ? item : (item && (item.SPPG || item.nama || item.name));
    }).filter(Boolean).map(function (value) { return String(value).trim(); });
    var signature = values.join('|');
    if (signature === lastSppgSignature && datalist.options.length === values.length) return;
    lastSppgSignature = signature;
    var fragment = document.createDocumentFragment();
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      fragment.appendChild(option);
    });
    datalist.replaceChildren(fragment);
  }

  function bindMobileLogin() {
    var btn = document.getElementById('btnLogin');
    var username = document.getElementById('loginUsername');
    var password = document.getElementById('loginPassword');
    if (!btn || typeof window.doLogin !== 'function' || btn.dataset.mobileLoginBound === '1') return;
    btn.dataset.mobileLoginBound = '1';
    btn.type = 'button';
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      if (!btn.disabled) window.doLogin();
    });
    [username, password].forEach(function (input) {
      if (!input) return;
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!btn.disabled) window.doLogin();
        }
      });
    });
  }

  function validateEditUserSppg() {
    if (typeof window.saveEditUser !== 'function' || window.saveEditUser.__sppgValidated) return;
    var original = window.saveEditUser;
    function wrapped() {
      var input = document.getElementById('editUserSPPG');
      var value = input ? input.value.trim().toUpperCase() : '';
      var master = Array.isArray(window.SPPG_MASTER) ? window.SPPG_MASTER.map(function (item) { return String(item).trim().toUpperCase(); }) : [];
      if (value && master.length && master.indexOf(value) === -1) {
        if (typeof window.showToast === 'function') window.showToast('warning', 'SPPG Tidak Valid', 'Pilih SPPG dari daftar yang tersedia.');
        if (input) input.focus();
        return;
      }
      return original.apply(this, arguments);
    }
    wrapped.__sppgValidated = true;
    window.saveEditUser = wrapped;
  }

  function fixNominalRaw() {
    if (typeof window.getNominalRaw !== 'function' || window.getNominalRaw.__mobileFixed) return;
    var original = window.getNominalRaw;
    function wrapped(inputOrId) {
      var result = Number(original.apply(this, arguments)) || 0;
      var input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
      if (!input && arguments.length === 0) input = document.getElementById('addTxNominal');
      if (input) {
        var parsed = Number(String(input.value || '').replace(/[^0-9]/g, '')) || 0;
        if (parsed > 0 && result !== parsed) { input.dataset.raw = String(parsed); result = parsed; }
      }
      return result;
    }
    wrapped.__mobileFixed = true;
    window.getNominalRaw = wrapped;
  }

  function resetVerificationMode() { try { verifikasiPembayaranMode = false; } catch (_) {} }
  function syncBodyOverflow() {
    var visibleModal = Array.prototype.some.call(document.querySelectorAll('.modal'), function (modal) {
      return getComputedStyle(modal).display !== 'none' && !modal.classList.contains('hidden');
    });
    document.body.style.overflow = visibleModal ? 'hidden' : '';
    try { _openModalCount = visibleModal ? Math.max(1, Number(_openModalCount) || 0) : 0; } catch (_) {}
  }

  function fixModalLifecycle() {
    if (typeof window.closeModal === 'function' && !window.closeModal.__verificationFixed) {
      var originalClose = window.closeModal;
      window.closeModal = function (id) {
        var modalId = typeof id === 'string' ? id : (id && id.id);
        if (modalId === 'modalPin') resetVerificationMode();
        var result = originalClose.apply(this, arguments);
        requestAnimationFrame(syncBodyOverflow);
        return result;
      };
      window.closeModal.__verificationFixed = true;
    }
  }

  function relativeTime(raw, fallback) {
    if (!raw) return fallback || '-';
    var date = new Date(raw);
    if (isNaN(date.getTime())) return fallback || raw;
    var minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return minutes + ' menit lalu';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' jam lalu';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + ' hari lalu';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function installNotificationOverride() {
    var panel = document.getElementById('notifPanelList');
    if (!panel || typeof window.$ !== 'function' || !Array.isArray(window.notifList) || typeof window.esc !== 'function') return;
    window.renderNotifPanel = function () {
      var listEl = window.$('notifPanelList');
      if (!listEl) return;
      if (!window.notifList.length) {
        listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><strong>Belum ada notifikasi</strong><p>Aktivitas penting aplikasi akan muncul di sini.</p></div>';
        return;
      }
      listEl.innerHTML = window.notifList.map(function (item, index) {
        var type = item.actionType === 'DELETE' ? ['delete','Dihapus','action-delete'] : item.actionType === 'EDIT' ? ['edit','Diperbarui','action-edit'] : ['add','Baru','action-add'];
        var actor = String(item.pelaku || 'Sistem').trim() || 'Sistem';
        var desc = String(item.deskripsi || '').trim() || ((item.label || 'Aktivitas aplikasi') + ' oleh ' + actor + '.');
        return '<div class="notif-item ' + (item.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + index + ')" role="button" tabindex="0">' +
          '<div class="notif-item-icon ' + type[2] + '"><i class="fas ' + window.esc(item.icon || 'fa-bell') + '"></i></div>' +
          '<div class="notif-item-content"><div class="notif-item-head"><div class="notif-item-title">' + window.esc(item.label || 'Aktivitas Baru') + '</div><span class="notif-action-chip ' + type[0] + '">' + type[1] + '</span></div>' +
          '<div class="notif-item-desc">' + window.esc(desc) + '</div><div class="notif-item-meta"><span><i class="fas fa-user-circle"></i>' + window.esc(actor) + '</span><span><i class="fas fa-clock"></i>' + window.esc(relativeTime(item.waktuRaw, item.waktu)) + '</span></div></div></div>';
      }).join('');
    };
    window.renderNotifPanel();
  }

  var attempts = 0;
  function installFixes() {
    attempts += 1;
    setExternalLinkTargets();
    normalizeAllUsersCall();
    populateSppgDatalist();
    bindMobileLogin();
    validateEditUserSppg();
    fixNominalRaw();
    fixModalLifecycle();
    installNotificationOverride();
    if (attempts < 40 && (typeof window.callApi !== 'function' || typeof window.doLogin !== 'function')) setTimeout(installFixes, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFixes, { once: true });
  else installFixes();

  var observerScheduled = false;
  new MutationObserver(function (records) {
    var relevant = records.some(function (record) {
      return !(record.target && (record.target.id === 'sppgDatalist' || (record.target.closest && record.target.closest('#sppgDatalist'))));
    });
    if (!relevant || observerScheduled) return;
    observerScheduled = true;
    setTimeout(function () {
      observerScheduled = false;
      setExternalLinkTargets();
      populateSppgDatalist();
      bindMobileLogin();
      fixModalLifecycle();
    }, 120);
  }).observe(document.body, { childList: true, subtree: true });
})();

/* ===== INLINE: dashboard-ui-v2.js ===== */
(function(){
'use strict';
var charts={};
function $(id){return document.getElementById(id)}
function money(v){return 'Rp '+(Number(v)||0).toLocaleString('id-ID')}
function compact(v){v=Number(v)||0;if(Math.abs(v)>=1e9)return 'Rp '+(v/1e9).toFixed(1).replace('.0','')+' M';if(Math.abs(v)>=1e6)return 'Rp '+(v/1e6).toFixed(1).replace('.0','')+' Jt';if(Math.abs(v)>=1e3)return 'Rp '+Math.round(v/1e3)+' Rb';return money(v)}
function num(id){var n=$(id);return n?Number(String(n.textContent||'').replace(/[^0-9-]/g,''))||0:0}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function api(name,args){return new Promise(function(resolve){if(typeof window.callApi!=='function')return resolve(null);window.callApi(name,args||[],resolve,function(){resolve(null)})})}
function range(days){var e=new Date(),s=new Date();s.setDate(e.getDate()-days+1);function f(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}return{start:f(s),end:f(e)}}
function css(){if($('dash-v2-css'))return;var s=document.createElement('style');s.id='dash-v2-css';s.textContent=`
#page-dashboard{--d-blue:#1e6f9c;--d-navy:#153754;--d-green:#10b981;--d-rose:#f43f5e;--d-amber:#f59e0b}
.dash-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.45fr .55fr;gap:22px;padding:26px;margin-bottom:18px;border-radius:24px;background:linear-gradient(135deg,#153754,#1e6f9c 60%,#168aad);color:#fff;box-shadow:0 18px 44px rgba(21,55,84,.18)}
.dash-hero:after{content:"";position:absolute;width:260px;height:260px;right:-100px;top:-130px;border-radius:50%;background:rgba(255,255,255,.08)}.dash-hero>*{position:relative;z-index:1}
.dash-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}
.dash-hero h2{margin:13px 0 7px;font-size:clamp(23px,3vw,34px);letter-spacing:-.7px}.dash-hero p{max-width:720px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.65}
.dash-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:17px}.dash-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:12px;background:rgba(255,255,255,.11);font-size:11px;font-weight:600}
.dash-health{height:100%;padding:18px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.1);backdrop-filter:blur(10px)}.dash-health-head{display:flex;justify-content:space-between;font-size:11px;font-weight:700}.dash-score{font-size:31px;font-weight:800;margin-top:12px}.dash-health p{font-size:10px;margin:2px 0 0}.dash-bar{height:8px;margin:14px 0 10px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden}.dash-bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#6ee7b7,#fde68a);border-radius:inherit;transition:.45s}
#page-dashboard .stats-grid{gap:14px;margin-bottom:18px}#page-dashboard .stat-card{position:relative;overflow:hidden;align-items:flex-start;text-align:left;min-height:148px;padding:18px;border:1px solid #e5edf4;border-radius:18px;box-shadow:0 9px 24px rgba(15,23,42,.055);transition:.2s}#page-dashboard .stat-card:hover{transform:translateY(-3px);box-shadow:0 15px 32px rgba(15,23,42,.09)}
#page-dashboard .stat-card:after{content:"";position:absolute;width:90px;height:90px;right:-38px;top:-38px;border-radius:50%;background:rgba(30,111,156,.08)}#page-dashboard .stat-card:nth-child(2):after{background:rgba(16,185,129,.1)}#page-dashboard .stat-card:nth-child(3):after{background:rgba(244,63,94,.1)}#page-dashboard .stat-card:nth-child(4):after{background:rgba(245,158,11,.12)}
#page-dashboard .stat-icon{width:44px;height:44px;min-width:44px;border-radius:14px;margin-bottom:17px}#page-dashboard .stat-info{width:100%}#page-dashboard .stat-value{font-size:clamp(19px,2vw,25px);font-weight:800;color:#172b3a;letter-spacing:-.5px}#page-dashboard .stat-label{margin-top:5px;font-size:12px;font-weight:700;color:#526577}#page-dashboard .stat-trend{margin-top:9px;font-size:10px}
.dash-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:16px;margin-bottom:16px}.dash-grid.equal{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-panel{min-width:0;background:#fff;border:1px solid #e4edf4;border-radius:20px;box-shadow:0 10px 28px rgba(15,23,42,.05)}
.dash-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 0}.dash-title{display:flex;align-items:center;gap:11px}.dash-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#eaf5fb;color:#1e6f9c}.dash-panel h3{font-size:14px;color:#1d3344;margin:0}.dash-desc{font-size:10px;color:#7b8d9b;margin-top:3px}.dash-body{padding:12px 18px 18px}.dash-chart{height:285px;position:relative}.dash-filter{padding:7px 9px;border:1px solid #d9e5ee;border-radius:10px;background:#fff;color:#42586b;font-size:10px;font-weight:700}
.dash-insights{display:grid;gap:10px}.dash-insight{display:flex;gap:11px;padding:12px;border:1px solid #edf2f6;border-radius:14px;background:#f7fafc}.dash-insight i{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:11px}.dash-insight strong{display:block;font-size:11px;color:#243b4d;margin-bottom:3px}.dash-insight span{display:block;font-size:10px;line-height:1.45;color:#718394}
.dash-sppg{display:grid;gap:10px}.dash-sppg-row{display:grid;grid-template-columns:minmax(90px,1fr) minmax(100px,1.25fr) auto;gap:11px;align-items:center}.dash-sppg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:700;color:#334b5e}.dash-track{height:7px;background:#edf3f7;border-radius:999px;overflow:hidden}.dash-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#1e6f9c)}.dash-val{font-size:10px;font-weight:800;color:#1e425c}.dash-empty{display:grid;place-items:center;min-height:210px;text-align:center;color:#8293a2}.dash-empty i{font-size:27px;color:#bdd0dc;margin-bottom:8px}.dash-empty strong{display:block;font-size:11px}
@media(max-width:980px){.dash-hero,.dash-grid,.dash-grid.equal{grid-template-columns:1fr}}@media(max-width:640px){.dash-hero{padding:20px;border-radius:20px}.dash-health{display:none}#page-dashboard .stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#page-dashboard .stat-card{min-width:0;min-height:136px;padding:14px}#page-dashboard .stat-value{font-size:17px}.dash-chart{height:245px}.dash-head{padding:15px 15px 0}.dash-body{padding:10px 15px 15px}}
`;document.head.appendChild(s)}
function hero(){return `<section class="dash-hero"><div><span class="dash-eyebrow"><i class="fas fa-chart-line"></i> Ringkasan operasional</span><h2 id="dashGreeting">Selamat datang di SIM-SPPG</h2><p>Pantau arus kas, transaksi yang memerlukan perhatian, dan performa setiap unit SPPG dalam satu tampilan.</p><div class="dash-meta"><span class="dash-chip"><i class="fas fa-building"></i><span id="dashSppg">Semua SPPG</span></span><span class="dash-chip"><i class="fas fa-user-shield"></i><span id="dashRole">Pengguna</span></span><span class="dash-chip"><i class="fas fa-calendar-day"></i><span id="dashDate">-</span></span></div></div><div class="dash-health"><div class="dash-health-head"><span>Kesehatan anggaran</span><i class="fas fa-shield-alt"></i></div><div class="dash-score" id="dashScore">0%</div><p id="dashHealthText">Menunggu data transaksi</p><div class="dash-bar"><span id="dashBar"></span></div><p>Rasio saldo terhadap total pemasukan.</p></div></section>`}
function panels(){return `<div id="dashPanels"><div class="dash-grid"><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-chart-area"></i></div><div><h3>Tren arus kas</h3><div class="dash-desc">Pemasukan, pengeluaran, dan saldo harian</div></div></div><select id="dashPeriod" class="dash-filter"><option value="7">7 hari</option><option value="30" selected>30 hari</option><option value="90">90 hari</option></select></div><div class="dash-body"><div class="dash-chart"><canvas id="dashCashflow"></canvas></div></div></section><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-lightbulb"></i></div><div><h3>Insight hari ini</h3><div class="dash-desc">Sorotan otomatis operasional</div></div></div></div><div class="dash-body"><div id="dashInsights" class="dash-insights"></div></div></section></div><div class="dash-grid equal"><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-chart-pie"></i></div><div><h3>Komposisi transaksi</h3><div class="dash-desc">Porsi pemasukan dan pengeluaran</div></div></div></div><div class="dash-body"><div class="dash-chart"><canvas id="dashComposition"></canvas></div></div></section><section id="dashSppgPanel" class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-building"></i></div><div><h3>Pengeluaran per SPPG</h3><div class="dash-desc">Unit dengan pengeluaran terbesar</div></div></div></div><div class="dash-body"><div id="dashSppgList" class="dash-sppg"></div></div></section></div></div>`}
function applyDashboardRoleVisibility(){var u=window.currentUser||{},panel=$('dashSppgPanel'),grid=panel&&panel.parentElement,isAdmin=u.role==='ADMIN'||u.role==='SUPER_ADMIN';if(panel)panel.style.display=isAdmin?'':'none';if(grid)grid.style.gridTemplateColumns=isAdmin?'':'minmax(0,1fr)'}
function identity(){var u=window.currentUser||{},h=new Date().getHours(),g=h<11?'Selamat pagi':h<15?'Selamat siang':h<19?'Selamat sore':'Selamat malam';if($('dashGreeting'))$('dashGreeting').textContent=g+(u.namaLengkap?', '+u.namaLengkap.split(' ')[0]:'')+'.';if($('dashSppg'))$('dashSppg').textContent=u.role==='SUPER_ADMIN'?'Seluruh SPPG':(u.sppg||'SPPG belum ditentukan');if($('dashRole'))$('dashRole').textContent=String(u.role||u.jabatan||'Pengguna').replace(/_/g,' ');if($('dashDate'))$('dashDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
function health(){var inc=num('statPemasukan'),bal=num('statSaldo'),score=inc?Math.max(0,Math.min(100,Math.round(bal/inc*100))):0;if($('dashScore'))$('dashScore').textContent=score+'%';if($('dashBar'))$('dashBar').style.width=score+'%';if($('dashHealthText'))$('dashHealthText').textContent=score>=50?'Kondisi anggaran sehat':score>=20?'Perlu pengendalian belanja':inc?'Saldo perlu perhatian':'Menunggu data transaksi'}
function empty(canvas,msg){if(!canvas)return;canvas.style.display='none';canvas.parentElement.innerHTML='<div class="dash-empty"><div><i class="fas fa-chart-area"></i><strong>'+esc(msg)+'</strong></div></div>'}
function renderCharts(rows){if(!window.Chart)return;Chart.defaults.font.family='Inter, sans-serif';Chart.defaults.color='#708293';var c=$('dashCashflow');if(charts.cash)charts.cash.destroy();if(!rows.length)empty(c,'Belum ada data tren pada periode ini.');else charts.cash=new Chart(c,{type:'line',data:{labels:rows.map(r=>r.tanggal),datasets:[{label:'Pemasukan',data:rows.map(r=>+r.pemasukan||0),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.08)',fill:true,tension:.35,borderWidth:2,pointRadius:2},{label:'Pengeluaran',data:rows.map(r=>+r.pengeluaran||0),borderColor:'#f43f5e',backgroundColor:'rgba(244,63,94,.06)',fill:true,tension:.35,borderWidth:2,pointRadius:2},{label:'Saldo',data:rows.map(r=>+r.saldo||0),borderColor:'#1e6f9c',tension:.35,borderWidth:2.5,pointRadius:1,borderDash:[5,4]}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.raw)}}},scales:{x:{grid:{display:false},ticks:{maxRotation:0,maxTicksLimit:7}},y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.13)'},ticks:{callback:compact}}}}});var d=$('dashComposition');if(charts.comp)charts.comp.destroy();var inc=num('statPemasukan'),exp=num('statPengeluaran');if(!inc&&!exp)empty(d,'Komposisi transaksi belum tersedia.');else charts.comp=new Chart(d,{type:'doughnut',data:{labels:['Pemasukan','Pengeluaran'],datasets:[{data:[inc,exp],backgroundColor:['#10b981','#f43f5e'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.label+': '+money(c.raw)}}}}})}
function renderSppg(rows){var box=$('dashSppgList'),data=(rows||[]).slice().sort((a,b)=>(+b.pengeluaran||0)-(+a.pengeluaran||0)).slice(0,7);if(!data.length){box.innerHTML='<div class="dash-empty"><div><i class="fas fa-building"></i><strong>Data per SPPG belum tersedia.</strong></div></div>';return}var max=Math.max.apply(null,data.map(r=>+r.pengeluaran||0))||1;box.innerHTML=data.map(r=>`<div class="dash-sppg-row"><div class="dash-sppg-name" title="${esc(r.name)}">${esc(r.name)}</div><div class="dash-track"><span style="width:${Math.max(3,Math.round((+r.pengeluaran||0)/max*100))}%"></span></div><div class="dash-val">${compact(r.pengeluaran)}</div></div>`).join('')}
function insights(rows,sppg){var box=$('dashInsights'),queue=num('statAntrian'),pending=num('statAntrianNominal'),last=rows[rows.length-1],top=(sppg||[]).slice().sort((a,b)=>(+b.pengeluaran||0)-(+a.pengeluaran||0))[0],items=[['fa-hourglass-half','#fff7ed','#c2410c',queue+' transaksi menunggu approval',pending?'Nominal tertunda '+money(pending)+'.':'Tidak ada nominal tertunda.'],['fa-calendar-check','#ecfdf5','#047857',last?'Aktivitas terakhir '+last.tanggal:'Belum ada aktivitas harian',last?'Pemasukan '+money(last.pemasukan)+' dan pengeluaran '+money(last.pengeluaran)+'.':'Data muncul setelah transaksi tercatat.'],['fa-building','#eff6ff','#1d4ed8',top?top.name+' tertinggi':'Perbandingan SPPG belum tersedia',top?'Pengeluaran tercatat '+money(top.pengeluaran)+'.':'Data unit belum tersedia.'],['fa-shield-alt','#f5f3ff','#6d28d9','Kontrol pengeluaran','Pastikan bukti transaksi dan approval selalu lengkap.']];box.innerHTML=items.map(i=>`<div class="dash-insight"><i class="fas ${i[0]}" style="background:${i[1]};color:${i[2]}"></i><div><strong>${esc(i[3])}</strong><span>${esc(i[4])}</span></div></div>`).join('')}
var loading=false,lastLoad=0;async function load(force){if(loading||!window.currentUser||(!force&&Date.now()-lastLoad<30000))return;loading=true;var days=+$('dashPeriod').value||30,r=range(days),res=await Promise.all([api('getChartData',[{dateStart:r.start,dateEnd:r.end}]),api('getSPPGData',[r.start,r.end])]),rows=Array.isArray(res[0])?res[0]:[],sppg=Array.isArray(res[1])?res[1]:[];renderCharts(rows);renderSppg(sppg);insights(rows,sppg);identity();health();lastLoad=Date.now();loading=false}
function init(){var page=$('page-dashboard'),stats=$('dashboardStats'),quick=$('quickAccessSection');if(!page||!stats||!quick)return setTimeout(init,300);if($('dashPanels'))return;css();stats.insertAdjacentHTML('beforebegin',hero());page.insertBefore(quick,stats);stats.insertAdjacentHTML('afterend',panels());applyDashboardRoleVisibility();$('dashPeriod').addEventListener('change',()=>load(true));['statSaldo','statPemasukan','statPengeluaran','statAntrian','statAntrianNominal'].forEach(id=>{var n=$(id);if(n)new MutationObserver(function(){health();if(id!=='statSaldo')setTimeout(function(){renderCharts([])},0)}).observe(n,{childList:true,subtree:true,characterData:true})});identity();health();setInterval(function(){var p=$('page-dashboard');if(p&&!p.classList.contains('hidden')&&getComputedStyle(p).display!=='none')load(false)},1400);setTimeout(()=>load(true),700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* ===== INLINE: dashboard-ui-fix.js ===== */
(function(){
'use strict';
var repairing=false;
function repair(){
  if(repairing)return;
  var cashWrap=document.querySelector('#dashPanels .dash-grid:first-child .dash-chart');
  var compWrap=document.querySelector('#dashPanels .dash-grid.equal .dash-chart');
  var changed=false;
  if(cashWrap&&!document.getElementById('dashCashflow')){cashWrap.innerHTML='<canvas id="dashCashflow"></canvas>';changed=true;}
  if(compWrap&&!document.getElementById('dashComposition')){compWrap.innerHTML='<canvas id="dashComposition"></canvas>';changed=true;}
  if(changed){
    repairing=true;
    setTimeout(function(){
      var period=document.getElementById('dashPeriod');
      if(period)period.dispatchEvent(new Event('change',{bubbles:true}));
      repairing=false;
    },120);
  }
}
new MutationObserver(function(){setTimeout(repair,30)}).observe(document.documentElement,{childList:true,subtree:true});
})();

// ============================================================
// MODUL: LAPORAN — Generate PDF & Kirim ke Telegram
// ============================================================

const TELEGRAM_BOT_TOKEN = '8824501449:AAGIkv_IuenEXdQZdZov11g5Vz-4Qmg-_vI';
const SUPABASE_URL_LAPORAN = 'https://dmjsgtichrfxhyywstrt.supabase.co';

// --- State tombol ---
function setLaporanLoading(isLoading, stepText) {
  const btn = document.getElementById('btn-kirim-laporan');
  const icon = document.getElementById('btn-laporan-icon');
  const text = document.getElementById('btn-laporan-text');
  const progress = document.getElementById('laporan-progress');
  const progressText = document.getElementById('laporan-progress-text');
  if (isLoading) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.textContent = '⏳';
    text.textContent = 'Memproses...';
    progress.style.display = 'block';
    progressText.textContent = stepText || '⏳ Memproses...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    icon.textContent = '📤';
    text.textContent = 'Kirim Laporan ke Telegram';
    progress.style.display = 'none';
  }
}

function updateLaporanProgress(text) {
  const el = document.getElementById('laporan-progress-text');
  if (el) el.textContent = text;
}

// --- Format angka Rupiah ---
function formatRupiahLaporan(n) {
  if (!n && n !== 0) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// --- Format tanggal Indonesia ---
function formatTglLaporan(tgl) {
  if (!tgl) return '-';
  const d = new Date(tgl);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

// --- MAIN HANDLER: Tombol Kirim Laporan ---
async function handleKirimLaporan() {
  const tglMulai  = document.getElementById('laporan-tgl-mulai').value;
  const tglSelesai = document.getElementById('laporan-tgl-selesai').value;
  const chatId    = document.getElementById('laporan-chat-id').value.trim() || '8739721946';

  // Validasi input
  if (!tglMulai || !tglSelesai) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('Peringatan', 'Harap isi Tanggal Mulai dan Tanggal Selesai.', 'warning');
    } else {
      alert('Harap isi Tanggal Mulai dan Tanggal Selesai.');
    }
    return;
  }
  if (new Date(tglMulai) > new Date(tglSelesai)) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('Peringatan', 'Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.', 'warning');
    } else {
      alert('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
    }
    return;
  }
  if (!chatId) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('Peringatan', 'Harap isi Chat ID Telegram tujuan.', 'warning');
    } else {
      alert('Harap isi Chat ID Telegram tujuan.');
    }
    return;
  }

  // Ambil info user saat ini
  const currentUser = window.currentUser || {};
  const userEmail   = currentUser.email || currentUser.EMAIL || '-';
  const userName    = currentUser['NAMA LENGKAP'] || currentUser.nama || '-';
  const userRole    = currentUser.ROLE || '-';

  setLaporanLoading(true, '📡 Mengambil data transaksi dari Supabase...');

  let transaksiData = [];
  let statusKirim   = false;
  let fileUrl       = null;
  let fileName      = null;
  let errorMsg      = null;

  try {
    // STEP 1: Fetch data TRANSAKSI
    updateLaporanProgress('📡 Step 1/5 — Mengambil data transaksi...');
    const sbToken = window._supabaseToken || (typeof supabase !== 'undefined' && supabase.auth ?
      (await supabase.auth.getSession()).data.session?.access_token : null);

    const resTx = await fetch(
      `${SUPABASE_URL_LAPORAN}/rest/v1/TRANSAKSI?select=*&Tanggal=gte.${tglMulai}&Tanggal=lte.${tglSelesai}&order=Tanggal.asc`,
      {
        headers: {
          apikey: window._supabaseKey || '',
          Authorization: sbToken ? `Bearer ${sbToken}` : '',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!resTx.ok) throw new Error(`Gagal fetch TRANSAKSI: ${resTx.status}`);
    transaksiData = await resTx.json();

    // STEP 2: Generate PDF
    updateLaporanProgress('📄 Step 2/5 — Membuat file PDF...');
    const pdfBlob = await generateLaporanPDF(transaksiData, tglMulai, tglSelesai, userName, userRole);

    // STEP 3: Upload ke Supabase Storage
    updateLaporanProgress('☁️ Step 3/5 — Mengupload PDF ke Storage...');
    const ts = Date.now();
    fileName = `laporan_${tglMulai}_${tglSelesai}_${ts}.pdf`;
    const uploadResult = await uploadLaporanToStorage(pdfBlob, fileName, sbToken);
    fileUrl = uploadResult;

    // STEP 4: Kirim ke Telegram
    updateLaporanProgress('📨 Step 4/5 — Mengirim ke Telegram...');
    await kirimLaporanTelegram(pdfBlob, fileName, chatId, {
      tglMulai, tglSelesai, userName, userRole,
      jumlahTransaksi: transaksiData.length
    });
    statusKirim = true;

    // STEP 5: Catat riwayat
    updateLaporanProgress('💾 Step 5/5 — Menyimpan riwayat...');
    await simpanRiwayatLaporan({
      periode_awal: tglMulai,
      periode_akhir: tglSelesai,
      file_url: fileUrl,
      file_name: fileName,
      generated_by: userEmail,
      generated_by_name: userName,
      generated_by_role: userRole,
      status_kirim: true,
      jumlah_transaksi: transaksiData.length,
      keterangan: `Chat ID: ${chatId}`
    }, sbToken);

    setLaporanLoading(false);
    if (typeof Swal !== 'undefined') {
      Swal.fire('Berhasil! ✅', `Laporan berhasil dikirim ke Telegram.\n\nTotal: ${transaksiData.length} transaksi dalam periode ${formatTglLaporan(tglMulai)} s/d ${formatTglLaporan(tglSelesai)}.`, 'success');
    } else {
      alert('Laporan berhasil dikirim ke Telegram!');
    }
    loadRiwayatLaporan();

  } catch (err) {
    console.error('[LAPORAN ERROR]', err);
    errorMsg = err.message || 'Terjadi kesalahan tidak diketahui.';

    // Coba catat riwayat gagal
    try {
      const sbToken2 = window._supabaseToken || null;
      const currentUser2 = window.currentUser || {};
      await simpanRiwayatLaporan({
        periode_awal: tglMulai,
        periode_akhir: tglSelesai,
        file_url: fileUrl,
        file_name: fileName,
        generated_by: currentUser2.email || currentUser2.EMAIL || '-',
        generated_by_name: currentUser2['NAMA LENGKAP'] || '-',
        generated_by_role: currentUser2.ROLE || '-',
        status_kirim: false,
        jumlah_transaksi: transaksiData.length,
        keterangan: `GAGAL: ${errorMsg}`
      }, sbToken2);
    } catch (e2) { /* silent */ }

    setLaporanLoading(false);
    if (typeof Swal !== 'undefined') {
      Swal.fire('Gagal ❌', `Terjadi kesalahan: ${errorMsg}`, 'error');
    } else {
      alert('Gagal: ' + errorMsg);
    }
    loadRiwayatLaporan();
  }
}

// --- Generate PDF menggunakan jsPDF ---
async function generateLaporanPDF(transaksiData, tglMulai, tglSelesai, userName, userRole) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // KOP LAPORAN
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('LAPORAN REKAPAN DATA TRANSAKSI', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('SIM-SPPG — Sistem Informasi Manajemen SPPG', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(9);
  doc.text(`Periode: ${formatTglLaporan(tglMulai)} s/d ${formatTglLaporan(tglSelesai)}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`Dibuat oleh: ${userName} (${userRole}) pada ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Garis pemisah
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(10, y, pageWidth - 10, y);
  y += 6;

  // RINGKASAN
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RINGKASAN', 10, y);
  y += 6;

  const totalNominal = transaksiData.reduce((s, r) => s + (Number(r['Nominal']) || 0), 0);
  const approved = transaksiData.filter(r => r['APPROVED BY']).length;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Transaksi   : ${transaksiData.length} transaksi`, 10, y); y += 5;
  doc.text(`Total Nominal     : ${formatRupiahLaporan(totalNominal)}`, 10, y); y += 5;
  doc.text(`Sudah Diapprove   : ${approved} transaksi`, 10, y); y += 5;
  doc.text(`Belum Diapprove   : ${transaksiData.length - approved} transaksi`, 10, y); y += 8;

  // TABEL TRANSAKSI
  if (transaksiData.length > 0) {
    doc.autoTable({
      startY: y,
      head: [[
        'No', 'Tanggal', 'Kode', 'SPPG', 'Kategori',
        'Nama Item', 'Nominal', 'Metode', 'Status Dok', 'Approved By'
      ]],
      body: transaksiData.map((r, i) => [
        i + 1,
        r['Tanggal'] ? new Date(r['Tanggal']).toLocaleDateString('id-ID') : '-',
        r['Kode Pemasukan'] || '-',
        r['SPPG'] || '-',
        r['Kategori'] || '-',
        r['Nama Item/ Bahan Baku'] || '-',
        formatRupiahLaporan(r['Nominal']),
        r['Metode Transaksi'] || '-',
        r['STATUS DOKUMEN'] || '-',
        r['APPROVED BY'] || '-'
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: {
        0: { cellWidth: 8 },
        6: { halign: 'right' }
      },
      margin: { left: 10, right: 10 }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Tidak ada data transaksi pada periode ini.', 10, y + 10);
  }

  // Footer setiap halaman
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Halaman ${i} dari ${pageCount} — SIM-SPPG`, pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  return doc.output('blob');
}

// --- Upload PDF ke Supabase Storage ---
async function uploadLaporanToStorage(blob, fileName, token) {
  const url = `${SUPABASE_URL_LAPORAN}/storage/v1/object/laporan_pdf/${fileName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      apikey: window._supabaseKey || '',
      'Content-Type': 'application/pdf',
      'x-upsert': 'true'
    },
    body: blob
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload storage gagal: ${err}`);
  }
  return `${SUPABASE_URL_LAPORAN}/storage/v1/object/public/laporan_pdf/${fileName}`;
}

// --- Kirim PDF ke Telegram via Bot API ---
async function kirimLaporanTelegram(blob, fileName, chatId, meta) {
  const caption =
    `📢 *LAPORAN REKAPAN DATA SIM-SPPG*\n` +
    `📅 *Periode:* ${formatTglLaporan(meta.tglMulai)} s/d ${formatTglLaporan(meta.tglSelesai)}\n` +
    `👤 *Dibuat Oleh:* ${meta.userName} (${meta.userRole})\n\n` +
    `📊 *Ringkasan Data:*\n` +
    `• Total Transaksi: ${meta.jumlahTransaksi} transaksi\n\n` +
    `_File PDF laporan lengkap terlampir di bawah ini._`;

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', new File([blob], fileName, { type: 'application/pdf' }));
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || JSON.stringify(data)}`);
  }
  return data;
}

// --- Simpan riwayat ke tabel riwayat_laporan ---
async function simpanRiwayatLaporan(payload, token) {
  const res = await fetch(`${SUPABASE_URL_LAPORAN}/rest/v1/riwayat_laporan`, {
    method: 'POST',
    headers: {
      apikey: window._supabaseKey || '',
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn('[LAPORAN] Gagal simpan riwayat:', err);
  }
}

// --- Load tabel riwayat laporan ---
async function loadRiwayatLaporan() {
  const tbody = document.getElementById('riwayat-laporan-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#9ca3af;">⏳ Memuat riwayat...</td></tr>';

  try {
    const sbToken = window._supabaseToken ||
      (typeof supabase !== 'undefined' && supabase.auth ?
        (await supabase.auth.getSession()).data.session?.access_token : null);

    const res = await fetch(
      `${SUPABASE_URL_LAPORAN}/rest/v1/riwayat_laporan?select=*&order=tanggal_generate.desc&limit=50`,
      {
        headers: {
          apikey: window._supabaseKey || '',
          Authorization: sbToken ? `Bearer ${sbToken}` : ''
        }
      }
    );

    if (!res.ok) throw new Error('Gagal memuat riwayat');
    const data = await res.json();

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af;">Belum ada riwayat laporan.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(row => {
      const tglGen = row.tanggal_generate
        ? new Date(row.tanggal_generate).toLocaleString('id-ID') : '-';
      const periode = `${formatTglLaporan(row.periode_awal)} — ${formatTglLaporan(row.periode_akhir)}`;
      const statusBadge = row.status_kirim
        ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">✅ Terkirim</span>'
        : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">❌ Gagal</span>';
      const downloadBtn = row.file_url
        ? `<a href="${row.file_url}" target="_blank" style="padding:4px 10px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;text-decoration:none;">⬇️ Unduh</a>`
        : '<span style="color:#9ca3af;font-size:12px;">-</span>';

      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 12px;">${tglGen}</td>
        <td style="padding:10px 12px;">${periode}</td>
        <td style="padding:10px 12px;">${row.generated_by_name || row.generated_by || '-'}<br><span style="font-size:11px;color:#6b7280;">${row.generated_by_role || ''}</span></td>
        <td style="padding:10px 12px;text-align:center;">${row.jumlah_transaksi ?? '-'}</td>
        <td style="padding:10px 12px;text-align:center;">${statusBadge}</td>
        <td style="padding:10px 12px;text-align:center;">${downloadBtn}</td>
      </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#ef4444;">❌ Gagal memuat: ${err.message}</td></tr>`;
  }
}

// --- Auto-load riwayat saat panel Laporan dibuka ---
// Tambahkan ini ke fungsi showPanel / navigasi yang sudah ada:
// if (panelId === 'laporan') { loadRiwayatLaporan(); }
// Atau gunakan observer di bawah ini sebagai fallback:
(function() {
  const observer = new MutationObserver(function() {
    const panel = document.getElementById('panel-laporan');
    if (panel && panel.style.display !== 'none') {
      const tbody = document.getElementById('riwayat-laporan-tbody');
      if (tbody && tbody.innerHTML.includes('Memuat data...')) {
        loadRiwayatLaporan();
      }
    }
  });
  // Observe setelah DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const container = document.body;
      if (container) observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['style'] });
    });
  } else {
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
  }
})();

/* ===== UNIFIED HARDENING RUNTIME ===== */
/* SIM-SPPG unified runtime
 * Session guard, authentication experience, registration routing,
 * role-aware UI hardening, file-input repair, and report downloads.
 */
(function () {
  'use strict';

  if (window.__SIMSPPG_UNIFIED_RUNTIME__) return;
  window.__SIMSPPG_UNIFIED_RUNTIME__ = true;

  var CONFIG = {
    registerUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/register-user-v2',
    tokenKey: 'sppg_jwt',
    sessionKey: 'sppg_session',
    clockSkewMs: 60 * 1000,
    sessionCheckMs: 30 * 1000,
    logoUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png'
  };

  var PUBLIC_FUNCTIONS = {
    registerUser: 1,
    verifyRegistrationOtp: 1,
    resendRegistrationOtp: 1,
    loginUser: 1,
    checkSession: 1,
    recoverPassword: 1,
    recoverUsername: 1,
    recoverToken: 1,
    getAppConfig: 1,
    getDropdownOptions: 1,
    getPushPublicKey: 1
  };

  var REPORT_DATASETS = [
    { key:'TRANSAKSI', label:'Data Transaksi', icon:'fa-exchange-alt', action:'getTransactions', dateFields:['tanggal','Tanggal','Timestamp','timestamp'] },
    { key:'APPROVAL', label:'Data Approval Transaksi', icon:'fa-clipboard-check', action:'getTransactions', approval:true, dateFields:['waktuApprove','WAKTU APPROVE','tanggal','Tanggal'] },
    { key:'PENDING', label:'Data Pending Payment', icon:'fa-hand-holding-usd', action:'getPendingPayments', dateFields:['tanggalPending','Tanggal Pending','Timestamp'] },
    { key:'SUPPLIER', label:'Data Supplier', icon:'fa-truck', action:'getMasterSupplier', dateFields:['TIMESTAMP','Timestamp','created_at'] },
    { key:'BAHAN', label:'Master Bahan Baku', icon:'fa-boxes', action:'getMasterBahanBaku', dateFields:['TIMESTAMP','Timestamp','UPDATE','created_at'] },
    { key:'SURVEI', label:'Data Survei Harga', icon:'fa-search-dollar', action:'getSurveiBahanBaku', dateFields:['waktuSurvei','WAKTU SURVEI','TIMESTAMP','Timestamp'] },
    { key:'SERAH_TERIMA', label:'Data Serah Terima', icon:'fa-dolly', action:'getSerahTerima', dateFields:['TIMESTAMP','Timestamp','Tanggal','tanggal'] },
    { key:'MENU', label:'Data Menu Harian', icon:'fa-utensils', action:'getMenuHarian', dateFields:['tanggal','TANGGAL','Tanggal','TIMESTAMP'] },
    { key:'USERS', label:'Data Pengguna', icon:'fa-users', action:'getAllUsers', dateFields:['timestamp','TIMESTAMP','created_at'] },
    { key:'ADMIN_ASSIGNMENT', label:'Konfigurasi Admin', icon:'fa-user-shield', action:'getAdminAssignments', dateFields:['created_at'] },
    { key:'AUDIT', label:'Riwayat Aktivitas', icon:'fa-history', action:'getAuditLog', dateFields:['waktuRaw','TIMESTAMP','timestamp','waktu'] }
  ];

  var SENSITIVE_COLUMN = /(password|passwd|secret|token|refresh|service_role|private_key|\bpin\b|otp|endpoint|p256dh|auth_key)/i;
  var installAttempts = 0;
  var reportInstalled = false;
  var authObserver = null;

  function byId(id) { return document.getElementById(id); }
  function storageGet(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  function storageRemove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char];
    });
  }
  function notify(type, title, message) {
    if (typeof window.showToast === 'function') return window.showToast(type, title, message);
    if (window.Swal) return window.Swal.fire(title, message, type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
    window.alert(title + '\n' + message);
  }
  function role() {
    return String(window.currentUser && (window.currentUser.role || window.currentUser.ROLE) || '').toUpperCase();
  }
  function email() {
    return String(window.currentUser && (window.currentUser.email || window.currentUser.EMAIL || window.currentUser.username) || '').toLowerCase();
  }

  function decodeJwtPayload(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) encoded += '=';
      var binary = window.atob(encoded);
      var text;
      try {
        text = decodeURIComponent(Array.prototype.map.call(binary, function (char) {
          return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (_) {
        text = binary;
      }
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function jwtExpiryMs(token) {
    var payload = decodeJwtPayload(token);
    var exp = payload && Number(payload.exp);
    return exp > 0 ? exp * 1000 : 0;
  }

  function isTokenUsable(token) {
    var expiry = jwtExpiryMs(token);
    return !!expiry && expiry > Date.now() + CONFIG.clockSkewMs;
  }

  function stopBackgroundTasks() {
    try {
      if (window.notifPollTimer) {
        clearInterval(window.notifPollTimer);
        window.notifPollTimer = null;
      }
    } catch (_) {}
  }

  function renderLoggedOut(message) {
    var app = byId('appContainer');
    var auth = byId('authOverlay');
    var loading = byId('appLoadingOverlay');
    if (app) app.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (typeof window.showLogin === 'function') {
      try { window.showLogin(); } catch (_) {}
    }
    if (message) {
      var box = byId('loginError');
      if (box) {
        var span = box.querySelector('span');
        if (span) span.textContent = message;
        box.classList.add('show');
      }
    }
  }

  function clearAuthState(message, updateUi) {
    storageRemove(CONFIG.tokenKey);
    storageRemove(CONFIG.sessionKey);
    window._supabaseToken = '';
    window.currentUser = null;
    window.sessionExpiry = 0;
    stopBackgroundTasks();
    if (updateUi) renderLoggedOut(message || 'Sesi berakhir. Silakan login kembali.');
  }

  function readValidSession(restoreGlobals) {
    var raw = storageGet(CONFIG.sessionKey);
    var token = storageGet(CONFIG.tokenKey);
    if (!raw && !token) return false;
    if (!raw || !isTokenUsable(token)) {
      clearAuthState('', false);
      return false;
    }
    var session;
    try { session = JSON.parse(raw); } catch (_) { session = null; }
    if (!session || !session.user) {
      clearAuthState('', false);
      return false;
    }
    var tokenLimit = jwtExpiryMs(token) - CONFIG.clockSkewMs;
    var appLimit = Number(session.expiry) || 0;
    var effectiveExpiry = appLimit > 0 ? Math.min(appLimit, tokenLimit) : tokenLimit;
    if (!effectiveExpiry || Date.now() >= effectiveExpiry) {
      clearAuthState('', false);
      return false;
    }
    if (Number(session.expiry) !== effectiveExpiry) {
      session.expiry = effectiveExpiry;
      storageSet(CONFIG.sessionKey, JSON.stringify(session));
    }
    if (restoreGlobals) {
      window.currentUser = session.user;
      window.sessionExpiry = effectiveExpiry;
      window._supabaseToken = token;
    }
    return true;
  }

  function isAuthFailure(value) {
    var message = value && String(value.message || value.error || value.msg || value) || '';
    return /token.*(invalid|expired|kedaluwarsa)|jwt.*(invalid|expired|kedaluwarsa)|authorization.*(wajib|missing|required)|sesi.*(berakhir|kedaluwarsa)/i.test(message);
  }

  function validTokenOrEmpty() {
    var token = storageGet(CONFIG.tokenKey);
    if (!isTokenUsable(token)) {
      if (token || storageGet(CONFIG.sessionKey)) clearAuthState('', false);
      return '';
    }
    return token;
  }

  function installSessionGuard() {
    if (window.__sppgUnifiedSessionInstalled) return true;
    if (typeof window.callApi !== 'function' || typeof window.checkSession !== 'function') return false;
    window.__sppgUnifiedSessionInstalled = true;

    var original = window.callApi;
    window.getJwtToken = function () {
      var token = validTokenOrEmpty();
      if (!token && window.currentUser) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
      return token;
    };
    window.checkSession = function () { return readValidSession(true); };

    window.callApi = function (action, params, success, failure) {
      var isPublic = !!PUBLIC_FUNCTIONS[action];
      if (action === 'loginUser') {
        clearAuthState('', false);
      } else if (!isPublic && !validTokenOrEmpty()) {
        var error = new Error('Sesi berakhir. Silakan login kembali.');
        clearAuthState(error.message, true);
        if (typeof failure === 'function') setTimeout(function () { failure(error); }, 0);
        return;
      }

      return original(action, params, function (result) {
        if (action === 'loginUser' && result && result.success && result.token) {
          var tokenExpiry = jwtExpiryMs(result.token);
          if (!tokenExpiry || tokenExpiry <= Date.now() + CONFIG.clockSkewMs) {
            clearAuthState('', false);
            if (typeof failure === 'function') failure(new Error('Server mengirim sesi yang tidak valid. Silakan login kembali.'));
            return;
          }
          result.sessionExpiry = Math.min(Number(result.sessionExpiry) || tokenExpiry, tokenExpiry - CONFIG.clockSkewMs);
          storageSet(CONFIG.tokenKey, result.token);
          window._supabaseToken = result.token;
        }
        if (!isPublic && isAuthFailure(result)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        if (typeof success === 'function') success(result);
      }, function (error) {
        if (!isPublic && isAuthFailure(error)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        if (typeof failure === 'function') failure(error);
      });
    };
    window.callApi.__unifiedRuntime = true;
    window.callApi.__original = original;
    readValidSession(true);
    return true;
  }

  function installStyles() { return; }

  function visible(element) {
    if (!element || element.classList.contains('hidden')) return false;
    var computed = window.getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden';
  }

  function authMode() {
    if (visible(byId('registerForm'))) return 'register';
    if (visible(byId('otpForm'))) return 'otp';
    if (visible(byId('recoveryForm'))) return 'recovery';
    return 'login';
  }

  function updateAuthHeading() {
    var overlay = byId('authOverlay');
    if (!overlay || !overlay.classList.contains('auth-architecture')) return;
    var mode = authMode();
    overlay.dataset.authMode = mode;
    var heading = overlay.querySelector('.auth-architecture-heading');
    if (!heading) return;
    var eyebrow = heading.querySelector('span');
    var title = heading.querySelector('h2');
    var description = heading.querySelector('p');
    var content = {
      login: ['Selamat datang', 'Masuk ke SIM-SPPG', 'Gunakan email dan password akun Anda untuk melanjutkan.'],
      register: ['Registrasi akun', 'Bangun akses operasional Anda', 'Lengkapi identitas, unit SPPG, dan yayasan secara akurat.'],
      otp: ['Verifikasi akun', 'Masukkan kode OTP', 'Periksa email Anda lalu masukkan enam digit kode verifikasi.'],
      recovery: ['Pemulihan akun', 'Pulihkan akses SIM-SPPG', 'Ikuti langkah verifikasi untuk mendapatkan kembali akses akun.']
    }[mode];
    eyebrow.textContent = content[0];
    title.textContent = content[1];
    description.textContent = content[2];
  }

  function repairInputs() {
    document.querySelectorAll('input[type="file"]').forEach(function (input) {
      var accept = input.getAttribute('accept') || '';
      if (accept.indexOf('image<!--') !== -1) input.setAttribute('accept', accept.replace(/image<!--/g, 'image/*'));
    });
    var loginEmail = byId('loginUsername');
    if (loginEmail) {
      loginEmail.type = 'email';
      loginEmail.autocomplete = 'email';
      loginEmail.inputMode = 'email';
      loginEmail.required = true;
      loginEmail.setAttribute('aria-label', 'Email akun');
    }
    var loginPassword = byId('loginPassword');
    if (loginPassword) {
      loginPassword.autocomplete = 'current-password';
      loginPassword.required = true;
    }
    var registerEmail = byId('regEmail');
    if (registerEmail) {
      registerEmail.autocomplete = 'email';
      registerEmail.required = true;
    }
    var registerPassword = byId('regPassword');
    if (registerPassword) registerPassword.autocomplete = 'new-password';
    var registerPassword2 = byId('regPassword2');
    if (registerPassword2) registerPassword2.autocomplete = 'new-password';

    var photo = byId('regFoto');
    if (photo) {
      photo.setAttribute('accept', 'image/*');
      var photoGroup = photo.closest('.form-group');
      if (photoGroup) photoGroup.classList.add('auth-hidden-field');
    }
  }

  function enhanceAuthentication() {
    var overlay = byId('authOverlay');
    if (!overlay) return false;
    repairInputs();

    if (overlay.dataset.architectureReady !== '1') {
      var container = overlay.querySelector('.auth-container');
      if (!container) return false;
      overlay.dataset.architectureReady = '1';
      overlay.classList.add('auth-architecture');

      var story = document.createElement('section');
      story.className = 'auth-architecture-story';
      story.innerHTML =
        '<div class="auth-architecture-brand"><span class="auth-architecture-logo"><img src="' + CONFIG.logoUrl + '" alt="Logo SIM-SPPG"></span><span>SIM-SPPG</span></div>' +
        '<div class="auth-architecture-copy"><span class="auth-architecture-kicker"><i class="fas fa-compass-drafting"></i> Arsitektur operasional terintegrasi</span>' +
        '<h1>Satu fondasi digital untuk operasional SPPG.</h1>' +
        '<p>Kelola transaksi, bahan baku, supplier, menu, serah terima, approval, dan pelaporan melalui struktur kerja yang konsisten dan terukur.</p>' +
        '<div class="auth-architecture-metrics">' +
        '<div class="auth-architecture-metric"><i class="fas fa-layer-group"></i><b>Terstruktur</b><span>Alur kerja dan data tersusun dalam satu sistem.</span></div>' +
        '<div class="auth-architecture-metric"><i class="fas fa-shield-halved"></i><b>Terkendali</b><span>Akses mengikuti role, SPPG, dan cakupan yayasan.</span></div>' +
        '<div class="auth-architecture-metric"><i class="fas fa-mobile-screen-button"></i><b>Adaptif</b><span>Nyaman digunakan di desktop, tablet, dan mobile.</span></div>' +
        '</div></div><div class="auth-architecture-foot"><span>Sistem Informasi Manajemen SPPG</span><span>Operasional • Keuangan • Pelaporan</span></div>';

      var side = document.createElement('section');
      side.className = 'auth-architecture-formside';
      container.parentNode.insertBefore(story, container);
      container.parentNode.insertBefore(side, container);
      side.appendChild(container);

      var heading = document.createElement('div');
      heading.className = 'auth-architecture-heading';
      heading.innerHTML = '<span>Selamat datang</span><h2>Masuk ke SIM-SPPG</h2><p>Gunakan email dan password akun Anda untuk melanjutkan.</p>';
      container.insertBefore(heading, container.firstChild);

      var note = document.createElement('div');
      note.className = 'auth-architecture-note';
      note.innerHTML = '<strong>Keamanan akses:</strong> sesi mengikuti masa berlaku token Supabase dan data ditampilkan sesuai peran pengguna.';
      container.appendChild(note);
    }

    var yayasan = byId('regYayasan');
    if (yayasan) {
      yayasan.required = true;
      yayasan.setAttribute('aria-required', 'true');
      var label = yayasan.closest('.form-group') && yayasan.closest('.form-group').querySelector('label');
      if (label && label.textContent.indexOf('*') === -1) label.insertAdjacentHTML('beforeend', ' <span class="req">*</span>');
    }
    var register = byId('registerForm');
    if (register && !register.querySelector('.auth-register-note')) {
      var registerNote = document.createElement('div');
      registerNote.className = 'auth-register-note';
      registerNote.innerHTML = '<i class="fas fa-circle-info"></i> Foto profil dapat ditambahkan setelah akun aktif melalui menu <b>Profil</b>.';
      register.insertBefore(registerNote, register.firstChild);
    }

    updateAuthHeading();
    if (!authObserver) {
      authObserver = new MutationObserver(function () {
        window.requestAnimationFrame(function () {
          repairInputs();
          updateAuthHeading();
        });
      });
      authObserver.observe(overlay, { subtree:true, attributes:true, attributeFilter:['class','style','hidden'] });
    }
    return true;
  }

  function installRegistrationRouting() {
    if (typeof window.callApi !== 'function' || window.callApi.__registrationRouting) return false;
    var original = window.callApi;
    window.callApi = function (action, params, success, failure) {
      if (action !== 'registerUser') return original.apply(this, arguments);
      var data = Array.isArray(params) ? (params[0] || {}) : {};
      if (!String(data.namaYayasan || '').trim()) {
        var validationError = new Error('Nama Yayasan wajib diisi.');
        if (typeof failure === 'function') failure(validationError);
        else notify('error', 'Registrasi belum lengkap', validationError.message);
        return;
      }
      data.fotoProfilBase64 = '';
      data.fotoMimeType = '';
      data.fotoFileName = '';
      fetch(CONFIG.registerUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', apikey: window._supabaseKey || '' },
        body: JSON.stringify({ function:'registerUser', parameters:[data] })
      }).then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok) throw new Error(json.error || json.message || 'Registrasi gagal.');
          return json;
        });
      }).then(function (json) {
        if (json.error) throw new Error(json.error);
        if (typeof success === 'function') success(Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json);
      }).catch(function (error) {
        if (typeof failure === 'function') failure(error);
        else notify('error', 'Registrasi gagal', error.message);
      });
    };
    window.callApi.__registrationRouting = true;
    window.callApi.__original = original;
    return true;
  }

  function ensureRoleMenus() {
    if (!window.MENU_CONFIG) return false;
    if (!window.MENU_CONFIG.USER) {
      window.MENU_CONFIG.USER = [
        { page:'dashboard', label:'Beranda', icon:'fa-th-large' },
        { page:'profil', label:'Profil', icon:'fa-user-circle' },
        { label:'AKTIVITAS SAYA', isHeader:true },
        { page:'transaksi', label:'Transaksi Saya', icon:'fa-exchange-alt' },
        { page:'pending-payment', label:'Pending Payment Saya', icon:'fa-hand-holding-usd' },
        { label:'AKUN', isHeader:true },
        { action:'logout', label:'Keluar', icon:'fa-sign-out-alt' }
      ];
      if (window.BOTTOM_NAV_CONFIG && !window.BOTTOM_NAV_CONFIG.USER) window.BOTTOM_NAV_CONFIG.USER = ['dashboard','transaksi','profil'];
    }
    Object.keys(window.MENU_CONFIG).forEach(function (key) {
      var items = window.MENU_CONFIG[key];
      if (!Array.isArray(items)) return;
      var report = items.find(function (item) { return item && item.page === 'laporan'; });
      if (!report) return;
      items = items.filter(function (item) {
        return !(item && (item.page === 'laporan' || (item.isHeader && String(item.label).toUpperCase() === 'PELAPORAN')));
      });
      var accountIndex = items.findIndex(function (item) { return item && item.isHeader && String(item.label).toUpperCase() === 'AKUN'; });
      if (accountIndex < 0) {
        var logoutIndex = items.findIndex(function (item) { return item && item.action === 'logout'; });
        accountIndex = logoutIndex < 0 ? items.length : logoutIndex;
      }
      items.splice(accountIndex, 0, { label:'PELAPORAN', isHeader:true }, report);
      window.MENU_CONFIG[key] = items;
    });
    return true;
  }

  function hideRestrictedUserWidgets() {
    if (role() !== 'USER') return;
    document.querySelectorAll('#page-dashboard h1,#page-dashboard h2,#page-dashboard h3,#page-dashboard h4,#page-dashboard .card-title,#page-dashboard .chart-title,#page-dashboard .stat-label').forEach(function (node) {
      if (/pengeluaran\s+per\s+sppg/i.test(node.textContent || '')) {
        var block = node.closest('.chart-container,.card,.dashboard-card,.table-container,.section-card') || node.parentElement;
        if (block) block.style.display = 'none';
      }
    });
  }

  function hardenPrint() {
    if (typeof window.printCurrentPage !== 'function' || window.printCurrentPage.__unifiedRuntime) return;
    var original = window.printCurrentPage;
    window.printCurrentPage = function () {
      document.documentElement.style.setProperty('--print-start-offset', '0');
      window.scrollTo(0, 0);
      return original.apply(this, arguments);
    };
    window.printCurrentPage.__unifiedRuntime = true;
  }

  function api(action, args) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') return reject(new Error('API aplikasi belum siap.'));
      window.callApi(action, args || [], resolve, reject);
    });
  }

  function unwrap(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && result.success === false) throw new Error(result.message || 'Backend menolak permintaan.');
    return [];
  }

  function reportParams(dataset, start, end) {
    if (dataset.action === 'getTransactions') return [{ dateStart:start, dateEnd:end }];
    if (dataset.action === 'getMenuHarian') return [{}];
    if (dataset.action === 'getAuditLog') return [{}];
    if (dataset.action === 'getAdminAssignments') return [''];
    return [];
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var raw = String(value).trim();
    var indo = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (indo) return new Date(Number(indo[3]), Number(indo[2]) - 1, Number(indo[1]));
    var date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  }

  function sanitizeRows(rows) {
    return rows.map(function (row) {
      var clean = {};
      Object.keys(row || {}).forEach(function (key) {
        if (!SENSITIVE_COLUMN.test(key)) clean[key] = row[key];
      });
      return clean;
    });
  }

  async function loadReportDataset(dataset, start, end) {
    var rows = unwrap(await api(dataset.action, reportParams(dataset, start, end)));
    if (dataset.approval) rows = rows.filter(function (row) {
      return !!(row.approvedBy || row['APPROVED BY'] || row.waktuApprove || row['WAKTU APPROVE']);
    });
    var startDate = new Date(start + 'T00:00:00');
    var endDate = new Date(end + 'T23:59:59.999');
    var field = dataset.dateFields.find(function (candidate) {
      return rows.some(function (row) { return row && parseDate(row[candidate]); });
    });
    if (field) rows = rows.filter(function (row) {
      var date = parseDate(row[field]);
      return date && date >= startDate && date <= endDate;
    });
    return sanitizeRows(rows);
  }

  function reportColumns(rows) {
    var columns = [];
    rows.forEach(function (row) {
      Object.keys(row || {}).forEach(function (key) { if (columns.indexOf(key) < 0) columns.push(key); });
    });
    return columns;
  }

  function reportCell(value) {
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  function loadLibrary(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Library laporan gagal dimuat.')); };
      document.head.appendChild(script);
    });
  }

  async function createExcel(datasets, start, end) {
    await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', function () { return !!window.XLSX; });
    var workbook = window.XLSX.utils.book_new();
    var summary = [['LAPORAN SIM-SPPG'], ['Periode', start + ' s.d. ' + end], ['Dibuat oleh', email() || '-'], ['Dibuat pada', new Date().toLocaleString('id-ID')], [], ['Data','Jumlah']];
    datasets.forEach(function (dataset) { summary.push([dataset.config.label, dataset.rows.length]); });
    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(summary), 'Ringkasan');
    datasets.forEach(function (dataset, index) {
      var columns = reportColumns(dataset.rows);
      var rows = dataset.rows.map(function (row) {
        var output = {};
        columns.forEach(function (key) { output[key] = reportCell(row[key]); });
        return output;
      });
      var sheet = rows.length ? window.XLSX.utils.json_to_sheet(rows) : window.XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode terpilih']]);
      sheet['!cols'] = columns.map(function (key) { return { wch:Math.min(Math.max(key.length + 2, 14), 42) }; });
      var name = dataset.config.label.replace(/[\\\/?*\[\]:]/g, '').slice(0, 28) || ('Data ' + (index + 1));
      window.XLSX.utils.book_append_sheet(workbook, sheet, name);
    });
    window.XLSX.writeFile(workbook, 'laporan-sim-sppg_' + start + '_' + end + '.xlsx', { compression:true });
  }

  async function createPdf(datasets, start, end) {
    await loadLibrary('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); });
    await loadLibrary('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js', function () { return !!window.jspdf.jsPDF.API.autoTable; });
    var doc = new window.jspdf.jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    var width = doc.internal.pageSize.getWidth();
    function header(title, subtitle) {
      doc.setFillColor(30,111,156);
      doc.roundedRect(10,10,width - 20,24,3,3,'F');
      doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(title,16,21);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(subtitle,16,28); doc.setTextColor(30);
    }
    header('Laporan SIM-SPPG', 'Periode ' + start + ' s.d. ' + end + ' • ' + (email() || '-'));
    doc.autoTable({ startY:42, head:[['No','Kelompok Data','Jumlah']], body:datasets.map(function (dataset, index) { return [index + 1, dataset.config.label, dataset.rows.length]; }), headStyles:{fillColor:[30,111,156]}, styles:{fontSize:8} });
    datasets.forEach(function (dataset) {
      doc.addPage();
      header(dataset.config.label, 'Periode ' + start + ' s.d. ' + end + ' • ' + dataset.rows.length + ' baris');
      if (!dataset.rows.length) { doc.text('Tidak ada data pada periode yang dipilih.',14,48); return; }
      var columns = reportColumns(dataset.rows).slice(0,12);
      doc.autoTable({ startY:40, head:[['No'].concat(columns)], body:dataset.rows.map(function (row, index) { return [index + 1].concat(columns.map(function (key) { return reportCell(row[key]); })); }), headStyles:{fillColor:[30,111,156],fontSize:7}, styles:{fontSize:6.2,cellPadding:1.6,overflow:'linebreak'}, alternateRowStyles:{fillColor:[243,248,251]} });
    });
    doc.save('laporan-sim-sppg_' + start + '_' + end + '.pdf');
  }

  function selectedReportDatasets() {
    return Array.prototype.slice.call(document.querySelectorAll('.report-unified-check input:checked')).map(function (input) {
      return REPORT_DATASETS.find(function (dataset) { return dataset.key === input.value; });
    }).filter(Boolean);
  }

  function updateReportCount() {
    var target = byId('reportUnifiedCount');
    if (target) target.textContent = document.querySelectorAll('.report-unified-check input:checked').length + ' dipilih';
  }

  async function downloadReport() {
    var start = byId('reportUnifiedStart').value;
    var end = byId('reportUnifiedEnd').value;
    var format = byId('reportUnifiedFormat').value;
    var configs = selectedReportDatasets();
    var button = byId('reportUnifiedDownload');
    var progress = byId('reportUnifiedProgress');
    if (!start || !end) return notify('warning','Periode belum lengkap','Pilih tanggal mulai dan tanggal selesai.');
    if (new Date(start) > new Date(end)) return notify('warning','Periode tidak valid','Tanggal mulai tidak boleh melewati tanggal selesai.');
    if (!configs.length) return notify('warning','Data belum dipilih','Pilih minimal satu jenis data.');
    button.disabled = true;
    progress.classList.remove('hidden');
    try {
      var datasets = [];
      for (var i = 0; i < configs.length; i += 1) {
        progress.textContent = 'Mengambil ' + configs[i].label + ' (' + (i + 1) + '/' + configs.length + ')...';
        datasets.push({ config:configs[i], rows:await loadReportDataset(configs[i], start, end) });
      }
      progress.textContent = 'Menyusun file ' + format.toUpperCase() + '...';
      if (format === 'xlsx') await createExcel(datasets, start, end); else await createPdf(datasets, start, end);
      notify('success','Laporan berhasil dibuat','File ' + format.toUpperCase() + ' telah diunduh ke perangkat.');
    } catch (error) {
      console.error('[SIM-SPPG REPORT]', error);
      notify('error','Gagal membuat laporan',error.message || String(error));
    } finally {
      button.disabled = false;
      progress.classList.add('hidden');
      button.innerHTML = '<i class="fas fa-download"></i><span>Download Laporan</span>';
    }
  }

  function installReportCenter() {
    var page = byId('page-laporan') || byId('laporanPage') || document.querySelector('[data-page-content="laporan"]');
    if (!page || page.dataset.unifiedReportReady === '1') return false;
    page.dataset.unifiedReportReady = '1';
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    page.innerHTML =
      '<div class="report-unified-hero"><div><span class="report-unified-eyebrow"><i class="fas fa-chart-pie"></i> PUSAT LAPORAN</span><h2>Unduh laporan sesuai kebutuhan</h2><p>Pilih periode, beberapa kelompok data, dan format file. Kolom sensitif seperti password, token, PIN, dan OTP otomatis dikecualikan.</p></div></div>' +
      '<div class="report-unified-grid"><section class="report-unified-card"><div class="report-unified-title"><span>1</span><div><h3>Periode & Format</h3><p>Tentukan rentang data yang akan diproses.</p></div></div><div class="report-unified-fields">' +
      '<label><span>Tanggal Mulai</span><input id="reportUnifiedStart" type="date" value="' + first.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Tanggal Selesai</span><input id="reportUnifiedEnd" type="date" value="' + now.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Format File</span><select id="reportUnifiedFormat"><option value="pdf">PDF — siap cetak</option><option value="xlsx">Excel — multi-sheet</option></select></label></div></section>' +
      '<section class="report-unified-card"><div class="report-unified-title"><span>2</span><div><h3>Pilih Data</h3><p>Data diambil melalui backend sesuai hak akses akun.</p></div></div>' +
      '<div class="report-unified-actions"><button id="reportUnifiedAll" type="button">Pilih Semua</button><button id="reportUnifiedNone" type="button">Kosongkan</button><strong id="reportUnifiedCount">0 dipilih</strong></div>' +
      '<div class="report-unified-checks">' + REPORT_DATASETS.map(function (dataset, index) {
        return '<label class="report-unified-check"><input type="checkbox" value="' + escapeHtml(dataset.key) + '" ' + (index < 8 ? 'checked' : '') + '><i class="fas ' + dataset.icon + '"></i><span><b>' + escapeHtml(dataset.label) + '</b><small>Sumber backend aplikasi</small></span></label>';
      }).join('') + '</div></section></div>' +
      '<div id="reportUnifiedProgress" class="report-unified-progress hidden">Menyiapkan data...</div>' +
      '<div class="report-unified-bar"><div><strong>File dibuat langsung di perangkat</strong><span>Data mengikuti cakupan akses pengguna yang sedang login.</span></div><button id="reportUnifiedDownload" type="button" class="btn btn-primary"><i class="fas fa-download"></i><span>Download Laporan</span></button></div>';

    document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.addEventListener('change', updateReportCount); });
    byId('reportUnifiedAll').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = true; }); updateReportCount(); });
    byId('reportUnifiedNone').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = false; }); updateReportCount(); });
    byId('reportUnifiedDownload').addEventListener('click', downloadReport);
    updateReportCount();
    window.generateDanKirimLaporan = downloadReport;
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram dinonaktifkan. Gunakan Download Laporan.'); };
    reportInstalled = true;
    return true;
  }

  function bootstrapRuntime() {
    installStyles();
    enhanceAuthentication();
    installSessionGuard();
    installRegistrationRouting();
    ensureRoleMenus();
    hardenPrint();
    hideRestrictedUserWidgets();
    installReportCenter();

    installAttempts += 1;
    if (installAttempts < 200 && (!window.__sppgUnifiedSessionInstalled || !window.callApi || !window.MENU_CONFIG)) {
      setTimeout(bootstrapRuntime, 60);
    }
  }

  readValidSession(false);
  window.SPPGSessionGuard = {
    getToken: validTokenOrEmpty,
    isTokenUsable: isTokenUsable,
    getTokenExpiry: jwtExpiryMs,
    validateSession: function () { return readValidSession(true); },
    clearAuth: function (message) { clearAuthState(message, true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrapRuntime, { once:true });
  else bootstrapRuntime();

  window.addEventListener('pageshow', bootstrapRuntime, { passive:true });
  setInterval(function () {
    if (storageGet(CONFIG.sessionKey) && !readValidSession(true)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
  }, CONFIG.sessionCheckMs);

  var domObserver = new MutationObserver(function () {
    window.requestAnimationFrame(function () {
      repairInputs();
      updateAuthHeading();
      hideRestrictedUserWidgets();
      if (!reportInstalled) installReportCenter();
    });
  });
  domObserver.observe(document.documentElement, { childList:true, subtree:true });
})();
