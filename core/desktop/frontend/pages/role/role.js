(() => {
  const status = document.getElementById('role-policy-status');

  if (!status) {
    console.error(
      '[Role Page] Container status kebijakan tidak ditemukan.'
    );
    return;
  }

  status.textContent =
    'Akses menu dan operasi sistem mengikuti role sesi aktif.';
})();
