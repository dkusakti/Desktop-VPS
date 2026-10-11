import accountManagerRepository from './account-manager.repository.js';
import bcrypt from 'bcryptjs';
import sessionService from '../../../security/session/session.service.js';

const normalizeRole = (role) =>
  String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const accountManagerService = {
  registerNewUser: async ({ actorRole, role, passwordDefault }) => {
    const cleanActorRole = normalizeRole(actorRole);

    if (cleanActorRole !== 'owner') {
      return {
        success: false,
        status: 'FORBIDDEN',
        error: 'AKSES DITOLAK: Hanya Owner yang berhak membuat akun baru!'
      };
    }

    const cleanRole = normalizeRole(role);
    const cleanPassword = String(passwordDefault || '');

    if (!['adminmaster', 'user'].includes(cleanRole)) {
      return {
        success: false,
        status: 'INVALID_INPUT',
        error: 'Format kasta peran tidak valid.'
      };
    }

    if (cleanPassword.length < 6 || cleanPassword.length > 128) {
      return {
        success: false,
        status: 'INVALID_INPUT',
        error: 'Password sementara wajib 6-128 karakter.'
      };
    }

    const sekarang = new Date();
    const tgl = String(sekarang.getDate()).padStart(2, '0');
    const bln = String(sekarang.getMonth() + 1).padStart(2, '0');
    const thn = String(sekarang.getFullYear()).slice(-2);
    const polaTanggal = `${tgl}${bln}${thn}`;

    const jumlahAkun =
    await accountManagerRepository.countUsersByUsernamePrefix(polaTanggal);

  const urutanBerikutnya = jumlahAkun + 1;

  const stringUrutan = String(urutanBerikutnya).padStart(2, '0');
    const usernameFinal = `${polaTanggal}${stringUrutan}`;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);

    const emailFinal = `${usernameFinal}@enterprise.com`;
    
    const insertRes = await accountManagerRepository.createUser({
    username: usernameFinal,
    email: emailFinal,
    passwordHash,
    role: cleanRole
  });

  if (insertRes.rowCount !== 1) {
      return {
        success: false,
        status: 'ERROR',
        error: 'Akun gagal dibuat.'
      };
    }

    return {
      success: true,
      status: 'CREATED',
      username: usernameFinal,
      email: emailFinal,
      role: cleanRole,
      temporaryPassword: true,
      message:
      'Akun dibuat. Password sementara harus disampaikan melalui kanal aman dan wajib diganti pada login pertama.'
    };
  },

  changePasswordSelf: async ({ userId, sandiLama, sandiBaru }) => {
    const cleanUserId = parseInt(userId, 10);
    const oldPassword = String(sandiLama || '');
    const newPassword = String(sandiBaru || '');

    if (!Number.isSafeInteger(cleanUserId) || cleanUserId <= 0) {
      return {
        success: false,
        status: 'UNAUTHORIZED',
        error: 'Sesi ilegal atau tidak terotentikasi.'
      };
    }

    if (
!oldPassword ||
!newPassword ||
newPassword.length < 6 ||
newPassword.length > 128
) {
return {
success: false,
status: 'INVALID_INPUT',
error: 'Kata sandi baru wajib 6-128 karakter.'
};
}

    const checkRes =
    await accountManagerRepository.findPasswordHashByUserId(cleanUserId);

  if (checkRes.rowCount !== 1) {
      return {
        success: false,
        status: 'NOT_FOUND',
        error: 'Identitas pengguna tidak ditemukan.'
      };
    }

    const currentHash = checkRes.rows[0].password_hash;
    const isMatch = await bcrypt.compare(oldPassword, currentHash);

    if (!isMatch) {
      return {
        success: false,
        status: 'INVALID_INPUT',
        error: 'Kata sandi lama yang Anda masukkan salah!'
      };
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await accountManagerRepository.updatePasswordHash(
    cleanUserId,
    newHash
  );

  await sessionService.revokeAllForUser(cleanUserId);

    return {
      success: true,
      status: 'PASSWORD_CHANGED',
      message: 'Kata sandi berhasil diperbarui.',
      sessionRevoked: true
    };
  }
};

export default accountManagerService;
