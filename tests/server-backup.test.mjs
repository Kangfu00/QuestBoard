import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { MAX_BACKUP_BYTES } from '../dist/model.mjs';

const backupModule = await import('../backup-store.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const state = (name = 'My saved board') => ({
  version: 1, items: [], stamps: [],
  settings: { stampStyle: 'seal', theme: 'walnut', boardName: name },
});

async function temporaryStore(t, options = {}) {
  assert.equal(typeof backupModule.createBackupStore, 'function', 'A local disk backup store must be available');
  const dir = await mkdtemp(join(tmpdir(), 'questboard-backup-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, store: backupModule.createBackupStore({ backupDir: dir, ...options }) };
}

async function temporaryServer(t) {
  const fixture = await temporaryStore(t);
  const { startQuestboardServer } = await import('../server.mjs');
  const server = await startQuestboardServer({ backupDir: fixture.dir, port: 0 });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); });
  return { ...fixture, server, port: server.address().port };
}

function http(port, path = '/api/backup', { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolveResponse, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(text); } catch { /* Static responses are not JSON. */ }
        resolveResponse({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.setTimeout(2500, () => req.destroy(new Error(`HTTP timeout: ${method} ${path} ${JSON.stringify(headers)}`)));
    req.on('error', reject);
    req.end(body);
  });
}

const post = (port, document, baseRevision) => http(port, '/api/backup', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Questboard-Backup': '1' },
  body: JSON.stringify({ state: document, baseRevision }),
});

test('an empty disk store reports no saved board without creating backup files', async t => {
  const { dir, store } = await temporaryStore(t);
  assert.deepEqual(await store.read(), { state: null, revision: null, savedAt: null, backupDir: dir });
  assert.deepEqual(await readdir(dir), []);
});

test('a write saves validated importable JSON and survives a new store instance', async t => {
  const { dir, store } = await temporaryStore(t);
  const saved = await store.write({ ...state(), unknown: 'discard this' }, null);
  assert.deepEqual(saved.state, state());
  assert.match(saved.revision, /^[a-f0-9]{64}$/);
  assert.equal(saved.revision, createHash('sha256').update(JSON.stringify(state())).digest('hex'));
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'latest.json'), 'utf8')), state());
  assert.deepEqual(await backupModule.createBackupStore({ backupDir: dir }).read(), saved);
  assert.ok((await readdir(dir)).every(name => !name.endsWith('.tmp')));
});

test('stale and simultaneous writes cannot overwrite a newer board', async t => {
  const { store } = await temporaryStore(t);
  const first = await store.write(state('First'), null);
  const writes = await Promise.allSettled([
    store.write(state('Writer A'), first.revision),
    store.write(state('Writer B'), first.revision),
  ]);
  assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = writes.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.statusCode, 409);
  assert.equal(rejected.reason.code, 'conflict');
  const current = await store.read();
  assert.equal(current.state.settings.boardName, 'Writer A');
  assert.deepEqual(rejected.reason.current, current);
  await assert.rejects(store.write(state('Stale initial page'), null), { statusCode: 409 });
  assert.deepEqual(await store.read(), current);
});

test('invalid writes and unchanged saves preserve the last good file and its timestamp', async t => {
  const { dir, store } = await temporaryStore(t);
  const saved = await store.write(state(), null);
  const diskBefore = await readFile(join(dir, 'latest.json'));
  await assert.rejects(store.write({ version: 999 }, saved.revision), { statusCode: 400 });
  await assert.rejects(store.write(state('Bad revision'), '../outside'), { statusCode: 400 });
  assert.deepEqual(await store.write(state(), saved.revision), saved);
  assert.deepEqual(await readFile(join(dir, 'latest.json')), diskBefore);
  assert.deepEqual(await store.read(), saved);
  assert.deepEqual(await readdir(join(dir, 'history')), []);
});

