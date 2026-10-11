import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import runDiscoveryClient from './services/discovery-client.js';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import vpsClient from './services/vps-client.js';
import { getSecureFingerprint } from './security/hardware-fingerprint.js';
import CapabilityPolicy from './security/capability-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(desktopRoot, '.env')
});

let mainWindow = null;
let dashboardWindow = null;

let currentSessionRole = 'user';
let currentSessionUserId = null;
let currentSessionUsername = '';

let internalAccessToken = '';
let internalRefreshToken = '';
let tokenExpirationTime = 0;

let isRefreshingTokens = false;


const runServerDiscovery = async () => {
  const clientSecretPath = app.isPackaged
    ? path.join(process.resourcesPath, 'discovery', 'client_secret.json')
    : path.join(__dirname, 'services', 'client_secret.json');

  const tokenFile = path.join(app.getPath('userData'), 'google-token.json');

  console.log('[DISCOVERY_START] JavaScript client');
  console.log(`[DISCOVERY_ENV] log_dir=${path.join(app.getPath('userData'), 'logs')}`);

  try {
    const result = await runDiscoveryClient({ clientSecretPath, tokenFile });

    if (!result || result.success !== true) {
      console.error('[DISCOVERY_FAILED]', result?.error || 'Discovery VPS gagal.');
      return {
        success: false,
        error: result?.error || 'Discovery VPS gagal.'
      };
    }

    const serverIp = String(result.server_ip || '').trim();
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(serverIp)) {
      return { success: false, error: 'Discovery menghasilkan alamat IP yang tidak valid.' };
    }

    return { ...result, server_ip: serverIp };
  } catch (error) {
    console.error('[DISCOVERY_FAILED]', error.message);
    return { success: false, error: error.message || 'Discovery VPS gagal.' };
  }
};


const normalizeRole = (role) => {
  const normalized = String(role || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  const aliases = {
    super_admin: 'owner',
    admin: 'adminmaster'
  };

  return aliases[normalized] || normalized;
};

const clearSensitiveSessionData = async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: [
        'cookies',
        'localstorage',
        'websql',
        'indexeddb',
        'serviceworkers',
        'cachestorage'
      ]
    });

    await session.defaultSession.clearCache();
  } catch (error) {
    console.error(
      `[KERNEL_CLEAN_FATAL] ${error.message}`
    );

    process.exit(1);
  }
};

const resetSessionState = () => {
  currentSessionRole = 'user';
  currentSessionUserId = null;
  currentSessionUsername = '';

  internalAccessToken = '';
  internalRefreshToken = '';
  tokenExpirationTime = 0;
};

const applyAuthenticatedUser = (user) => {
  if (!user || typeof user !== 'object') {
    return false;
  }

  if (
    user.id === undefined ||
    user.id === null
  ) {
    return false;
  }

  currentSessionUserId = Number(user.id);
  currentSessionUsername = String(
    user.username || ''
  );
  currentSessionRole = normalizeRole(user.role);

  return true;
};

const refreshAccessToken = async () => {
  if (
    !internalRefreshToken ||
    isRefreshingTokens
  ) {
    return false;
  }

  isRefreshingTokens = true;

  try {
    const response = await vpsClient.request({
      method: 'POST',
      pathname: '/api/client/token/refresh',
      headers: {
        'X-Refresh-Token': internalRefreshToken
      }
    });

    if (
      response.statusCode !== 200 ||
      !response.body?.success
    ) {
      return false;
    }

    internalAccessToken = String(
      response.body.accessToken || ''
    );

    internalRefreshToken = String(
      response.body.refreshToken || ''
    );

    tokenExpirationTime = Number(
      response.body.expiresAt || 0
    );

    return Boolean(
      internalAccessToken &&
      internalRefreshToken
    );
  } catch (error) {
    console.error(
      `[KERNEL_REFRESH_ERROR] ${error.message}`
    );

    return false;
  } finally {
    isRefreshingTokens = false;
  }
};

