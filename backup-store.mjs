import { open, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BACKUP_BYTES, parseState, validateState } from './dist/model.mjs';

export const DEFAULT_BACKUP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'Questboard-Backups');
const HISTORY_LIMIT = 30;
const HISTORY_FILE = /^\d{13,}-[a-f0-9]{64}\.json$/;
const revisionOf = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');

export class BackupError extends Error {
  constructor(code, message, statusCode = 500, current) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    if (current) this.current = current;
  }
}

async function syncDirectory(directory) {
  // Windows does not expose fsync for directory handles through Node. The file
  // itself is always flushed before rename; POSIX also flushes the directory.
  if (process.platform === 'win32') return;
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function atomicWrite(file, state, savedAt) {
  const temporary = join(dirname(file), `.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(state, null, 2), 'utf8');
    if (savedAt) await handle.utimes(new Date(savedAt), new Date(savedAt));
    await handle.sync();
    await handle.close();
    handle = null;
    // Both paths are in the same directory. Never delete the good destination
    // first: a failed replacement leaves it intact.
    await rename(temporary, file);
    await syncDirectory(dirname(file));
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function readDocument(file) {
  let handle;
  try {
    handle = await open(file, 'r');
    const details = await handle.stat();
    if (!details.isFile() || details.size > MAX_BACKUP_BYTES) return { invalid: true };
    const state = parseState(await handle.readFile('utf8'));
    return { state, revision: revisionOf(state), savedAt: details.mtime.toISOString() };
  } catch (error) {
    if (error.code === 'ENOENT') return { missing: true };
    // Permissions and other I/O problems must not be treated as empty storage.
    if (error.code) throw error;
    return { invalid: true };
  } finally {
    if (handle) await handle.close();
  }
}

export function createBackupStore({ backupDir = DEFAULT_BACKUP_DIR } = {}) {
  backupDir = resolve(backupDir);
  const latestFile = join(backupDir, 'latest.json');
  const historyDir = join(backupDir, 'history');
  let operations = Promise.resolve();

  async function historyFiles() {
    try { return (await readdir(historyDir)).filter(name => HISTORY_FILE.test(name)).sort(); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }

  async function readCurrent() {
    const latest = await readDocument(latestFile);
    if (latest.state) return { ...latest, backupDir };
    const histories = await historyFiles();
    for (const name of histories.slice().reverse()) {
      const previous = await readDocument(join(historyDir, name));
      if (previous.state) return { ...previous, backupDir, recovered: true };
    }
    if (latest.invalid || histories.length) {
      throw new BackupError('backup_unreadable', 'ไม่พบไฟล์สำรองที่อ่านได้ กรุณาเก็บไฟล์เดิมไว้เพื่อตรวจสอบ');
    }
    return { state: null, revision: null, savedAt: null, backupDir };
  }

  function serial(operation) {
    const result = operations.then(operation);
    operations = result.catch(() => {});
    return result;
  }

  return {
    read: () => serial(readCurrent),
    write: (raw, baseRevision) => serial(async () => {
      if (baseRevision !== null && (typeof baseRevision !== 'string' || !/^[a-f0-9]{64}$/.test(baseRevision))) {
        throw new BackupError('invalid_backup', 'รหัสเวอร์ชันไฟล์สำรองไม่ถูกต้อง', 400);
      }
      let state;
      try { state = validateState(raw); }
      catch (error) { throw new BackupError('invalid_backup', error.message, 400); }
      const current = await readCurrent();
      if (baseRevision !== current.revision) {
        throw new BackupError('conflict', 'ไฟล์สำรองมีการเปลี่ยนแปลงจากหน้าต่างอื่น', 409, current);
      }
      if (revisionOf(state) === current.revision && !current.recovered) return current;

      await mkdir(historyDir, { recursive: true });
      if (current.state) {
        const histories = await historyFiles();
        // Keep ordering stable even if the clock moves backwards or two saves
        // occur in one millisecond. Each change retains the previous version.
        const lastSequence = Number(histories.at(-1)?.split('-')[0] ?? 0);
        const sequence = String(Math.max(Date.now(), lastSequence + 1)).padStart(13, '0');
        const historyFile = `${sequence}-${current.revision}.json`;
        await atomicWrite(join(historyDir, historyFile), current.state, current.savedAt);
        histories.push(historyFile);
        // There are at most 30 previous versions, plus latest.json. Prune only
        // after the last good document has a durable history copy.
        for (const old of histories.slice(0, Math.max(0, histories.length - HISTORY_LIMIT))) await unlink(join(historyDir, old));
      }
      await atomicWrite(latestFile, state);
      return readCurrent();
    }),
  };
}
