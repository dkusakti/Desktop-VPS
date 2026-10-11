import crypto from 'crypto';
import dbPool from '../../../../database/pool.js';

export const VerifyDeviceRepository = {
  approveDevice: async (activationCode) => {
    const timestamp = new Date().toISOString();
    const cleanCode = String(activationCode || '').replace(/-/g, '').trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return null;
    }

    try {
      const codeHash = crypto
        .createHash('sha256')
        .update(cleanCode)
        .digest('hex');

      const queryText = `
        UPDATE users_devices
        SET is_verified = TRUE,
            device_name = 'Stasiun Kerja (Disetujui Admin Master)',
            activation_code_hash = NULL,
            activation_expires_at = NULL
        WHERE activation_code_hash = $1
          AND is_verified = FALSE
          AND activation_expires_at > NOW()
        RETURNING id, user_id
      `;

      const result = await dbPool.query(queryText, [codeHash]);

      if (result.rowCount !== 1) {
        console.warn(
          `[DB_REPO_WARN] [${timestamp}] Kode aktivasi salah atau kedaluwarsa.`
        );

        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error(
        `[DB_REPO_FATAL] [${timestamp}] Eror internal pada modul approveDevice: ${error.message}`
      );

      throw new Error('Database transaction processing failed.');
    }
  },


  fetchExpressAuditDetails: async (verifiedDeviceId) => {
    const result = await dbPool.query(
      `SELECT ud.id, ud.device_name, l.username
         FROM users_devices ud
         JOIN login l ON ud.user_id = l.id
        WHERE ud.id = $1 LIMIT 1`,
      [verifiedDeviceId]
    );
    return result.rows[0] || null;
  }
};
