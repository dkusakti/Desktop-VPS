(() => {
  const status =
    document.getElementById('hash-security-status');

  if (!status) {
    console.error(
      '[Hash Page] Container status keamanan tidak ditemukan.'
    );
    return;
  }

  status.textContent =
    'Informasi hash sensitif tidak ditampilkan pada workspace.';
})();
