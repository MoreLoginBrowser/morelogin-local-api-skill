const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { toBoolean, unwrapApiResult, redactSensitive, parseRequiredInt, parseJsonInput, requestApi } = require('../bin/common');
const { timeoutFor, guard } = require('../bin/policy');
let server, baseUrl, received = [], mode = 'success';
const root = path.resolve(__dirname, '..');
function cli(args) {
  return new Promise((resolve) => execFile(process.execPath, [path.join(root, 'bin/morelogin.js'), ...args], {
    cwd: root, env: { ...process.env, MORELOGIN_LOCAL_API_URL: baseUrl }, timeout: 5000,
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
before(async () => {
  server = http.createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    received.push({ path: req.url, method: req.method, body: text ? JSON.parse(text) : undefined });
    if (req.url === '/status') return res.end('{"status":"ok"}');
    if (mode === 'timeout') return;
    if (mode === 'invalid') return res.end('<html>not JSON</html>');
    if (mode === 'missing-code') return res.end('{"data":{"ok":true}}');
    if (mode === 'string-code') return res.end('{"code":"0","data":{}}');
    res.end(JSON.stringify({ code: 0, data: { password: 'secret-fixture', otpSecret: 'otp-fixture',
      cookies: 'cookie-fixture', id: '1993244721490239488', nested: [{ accessToken: 'token-fixture' }] } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise((resolve) => server.close(resolve)); });

test('strict booleans reject typo rather than silently disable resources', () => {
  for (const value of ['true', '1', 'yes', 'on', true]) assert.equal(toBoolean(value), true);
  for (const value of ['false', '0', 'no', 'off', false]) assert.equal(toBoolean(value), false);
  for (const value of ['ture', 'flase', {}, null]) assert.throws(() => toBoolean(value));
});
test('desktop status accepts its special health envelope only at /status', async () => {
  const response = { ok: true, body: { status: 'ok' } };
  assert.equal(unwrapApiResult(response).success, false);
  assert.equal(unwrapApiResult(response, { endpoint: '/status' }).success, true);
  const result = await cli(['api', '--endpoint', '/status', '--data', '{}']);
  assert.equal(result.code, 0, result.stderr);
});
test('invalid and business failure envelopes never report success', () => {
  for (const body of [null, {}, { code: '0' }, { code: 33301 }, { raw: 'html' }]) {
    assert.equal(unwrapApiResult({ ok: true, statusCode: 200, body }).success, false);
  }
  assert.equal(unwrapApiResult({ ok: true, body: { code: 0, data: false } }).data, false);
});
test('sensitive nested keys redacted without altering input or IDs', () => {
  const data = { id: '1993244721490239488', rows: [{ otpSecret: 'secret', Cookie: 'secret',
    username: 'private', androidId: 'private', apiKey: 'private', encryptKey: 'private' }] };
  const result = redactSensitive(data);
  assert.equal(result.id, data.id);
  assert.ok(Object.values(result.rows[0]).every((v) => v === '[REDACTED]'));
  assert.equal(data.rows[0].otpSecret, 'secret');
});
test('reject unsafe numeric IDs and remote/non-HTTP transport', async () => {
  assert.throws(() => parseRequiredInt('1993244721490239488', 'id'), /safe integer/);
  assert.throws(() => parseJsonInput('{"id":1993244721490239488}', 'data'), /large IDs as strings/);
  await assert.rejects(() => requestApi('/api/cloudphone/%72eset', { baseUrl }), /Invalid API path/);
  for (const base of ['https://127.0.0.1', 'http://example.com', 'http://user:pass@localhost']) {
    await assert.rejects(() => requestApi('/status', { baseUrl: base }), /loopback/);
  }
});
test('defaults allow asynchronous startup and long kernel wait', () => {
  assert.equal(timeoutFor('/api/cloudphone/powerOn'), 120000);
  assert.equal(timeoutFor('/api/env/start'), 30000);
  assert.ok(timeoutFor('/api/env/core/download') > 1805000);
});
test('force stop and generic monthly activation cannot bypass confirmation', () => {
  assert.throws(() => guard('/api/cloudbrowser/stop', { force: true }), /confirm-force-stop/);
  assert.throws(() => guard('/api/cloudphone/monthly/activate', { ids: ['123'] }), /confirm-charge/);
  assert.throws(() => guard('/api/cloudbrowser/stop', { force: 'ture' }), /Boolean/);
});
test('named queries redact by default and false is not raw-output', async () => {
  mode = 'success';
  for (const args of [['browser', 'list'], ['browser', 'detail', '--env-id', '123'], ['cloudphone', 'info', '--id', '123'], ['proxy', 'list']]) {
    for (const suffix of [[], ['--raw-output', 'false']]) {
      const result = await cli([...args, ...suffix]);
      assert.equal(result.code, 0, result.stderr);
      assert.ok(!/secret-fixture|otp-fixture|cookie-fixture|token-fixture/.test(result.stdout));
    }
  }
  const raw = await cli(['browser', 'detail', '--env-id', '123', '--raw-output']);
  assert.match(raw.stdout, /secret-fixture/);
});
test('int64 strings preserved in ADB updates, including payload mode', async () => {
  mode = 'success'; received = [];
  const id = '1993244721490239488';
  const result = await cli(['cloudphone', 'update-adb', '--id', id, '--enable', 'false', '--confirm-security', 'true']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(received.at(-1).body, { ids: [id], enableAdb: false });
});
test('destructive named commands are blocked before HTTP', async () => {
  mode = 'success'; received = [];
  for (const args of [
    ['browser', 'delete', '--env-ids', '123'], ['cloudphone', 'reset', '--id', '123'],
    ['cloudphone', 'stop', '--id', '123'], ['cloudstorage', 'delete', '--ids', '123'],
    ['cloudphone', 'app-uninstall', '--id', '123', '--package-name', 'com.example.app'],
  ]) {
    const result = await cli(args); assert.equal(result.code, 1); assert.match(result.stderr, /confirm-/);
  }
  assert.equal(received.length, 0);
});
test('malformed JSON, missing code and string codes fail CLI', async () => {
  for (const failure of ['invalid', 'missing-code', 'string-code']) {
    mode = failure;
    const result = await cli(['account', 'balance']);
    assert.equal(result.code, 1);
  }
  mode = 'success';
});
test('timeout produces unknown-outcome message and never retries automatically', async () => {
  mode = 'timeout'; received = [];
  const result = await cli(['cloudphone', 'start', '--id', '123', '--timeout-ms', '50']);
  assert.equal(result.code, 1); assert.match(result.stderr, /outcome unknown/);
  assert.equal(received.length, 1);
  mode = 'success';
});
test('empty label replacement is supported', async () => {
  mode = 'success'; received = [];
  const result = await cli(['cloudstorage', 'set-tags', '--payload', '{"fileId":"123","tagIds":[]}']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(received.at(-1).body.tagIds, []);
});
