import logoutDTO from './logout.dto.js';
import AuditService from '../../application/audit/audit.service.js';
import jwtTokenController from '../security/jwt-token/jwt-token.controller.js';

const logoutController = {
  validateLogoutRequest: (rawPayload = {}) => {
    try {
      const sanitized = logoutDTO.transformInput(rawPayload);
      if (sanitized.action !== 'EXECUTE_LOGOUT') return { allowed: false, error: 'Klaim aksi pembersihan ilegal!' };
      return { allowed: true };
    } catch { return { allowed: false, error: 'Gagal memproses validasi logout.' }; }
  },
  handleExpressLogout: async (req, res) => {
    try {
      const validation = logoutController.validateLogoutRequest(req.body || {});
      if (!validation.allowed) return res.status(400).json({ success: false, error: validation.error });
      await jwtTokenController.revokeSessionById(req.user?.sessionId);
      try {
        await AuditService.record({ id: req.user?.id || null, username: req.user?.username || 'vps_client' }, 'LOGOUT', 'auth_sessions', 'SUCCESS');
      } catch (error) { console.error(`[AUTH_LOG_FAILURE] ${error.message}`); }
      res.clearCookie('token');
      return res.status(200).json({ success: true, message: 'Sesi berhasil dicabut.' });
    } catch (error) {
      console.error(`[EXPRESS_LOGOUT_ERROR] ${error.message}`);
      return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat logout.' });
    }
  }
};
export default logoutController;