test('the previous 30 changed versions recover a corrupt latest file and ignore torn temporary files', async t => {
  const { dir, store } = await temporaryStore(t);
  let saved = await store.write(state('Version 0'), null);
  for (let i = 1; i <= 32; i++) saved = await store.write(state(`Version ${i}`), saved.revision);
  const files = (await readdir(join(dir, 'history'))).filter(name => name.endsWith('.json')).sort();
  assert.equal(files.length, 30);
  const oldNames = await Promise.all(files.map(async name => JSON.parse(await readFile(join(dir, 'history', name))).settings.boardName));
  assert.equal(oldNames[0], 'Version 2');
  assert.equal(oldNames.at(-1), 'Version 31');
  await writeFile(join(dir, 'latest.json'), '{"version":');
  await writeFile(join(dir, '.latest-incomplete.tmp'), '{"version":1');
  const restarted = backupModule.createBackupStore({ backupDir: dir });
  const recovered = await restarted.read();
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.settings.boardName, 'Version 31');
  assert.equal(await readFile(join(dir, 'latest.json'), 'utf8'), '{"version":');
  const repaired = await restarted.write(state('After recovery'), recovered.revision);
  assert.equal(repaired.state.settings.boardName, 'After recovery');
  assert.equal((await restarted.read()).recovered, undefined);
  assert.equal((await readdir(join(dir, 'history'))).filter(name => name.endsWith('.json')).length, 30);
});

test('recovery skips invalid history and can restore when the latest file is missing', async t => {
  const { dir, store } = await temporaryStore(t);
  let saved = await store.write(state('Old good'), null);
  saved = await store.write(state('Recent good'), saved.revision);
  await store.write(state('Latest'), saved.revision);
  await rm(join(dir, 'latest.json'));
  let recovered = await backupModule.createBackupStore({ backupDir: dir }).read();
  assert.equal(recovered.state.settings.boardName, 'Recent good');
  assert.equal(recovered.recovered, true);
  const histories = (await readdir(join(dir, 'history'))).sort();
  await writeFile(join(dir, 'history', histories.at(-1)), JSON.stringify({ version: 999 }));
  recovered = await backupModule.createBackupStore({ backupDir: dir }).read();
  assert.equal(recovered.state.settings.boardName, 'Old good');
  assert.equal(recovered.recovered, true);
});

test('an unrecoverable disk file is reported as an error instead of an empty board', async t => {
  const { dir, store } = await temporaryStore(t);
  await writeFile(join(dir, 'latest.json'), 'broken');
  await assert.rejects(store.read(), { code: 'backup_unreadable', statusCode: 500 });
  await assert.rejects(store.write(state(), null), { code: 'backup_unreadable' });
  assert.equal(await readFile(join(dir, 'latest.json'), 'utf8'), 'broken');
});

test('a filesystem failure cannot be mistaken for a successful save', async t => {
  const { dir } = await temporaryStore(t);
  const blocker = join(dir, 'not-a-folder');
  await writeFile(blocker, 'keep');
  const store = backupModule.createBackupStore({ backupDir: blocker });
  await assert.rejects(store.write(state(), null));
  assert.equal(await readFile(blocker, 'utf8'), 'keep');
});

test('HTTP backup persistence, restart, health, and static assets work from exported server', async t => {
  const { dir, port, server } = await temporaryServer(t);
  assert.equal(server.address().address, '127.0.0.1');
  assert.deepEqual((await http(port, '/api/health')).json, { app: 'questboard', backupApi: 1 });
  assert.equal((await http(port, '/')).status, 200);
  assert.equal((await http(port, '/model.mjs')).status, 200);
  const audio=await http(port,'/audio/kenney-rpg/bookOpen.ogg');
  assert.equal(audio.status,200);
  assert.equal(audio.headers['content-type'],'audio/ogg');
  assert.equal(audio.text.slice(0,4),'OggS');
  assert.equal((await http(port, '/server.mjs')).status, 404);
  assert.equal((await http(port, '/api/backup')).json.state, null);
  const saved = await post(port, state('HTTP saved'), null);
  assert.equal(saved.status, 200);
  assert.equal(saved.headers['cache-control'], 'no-store');
  assert.equal(saved.headers['access-control-allow-origin'], undefined);
  assert.equal(saved.json.state, undefined);
  assert.deepEqual((await http(port)).json, { ...saved.json, state: state('HTTP saved') });
  const conflict = await post(port, state('Stale page'), null);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.error, 'conflict');
  assert.equal(conflict.json.revision, saved.json.revision);
  const { startQuestboardServer } = await import('../server.mjs');
  const restarted = await startQuestboardServer({ backupDir: dir, port: 0 });
  t.after(async () => { restarted.closeAllConnections(); await new Promise(resolveClose => restarted.close(resolveClose)); });
  assert.deepEqual((await http(restarted.address().port)).json, { ...saved.json, state: state('HTTP saved') });
});

