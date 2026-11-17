import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackupError, createBackupStore, DEFAULT_BACKUP_DIR } from './backup-store.mjs';
import { MAX_BACKUP_BYTES } from './dist/model.mjs';

export { DEFAULT_BACKUP_DIR };
export const STATIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
export const MAX_REQUEST_BYTES = MAX_BACKUP_BYTES + 4096;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

function json(res, status, body) {
  // A rejected upload may still have an unread body. Close its connection so
  // the next request cannot be interpreted as the remainder of that upload.
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status >= 400 ? { Connection: 'close' } : {}) }).end(JSON.stringify(body));
}

function localRequest(req) {
  if (!['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(req.socket.remoteAddress)) return false;
  const port = req.socket.localPort;
  const host = req.headers.host;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host)) return false;
  if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return false;
  const site = req.headers['sec-fetch-site'];
  return site === undefined || site === 'same-origin' || site === 'none';
}

function readEnvelope(req) {
  const announced = req.headers['content-length'];
  if (announced !== undefined && Number(announced) > MAX_REQUEST_BYTES) {
    req.resume();
    return Promise.reject(new BackupError('backup_too_large', 'ไฟล์สำรองมีขนาดใหญ่เกินไป', 413));
  }
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        failed = true;
        chunks.length = 0;
        reject(new BackupError('backup_too_large', 'ไฟล์สำรองมีขนาดใหญ่เกินไป', 413));
      } else chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new BackupError('invalid_backup', 'การส่งไฟล์สำรองไม่สมบูรณ์', 400)));
    req.on('end', () => {
      if (failed) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || Array.isArray(body) || typeof body !== 'object'
          || !Object.hasOwn(body, 'state') || !Object.hasOwn(body, 'baseRevision')
          || Object.keys(body).some(key => !['state', 'baseRevision'].includes(key))) throw new Error('Invalid backup envelope');
        resolveBody(body);
      } catch { reject(new BackupError('invalid_backup', 'ข้อมูลสำรองไม่ถูกต้อง', 400)); }
    });
  });
}

function metadata({ state, ...details }) { return details; }

export function createQuestboardServer({ backupDir = DEFAULT_BACKUP_DIR, staticDir = STATIC_DIR } = {}) {
  const store = createBackupStore({ backupDir });
  const root = resolve(staticDir);
  const server = createServer(async (req, res) => {
    try {
      if (!localRequest(req)) {
        req.resume();
        json(res, 403, { error: 'local_only' });
        return;
      }
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/api/health') {
        json(res, req.method === 'GET' ? 200 : 405, req.method === 'GET' ? { app: 'questboard', backupApi: 1 } : { error: 'method_not_allowed' });
        return;
      }
      if (pathname === '/api/backup') {
        if (req.method === 'GET') json(res, 200, await store.read());
        else if (req.method === 'POST') {
          if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '') || req.headers['x-questboard-backup'] !== '1') {
            req.resume();
            json(res, 403, { error: 'backup_headers_required' });
            return;
          }
          const { state, baseRevision } = await readEnvelope(req);
          json(res, 200, metadata(await store.write(state, baseRevision)));
        } else { req.resume(); json(res, 405, { error: 'method_not_allowed' }); }
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { req.resume(); json(res, 405, { error: 'method_not_allowed' }); return; }
      const path = resolve(root, '.' + decodeURIComponent(pathname));
      if (path !== root && !path.startsWith(root + sep)) { json(res, 403, { error: 'forbidden_path' }); return; }
      const file = path === root ? resolve(root, 'index.html') : path;
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(req.method === 'HEAD' ? undefined : data);
      } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('Not found'); }
    } catch (error) {
      const status = error instanceof BackupError ? error.statusCode : 500;
      json(res, status, {
        error: error instanceof BackupError ? error.code : 'backup_io_error',
        message: error instanceof BackupError ? error.message : 'บันทึกหรืออ่านไฟล์สำรองไม่ได้ กรุณาตรวจสอบพื้นที่และสิทธิ์ของโฟลเดอร์',
        ...(error.current ? metadata(error.current) : {}),
      });
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 15_000;
  return server;
}

export function startQuestboardServer({ port = 4173, ...options } = {}) {
  const server = createQuestboardServer(options);
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolveServer(server);
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startQuestboardServer().then(server => {
    console.log(`Local: http://127.0.0.1:${server.address().port}`);
    console.log(`Backups: ${DEFAULT_BACKUP_DIR}`);
  }).catch(error => {
    console.error(error.code === 'EADDRINUSE' ? 'Port 4173 is already in use.' : error.message);
    process.exitCode = 1;
  });
}
