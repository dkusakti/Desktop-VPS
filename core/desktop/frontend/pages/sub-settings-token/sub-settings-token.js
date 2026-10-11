(() => {
  const inputTokenReset =
    document.getElementById('input-token-reset');

  const btnTriggerReset =
    document.getElementById('btn-trigger-reset');

  const msgStatusToken =
    document.getElementById('msg-status-token');

  if (
    !inputTokenReset ||
    !btnTriggerReset ||
    !msgStatusToken
  ) {
    console.error(
      '[Token Page] Komponen reset hardware tidak ditemukan.'
    );
    return;
  }

  const setStatus = (message) => {
    msgStatusToken.textContent = message;
  };

  btnTriggerReset.addEventListener('click', async () => {
    const tokenValue = inputTokenReset.value.trim();

    if (!tokenValue) {
      setStatus(
        'Frasa konfirmasi wajib diisi.'
      );
      return;
    }

    const konfirmasi =
      window.confirm(
        'PERINGATAN: Operasi ini akan menghapus data hardware secara permanen. Lanjutkan?'
      );

    if (!konfirmasi) {
      setStatus(
        'Operasi reset dibatalkan.'
      );
      return;
    }

    try {
      btnTriggerReset.disabled = true;
      btnTriggerReset.textContent = 'MEMPROSES...';

      setStatus(
        'Memvalidasi otorisasi dan menjalankan reset...'
      );

      const response =
        await window.DashboardSecurityContext.panggilMandorBackend(
          'TRUNCATE_HARDWARE_DATA',
          {
            confirmationPhrase: tokenValue
          }
        );

      if (response?.success) {
        inputTokenReset.value = '';

        setStatus(
          response.message ||
          'Reset hardware berhasil diproses.'
        );

        return;
      }

      setStatus(
        response?.error ||
        response?.message ||
        'Reset hardware ditolak oleh server.'
      );
    } catch (error) {
      console.error(
        '[Token Page] Gagal memproses reset hardware:',
        error
      );

      setStatus(
        'Gangguan internal saat memproses reset hardware.'
      );
    } finally {
      btnTriggerReset.disabled = false;
      btnTriggerReset.textContent =
        'HANCURKAN DATA HARDWARE';
    }
  });
})();