const requestAuthenticated = async ({
  method = 'GET',
  pathname,
  body = null,
  retryOnUnauthorized = true
}) => {
  if (!internalAccessToken) {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: 'Sesi tidak tersedia.'
      }
    };
  }

  let response = await vpsClient.request({
    method,
    pathname,
    body,
    accessToken: internalAccessToken
  });

  if (
    response.statusCode === 401 &&
    retryOnUnauthorized &&
    internalRefreshToken
  ) {
    const refreshed = await refreshAccessToken();

    if (!refreshed) {
      resetSessionState();

      return {
        statusCode: 401,
        body: {
          success: false,
          code: 'SESSION_EXPIRED',
          error: 'Sesi habis atau sudah dicabut.'
        }
      };
    }

    response = await vpsClient.request({
      method,
      pathname,
      body,
      accessToken: internalAccessToken
    });
  }

  return response;
};

const checkSecurityGate = async () => {
  if (
    !internalAccessToken ||
    !currentSessionUserId
  ) {
    return false;
  }

  try {
    const response = await requestAuthenticated({
      method: 'GET',
      pathname: '/api/session/heartbeat',
      retryOnUnauthorized: true
    });

    if (
      response.statusCode === 200 &&
      response.body?.success === true
    ) {
      return true;
    }

    resetSessionState();
    return false;
  } catch (error) {
    console.error(
      `[KERNEL_GATE_ERROR] ${error.message}`
    );

    return false;
  }
};

const createDashboardWindow = async () => {
  const rootPath = desktopRoot;

  dashboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    fullscreen: false,
    autoHideMenuBar: true,
    title: 'Enterprise Invest - Dashboard Master',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(
__dirname,
'preloads',
'dashboard.preload.js'
)
    }
  });

  dashboardWindow.setMenu(null);
  dashboardWindow.setContentProtection(true);

  dashboardWindow.webContents.on(
    'will-navigate',
    (event) => event.preventDefault()
  );

  dashboardWindow.webContents.setWindowOpenHandler(
    () => ({ action: 'deny' })
  );

  await dashboardWindow.loadFile(
    path.join(
      rootPath,
      'frontend',
      'main.html'
    )
  );

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
};

