/* SIM-SPPG laporan hotfix
 * - Ambil token dari session Supabase, fallback ke anon/publishable key.
 * - Kirim PDF ke Telegram sebelum mencoba upload Storage.
 * - Kegagalan Storage/Riwayat tidak membatalkan pengiriman Telegram.
 */
(function () {
  'use strict';

  function getSupabaseClient() {
    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
      return window.supabase;
    }
    if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
      return supabase;
    }
    return null;
  }

  function getAnonKey() {
    return String(window._supabaseKey || window.SUPABASE_ANON_KEY || '').trim();
  }

  async function getSupabaseAuthorizationToken() {
    var client = getSupabaseClient();
    if (client) {
      try {
        var result = await client.auth.getSession();
        var accessToken = result && result.data && result.data.session
          ? result.data.session.access_token
          : null;
        if (accessToken) {
          window._supabaseToken = accessToken;
          return accessToken;
        }
      } catch (error) {
        console.warn('[LAPORAN AUTH] Gagal membaca session:', error);
      }
    }

    // Supabase REST/Storage tetap memerlukan Authorization. Untuk request anon,
    // anon/publishable key digunakan sebagai bearer token.
    return getAnonKey();
  }

  function buildAuthHeaders(extra) {
    return Object.assign({
      apikey: getAnonKey()
    }, extra || {});
  }

  async function uploadLaporanToStorageFixed(blob, fileName) {
    if (!(blob instanceof Blob)) {
      throw new Error('File PDF tidak valid.');
    }

    var token = await getSupabaseAuthorizationToken();
    var anonKey = getAnonKey();
    if (!token || !anonKey) {
      throw new Error('Token atau API key Supabase tidak tersedia. Silakan login ulang.');
    }

    var safeName = String(fileName || ('laporan_' + Date.now() + '.pdf'))
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    var filePath = 'laporan/' + safeName;
    var baseUrl = String(SUPABASE_URL_LAPORAN).replace(/\/$/, '');
    var encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

    var res = await fetch(baseUrl + '/storage/v1/object/laporan_pdf/' + encodedPath, {
      method: 'POST',
      headers: buildAuthHeaders({
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true'
      }),
      body: blob
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('Upload storage gagal: ' + (err || res.statusText));
    }

    return baseUrl + '/storage/v1/object/public/laporan_pdf/' + encodedPath;
  }

  async function simpanRiwayatLaporanFixed(payload) {
    var token = await getSupabaseAuthorizationToken();
    var anonKey = getAnonKey();
    if (!token || !anonKey) {
      throw new Error('Token atau API key Supabase tidak tersedia.');
    }

    var res = await fetch(String(SUPABASE_URL_LAPORAN).replace(/\/$/, '') + '/rest/v1/riwayat_laporan', {
      method: 'POST',
      headers: buildAuthHeaders({
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      }),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('Gagal menyimpan riwayat: ' + (err || res.statusText));
    }
    return true;
  }

  async function handleKirimLaporanFixed() {
    var mulaiEl = document.getElementById('laporan-tgl-mulai');
    var selesaiEl = document.getElementById('laporan-tgl-selesai');
    var chatEl = document.getElementById('laporan-chat-id');
    var tglMulai = mulaiEl ? mulaiEl.value : '';
    var tglSelesai = selesaiEl ? selesaiEl.value : '';
    var chatId = (chatEl ? chatEl.value.trim() : '') || '8739721946';

    if (!tglMulai || !tglSelesai) {
      if (typeof Swal !== 'undefined') Swal.fire('Peringatan', 'Harap isi Tanggal Mulai dan Tanggal Selesai.', 'warning');
      else alert('Harap isi Tanggal Mulai dan Tanggal Selesai.');
      return;
    }
    if (new Date(tglMulai) > new Date(tglSelesai)) {
      if (typeof Swal !== 'undefined') Swal.fire('Peringatan', 'Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.', 'warning');
      else alert('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }

    var currentUser = window.currentUser || {};
    var userEmail = currentUser.email || currentUser.EMAIL || currentUser.username || '-';
    var userName = currentUser['NAMA LENGKAP'] || currentUser.namaLengkap || currentUser.nama || '-';
    var userRole = currentUser.ROLE || currentUser.role || '-';
    var transaksiData = [];
    var fileUrl = null;
    var fileName = null;
    var telegramSent = false;

    setLaporanLoading(true, '📡 Mengambil data transaksi dari Supabase...');

    try {
      updateLaporanProgress('📡 Step 1/5 — Mengambil data transaksi...');
      var token = await getSupabaseAuthorizationToken();
      var anonKey = getAnonKey();
      if (!token || !anonKey) throw new Error('Session Supabase tidak tersedia. Silakan login ulang.');

      var txUrl = String(SUPABASE_URL_LAPORAN).replace(/\/$/, '') +
        '/rest/v1/TRANSAKSI?select=*&Tanggal=gte.' + encodeURIComponent(tglMulai) +
        '&Tanggal=lte.' + encodeURIComponent(tglSelesai) + '&order=Tanggal.asc';
      var resTx = await fetch(txUrl, {
        headers: buildAuthHeaders({
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        })
      });
      if (!resTx.ok) {
        var txErr = await resTx.text();
        throw new Error('Gagal fetch TRANSAKSI: ' + resTx.status + ' ' + txErr);
      }
      transaksiData = await resTx.json();

      updateLaporanProgress('📄 Step 2/5 — Membuat file PDF...');
      var pdfBlob = await generateLaporanPDF(transaksiData, tglMulai, tglSelesai, userName, userRole);
      fileName = 'laporan_' + tglMulai + '_' + tglSelesai + '_' + Date.now() + '.pdf';

      // Telegram adalah tujuan utama. Jangan biarkan Storage menggagalkan pengiriman.
      updateLaporanProgress('📨 Step 3/5 — Mengirim PDF ke Telegram...');
      await kirimLaporanTelegram(pdfBlob, fileName, chatId, {
        tglMulai: tglMulai,
        tglSelesai: tglSelesai,
        userName: userName,
        userRole: userRole,
        jumlahTransaksi: transaksiData.length
      });
      telegramSent = true;

      var storageError = null;
      try {
        updateLaporanProgress('☁️ Step 4/5 — Mengupload salinan PDF ke Storage...');
        fileUrl = await uploadLaporanToStorageFixed(pdfBlob, fileName);
      } catch (error) {
        storageError = error;
        console.warn('[LAPORAN] Telegram berhasil, tetapi Storage gagal:', error);
      }

      try {
        updateLaporanProgress('💾 Step 5/5 — Menyimpan riwayat...');
        await simpanRiwayatLaporanFixed({
          periode_awal: tglMulai,
          periode_akhir: tglSelesai,
          file_url: fileUrl,
          file_name: fileName,
          generated_by: String(userEmail),
          generated_by_name: userName,
          generated_by_role: userRole,
          status_kirim: true,
          jumlah_transaksi: transaksiData.length,
          keterangan: storageError
            ? 'Telegram berhasil; upload Storage gagal: ' + storageError.message
            : 'Telegram dan Storage berhasil. Chat ID: ' + chatId
        });
      } catch (historyError) {
        console.warn('[LAPORAN] Gagal menyimpan riwayat:', historyError);
      }

      setLaporanLoading(false);
      var successText = 'Laporan berhasil dikirim ke Telegram.\n\nTotal: ' + transaksiData.length +
        ' transaksi dalam periode ' + formatTglLaporan(tglMulai) + ' s/d ' + formatTglLaporan(tglSelesai) + '.';
      if (!fileUrl) successText += '\n\nCatatan: salinan Storage gagal, tetapi file Telegram sudah terkirim.';
      if (typeof Swal !== 'undefined') Swal.fire('Berhasil! ✅', successText, 'success');
      else alert(successText);
      if (typeof loadRiwayatLaporan === 'function') loadRiwayatLaporan();
    } catch (error) {
      console.error('[LAPORAN ERROR]', error);

      if (!telegramSent) {
        try {
          await simpanRiwayatLaporanFixed({
            periode_awal: tglMulai,
            periode_akhir: tglSelesai,
            file_url: fileUrl,
            file_name: fileName,
            generated_by: String(userEmail),
            generated_by_name: userName,
            generated_by_role: userRole,
            status_kirim: false,
            jumlah_transaksi: transaksiData.length,
            keterangan: 'GAGAL: ' + (error.message || 'Kesalahan tidak diketahui')
          });
        } catch (historyError) {
          console.warn('[LAPORAN] Riwayat gagal juga tidak dapat disimpan:', historyError);
        }
      }

      setLaporanLoading(false);
      if (typeof Swal !== 'undefined') Swal.fire('Gagal ❌', 'Terjadi kesalahan: ' + (error.message || error), 'error');
      else alert('Gagal: ' + (error.message || error));
      if (typeof loadRiwayatLaporan === 'function') loadRiwayatLaporan();
    }
  }

  // Override fungsi lama setelah seluruh bundle utama selesai dimuat.
  window.getSupabaseAuthorizationToken = getSupabaseAuthorizationToken;
  window.uploadLaporanToStorage = uploadLaporanToStorageFixed;
  window.simpanRiwayatLaporan = simpanRiwayatLaporanFixed;
  window.handleKirimLaporan = handleKirimLaporanFixed;

  console.info('[SIM-SPPG] Laporan auth/storage hotfix aktif.');
})();
