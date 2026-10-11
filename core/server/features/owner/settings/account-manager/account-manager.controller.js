import accountManagerService from './account-manager.service.js';

const accountManagerController = {
  registerNewUser: async (req, res) => {
    const timestamp = new Date().toISOString();

    try {
      const result = await accountManagerService.registerNewUser({
        actorRole: req.user?.role,
        role: req.body?.role,
        passwordDefault: req.body?.passwordDefault
      });

      if (!result.success) {
        const statusCode =
          result.status === 'FORBIDDEN' ? 403 :
          result.status === 'INVALID_INPUT' ? 400 :
          500;

        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }

      console.log(
        `[USER_REGISTER_SUCCESS] [${timestamp}] Akun baru berhasil dibuat: "${result.username}" dengan peran: [${result.role}]`
      );

      return res.status(201).json(result);
    } catch (error) {
      console.error(
        `[ACCOUNT_REGISTER_FATAL] [${timestamp}] ${error.message}`
      );

      return res.status(500).json({
        success: false,
        error: 'Kesalahan internal server saat mendaftarkan akun.'
      });
    }
  },

  changePasswordSelf: async (req, res) => {
    const timestamp = new Date().toISOString();

    try {
      const result = await accountManagerService.changePasswordSelf({
        userId: req.user?.id,
        sandiLama: req.body?.sandiLama,
        sandiBaru: req.body?.sandiBaru
      });

      if (!result.success) {
        const statusCode =
          result.status === 'UNAUTHORIZED' ? 401 :
          result.status === 'NOT_FOUND' ? 404 :
          result.status === 'INVALID_INPUT' ? 400 :
          500;

        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }

      console.log(
        `[PASSWORD_UPDATE_SUCCESS] [${timestamp}] User ID: [${req.user.id}] berhasil memperbarui kata sandi.`
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        `[PASSWORD_UPDATE_FATAL] [${timestamp}] ${error.message}`
      );

      return res.status(500).json({
        success: false,
        error: 'Kesalahan internal server saat memperbarui kata sandi.'
      });
    }
  }
};

export default accountManagerController;
