// core/server/features/login/login.service.js
import bcrypt from 'bcryptjs';
import loginRepository from './login.repository.js';

const loginService = {
  /**
   * Mengeksekusi logika bisnis autentikasi kredensial & hardware binding
   */
  executeLogin: async (sanitizedDto) => {
    const username = String(sanitizedDto?.username || '').trim().toLowerCase();
    const password = String(sanitizedDto?.password || '');
    const fingerprint = String(sanitizedDto?.fingerprint || '').trim().toLowerCase();
    
    console.log(`[LOG SERVICE] Memproses permintaan otentikasi untuk entitas pengguna.`);
    
    try {
      // 1. Ambil data baris objek dari repositori PostgreSQL
      const user = await loginRepository.findUserByUsername(username);
      
      // PERTAHANAN TIMING ATTACK: Jika user null/tidak ada, jalankan hash buntu agar durasi respons seragam
      if (!user) {
        const fakeHash = '$2a$06$AnArbitraryStringThatLooksLikeValidHashValuesToTrickAttacker';
        await bcrypt.compare(password, fakeHash);
        return { success: false, user: null, error: 'Nama pengguna atau kata sandi salah.' };
      }
      
      // ========================================================
      // ✅ SINKRONISASI PURIFIKASI: VERIFIKASI SEGAR BCRYPT HASH DB
      // ========================================================
      // SINKRONISASI SEKURITI: Ganti fallback string kosong ke fake hash valid jika password_hash di DB bernilai null/rusak
      // Langkah ini memastikan bcryptjs tidak crash dan tetap menghasilkan return 'false' secara mulus.
      const dbPasswordHash = user.password_hash && String(user.password_hash).startsWith('$2') 
        ? user.password_hash 
        : '$2a$06$AnArbitraryStringThatLooksLikeValidHashValuesToTrickAttacker';

      const isPasswordValid = await bcrypt.compare(password, dbPasswordHash);
      
      if (!isPasswordValid) {
        return { success: false, user: null, error: 'Nama pengguna atau kata sandi salah.' };
      }

      // ========================================================
      // SINKRONISASI COUPLING: PENCOCOKAN GEMBOK HARDWARE
      // ========================================================
      // Fingerprint wajib berasal dari trusted client path:
      // Electron mengirim hardware fingerprint; Web mengirim device ID acak yang dibuat server.
      // Tidak ada fallback statis karena fallback akan membuat seluruh browser berbagi identitas perangkat.
      if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
        return {
          success: false,
          user: null,
          error: 'Identitas perangkat tidak valid.'
        };
      }
      const deviceCheck = await loginRepository.checkDeviceBinding(user.id, fingerprint);

      if (deviceCheck && !deviceCheck.isAllowed) {
        return {
          success: false,
          user: null,
          error: deviceCheck.error || 'Akses stasiun kerja ditolak oleh gembok hardware.'
        };
      }
      
      console.log(`[LOG SERVICE] Autentikasi tingkat tinggi & Validasi Perangkat keras sukses.`);
      
      return {
        success: true,
        user: { 
          id: parseInt(user.id, 10), 
          username: String(user.username), 
          role: String(user.role).toUpperCase().trim()
        },
        error: null
      };
      
    } catch (error) {
      // Menyertakan pesan internal pada log rahasia server untuk mempermudah perbaikan jika terjadi kendala infrastruktur
      console.error(`🚨 [LOG SERVICE ERROR] Terjadi kegagalan fatal pada alur pemrosesan internal service. Detail: ${error.message}`);
      return { success: false, user: null, error: 'Terjadi kesalahan sistem internal pada proses autentikasi.' };
    }
  }
};

export default loginService;
