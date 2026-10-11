(() => {
  const tabelBody =
    document.getElementById('perangkat-body');

  if (!tabelBody) {
    console.error(
      '[Perangkat Page] Container tabel perangkat tidak ditemukan.'
    );
    return;
  }

  const tampilkanPesan = (message) => {
    tabelBody.replaceChildren();

    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = 4;
    cell.className = 'settings-status';
    cell.textContent = message;

    row.appendChild(cell);
    tabelBody.appendChild(row);
  };

  const buatCell = (value, className = '') => {
    const cell = document.createElement('td');

    if (className) {
      cell.className = className;
    }

    cell.textContent = String(value ?? '-');

    return cell;
  };

  const muatPerangkat = async () => {
    tampilkanPesan(
      'Memuat informasi perangkat...'
    );

    try {
      const response =
        await window.DashboardSecurityContext.panggilMandorBackend(
          'CHECK_HEARTBEAT_AND_DEVICES'
        );

      if (
        !response ||
        response.status !== 'success' ||
        !Array.isArray(response.devices)
      ) {
        tampilkanPesan(
          'Informasi perangkat tidak tersedia.'
        );
        return;
      }

      if (response.devices.length === 0) {
        tampilkanPesan(
          'Tidak ada perangkat yang terdaftar.'
        );
        return;
      }

      tabelBody.replaceChildren();

      response.devices.forEach((device) => {
        const row = document.createElement('tr');

        const tdUser = buatCell(
          device.user_id || '-'
        );

        const tdDevice = buatCell(
          device.device_name || '-'
        );

        const tdStatus = buatCell(
          device.is_verified ? 'Terverifikasi' : 'Belum Terverifikasi'
        );

        tdStatus.classList.add(
          device.is_verified
            ? 'settings-status-success'
            : 'settings-status-error'
        );

        const tdFingerprint = buatCell(
          device.device_fingerprint || '-',
          'settings-table-monospace'
        );

        row.append(
          tdUser,
          tdDevice,
          tdStatus,
          tdFingerprint
        );

        tabelBody.appendChild(row);
      });
    } catch (error) {
      console.error(
        '[Perangkat Page] Gagal memuat perangkat:',
        error
      );

      tampilkanPesan(
        'Gangguan internal saat mengambil informasi perangkat.'
      );
    }
  };

  muatPerangkat();
})();
