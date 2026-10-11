(() => {
  const inputOtpDevice = document.getElementById('input-otp-device');
  const btnSubmitOtp = document.getElementById('btn-submit-otp');
  const msgStatusOtp = document.getElementById('msg-status-otp');

  if (!inputOtpDevice || !btnSubmitOtp || !msgStatusOtp) {
    console.error(
      '[OTP Page] Komponen halaman otorisasi perangkat tidak ditemukan.'
    );
    return;
  }

  const setStatus = (message) => {
    msgStatusOtp.textContent = message;
  };

  inputOtpDevice.addEventListener('input', (event) => {
    const angka = event.target.value
      .replace(/\D/g, '')
      .slice(0, 6);

    event.target.value =
      angka.length > 3
        ? `${angka.slice(0, 3)}-${angka.slice(3)}`
        : angka;
  });

  btnSubmitOtp.addEventListener('click', async () => {
    const rawOtpValue = inputOtpDevice.value
      .replace(/\D/g, '')
      .trim();

    if (rawOtpValue.length !== 6) {
      setStatus('Kode aktivasi harus terdiri dari 6 digit angka.');
      return;
    }

    try {
      btnSubmitOtp.disabled = true;
      btnSubmitOtp.textContent = 'MEMPROSES...';
      setStatus('Memvalidasi kode aktivasi...');

      const response =
        await window.DashboardSecurityContext.panggilMandorBackend(
          'APPROVE_DEVICE',
          {
            code: rawOtpValue
          }
        );

      if (response?.status === 'success') {
        setStatus(
          response.message ||
          'Perangkat berhasil diotorisasi.'
        );

        inputOtpDevice.value = '';
        return;
      }

      const message =
        response?.message ||
        'Kode aktivasi salah atau tidak dapat diproses.';

      setStatus(message);
    } catch (error) {
      console.error(
        '[OTP Page] Gagal memproses otorisasi perangkat:',
        error
      );

      setStatus(
        'Gangguan internal saat memproses otorisasi perangkat.'
      );
    } finally {
      btnSubmitOtp.disabled = false;
      btnSubmitOtp.textContent = 'SETUJUI PERANGKAT BARU';
    }
  });
})();
