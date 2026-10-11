import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_FILE = process.env.ENTERPRISE_VPS_GOOGLE_SERVICE_ACCOUNT;
const DISCOVERY_FILE_ID =
  process.env.ENTERPRISE_VPS_DISCOVERY_FILE_ID ||
  '1nIi5n5OHL09rtXE338I_ObLIws4Ca_zX';
const POLL_INTERVAL = 5000;

if (!CREDENTIALS_FILE) {
  throw new Error(
    'ENTERPRISE_VPS_GOOGLE_SERVICE_ACCOUNT belum dikonfigurasi.'
  );
}

const LOG_DIR = path.join(BASE_DIR, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, message, details = '') {
  const line = `${new Date().toISOString()} | ${level} | ${message}${details ? ` | ${details}` : ''}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'discovery_server.log'), line + '\n');
}

function getActiveIp() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  throw new Error('IP IPv4 server tidak ditemukan.');
}

async function createDriveClient() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(`File kredensial tidak ditemukan: ${CREDENTIALS_FILE}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  log('INFO', 'Koneksi Google Drive siap');
  return drive;
}

async function readDiscoveryFile(drive) {
  const response = await drive.files.get(
    { fileId: DISCOVERY_FILE_ID, alt: 'media' },
    { responseType: 'text' }
  );

  const content = typeof response.data === 'string'
    ? response.data
    : JSON.stringify(response.data);

  const data = JSON.parse(content);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Format discovery.json harus berupa JSON object');
  }

  return data;
}

async function writeDiscoveryFile(drive, data) {
  data.updated_at = new Date().toISOString();

  await drive.files.update({
    fileId: DISCOVERY_FILE_ID,
    media: {
      mimeType: 'application/json',
      body: JSON.stringify(data, null, 2),
    },
  });

  log('INFO', 'discovery.json berhasil diperbarui', `request_id=${data.request_id}`);
}

async function processRequest(drive) {
  const data = await readDiscoveryFile(drive);
  const { status, request_id: requestId } = data;

  if (status !== 'request') {
    return;
  }

  if (!requestId) {
    log('WARN', 'Request ditolak karena request_id kosong');
    return;
  }

  const serverIp = getActiveIp();

  log('INFO', 'Request discovery diterima', `request_id=${requestId}`);

  await writeDiscoveryFile(drive, {
    version: 1,
    status: 'response',
    request_id: requestId,
    server_id: 'enterprise-vps-server',
    server_ip: serverIp,
    updated_at: null,
  });

  log('INFO', 'Response discovery selesai', `request_id=${requestId} server_ip=${serverIp}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  log('INFO', 'Enterprise VPS Discovery Server START');

  const drive = await createDriveClient();
  log('INFO', 'Discovery server siap memonitor Google Drive', `file_id=${DISCOVERY_FILE_ID}`);

  while (true) {
    try {
      await processRequest(drive);
    } catch (error) {
      log('ERROR', error.message || String(error));
    }

    await sleep(POLL_INTERVAL);
  }
}

main().catch(error => {
  log('ERROR', error.stack || String(error));
  process.exitCode = 1;
});
