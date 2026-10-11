// frontend/access-policy.js
// Policy UI terpusat. Ini hanya mengatur visibilitas menu; otorisasi tetap wajib
// dilakukan server-side pada setiap endpoint.
const SUBMENU_ROLES = Object.freeze({
  'manajemen-perangkat': new Set(['owner', 'adminmaster', ]),
  'profil-iot': new Set(['owner', 'adminmaster', , 'user'])
});

const AccessPolicy = Object.freeze({
  isSubMenuAllowed(role, submenu) {
    const normalizedRole = String(role || 'user').trim().toLowerCase();
    return Boolean(SUBMENU_ROLES[submenu]?.has(normalizedRole));
  },

  cleanSettingsSubMenu(role) {
    const normalizedRole = String(role || 'user').trim().toLowerCase();
    document.querySelectorAll('[data-settings-submenu]').forEach((element) => {
      const submenu = String(element.dataset.settingsSubmenu || '').trim();
      element.hidden = !AccessPolicy.isSubMenuAllowed(normalizedRole, submenu);
    });
  }
});

export default AccessPolicy;
