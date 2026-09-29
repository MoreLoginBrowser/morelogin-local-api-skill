const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { requestApi } = require('../bin/common');
const { validateOptions } = require('../bin/options');
const { buildMatrix } = require('../scripts/test-results');
async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
test('canonical paths and method allowlist reject confirmation bypasses before HTTP', async (t) => {
  let count = 0;
  const baseUrl = await serve(t, (req, res) => { count++; res.end('{"code":0}'); });
  for (const endpoint of ['/api/cloudphone/./monthly/activate', '/api/env/./closeAll', '/api/cloudbrowser/./stop',
    '/api/env//closeAll', '/api/env/closeAll/', '/api/env/closeAll?x=1', '/api/env/%63loseAll',
    '/api/env/a/../closeAll', '/api/env/closeAll\n', '/api/env/CloseAll', '/api/notDocumented']) {
    await assert.rejects(requestApi(endpoint, { baseUrl, body: { force: true } }), /Invalid API path|Undocumented/);
  }
  await assert.rejects(requestApi('/api/env/closeAll', { baseUrl, method: 'GET' }), /Undocumented/);
  await assert.rejects(requestApi('/api/cloudbrowser/stop', { baseUrl, body: { force: true } }), /confirm-force-stop/);
  assert.equal(count, 0);
});
test('UTF-8 Chinese and emoji survive one-byte response chunks', async (t) => {
  const expected = { code: 0, data: { name: '中文环境😀', remark: '测试𠮷' } };
  const bytes = Buffer.from(JSON.stringify(expected));
  const baseUrl = await serve(t, (req, res) => {
    let offset = 0;
    const timer = setInterval(() => { if (offset < bytes.length) res.write(bytes.subarray(offset, ++offset)); else { clearInterval(timer); res.end(); } }, 1);
    res.on('close', () => clearInterval(timer));
  });
  assert.deepEqual((await requestApi('/api/balance', { method: 'GET', baseUrl })).body, expected);
});
test('absolute deadline terminates a continuously trickling response without retry', async (t) => {
  let count = 0;
  const baseUrl = await serve(t, (req, res) => {
    count++;
    res.write('{');
    const timer = setInterval(() => res.write(' '), 10);
    res.on('close', () => clearInterval(timer));
  });
  const start = Date.now();
  await assert.rejects(requestApi('/api/balance', { method: 'GET', baseUrl, timeoutMs: 100 }), /timeout.*outcome unknown/);
  assert.ok(Date.now() - start < 2000);
  assert.equal(count, 1);
});
test('response limit aborts oversize results', async (t) => {
  const previous = process.env.MORELOGIN_MAX_RESPONSE_BYTES;
  process.env.MORELOGIN_MAX_RESPONSE_BYTES = '128';
  t.after(() => { if (previous === undefined) delete process.env.MORELOGIN_MAX_RESPONSE_BYTES; else process.env.MORELOGIN_MAX_RESPONSE_BYTES = previous; });
  const baseUrl = await serve(t, (req, res) => res.end(JSON.stringify({ code: 0, data: 'x'.repeat(1024) })));
  await assert.rejects(requestApi('/api/balance', { method: 'GET', baseUrl }), /Response exceeds 128/);
});
test('numeric int64 response IDs are preserved as exact decimal strings', async (t) => {
  const baseUrl = await serve(t, (req, res) => res.end('{"code":0,"data":{"id":1993244721490239488,"count":3}}'));
  const response = await requestApi('/api/balance', { method: 'GET', baseUrl });
  assert.equal(response.body.data.id, '1993244721490239488');
  assert.equal(response.body.data.count, 3);
});
test('multipart uses streaming, exact Content-Length, and rejects oversized files before sending', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'morelogin-stream-'));
  t.after(() => fs.rmSync(temp, { recursive: true }));
  const file = path.join(temp, '测试.bin');
  fs.writeFileSync(file, Buffer.alloc(2 * 1024 * 1024, 123));
  let calls = 0, received = 0, expected;
  const baseUrl = await serve(t, async (req, res) => {
    calls++; expected = Number(req.headers['content-length']);
    for await (const chunk of req) received += chunk.length;
    res.end('{"code":0,"msg":null,"requestId":"upload-test"}');
  });
  t.mock.method(fs, 'readFileSync', () => { throw new Error('Upload must not buffer entire file'); });
  const result = await requestApi('/api/cloudphone/uploadFile', { baseUrl, body: { id: '123' }, file });
  assert.equal(result.body.code, 0); assert.equal(received, expected); assert.ok(received > 2 * 1024 * 1024);
  const previous = process.env.MORELOGIN_MAX_UPLOAD_BYTES;
  process.env.MORELOGIN_MAX_UPLOAD_BYTES = '100';
  try { await assert.rejects(requestApi('/api/cloudphone/uploadFile', { baseUrl, body: { id: '123' }, file }), /Upload exceeds 100/); }
  finally { if (previous === undefined) delete process.env.MORELOGIN_MAX_UPLOAD_BYTES; else process.env.MORELOGIN_MAX_UPLOAD_BYTES = previous; }
  assert.equal(calls, 1);
});
test('ambiguous, missing-value and unsupported options fail closed', () => {
  for (const [scope, command, options] of [
    ['browser', 'status', { 'unique-id': '123' }], ['cloudphone', 'start', { headless: true }],
    ['cloudphone', 'start', { headles: 'false' }], ['cloudphone', 'start', { payload: '{}', id: '123' }],
    ['browser', 'start', { 'env-id': '1', 'profile-id': '2' }], ['tag', 'list', { payload: '{}' }],
  ]) assert.throws(() => validateOptions(scope, command, options));
});
test('release matrix preserves failed, skipped and missing cases instead of manufacturing passes', () => {
  const operations = [{ route: '/api/balance', method: 'GET' }];
  const events = ['success', 'business', 'http'].map((phase) => ({ type: 'test:pass', name: `transport GET /api/balance :: ${phase}` }));
  assert.equal(buildMatrix(events, operations, {}).status, 'pass');
  assert.equal(buildMatrix(events, operations, { browser: { list: '' } }).status, 'incomplete-or-failed');
  for (const variant of [events.slice(1), [...events, events[0]], events.map((e, i) => i ? e : { ...e, skip: true }),
    events.map((e, i) => i ? e : { ...e, type: 'test:fail' })]) {
    assert.equal(buildMatrix(variant, operations, {}).status, 'incomplete-or-failed');
  }
});
