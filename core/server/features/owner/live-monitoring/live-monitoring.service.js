import liveMonitoringRepository from './live-monitoring.repository.js';

const liveMonitoringService = {
  handleTableUpdate: async () => {
    const timestamp = new Date().toISOString();

    try {
      const devices =
        await liveMonitoringRepository.fetchRegisteredDevices();

      const safeDevices = Array.isArray(devices) ? devices : [];

      const cleanDevices = safeDevices.map((device) => {
        const rawHash = String(device.device_fingerprint || '');

        return {
          userId: String(device.user_id),
          deviceName: String(device.device_name),
          isVerified: Boolean(device.is_verified),
          truncatedHash:
            rawHash.length > 15
              ? `${rawHash.substring(0, 15)}...`
              : rawHash
        };
      });

      console.log(
        `[LIVE_MONITOR_INFO] [${timestamp}] ` +
        `Sukses memproses sinkronisasi tabel pemantauan stasiun kerja. ` +
        `Total: ${cleanDevices.length} perangkat.`
      );

      return {
        success: true,
        data: cleanDevices
      };
    } catch (error) {
      console.error(
        `[LIVE_MONITOR_ERROR] [${timestamp}] ` +
        `Kegagalan internal pada penarikan data monitoring: ${error.message}`
      );

      return {
        success: false,
        error: 'Gagal melakukan penyegaran berkala tabel infrastruktur.'
      };
    }
  }
};

export default liveMonitoringService;
