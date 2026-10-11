// electron/preloads/dashboard.preload.js
const { contextBridge, ipcRenderer } = require('electron');

// STRATEGI VPS: Cek apakah kode ini berjalan di dalam runtime Electron asli
const isElectronEnv = typeof ipcRenderer !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.electron;

// konfigurasi Base URL untuk server VPS Anda (bisa diarahkan ke domain/IP VPS Anda nanti via .env atau config)
const VPS_BASE_URL = window.location.origin; 

// =====================================================================
// ⚙️ SEKURITI ENGINE: DETEKTOR MENGANGGUR (OPTIMASI PERFORMA RAM & CPU)
// =====================================================================
let detikMenganggur = 0;
const BATAS_MENGANGGUR_MAKSIMAL = 900; // 15 Menit otomatis terkunci kaku
const INTERVAL_PENYEGARAN_DB = 15;     // Database hanya akan ditembak setiap 15 detik sekali

/**
 * LOOP 1: Pelacak Detik Menganggur (Akurat 1 Detik di RAM Lokal - Tanpa Beban Jaringan)
 */
setInterval(async () => {
  detikMenganggur++;
  
  if (detikMenganggur >= BATAS_MENGANGGUR_MAKSIMAL) {
    try {
      if (isElectronEnv) {
        await ipcRenderer.invoke('secure-logout-channel', { action: 'EXECUTE_LOGOUT' });
      } else {
        // STRATEGI VPS: Eksekusi HTTP POST logout jika dibuka dari web browser biasa
        await fetch(`${VPS_BASE_URL}/api/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'EXECUTE_LOGOUT' })
        });
        localStorage.clear(); // Bersihkan RAM sisa token di web browser biasa sebelum keluar
        window.location.href = '/login.html';
      }
    } catch (logoutError) {
      // Meredam interupsi saat transisi penutupan jendela fisik
    }
  }
}, 1000);

/**
 * LOOP 2: Detak Jantung Sesi Berkala (15 Detik Sekali)
 * Hanya memvalidasi sesi melalui security gate.
 * Tidak mengambil data perangkat.
 */
setInterval(async () => {
  const timestamp = new Date().toISOString();

  try {
    if (isElectronEnv) {
      const respon = await ipcRenderer.invoke(
        'secure-heartbeat-channel'
      );

      if (
        respon &&
        respon.success === false &&
        respon.code === 'SESSION_EXPIRED'
      ) {
        await ipcRenderer.invoke(
          'secure-logout-channel',
          { action: 'EXECUTE_LOGOUT' }
        );
      }
    } else {
      // STRATEGI VPS: Tembak endpoint monitoring Express secara berkala dari web client
      const httpRespon = await fetch(
        `${VPS_BASE_URL}/api/session/heartbeat`,
        {
          method: 'GET',
          credentials: 'same-origin'
        }
      );
      
      if (httpRespon.status === 401 || httpRespon.status === 403) {
        window.location.href = '/login.html';
      }
    }
  } catch (error) {
    console.error(
      `[PRELOAD_HEARTBEAT_ERROR] [${timestamp}] Terjadi gangguan interupsi jaringan sesaat: ${error.message}`
    );
  }
}, INTERVAL_PENYEGARAN_DB * 1000); 

// Refresh session browser sebelum access cookie kedaluwarsa.
// Refresh token tetap HttpOnly sehingga JavaScript tidak pernah membaca credential tersebut.
if (!isElectronEnv) {
  setInterval(async () => {
    try {
      const response = await fetch(`${VPS_BASE_URL}/api/token/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (response.status === 401) window.location.href = '/login.html';
    } catch {}
  }, 10 * 60 * 1000);
}

function setelUlangTimerAktivitas() {
  detikMenganggur = 0;
}

window.addEventListener('mousemove', setelUlangTimerAktivitas);
window.addEventListener('mousedown', setelUlangTimerAktivitas);
window.addEventListener('keydown', setelUlangTimerAktivitas);
window.addEventListener('scroll', setelUlangTimerAktivitas);

// =====================================================================
// 🎫 JEMBATAN UNIVERSAL DINAMIS SEPADAN DENGAN ATURAN MANDOR ANDA
// =====================================================================
const bridgeContextInterface = {

  /**
   * Pipa Khusus Menembak Mandor Backend (Jalur Rahasia & Sensitif)
   */
  panggilMandorBackend: async (actionName, inputData = {}) => {
    const timestamp = new Date().toISOString();

    try {
      if (isElectronEnv) {
        return await ipcRenderer.invoke(
          'secure-channel',
          {
            action: actionName,
            data: inputData
          }
        );
      } else {
        // STRATEGI VPS: Petakan nama aksi 'actionName' ke endpoint REST API Express MandorBackend Anda
        let endpointUrl = `${VPS_BASE_URL}/api/owner/monitoring`;

        // SINKRONISASI HTTP METHOD
        let httpMethod = 'POST';

        if (actionName === 'CHECK_HEARTBEAT_AND_DEVICES') {
          httpMethod = 'GET';
        }
        
        if (actionName === 'APPROVE_DEVICE') {
          endpointUrl = `${VPS_BASE_URL}/api/settings/verify-device`;
        }

        if (actionName === 'TRUNCATE_HARDWARE_DATA') {
          endpointUrl = `${VPS_BASE_URL}/api/owner/reset-hardware`;
}

if (actionName === 'REGISTER_USER') {
endpointUrl = `${VPS_BASE_URL}/api/owner/register-user`;
}

if (actionName === 'CHANGE_PASSWORD') {
endpointUrl = `${VPS_BASE_URL}/api/user/change-password`;
}





        let fetchOptions = {
          method: httpMethod,
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin'
        };

        if (httpMethod === 'POST') {
          fetchOptions.body = JSON.stringify(inputData);
        }

        const httpRespon = await fetch(
          endpointUrl,
          fetchOptions
        );

        return await httpRespon.json();

      }

    } catch (error) {
      console.error(
        `[BRIDGE_BACKEND_ERROR] [${timestamp}] Gagal menghubungi Mandor Backend untuk aksi [${actionName}]: ${error.message}`
      );

      return {
        success: false,
        status: 'error',
        message: 'Gagal memproses permintaan data ke pusat kendali sistem.'
      };
    }
  },

  /**
   * Pipa Khusus Menembak Mandor Frontend (Jalur Umum Tarik Database SQL Dinamis)
   */
  panggilMandorFrontend: async (suratPerintah) => {
    const timestamp = new Date().toISOString();

    try {
      if (isElectronEnv) {

        return await ipcRenderer.invoke(
          'saluran-mandor',
          suratPerintah
        );

      } else {

        // STRATEGI VPS: Gunakan gerbang routing CRUD otomatis dinamis yang sudah kita rakit di MandorFrontend!
        const httpRespon = await fetch(
          `${VPS_BASE_URL}/api/dynamic/crud`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(suratPerintah)
          }
        );

        return await httpRespon.json();
      }

    } catch (error) {

      console.error(
        `[BRIDGE_FRONTEND_ERROR] [${timestamp}] Mandor Frontend gagal memproses perintah: ${error.message}`
      );

      return {
        status: 'ERROR',
        pesan: 'Gagal mengolah manipulasi kueri infrastruktur database.'
      };
    }
  },

  /**
   * Jalur darurat untuk logout manual dari tombol klik UI Frontend
   */
  logoutManual: async () => {
    const timestamp = new Date().toISOString();

    try {

      if (isElectronEnv) {

        return await ipcRenderer.invoke(
          'secure-logout-channel',
          {
            action: 'EXECUTE_LOGOUT'
          }
        );

      } else {

        const httpRespon = await fetch(
          `${VPS_BASE_URL}/api/logout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              action: 'EXECUTE_LOGOUT'
            })
          }
        );

        window.location.href = '/login.html';

        return await httpRespon.json();
      }

    } catch (error) {

      console.error(
        `[BRIDGE_LOGOUT_ERROR] [${timestamp}] Gagal mengeksekusi instruksi logout manual: ${error.message}`
      );

      localStorage.clear();

      window.location.href = '/login.html';

      return {
        success: false,
        error: 'Gagal mengeksekusi instruksi logout manual.'
      };
    }
  }
};

// =====================================================================
// 🔒 DAFTARKAN SATU-SATUNYA DASHBOARD SECURITY CONTEXT
// =====================================================================
// Sebelumnya DashboardSecurityContext didaftarkan 2 kali.
// Sekarang hanya satu interface yang digunakan.
//
// Electron:
// contextBridge.exposeInMainWorld()
//
// Browser/VPS:
// window.DashboardSecurityContext
// =====================================================================

if (
  typeof contextBridge !== 'undefined' &&
  contextBridge.exposeInMainWorld &&
  isElectronEnv
) {

  contextBridge.exposeInMainWorld(
    'DashboardSecurityContext',
    bridgeContextInterface
  );

} else {

  // Fallback jika dibuka dari web browser murni tanpa shell Electron wrapper
  window.DashboardSecurityContext = bridgeContextInterface;
}
