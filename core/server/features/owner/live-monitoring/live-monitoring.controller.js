import liveMonitoringService from './live-monitoring.service.js';

/**
 * ENTERPRISE LIVE MONITORING CONTROLLER
 *
 * Controller hanya menangani transport:
 * - IPC Electron
 * - HTTP Express
 *
 * Logika pemrosesan data berada pada Live Monitoring Service.
 */
const liveMonitoringController = {
  /**
   * Menangani permintaan sinkronisasi tabel data dari IPC.
   */
  handleTableUpdate: async () => {
    return await liveMonitoringService.handleTableUpdate();
  },

  /**
   * Menangani HTTP request untuk API Express Live Monitoring.
   */
  handleExpressTableUpdate: async (req, res) => {
    const timestamp = new Date().toISOString();

    try {
      const result =
        await liveMonitoringService.handleTableUpdate();

      if (!result || !result.success) {
        console.warn(
          `[EXPRESS_MONITOR_WARN] [${timestamp}] ` +
          `Pengiriman data API monitoring dibatalkan karena kendala service.`
        );

        return res.status(500).json({
          success: false,
          error:
            result?.error ||
            'Gagal melakukan penyegaran berkala tabel infrastruktur.'
        });
      }

      return res.status(200).json(result);
    } catch (expressMonitorError) {
      console.error(
        `[EXPRESS_LIVE_MONITORING_CONTROLLER_FATAL] ` +
        `[${timestamp}]: ${expressMonitorError.message}`
      );

      return res.status(500).json({
        success: false,
        error:
          'Terjadi kegagalan internal pada server VPS saat memproses data monitoring.'
      });
    }
  }
};

export default liveMonitoringController;
