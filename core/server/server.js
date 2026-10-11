import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import ExpressServer from './infrastructure/http/express-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '.env'),
});

process.env.APP_MODE = 'SERVER_VPS';

console.log(
  '\x1b[32m🚀 [VPS BOOTSTRAPPER] Memulai Enterprise Invest API Server...\x1b[0m'
);

let server;

try {
  server = ExpressServer.start();

  const matikanServerSecaraAman = (sinyalOS) => {
    console.log(
      `\n\x1b[31m⚠ Menangkap sinyal ${sinyalOS}. Menutup server Express...\x1b[0m`
    );

    if (!server) {
      process.exit(0);
    }

    server.close(() => {
      console.log(
        '\x1b[31m🛑 [SERVER CLOSED]: Server Express dihentikan dengan aman.\x1b[0m'
      );
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => matikanServerSecaraAman('SIGTERM'));
  process.on('SIGINT', () => matikanServerSecaraAman('SIGINT'));
} catch (bootstrapFatalError) {
  console.error(
    '🚨 [VPS BOOTSTRAPPER FATAL CRASH]: Gagal menjalankan server Express.',
    bootstrapFatalError
  );

  process.exit(1);
}