const createWindow = async () => {
  const rootPath = desktopRoot;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(
        __dirname,
        'preloads',
        'login.preload.js'
      )
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setContentProtection(true);

  session.defaultSession.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self'; " +
            "img-src 'self' data:; " +
            "connect-src 'self';"
          ]
        }
      });
    }
  );

  mainWindow.webContents.on(
    'will-navigate',
    (event) => event.preventDefault()
  );

  mainWindow.webContents.setWindowOpenHandler(
    () => ({ action: 'deny' })
  );

  mainWindow.webContents.on(
    'devtools-opened',
    () => mainWindow.webContents.closeDevTools()
  );

  await mainWindow.loadFile(
    path.join(
      rootPath,
      'frontend',
      'pages',
      'login',
      'login.html'
    )
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const closeDashboardAndShowLogin = async () => {
  if (
    dashboardWindow &&
    !dashboardWindow.isDestroyed()
  ) {
    dashboardWindow.destroy();
  }

  dashboardWindow = null;

  if (
    process.env.APP_MODE !== 'SERVER_VPS' &&
    !process.argv.includes('--headless')
  ) {
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    await createWindow();
  }
};

const handleLoginAttempt = async (data) => {
  try {
    const fingerprint = getSecureFingerprint();

    if (
      typeof fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(fingerprint)
    ) {
      return {
        success: false,
        error: 'Perangkat gagal diverifikasi.'
      };
    }

    const response = await vpsClient.request({
      method: 'POST',
      pathname: '/api/client/login',
      body: {
        ...(data || {}),
        fingerprint
      }
    });

    if (
      response.statusCode !== 200 ||
      !response.body?.success
    ) {
      return response.body || {
        success: false,
        error: 'Login ke VPS gagal.'
      };
    }

    const body = response.body;

    internalAccessToken = String(
      body.accessToken || ''
    );

    internalRefreshToken = String(
      body.refreshToken || ''
    );

    tokenExpirationTime = Number(
      body.expiresAt || 0
    );

    if (
      !internalAccessToken ||
      !internalRefreshToken
    ) {
      resetSessionState();

      return {
        success: false,
        error: 'Login berhasil tetapi sesi gagal dibuat.'
      };
    }

    if (!applyAuthenticatedUser(body.user)) {
      resetSessionState();

      return {
        success: false,
        error: 'Identitas user dari VPS tidak valid.'
      };
    }

    setTimeout(async () => {
      try {
        await createDashboardWindow();

        if (
          mainWindow &&
          !mainWindow.isDestroyed()
        ) {
          mainWindow.close();
        }

        mainWindow = null;
      } catch (error) {
        console.error(
          `[KERNEL_WINDOW_ERROR] ${error.message}`
        );
      }
    }, 500);

    return {
      success: true,
      user: body.user,
      expiresAt: body.expiresAt
    };
  } catch (error) {
    console.error(
      `[KERNEL_LOGIN_ERROR] ${error.message}`
    );

    resetSessionState();

    return {
      success: false,
      error: 'Tidak dapat terhubung ke server VPS.'
    };
  }
};

const executeAuthenticatedAction = async (
  action,
  data
) => {
  const capability =
    CapabilityPolicy.assert(
      action,
      currentSessionRole
    );

  if (!capability.allowed) {
    return {
      status: 'error',
      message: capability.message
    };
  }

  const endpointMap = {
    CHECK_HEARTBEAT_AND_DEVICES: {
      method: 'GET',
      pathname: '/api/owner/monitoring'
    },

    APPROVE_DEVICE: {
      method: 'POST',
      pathname: '/api/settings/verify-device'
    },

    TRUNCATE_HARDWARE_DATA: {
      method: 'POST',
      pathname: '/api/owner/reset-hardware'
    },

    REGISTER_USER: {
      method: 'POST',
      pathname: '/api/owner/register-user'
    },

    CHANGE_PASSWORD: {
      method: 'POST',
      pathname: '/api/user/change-password'
    }
  };

  if (action === 'FETCH_UI_POLICY') {
    if (!currentSessionUserId) {
      return {
        status: 'error',
        success: false,
        message:
          'Identitas sesi pengguna tidak tersedia.'
      };
    }

    return {
      status: 'success',
      success: true,
      role: currentSessionRole,
      policy: currentSessionRole,
      username: currentSessionUsername,
      userId: Number(currentSessionUserId)
    };
  }

  const endpoint = endpointMap[action];

  if (!endpoint) {
    return {
      status: 'error',
      message:
        `Aksi Backend '${action}' tidak dikenali.`
    };
  }

  try {
    const response =
      await requestAuthenticated({
        method: endpoint.method,
        pathname: endpoint.pathname,
        body: endpoint.method === 'GET'
          ? null
          : (data || {})
      });

    if (
      response.statusCode === 401
    ) {
      resetSessionState();

      return {
        success: false,
        code: 'SESSION_EXPIRED',
        error:
          'Sesi habis atau sudah dicabut.'
      };
    }

    return response.body || {
      success: false,
      error: 'Response VPS kosong.'
    };
  } catch (error) {
    console.error(
      `[KERNEL_ACTION_ERROR] ${error.message}`
    );

    return {
      success: false,
      error:
        'Tidak dapat memproses permintaan ke VPS.'
    };
  }
};

const handleBackend = async (
  event,
  payload
) => {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new Error(
      'Struktur IPC tidak valid.'
    );
  }

  const { action, data } = payload;

  if (action === 'LOGIN_ATTEMPT') {
    return handleLoginAttempt(data);
  }

  if (!(await checkSecurityGate())) {
    return {
      success: false,
      code: 'SESSION_EXPIRED',
      error:
        'Sesi habis atau sudah dicabut.'
    };
  }

  if (action === 'EXECUTE_LOGOUT') {
    return {
      status: 'trigger_kernel_logout',
      success: true
    };
  }

  return executeAuthenticatedAction(
    action,
    data
  );
};

