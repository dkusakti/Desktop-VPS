// core/server/features/owner/live-monitoring/live-monitoring.repository.js
import dbPool from '../../../database/pool.js';

/**
 * ENTERPRISE LIVE MONITORING REPOSITORY
 */
const liveMonitoringRepository = {
  /**
   * Mengambil seluruh daftar perangkat terikat di database secara realtime (Untuk IPC Electron Lokal)
   * @returns {Promise<Array>} Array berisi daftar baris perangkat karyawan
   */
  fetchRegisteredDevices: async () => {
    const timestamp = new Date().toISOString();
    // SINKRONISASI TOTAL: Menggunakan JOIN 'login' dan ORDER BY 'created_at' sesuai snapshot DBeaver Anda!
    const queryText = `
      SELECT 
        l.id AS user_id,
        ud.device_name, 
        ud.is_verified, 
        ud.device_fingerprint 
      FROM users_devices ud
      JOIN login l ON ud.user_id = l.id
      ORDER BY ud.created_at DESC;
    `;

    try {
      const result = await dbPool.query(queryText);
      // SINKRONISASI ANTI-ERROR: Amankan pembacaan properti rows dari resiko undefined jika koneksi pool goyang
      if (!result || !result.rows) {
        return [];
      }
      return result.rows;
    } catch (error) {
      console.error(`[LIVE_MONITOR_DB_ERROR] [${timestamp}]: ${error.message}`);
      throw new Error('Database query failure during device live monitoring fetch.');
    }
  },

  /**
   * STRATEGI VPS: Mengambil data monitoring dengan batasan (Limit & Offset) untuk API Express
   * Melindungi VPS dari kehabisan RAM akibat membaca data berukuran besar secara massal
   * 
   * @param {number} limit - Jumlah maksimal baris data yang diambil
   * @param {number} offset - Indeks baris awal data dimulai
   */

};

export default liveMonitoringRepository;
