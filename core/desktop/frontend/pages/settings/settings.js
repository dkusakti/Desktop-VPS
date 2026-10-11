(() => {
  const halaman = document.querySelector('.settings-page');

  if (!halaman) {
    console.error('[Settings Page] Container halaman tidak ditemukan.');
    return;
  }

  const status = halaman.querySelector('.settings-status');

  if (status) {
    status.textContent = 'Pusat pengaturan aktif.';
  }
})();
