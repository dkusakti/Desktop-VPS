import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '../..', '.env')
});

const VPS_BASE_URL = String(process.env.VPS_BASE_URL || '').trim();

if (!/^https:\/\//i.test(VPS_BASE_URL)) {
  throw new Error('VPS_BASE_URL harus menggunakan HTTPS.');
}

let vpsBaseUrl = VPS_BASE_URL;

const configureServerTarget = (serverIp) => {
  const normalizedIp = String(serverIp || '').trim();

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalizedIp)) {
    throw new Error(
      `IP VPS hasil discovery tidak valid: ${normalizedIp || 'kosong'}`
    );
  }

  const octets = normalizedIp.split('.').map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    throw new Error(
      `IP VPS hasil discovery tidak valid: ${normalizedIp}`
    );
  }

  const discoveredUrl = new URL(vpsBaseUrl);

  vpsBaseUrl =
    `https://${normalizedIp}:${discoveredUrl.port || '443'}`;

  console.log(
    `[VPS_TARGET_CONFIGURED] file=${__filename} ip=${normalizedIp} port=${discoveredUrl.port || 443}`
  );
};

const certificatePath = path.join(
  __dirname,
  '../certs/enterprise-invest-root-ca.crt'
);

if (!fs.existsSync(certificatePath)) {
  throw new Error(
    `Root CA Enterprise tidak ditemukan: ${certificatePath}`
  );
}

const caCertificate = fs.readFileSync(certificatePath);

const vpsClient = {
  request: ({
    method = 'GET',
    pathname,
    body = null,
    accessToken = '',
    headers = {}
  }) => new Promise((resolve, reject) => {
    const baseUrl = new URL(vpsBaseUrl);
    const requestPath = String(pathname || '');

    if (!requestPath.startsWith('/')) {
      return reject(
        new Error('Path VPS harus diawali dengan /.')
      );
    }

    const payload = body === null
      ? null
      : JSON.stringify(body);

    const requestHeaders = {
      Accept: 'application/json',
      ...headers
    };

    if (payload !== null) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] =
        Buffer.byteLength(payload);
    }

    if (accessToken) {
      requestHeaders.Authorization =
        `Bearer ${accessToken}`;
    }

    const requestOptions = {
      protocol: 'https:',
      hostname: baseUrl.hostname,
      port: baseUrl.port || 443,
      method,
      path: requestPath,
      headers: requestHeaders,
      ca: caCertificate,
    servername: 'enterprise-vps.local',
      rejectUnauthorized: true,
      timeout: 10000
    };

    const request = https.request(
      requestOptions,
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');

        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          let parsedBody = null;

          if (responseBody.trim() !== '') {
            try {
              parsedBody = JSON.parse(responseBody);
            } catch {
              parsedBody = {
                success: false,
                error: 'Response VPS bukan JSON yang valid.'
              };
            }
          }

          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: parsedBody
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(
        new Error('Koneksi ke VPS timeout.')
      );
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (payload !== null) {
      request.write(payload);
    }

    request.end();
  })
};

vpsClient.configureServerTarget = configureServerTarget;

export default vpsClient;