test('foreign hosts and browser request contexts cannot read or change local backup data', async t => {
  const { port, dir } = await temporaryServer(t);
  const denied = [
    { Host: `evil.example:${port}` },
    { Host: '127.0.0.1:1' },
    { Origin: 'https://evil.example' },
    { Origin: 'null' },
    { Origin: `http://localhost:${port}` },
    { 'Sec-Fetch-Site': 'cross-site' },
    { 'Sec-Fetch-Site': 'same-site' },
  ];
  for (const headers of denied) {
    assert.equal((await http(port, '/api/backup', { headers })).status, 403, JSON.stringify(headers));
    assert.equal((await http(port, '/api/backup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Questboard-Backup': '1', ...headers },
      body: JSON.stringify({ state: state(), baseRevision: null }),
    })).status, 403);
  }
  const allowed = await http(port, '/api/backup', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Questboard-Backup': '1', Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' },
    body: JSON.stringify({ state: state(), baseRevision: null }),
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'latest.json'))), state());
});

test('POST requires JSON and the custom header and rejects invalid, oversized, and path-bearing envelopes', async t => {
  const { port, dir } = await temporaryServer(t);
  const body = JSON.stringify({ state: state(), baseRevision: null });
  for (const headers of [{}, { 'Content-Type': 'text/plain', 'X-Questboard-Backup': '1' }, { 'Content-Type': 'application/json' }]) {
    assert.equal((await http(port, '/api/backup', { method: 'POST', headers, body })).status, 403);
  }
  const headers = { 'Content-Type': 'application/json', 'X-Questboard-Backup': '1' };
  for (const value of ['{', 'null', '[]', JSON.stringify({ state: { version: 999 }, baseRevision: null }), JSON.stringify({ state: state() }), JSON.stringify({ state: state(), baseRevision: null, path: '../outside.json' })]) {
    assert.equal((await http(port, '/api/backup', { method: 'POST', headers, body: value })).status, 400);
  }
  assert.equal((await http(port, '/api/backup', { method: 'POST', headers: { ...headers, 'Content-Length': String(MAX_BACKUP_BYTES + 4097) } })).status, 413);
  assert.equal((await http(port, '/api/backup', { method: 'OPTIONS' })).status, 405);
  assert.equal((await http(port, '/api/backup', { method: 'DELETE' })).status, 405);
  assert.equal((await http(port, '/api/backup/../../latest.json')).status, 404);
  assert.deepEqual(await readdir(dir), []);
});

test('default paths are anchored to the project instead of the shell working directory', async t => {
  await temporaryStore(t);
  const { DEFAULT_BACKUP_DIR, STATIC_DIR } = await import('../server.mjs');
  const project = dirname(dirname(fileURLToPath(import.meta.url)));
  assert.equal(DEFAULT_BACKUP_DIR, resolve(project, '..', 'Questboard-Backups'));
  assert.equal(STATIC_DIR, resolve(project, 'dist'));
});

test('an interrupted HTTP upload leaves the last saved board intact', async t => {
  const { port, dir, server } = await temporaryServer(t);
  const saved = await post(port, state('Last complete save'), null);
  const diskBefore = await readFile(join(dir, 'latest.json'));
  const seen = once(server, 'request');
  const upload = request({ hostname: '127.0.0.1', port, path: '/api/backup', method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Questboard-Backup': '1', 'Content-Length': '10000',
  } });
  upload.on('error', () => {}); // Destroying the client intentionally aborts it.
  upload.flushHeaders();
  const [incoming] = await seen;
  const received = once(incoming, 'data');
  upload.write('{"state":{"version":1');
  await received;
  const closed = new Promise(resolveClose => incoming.once('close', resolveClose));
  upload.destroy();
  await closed;
  assert.deepEqual((await http(port)).json, { ...saved.json, state: state('Last complete save') });
  assert.deepEqual(await readFile(join(dir, 'latest.json')), diskBefore);
  assert.deepEqual(await readdir(join(dir, 'history')), []);
});

test('chunked uploads enforce the byte limit even without a Content-Length header', async t => {
  const { port, dir } = await temporaryServer(t);
  const response = await http(port, '/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Questboard-Backup': '1', 'Transfer-Encoding': 'chunked' },
    body: Buffer.alloc(MAX_BACKUP_BYTES + 4097, 32),
  });
  assert.equal(response.status, 413);
  assert.equal(response.json.error, 'backup_too_large');
  assert.deepEqual(await readdir(dir), []);
});
