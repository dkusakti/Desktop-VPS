import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '../../..', '.env')
});

function readRawMachineId() {
  if (process.platform === 'linux') {
    for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const value = execFileSync('cat', [file], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();

        if (value) return value;
      } catch {}
    }
  }

  if (process.platform === 'win32') {
    const output = execFileSync(
      'reg',
      [
        'query',
        'HKLM\\SOFTWARE\\Microsoft\\Cryptography',
        '/v',
        'MachineGuid'
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );

    const match = output.match(/MachineGuid\s+REG_\w+\s+([^\r\n]+)/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  if (process.platform === 'darwin') {
    const output = execFileSync(
      'ioreg',
      ['-rd1', '-c', 'IOPlatformExpertDevice'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );

    const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);

    if (match?.[1]?.trim()) return match[1].trim();
  }

  throw new Error('HARDWARE_READ_FAILED');
}

export function getSecureFingerprint() {
  const machineId = readRawMachineId().trim().toLowerCase();
  const key = process.env.HARDWARE_FINGERPRINT_KEY;

  if (!/^[a-f0-9]{64}$/i.test(String(key ?? ''))) {
    throw new Error('HARDWARE_FINGERPRINT_KEY_INVALID');
  }

  return crypto
    .createHmac('sha256', Buffer.from(key, 'hex'))
    .update(machineId, 'utf8')
    .digest('hex');
}

export function validateFingerprintFormat(value) {
  return /^[a-f0-9]{64}$/.test(String(value ?? '').trim().toLowerCase());
}