ipcMain.handle(
  'secure-channel',
  handleBackend
);

ipcMain.handle(
  'secure-heartbeat-channel',
  async () => {
    try {
      const valid =
        await checkSecurityGate();

      if (!valid) {
        return {
          success: false,
          code: 'SESSION_EXPIRED',
          error:
            'Sesi habis atau sudah dicabut.'
        };
      }

      return {
        success: true,
        code: 'SESSION_ACTIVE'
      };
    } catch (error) {
      console.error(
        `[KERNEL_HEARTBEAT_ERROR] ${error.message}`
      );

      return {
        success: false,
        code: 'SESSION_CHECK_FAILED',
        error: 'Gagal memvalidasi sesi.'
      };
    }
  }
);

ipcMain.handle(
  'saluran-mandor',
  async (event, command) => {
    if (
      !command ||
      typeof command !== 'object' ||
      Array.isArray(command)
    ) {
      return {
        status: 'ERROR',
        pesan:
          'Format instruksi database tidak sah.'
      };
    }

    if (!(await checkSecurityGate())) {
      return {
        status: 'ERROR',
        pesan:
          'Akses Ditolak! Sesi ilegal atau telah habis.'
      };
    }

    try {
      const response =
        await requestAuthenticated({
          method: 'POST',
          pathname: '/api/dynamic/crud',
          body: command
        });

      if (response.statusCode === 401) {
        resetSessionState();

        return {
          status: 'ERROR',
          pesan: 'Sesi telah berakhir.'
        };
      }

      return response.body || {
        status: 'ERROR',
        pesan: 'Response VPS kosong.'
      };
    } catch (error) {
      console.error(
        `[KERNEL_CRUD_ERROR] ${error.message}`
      );

      return {
        status: 'ERROR',
        pesan:
          'Gagal terhubung ke server VPS.'
      };
    }
  }
);

ipcMain.handle(
  'secure-logout-channel',
  async (event, payload) => {
    try {
      if (
        !payload ||
        typeof payload !== 'object' ||
        payload.action !== 'EXECUTE_LOGOUT'
      ) {
        return {
          success: false,
          error: 'Permintaan logout tidak valid.'
        };
      }

      if (internalAccessToken) {
        try {
          await requestAuthenticated({
            method: 'POST',
            pathname: '/api/client/logout',
            body: {
              action: 'EXECUTE_LOGOUT'
            },
            retryOnUnauthorized: false
          });
        } catch (error) {
          console.error(
            `[KERNEL_REMOTE_LOGOUT_ERROR] ${error.message}`
          );
        }
      }

      await clearSensitiveSessionData();
      resetSessionState();
      await closeDashboardAndShowLogin();

      return {
        success: true
      };
    } catch (error) {
      console.error(
        `[KERNEL_LOGOUT_ERROR] ${error.message}`
      );

      return {
        success: false,
        error: 'Gagal melakukan logout.'
      };
    }
  }
);

const initApp = async () => {
  await app.whenReady();

  await clearSensitiveSessionData();

  const discovery = await runServerDiscovery();

  if (!discovery.success) {
    console.error(
      `[DISCOVERY_BOOT_FAILURE] ${discovery.error}`
    );

    throw new Error(
      `Discovery VPS gagal: ${discovery.error}`
    );
  }

  console.log(
    `[DISCOVERY_BOOT_SUCCESS] VPS IP=${discovery.server_ip}`
  );

  vpsClient.configureServerTarget(
    discovery.server_ip
  );

  console.log(
    `[VPS_TARGET_READY] file=${__filename} ip=${discovery.server_ip}`
  );

  if (
    process.env.APP_MODE !== 'SERVER_VPS' &&
    !process.argv.includes('--headless')
  ) {
    await createWindow();
  }

  console.log(
    '[KERNEL_READY] Electron client VPS aktif.'
  );
};

app.on(
  'window-all-closed',
  () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
);

initApp().catch((error) => {
  console.error(
    `[KERNEL_CRITICAL_BOOT_FAILURE] ${error.message}`
  );

  process.exit(1);
});
