(() => {
  const pilihanTema = document.querySelectorAll(
    'input[name="workspace-theme"]'
  );

  if (!pilihanTema.length) {
    console.error('[Tema Page] Pilihan tema tidak ditemukan.');
    return;
  }

  const temaDefault = 'dark';
  const temaValid = new Set(['dark', 'light']);
  const temaTersimpan = localStorage.getItem(
    'enterprise-workspace-theme'
  );

  const temaAktif = temaValid.has(temaTersimpan)
    ? temaTersimpan
    : temaDefault;

  const terapkanTema = (tema) => {
    if (!temaValid.has(tema)) {
      return;
    }

    document.documentElement.setAttribute(
      'data-workspace-theme',
      tema
    );

    pilihanTema.forEach((input) => {
      input.checked = input.value === tema;
    });

    localStorage.setItem(
      'enterprise-workspace-theme',
      tema
    );
  };

  terapkanTema(temaAktif);

  pilihanTema.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        return;
      }

      terapkanTema(input.value);
    });
  });
})();
