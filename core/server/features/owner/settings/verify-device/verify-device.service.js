import { VerifyDeviceRepository } from './verify-device.repository.js';
import antiBruteForceService from '../../../security/anti-brute-force/anti-brute-force.service.js';

export const VerifyDeviceService = {
  /**
   * Memproses persetujuan perangkat berdasarkan kode aktivasi yang dimasukkan Admin Master (Untuk IPC & Express)
   */
  approveClientDevice: async (activationCode, actorKey = 'local-device') => {
    // 🔒 SINKRONISASI SEKURITI: Gunakan indikator pelacak khusus OTP agar tidak mengunci pintu login utama!
    const lockStatus = antiBruteForceService.checkOtpLockoutStatus ? 
                       antiBruteForceService.checkOtpLockoutStatus(actorKey) : 
                       antiBruteForceService.checkLockoutStatus('verify-device');

    if (lockStatus.isLocked) {
      return { 
        status: 'error', 
        message: `Fitur verifikasi perangkat dibekukan sementara. Sisa waktu: ${lockStatus.remainingTime} menit.` 
      };
    }

    // FIX LOGIKA SANITASI: Gunakan regex global /-/g untuk menghapus seluruh tanda strip tampilan visual
    const pureCode = String(activationCode || '').replace(/-/g, '').trim();

    // Validasi panjang string OTP standar (6 digit numerik) sebelum membebani kueri database
    if (pureCode.length !== 6 || isNaN(Number(pureCode))) {
      return { status: 'error', message: 'Format kode aktivasi tidak valid! Harus berupa 6 digit angka.' };
    }

    // Jalankan query update ke repository
    const verifiedDeviceResult = await VerifyDeviceRepository.approveDevice(pureCode);

    // SINKRONISASI LAYER: Ekstrak objek tunggal dari data hasil repositori secara konsisten
    const verifiedDevice = verifiedDeviceResult;

    // JIKA KODE OTP SALAH ATAU TIDAK DIKETAHUI
    if (!verifiedDevice) {
      // Daftarkan kesalahannya khusus pada pelacak OTP
      const failure = antiBruteForceService.registerOtpFailedAttempt ?
                      antiBruteForceService.registerOtpFailedAttempt(actorKey) :
                      antiBruteForceService.registerFailedAttempt('verify-device');
                      
      return { 
        status: 'error', 
        message: `Kode aktivasi salah atau kedaluwarsa! ${failure.message}` 
      };
    }

    // JIKA KODE OTP COCOK DAN BERHASIL
    if (antiBruteForceService.resetOtpTracker) {
      antiBruteForceService.resetOtpTracker(actorKey);
    } else {
      antiBruteForceService.resetTracker();
    }

    return {
      status: 'success',
      message: 'Otorisasi Berhasil! Perangkat keras komputer karyawan telah sah diaktifkan.'
    };
  }
};
