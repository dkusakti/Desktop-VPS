(() => {
  const btnSubmit = document.getElementById('btn-submit-password');
  const inputLama = document.getElementById('pass-lama');
  const inputBaru = document.getElementById('pass-baru');
  const status = document.getElementById('password-status');

  if (!btnSubmit || !inputLama || !inputBaru) {
    console.error(
      '[Password Page] Komponen form tidak ditemukan.'
    );
    return;
  }

  const setStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  btnSubmit.addEventListener('click', async () => {
    const lamaVal = inputLama.value;
    const baruVal = inputBaru.value;

    if (!lamaVal || !baruVal) {
      setStatus('Kedua kolom kata sandi wajib diisi.');
      return;
    }

    if (baruVal.length < 6) {
      setStatus('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (baruVal.length > 128) {
      setStatus('Kata sandi baru maksimal 128 karakter.');
      return;
    }

    if (lamaVal === baruVal) {
      setStatus('Kata sandi baru harus berbeda dari kata sandi lama.');
      return;
    }

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'MEMPROSES...';
      setStatus('Memperbarui kata sandi...');

      const respon =
        await window.DashboardSecurityContext.panggilMandorBackend(
          'CHANGE_PASSWORD',
          {
            sandiLama: lamaVal,
            sandiBaru: baruVal
          }
        );

      inputLama.value = '';
      inputBaru.value = '';

      if (respon?.success) {
        setStatus(
          'Kata sandi berhasil diperbarui. Sistem akan meminta login kembali.'
        );
        return;
      }

      setStatus(
        respon?.message ||
        respon?.error ||
        'Gagal memproses perubahan kata sandi.'
      );
    } catch (error) {
      console.error('[Password Page] Gagal memperbarui kata sandi:', error);
      setStatus('Gangguan internal saat memperbarui kata sandi.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PERBARUI KATA SANDI';
    }
  });
})();
