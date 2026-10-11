(() => {
  const tabelBodyLog = document.getElementById('tabel-body-log');

  if (!tabelBodyLog) {
    console.error(
      '[Activity Log] Container tabel audit tidak ditemukan.'
    );
    return;
  }

  const tampilkanPesan = (message) => {
    tabelBodyLog.replaceChildren();

    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = 5;
    cell.className = 'settings-status';
    cell.textContent = message;

    row.appendChild(cell);
    tabelBodyLog.appendChild(row);
  };

  const buatCell = (value, className = '') => {
    const cell = document.createElement('td');

    if (className) {
      cell.className = className;
    }

    cell.textContent = String(value ?? '-');

    return cell;
  };

  const muatDataLogAktivitas = async () => {
    tampilkanPesan('Memuat activity log...');

    try {
      const response =
        await window.DashboardSecurityContext.panggilMandorFrontend({
          aksi: 'ambil_data',
          target_tabel: 'activity_log'
        });

      if (
        !response ||
        response.status !== 'OK' ||
        !Array.isArray(response.data)
      ) {
        tampilkanPesan(
          'Gagal mengambil data activity log.'
        );
        return;
      }

      if (response.data.length === 0) {
        tampilkanPesan(
          'Tidak ada aktivitas yang tercatat.'
        );
        return;
      }

      tabelBodyLog.replaceChildren();

      response.data.forEach((log) => {
        const row = document.createElement('tr');

        let waktu = '-';

        if (log.created_at) {
          const parsedDate = new Date(log.created_at);

          if (!Number.isNaN(parsedDate.getTime())) {
            waktu = parsedDate.toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour12: false
            });
          }
        }

        const status = String(
          log.status || 'UNKNOWN'
        );

        const statusUpper = status.toUpperCase();

        const tdWaktu = buatCell(
          waktu,
          'settings-table-monospace'
        );

        const tdUser = buatCell(
          log.username || 'System'
        );

        const tdAksi = buatCell(
          log.action_name || '-'
        );

        const tdTabel = buatCell(
          log.target_table || '-',
          'settings-table-monospace'
        );

        const tdStatus = buatCell(status);

        if (
          statusUpper === 'OK' ||
          statusUpper === 'SUCCESS'
        ) {
          tdStatus.classList.add('settings-status-success');
        } else {
          tdStatus.classList.add('settings-status-error');
        }

        row.append(
          tdWaktu,
          tdUser,
          tdAksi,
          tdTabel,
          tdStatus
        );

        tabelBodyLog.appendChild(row);
      });
    } catch (error) {
      console.error(
        '[Activity Log] Gagal memuat audit log:',
        error
      );

      tampilkanPesan(
        'Gangguan internal saat mengambil activity log.'
      );
    }
  };

  muatDataLogAktivitas();
})();
