(function () {
  'use strict';

  var state = {
    initialized: false,
    loading: false,
    cashflowChart: null,
    compositionChart: null,
    sppgChart: null,
    lastLoadAt: 0
  };

  function el(id) { return document.getElementById(id); }
  function rupiah(value) {
    var number = Number(value) || 0;
    return 'Rp ' + number.toLocaleString('id-ID');
  }
  function compactRupiah(value) {
    var number = Number(value) || 0;
    if (Math.abs(number) >= 1000000000) return 'Rp ' + (number / 1000000000).toFixed(1).replace('.0', '') + ' M';
    if (Math.abs(number) >= 1000000) return 'Rp ' + (number / 1000000).toFixed(1).replace('.0', '') + ' Jt';
    if (Math.abs(number) >= 1000) return 'Rp ' + (number / 1000).toFixed(0) + ' Rb';
    return rupiah(number);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function injectStyles() {
    if (el('dashboard-modern-styles')) return;
    var style = document.createElement('style');
    style.id = 'dashboard-modern-styles';
    style.textContent = [
      '#page-dashboard{--dash-navy:#153754;--dash-blue:#1e6f9c;--dash-cyan:#38bdf8;--dash-green:#10b981;--dash-amber:#f59e0b;--dash-rose:#f43f5e}',
      '.dashboard-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,.6fr);gap:22px;padding:26px;margin-bottom:18px;border-radius:24px;background:linear-gradient(135deg,#153754 0%,#1e6f9c 58%,#168aad 100%);color:#fff;box-shadow:0 18px 45px rgba(21,55,84,.18)}',
      '.dashboard-hero:before,.dashboard-hero:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.08);pointer-events:none}.dashboard-hero:before{width:240px;height:240px;right:-80px;top:-120px}.dashboard-hero:after{width:140px;height:140px;right:180px;bottom:-105px}',
      '.dashboard-hero-copy,.dashboard-hero-side{position:relative;z-index:1}.dashboard-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase}',
      '.dashboard-hero h2{margin:13px 0 7px;font-size:clamp(22px,3vw,34px);line-height:1.15;letter-spacing:-.7px}.dashboard-hero p{max-width:720px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.65}',
      '.dashboard-hero-meta{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.dashboard-meta-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:12px;background:rgba(255,255,255,.11);font-size:11px;font-weight:600}',
      '.dashboard-health{height:100%;padding:18px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.1);backdrop-filter:blur(12px)}.dashboard-health-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:12px;font-weight:700}.dashboard-health-score{font-size:30px;font-weight:800;letter-spacing:-1px}.dashboard-health-sub{color:rgba(255,255,255,.7);font-size:11px;margin-top:2px}',
      '.dashboard-health-bar{height:8px;margin:14px 0 12px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.15)}.dashboard-health-bar span{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#6ee7b7,#fef08a);transition:width .5s ease}',
      '#page-dashboard .stats-grid{gap:14px;margin-bottom:18px}#page-dashboard .stat-card{position:relative;overflow:hidden;align-items:flex-start;text-align:left;min-height:150px;padding:18px;border:1px solid #e5edf4;border-radius:18px;box-shadow:0 9px 24px rgba(15,23,42,.055);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}',
      '#page-dashboard .stat-card:hover{transform:translateY(-3px);box-shadow:0 15px 32px rgba(15,23,42,.09);border-color:#cbdbe7}#page-dashboard .stat-card:after{content:"";position:absolute;width:90px;height:90px;border-radius:50%;right:-38px;top:-38px;background:var(--card-glow,rgba(30,111,156,.08))}',
      '#page-dashboard .stat-card:nth-child(1){--card-glow:rgba(30,111,156,.12)}#page-dashboard .stat-card:nth-child(2){--card-glow:rgba(16,185,129,.13)}#page-dashboard .stat-card:nth-child(3){--card-glow:rgba(244,63,94,.12)}#page-dashboard .stat-card:nth-child(4){--card-glow:rgba(245,158,11,.15)}',
      '#page-dashboard .stat-icon{width:44px;height:44px;min-width:44px;border-radius:14px;margin-bottom:18px;font-size:17px}#page-dashboard .stat-info{width:100%}#page-dashboard .stat-value{font-size:clamp(19px,2vw,25px);font-weight:800;letter-spacing:-.6px;color:#172b3a}#page-dashboard .stat-label{margin-top:5px;color:#526577;font-size:12px;font-weight:700}#page-dashboard .stat-trend{margin-top:10px;font-size:10px}',
      '.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:16px;margin-bottom:16px}.dashboard-grid.equal{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.dashboard-panel{min-width:0;background:#fff;border:1px solid #e4edf4;border-radius:20px;box-shadow:0 10px 28px rgba(15,23,42,.05)}.dashboard-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 18px 0}.dashboard-panel-title{display:flex;gap:11px;align-items:center}.dashboard-panel-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#eaf5fb;color:#1e6f9c}.dashboard-panel h3{font-size:14px;color:#1d3344;margin:0}.dashboard-panel-desc{font-size:10px;color:#7b8d9b;margin-top:3px}.dashboard-panel-body{padding:12px 18px 18px}.dashboard-chart-wrap{height:285px;position:relative}',
      '.dashboard-filter{border:1px solid #d9e5ee;border-radius:10px;background:#fff;color:#42586b;padding:7px 9px;font-size:10px;font-weight:700;outline:none}',
      '.dashboard-insights{display:grid;gap:10px}.dashboard-insight{display:flex;align-items:flex-start;gap:11px;padding:12px;border-radius:14px;background:#f7fafc;border:1px solid #edf2f6}.dashboard-insight-icon{width:34px;height:34px;min-width:34px;border-radius:11px;display:flex;align-items:center;justify-content:center}.dashboard-insight strong{display:block;color:#243b4d;font-size:11px;margin-bottom:3px}.dashboard-insight span{display:block;color:#718394;font-size:10px;line-height:1.45}',
      '.dashboard-sppg-list{display:grid;gap:9px}.dashboard-sppg-item{display:grid;grid-template-columns:minmax(95px,1fr) minmax(110px,1.3fr) auto;gap:12px;align-items:center}.dashboard-sppg-name{font-size:10px;font-weight:700;color:#334b5e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboard-sppg-track{height:7px;border-radius:999px;background:#edf3f7;overflow:hidden}.dashboard-sppg-track span{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#1e6f9c)}.dashboard-sppg-value{font-size:10px;font-weight:800;color:#1e425c;text-align:right}',
      '.dashboard-empty{display:grid;place-items:center;min-height:210px;text-align:center;color:#8293a2}.dashboard-empty i{font-size:28px;margin-bottom:9px;color:#bdd0dc}.dashboard-empty strong{display:block;font-size:12px;color:#526879}.dashboard-loading:after{content:"";position:absolute;inset:0;background:rgba(255,255,255,.72) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2736%27 height=%2736%27 viewBox=%270 0 50 50%27%3E%3Cpath fill=%27%231e6f9c%27 d=%27M25 5A20 20 0 1 0 45 25h-4A16 16 0 1 1 25 9z%27%3E%3CanimateTransform attributeName=%27transform%27 type=%27rotate%27 from=%270 25 25%27 to=%27360 25 25%27 dur=%27.8s%27 repeatCount=%27indefinite%27/%3E%3C/path%3E%3C/svg%3E") center/34px no-repeat;z-index:4;border-radius:20px}',
      '@media(max-width:980px){.dashboard-hero{grid-template-columns:1fr}.dashboard-grid,.dashboard-grid.equal{grid-template-columns:1fr}}',
      '@media(max-width:640px){.dashboard-hero{padding:20px;border-radius:20px}.dashboard-hero-side{display:none}#page-dashboard .stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#page-dashboard .stat-card{min-width:0;min-height:138px;padding:14px}#page-dashboard .stat-value{font-size:17px}.dashboard-chart-wrap{height:245px}.dashboard-panel-head{padding:15px 15px 0}.dashboard-panel-body{padding:10px 15px 15px}.dashboard-sppg-item{grid-template-columns:90px 1fr auto}}',
      '@media(max-width:390px){#page-dashboard .stats-grid{grid-template-columns:1fr 1fr}#page-dashboard .stat-card{min-height:130px}.dashboard-meta-chip:nth-child(3){display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function dashboardMarkup() {
    return '' +
      '<section class="dashboard-hero" id="dashboardHero">' +
        '<div class="dashboard-hero-copy">' +
          '<span class="dashboard-eyebrow"><i class="fas fa-sparkles"></i> Ringkasan operasional</span>' +
          '<h2 id="dashboardGreeting">Selamat datang di SIM-SPPG</h2>' +
          '<p>Pantau arus kas, transaksi yang memerlukan perhatian, serta performa setiap unit SPPG dalam satu tampilan.</p>' +
          '<div class="dashboard-hero-meta">' +
            '<span class="dashboard-meta-chip"><i class="fas fa-building"></i><span id="dashboardUserSppg">Semua SPPG</span></span>' +
            '<span class="dashboard-meta-chip"><i class="fas fa-user-shield"></i><span id="dashboardUserRole">Pengguna</span></span>' +
            '<span class="dashboard-meta-chip"><i class="fas fa-calendar-day"></i><span id="dashboardToday">-</span></span>' +
          '</div>' +
        '</div>' +
        '<div class="dashboard-hero-side"><div class="dashboard-health">' +
          '<div class="dashboard-health-head"><span>Kesehatan anggaran</span><i class="fas fa-chart-pie"></i></div>' +
          '<div class="dashboard-health-score" id="dashboardHealthScore">0%</div>' +
          '<div class="dashboard-health-sub" id="dashboardHealthText">Menunggu data transaksi</div>' +
          '<div class="dashboard-health-bar"><span id="dashboardHealthBar"></span></div>' +
          '<div class="dashboard-health-sub">Rasio saldo terhadap total pemasukan periode berjalan.</div>' +
        '</div></div>' +
      '</section>' +
      '<div class="dashboard-grid">' +
        '<section class="dashboard-panel" id="cashflowPanel"><div class="dashboard-panel-head">' +
          '<div class="dashboard-panel-title"><div class="dashboard-panel-icon"><i class="fas fa-chart-line"></i></div><div><h3>Tren arus kas</h3><div class="dashboard-panel-desc">Pergerakan pemasukan, pengeluaran, dan saldo harian</div></div></div>' +
          '<select class="dashboard-filter" id="dashboardPeriod"><option value="7">7 hari</option><option value="30" selected>30 hari</option><option value="90">90 hari</option></select>' +
        '</div><div class="dashboard-panel-body"><div class="dashboard-chart-wrap"><canvas id="dashboardCashflowChart"></canvas></div></div></section>' +
        '<section class="dashboard-panel"><div class="dashboard-panel-head"><div class="dashboard-panel-title"><div class="dashboard-panel-icon"><i class="fas fa-lightbulb"></i></div><div><h3>Insight hari ini</h3><div class="dashboard-panel-desc">Sorotan otomatis dari data operasional</div></div></div></div><div class="dashboard-panel-body"><div class="dashboard-insights" id="dashboardInsights"></div></div></section>' +
      '</div>' +
      '<div class="dashboard-grid equal">' +
        '<section class="dashboard-panel"><div class="dashboard-panel-head"><div class="dashboard-panel-title"><div class="dashboard-panel-icon"><i class="fas fa-chart-donut"></i></div><div><h3>Komposisi transaksi</h3><div class="dashboard-panel-desc">Porsi pemasukan dan pengeluaran</div></div></div></div><div class="dashboard-panel-body"><div class="dashboard-chart-wrap"><canvas id="dashboardCompositionChart"></canvas></div></div></section>' +
        '<section class="dashboard-panel"><div class="dashboard-panel-head"><div class="dashboard-panel-title"><div class="dashboard-panel-icon"><i class="fas fa-map-marked-alt"></i></div><div><h3>Pengeluaran per SPPG</h3><div class="dashboard-panel-desc">Perbandingan unit berdasarkan nominal pengeluaran</div></div></div></div><div class="dashboard-panel-body"><div class="dashboard-sppg-list" id="dashboardSppgList"></div></div></section>' +
      '</div>';
  }

  function initializeDashboard() {
    var page = el('page-dashboard');
    var stats = el('dashboardStats');
    if (!page || !stats || el('dashboardHero')) return false;
    injectStyles();
    stats.insertAdjacentHTML('beforebegin', dashboardMarkup().split('<div class="dashboard-grid">')[0]);
    var quick = el('quickAccessSection');
    if (quick) quick.insertAdjacentHTML('beforebegin', '<div id="dashboardModernPanels">' + '<div class="dashboard-grid">' + dashboardMarkup().split('<div class="dashboard-grid">').slice(1).join('<div class="dashboard-grid">') + '</div>');
    var panels = el('dashboardModernPanels');
    if (panels) {
      var inner = panels.innerHTML;
      inner = inner.replace(/<\/div>\s*<\/div>$/, '</div>');
      panels.innerHTML = inner;
    }
    var period = el('dashboardPeriod');
    if (period) period.addEventListener('change', function () { loadDashboardData(true); });
    state.initialized = true;
    updateIdentity();
    observeKpis();
    return true;
  }

  function updateIdentity() {
    var user = window.currentUser || {};
    var hour = new Date().getHours();
    var greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
    if (el('dashboardGreeting')) el('dashboardGreeting').textContent = greeting + (user.namaLengkap ? ', ' + user.namaLengkap.split(' ')[0] : '') + '.';
    if (el('dashboardUserSppg')) el('dashboardUserSppg').textContent = user.role === 'SUPER_ADMIN' ? 'Seluruh SPPG' : (user.sppg || 'SPPG belum ditentukan');
    if (el('dashboardUserRole')) el('dashboardUserRole').textContent = String(user.role || user.jabatan || 'Pengguna').replace(/_/g, ' ');
    if (el('dashboardToday')) el('dashboardToday').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  }

  function numericText(id) {
    var node = el(id);
    if (!node) return 0;
    return Number(String(node.textContent || '').replace(/[^0-9-]/g, '')) || 0;
  }

  function updateHealth() {
    var pemasukan = numericText('statPemasukan');
    var saldo = numericText('statSaldo');
    var score = pemasukan > 0 ? Math.max(0, Math.min(100, Math.round((saldo / pemasukan) * 100))) : 0;
    if (el('dashboardHealthScore')) el('dashboardHealthScore').textContent = score + '%';
    if (el('dashboardHealthBar')) el('dashboardHealthBar').style.width = score + '%';
    if (el('dashboardHealthText')) el('dashboardHealthText').textContent = score >= 50 ? 'Kondisi anggaran sehat' : score >= 20 ? 'Perlu pengendalian belanja' : pemasukan ? 'Saldo perlu perhatian' : 'Menunggu data transaksi';
  }

  function observeKpis() {
    ['statSaldo','statPemasukan','statPengeluaran','statAntrian','statAntrianNominal'].forEach(function (id) {
      var node = el(id);
      if (node) new MutationObserver(updateHealth).observe(node, { childList:true, subtree:true, characterData:true });
    });
    updateHealth();
  }

  function callApiPromise(name, params) {
    return new Promise(function (resolve) {
      if (typeof window.callApi !== 'function') return resolve(null);
      window.callApi(name, params || [], function (result) { resolve(result); }, function () { resolve(null); });
    });
  }

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.color = '#708293';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 7;
  }

  function destroyChart(chart) { if (chart && typeof chart.destroy === 'function') chart.destroy(); }

  function renderCashflow(rows) {
    var canvas = el('dashboardCashflowChart');
    if (!canvas || !window.Chart) return;
    destroyChart(state.cashflowChart);
    if (!rows.length) return renderEmptyChart(canvas, 'Belum ada data tren pada periode ini.');
    state.cashflowChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: rows.map(function (r) { return r.tanggal; }),
        datasets: [
          { label:'Pemasukan', data:rows.map(function(r){return Number(r.pemasukan)||0;}), borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.08)', fill:true, tension:.35, borderWidth:2, pointRadius:2 },
          { label:'Pengeluaran', data:rows.map(function(r){return Number(r.pengeluaran)||0;}), borderColor:'#f43f5e', backgroundColor:'rgba(244,63,94,.06)', fill:true, tension:.35, borderWidth:2, pointRadius:2 },
          { label:'Saldo', data:rows.map(function(r){return Number(r.saldo)||0;}), borderColor:'#1e6f9c', backgroundColor:'transparent', tension:.35, borderWidth:2.5, pointRadius:1.5, borderDash:[5,4] }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+rupiah(c.raw);}}}}, scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:7}},y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.13)'},ticks:{callback:compactRupiah}}} }
    });
  }

  function renderComposition() {
    var canvas = el('dashboardCompositionChart');
    if (!canvas || !window.Chart) return;
    destroyChart(state.compositionChart);
    var income = numericText('statPemasukan');
    var expense = numericText('statPengeluaran');
    if (!income && !expense) return renderEmptyChart(canvas, 'Komposisi transaksi belum tersedia.');
    state.compositionChart = new Chart(canvas, {
      type:'doughnut',
      data:{labels:['Pemasukan','Pengeluaran'],datasets:[{data:[income,expense],backgroundColor:['#10b981','#f43f5e'],borderWidth:0,hoverOffset:6}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:function(c){return c.label+': '+rupiah(c.raw);}}}}}
    });
  }

  function renderEmptyChart(canvas, message) {
    var wrap = canvas.parentElement;
    canvas.style.display = 'none';
    var old = wrap.querySelector('.dashboard-empty');
    if (!old) {
      old = document.createElement('div'); old.className = 'dashboard-empty'; wrap.appendChild(old);
    }
    old.innerHTML = '<div><i class="fas fa-chart-area"></i><strong>' + escapeHtml(message) + '</strong></div>';
  }

  function clearEmptyChart(canvas) {
    if (!canvas) return;
    canvas.style.display = '';
    var empty = canvas.parentElement.querySelector('.dashboard-empty');
    if (empty) empty.remove();
  }

  function renderSppg(rows) {
    var list = el('dashboardSppgList');
    if (!list) return;
    var sorted = (rows || []).slice().sort(function(a,b){return (Number(b.pengeluaran)||0)-(Number(a.pengeluaran)||0);}).slice(0,7);
    if (!sorted.length) {
      list.innerHTML = '<div class="dashboard-empty"><div><i class="fas fa-building"></i><strong>Data per SPPG belum tersedia.</strong></div></div>';
      return;
    }
    var max = Math.max.apply(null, sorted.map(function(r){return Number(r.pengeluaran)||0;})) || 1;
    list.innerHTML = sorted.map(function(row){
      var val = Number(row.pengeluaran)||0;
      return '<div class="dashboard-sppg-item"><div class="dashboard-sppg-name" title="'+escapeHtml(row.name)+'">'+escapeHtml(row.name)+'</div><div class="dashboard-sppg-track"><span style="width:'+Math.max(3,Math.round(val/max*100))+'%"></span></div><div class="dashboard-sppg-value">'+compactRupiah(val)+'</div></div>';
    }).join('');
  }

  function renderInsights(chartRows, sppgRows) {
    var box = el('dashboardInsights');
    if (!box) return;
    var expense = numericText('statPengeluaran');
    var pending = numericText('statAntrianNominal');
    var queue = numericText('statAntrian');
    var latest = chartRows.length ? chartRows[chartRows.length - 1] : null;
    var top = (sppgRows || []).slice().sort(function(a,b){return (Number(b.pengeluaran)||0)-(Number(a.pengeluaran)||0);})[0];
    var items = [
      { icon:'fa-hourglass-half', bg:'#fff7ed', color:'#c2410c', title:queue+' transaksi menunggu approval', text:pending ? 'Nilai yang masih perlu ditindaklanjuti sebesar '+rupiah(pending)+'.' : 'Tidak ada nominal tertunda yang tercatat.' },
      { icon:'fa-calendar-check', bg:'#ecfdf5', color:'#047857', title:latest ? 'Aktivitas terakhir '+latest.tanggal : 'Belum ada aktivitas harian', text:latest ? 'Pemasukan '+rupiah(latest.pemasukan)+' dan pengeluaran '+rupiah(latest.pengeluaran)+'.' : 'Data akan muncul setelah transaksi tercatat.' },
      { icon:'fa-building', bg:'#eff6ff', color:'#1d4ed8', title:top ? top.name+' memiliki pengeluaran tertinggi' : 'Perbandingan SPPG belum tersedia', text:top ? 'Total pengeluaran tercatat '+rupiah(top.pengeluaran)+'.' : 'Data unit akan muncul setelah sinkronisasi.' },
      { icon:'fa-shield-alt', bg:'#f5f3ff', color:'#6d28d9', title:'Kontrol pengeluaran', text:expense ? 'Pantau bukti transaksi dan approval untuk menjaga akuntabilitas anggaran.' : 'Belum ada pengeluaran pada ringkasan saat ini.' }
    ];
    box.innerHTML = items.map(function(item){return '<div class="dashboard-insight"><div class="dashboard-insight-icon" style="background:'+item.bg+';color:'+item.color+'"><i class="fas '+item.icon+'"></i></div><div><strong>'+escapeHtml(item.title)+'</strong><span>'+escapeHtml(item.text)+'</span></div></div>';}).join('');
  }

  function dateRange(days) {
    var end = new Date();
    var start = new Date(); start.setDate(end.getDate() - (days - 1));
    function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    return { start:iso(start), end:iso(end) };
  }

  async function loadDashboardData(force) {
    if (!state.initialized || state.loading || !window.currentUser) return;
    if (!force && Date.now() - state.lastLoadAt < 30000) return;
    state.loading = true;
    var panel = el('cashflowPanel'); if (panel) panel.classList.add('dashboard-loading');
    var days = Number(el('dashboardPeriod') && el('dashboardPeriod').value) || 30;
    var range = dateRange(days);
    var results = await Promise.all([
      callApiPromise('getChartData', [{ dateStart:range.start, dateEnd:range.end }]),
      callApiPromise('getSPPGData', [range.start, range.end])
    ]);
    var chartRows = Array.isArray(results[0]) ? results[0] : [];
    var sppgRows = Array.isArray(results[1]) ? results[1] : [];
    clearEmptyChart(el('dashboardCashflowChart'));
    clearEmptyChart(el('dashboardCompositionChart'));
    chartDefaults();
    renderCashflow(chartRows);
    renderComposition();
    renderSppg(sppgRows);
    renderInsights(chartRows, sppgRows);
    updateHealth();
    updateIdentity();
    state.lastLoadAt = Date.now();
    state.loading = false;
    if (panel) panel.classList.remove('dashboard-loading');
  }

  function dashboardVisible() {
    var page = el('page-dashboard');
    return page && !page.classList.contains('hidden') && getComputedStyle(page).display !== 'none';
  }

  function boot() {
    if (!initializeDashboard()) return setTimeout(boot, 350);
    setInterval(function () {
      if (dashboardVisible()) loadDashboardData(false);
    }, 1500);
    var originalSwitch = window.switchPage;
    if (typeof originalSwitch === 'function' && !originalSwitch.__dashboardEnhanced) {
      window.switchPage = function (pageName) {
        var result = originalSwitch.apply(this, arguments);
        if (pageName === 'dashboard') setTimeout(function(){ loadDashboardData(true); }, 180);
        return result;
      };
      window.switchPage.__dashboardEnhanced = true;
    }
    setTimeout(function(){ if (dashboardVisible()) loadDashboardData(true); }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();