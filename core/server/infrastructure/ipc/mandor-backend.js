import logoutController from '../../features/logout/logout.controller.js';
import CapabilityPolicy from '../../application/capabilities/capability-policy.js';
import ActionRegistry from '../../application/actions/action-registry.js';

const normalizeRole = (role) =>
  String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const MandorBackend = {
  eksekusiAksiSpesifik: async (action, data, currentSessionRole, currentUserId = null, currentSessionUsername = '') => {
    const role = normalizeRole(currentSessionRole);
    const capability = CapabilityPolicy.assert(action, role);

    if (!capability.allowed) {
      return {
        status: 'error',
        message: capability.message
      };
    }

    try {
      if (action === 'EXECUTE_LOGOUT') {
        const validation = logoutController.validateLogoutRequest({ action });

        return validation.allowed
          ? { status: 'trigger_kernel_logout', success: true }
          : { status: 'error', message: validation.error };
      }

      
    if (action === 'CHECK_HEARTBEAT_AND_DEVICES') {
      return await ActionRegistry.CHECK_HEARTBEAT_AND_DEVICES();
    }



      
    if (action === 'APPROVE_DEVICE') {
      return await ActionRegistry.APPROVE_DEVICE(data);
    }



      
    if (action === 'TRUNCATE_HARDWARE_DATA') {
      return await ActionRegistry.TRUNCATE_HARDWARE_DATA(data, role);
    }



      
    if (action === 'REGISTER_USER') {
      return await ActionRegistry.REGISTER_USER(data, role);
    }



      if (action === 'CHANGE_PASSWORD') {
        return await ActionRegistry.CHANGE_PASSWORD(
          data,
          currentUserId
        );
      }

      if (action === 'FETCH_UI_POLICY') {
        if (!currentUserId) {
          return {
            status: 'error',
            success: false,
            message: 'Identitas sesi pengguna tidak tersedia.'
          };
        }
        
        return {
          status: 'success',
          success: true,
          role,
          policy: role,
          username: String(currentSessionUsername || ''),
          userId: Number(currentUserId)
        };
      }

      return {
        status: 'error',
        message: `Aksi Backend '${action}' tidak dikenali.`
      };
    } catch (error) {
      console.error(`[MANDOR_BACKEND_ERROR] ${error.message}`);

      return {
        status: 'error',
        message: 'Kegagalan internal pusat kendali.'
      };
    }
  },


};

export default MandorBackend;
