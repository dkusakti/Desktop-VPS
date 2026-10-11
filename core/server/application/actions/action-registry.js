import liveMonitoringService from '../../features/owner/live-monitoring/live-monitoring.service.js';
import { VerifyDeviceController } from '../../features/owner/settings/verify-device/verify-device.controller.js';
import resetHardwareController from '../../features/owner/reset-hardware/reset-hardware.controller.js';
import accountManagerService from '../../features/owner/settings/account-manager/account-manager.service.js';

const ActionRegistry = Object.freeze({
  CHECK_HEARTBEAT_AND_DEVICES: async () => {
    const result = await liveMonitoringService.handleTableUpdate();

    if (!result.success) {
      return {
        status: 'error',
        message: result.error
      };
    }

    return {
      status: 'success',
      devices: result.data.map((device) => ({
        user_id: device.userId,
        device_name: device.deviceName,
        is_verified: device.isVerified,
        device_fingerprint: device.truncatedHash
      }))
    };
  },

  APPROVE_DEVICE: async (data) => {
    return await VerifyDeviceController.handle(data);
  },

  TRUNCATE_HARDWARE_DATA: async (data, role) => {
    return await resetHardwareController.processEmergencyReset({
      role,
      confirmationPhrase: data?.confirmationPhrase
    });
  },

  REGISTER_USER: async (data, role) => {
    return await accountManagerService.registerNewUser({
      actorRole: role,
      role: data?.role,
      passwordDefault: data?.passwordDefault
    });
  },

  CHANGE_PASSWORD: async (data, currentUserId) => {
    const result = await accountManagerService.changePasswordSelf({
      userId: currentUserId,
      sandiLama: data?.sandiLama,
      sandiBaru: data?.sandiBaru
    });

    if (!result.success) {
      return {
        status: 'error',
        success: false,
        message: result.error
      };
    }

    return {
      status: 'trigger_kernel_logout',
      success: true,
      message: result.message,
      reason: 'PASSWORD_CHANGED'
    };
  }
});

export default ActionRegistry;
