import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import electron from 'electron';
const { shell } = electron;

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const POLL_INTERVAL_MS = 2000;
const RESPONSE_TIMEOUT_MS = 60000;

const DISCOVERY_FILE_ID =
  process.env.ENTERPRISE_VPS_DISCOVERY_FILE_ID ||
  '1nIi5n5OHL09rtXE338I_ObLIws4Ca_zX';

async function saveToken(tokenFile, oauth) {
  const credentials = oauth.credentials;

  const token = {
    token: credentials.access_token || null,
    refresh_token: credentials.refresh_token || null,
    token_uri: 'https://oauth2.googleapis.com/token',
    client_id: oauth._clientId,
    client_secret: oauth._clientSecret,
    scopes: SCOPES,
    expiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null,
  };

  await fs.mkdir(path.dirname(tokenFile), {
    recursive: true,
    mode: 0o700,
  });

  await fs.writeFile(
    tokenFile,
    JSON.stringify(token, null, 2),
    { mode: 0o600 }
  );

  await fs.chmod(tokenFile, 0o600);
}

async function authorize(clientSecretPath, tokenFile) {
  const raw = await fs.readFile(clientSecretPath, 'utf8');
  const secret = JSON.parse(raw);
  const config = secret.installed || secret.web;

  if (!config?.client_id || !config?.client_secret) {
    throw new Error('Konfigurasi Google OAuth tidak valid.');
  }

  const oauth = new google.auth.OAuth2(
    config.client_id,
    config.client_secret
  );

  oauth._clientId = config.client_id;
  oauth._clientSecret = config.client_secret;

  oauth.on('tokens', async (tokens) => {
    oauth.setCredentials({
      ...oauth.credentials,
      ...tokens,
    });

    try {
      await saveToken(tokenFile, oauth);
    } catch (error) {
      console.error('[DISCOVERY_TOKEN_SAVE_ERROR]', error.message);
    }
  });

  try {
    const saved = JSON.parse(
      await fs.readFile(tokenFile, 'utf8')
    );

    oauth.setCredentials({
      access_token: saved.token || saved.access_token || undefined,
      refresh_token: saved.refresh_token || undefined,
      expiry_date:
        saved.expiry_date ||
        (saved.expiry ? Date.parse(saved.expiry) : undefined),
      scope: Array.isArray(saved.scopes)
        ? saved.scopes.join(' ')
        : saved.scope,
      token_type: saved.token_type || 'Bearer',
    });

    if (oauth.credentials.access_token) {
      if (
        oauth.credentials.expiry_date &&
        oauth.credentials.expiry_date <= Date.now() &&
        !oauth.credentials.refresh_token
      ) {
        throw new Error('Token kedaluwarsa dan tidak memiliki refresh token.');
      }

      await oauth.getAccessToken();
      await saveToken(tokenFile, oauth);
      console.log('[DISCOVERY_AUTH] Token lama berhasil digunakan.');
      return oauth;
    }
  } catch (error) {
    if (
      error.code !== 'ENOENT' &&
      !String(error.message).includes('Token kedaluwarsa')
    ) {
      console.error('[DISCOVERY_TOKEN_READ_ERROR]', error.message);
    }
  }

  console.log('[DISCOVERY_AUTH] Otorisasi Google diperlukan.');

  const server = http.createServer();
  let callbackResolve;
  let callbackReject;

  const callbackResult = new Promise((resolve, reject) => {
    callbackResolve = resolve;
    callbackReject = reject;
  });

  server.on('request', (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (state !== oauth._discoveryState) {
      res.writeHead(400);
      res.end('State OAuth tidak valid.');
      callbackReject(new Error('State OAuth tidak valid.'));
      return;
    }

    if (error || !code) {
      res.writeHead(400);
      res.end('Otorisasi Google gagal. Silakan kembali ke aplikasi.');
      callbackReject(new Error(error || 'Kode otorisasi tidak ditemukan.'));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(
      '<!doctype html><html><body><h2>Otorisasi berhasil</h2>' +
      '<p>Kembali ke aplikasi Enterprise Invest.</p></body></html>'
    );

    callbackResolve(code);
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const redirectUri =
      `http://127.0.0.1:${address.port}/oauth2callback`;

    oauth.redirectUri = redirectUri;

    const state = cryptoRandomState();
    oauth._discoveryState = state;

    const authUrl = oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
      redirect_uri: redirectUri,
    });

    await shell.openExternal(authUrl);

    const timeout = new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Otorisasi Google melewati batas waktu.')),
        RESPONSE_TIMEOUT_MS
      );
      timer.unref?.();
    });

    const code = await Promise.race([callbackResult, timeout]);

    const { tokens } = await oauth.getToken({
      code,
      redirect_uri: redirectUri,
    });

    oauth.setCredentials(tokens);
    await saveToken(tokenFile, oauth);

    console.log('[DISCOVERY_AUTH] Otorisasi Google berhasil.');
    return oauth;
  } finally {
    server.close();
  }
}

function cryptoRandomState() {
  return randomBytes(32).toString('hex');
}

async function readDiscoveryFile(drive) {
  const response = await drive.files.get(
    {
      fileId: DISCOVERY_FILE_ID,
      alt: 'media',
    },
    {
      responseType: 'stream',
    }
  );

  let content = '';

  for await (const chunk of response.data) {
    content += chunk.toString('utf8');
  }

  const data = JSON.parse(content);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Isi discovery.json bukan JSON object.');
  }

  return data;
}

async function writeDiscoveryFile(drive, data) {
  const body = Readable.from([
    JSON.stringify(data, null, 2),
  ]);

  await drive.files.update({
    fileId: DISCOVERY_FILE_ID,
    media: {
      mimeType: 'application/json',
      body,
    },
  });
}

export default async function runServerDiscovery({
  clientSecretPath,
  tokenFile,
}) {
  try {
    const oauth = await authorize(clientSecretPath, tokenFile);
    const drive = google.drive({ version: 'v3', auth: oauth });

    const requestId = cryptoRandomState() + '-' + Date.now();

    const request = {
      version: 1,
      status: 'request',
      request_id: requestId,
      server_id: null,
      server_ip: null,
      updated_at: new Date().toISOString(),
    };

    console.log('[DISCOVERY_START] Mengirim request ke Google Drive.');
    await writeDiscoveryFile(drive, request);

    const deadline = Date.now() + RESPONSE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS)
      );

      const response = await readDiscoveryFile(drive);

      if (response.request_id !== requestId) continue;
      if (response.status !== 'response') continue;

      const serverIp = String(response.server_ip || '').trim();

      if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(serverIp)) {
        throw new Error('Respons discovery tidak memiliki IP yang valid.');
      }

      const result = {
        success: true,
        request_id: requestId,
        server_id: response.server_id || null,
        server_ip: serverIp,
        updated_at: response.updated_at || null,
      };

      console.log(
        `[DISCOVERY_SUCCESS] server_ip=${serverIp} request_id=${requestId}`
      );

      return result;
    }

    throw new Error('Discovery timeout setelah 60 detik.');
  } catch (error) {
    console.error('[DISCOVERY_FAILED]', error.message);

    return {
      success: false,
      error: error.message || 'Discovery VPS gagal.',
    };
  }
}
