(() => {
  const btnSubmit = document.getElementById('btn-submit-register');
  const selectRole = document.getElementById('select-register-role');
  const inputPass = document.getElementById('input-register-pass');

  const boxHasil = document.getElementById('box-hasil-cetak');
  const resUser = document.getElementById('res-username');
  const resPass = document.getElementById('res-password');
  const resRole = document.getElementById('res-role');
  const status = document.getElementById('register-status');

  if (!btnSubmit || !selectRole || !inputPass) {
    console.error(
      '[Register Page] Komponen form registrasi tidak ditemukan.'
    );
    return;
  }

  const setStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  btnSubmit.addEventListener('click', async () => {
    const roleVal = selectRole.value;
    const passVal = inputPass.value;

    if (!['user', 'adminmaster'].includes(roleVal)) {
      setStatus('Role akun tidak valid.');
      return;
    }

    if (!passVal) {
      setStatus('Password sementara wajib diisi.');
      return;
    }

    if (passVal.length < 12) {
      setStatus('Password sementara minimal 12 karakter.');
      return;
    }

    if (passVal.length > 128) {
      setStatus('Password sementara maksimal 128 karakter.');
      return;
    }

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'MEMPROSES...';
      setStatus('Membuat akun baru...');

      if (boxHasil) {
        boxHasil.style.display = 'none';
      }

      const response =
        await window.DashboardSecurityContext.panggilMandorBackend(
          'REGISTER_USER',
          {
            role: roleVal,
            passwordDefault: passVal
          }
        );

      if (response?.success) {
        if (resUser) {
          resUser.textContent = response.username || '-';
        }

        if (resRole) {
          resRole.textContent =
            String(response.role || roleVal).toUpperCase();
        }

        if (resPass) {
          resPass.textContent = passVal;
        }

        if (boxHasil) {
          boxHasil.style.display = 'block';
        }

        setStatus(
          response.message ||
          'Akun baru berhasil dibuat.'
        );

        inputPass.value = '';
        return;
      }

      setStatus(
        response?.error ||
        response?.message ||
        'Akun gagal dibuat.'
      );
    } catch (error) {
      console.error(
        '[Register Page] Gagal membuat akun:',
        error
      );

      setStatus(
        'Gangguan internal saat membuat akun baru.'
      );
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'GENERASI AKUN BARU';
    }
  });
})();
