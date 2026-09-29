const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
let server, baseUrl, mode, calls = [], state;
const id = '1993244721490239488';
before(async () => {
  server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
    calls.push({ path: req.url, body });
    let data;
    if (req.url === '/api/cloudphone/page') {
      data = { current: String(body.pageNo), pages: '2', total: '2', dataList: body.pageNo === 1 || mode === 'repeat'
        ? [{ id: '123' }] : [{ id, supportAdb: true, enableAdb: true, adbInfo: { adbPassword: 'PRIVATE', adbPort: '5555' } }] };
    } else if (req.url === '/api/cloudphone/info') data = { id, envStatus: state, device: { osVersion: '13' } };
    res.end(JSON.stringify({ code: mode === 'business' ? 33301 : 0, msg: null, requestId: 'workflow', data }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
function cli(args) {
  return new Promise((resolve) => execFile(process.execPath, [path.join(__dirname, '../bin/morelogin.js'), ...args], {
    env: { ...process.env, MORELOGIN_LOCAL_API_URL: baseUrl }, timeout: 5000,
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
test('named cloudphone adb-info searches later pages and redacts credentials', async () => {
  mode = 'adb'; calls = [];
  const result = await cli(['cloudphone', 'adb-info', '--id', id]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).id, id);
  assert.equal(JSON.parse(result.stdout).adbInfo.adbPassword, '[REDACTED]');
  assert.deepEqual(calls.map((c) => [c.path, c.body.pageNo]), [['/api/cloudphone/page', 1], ['/api/cloudphone/page', 2], ['/api/cloudphone/info', undefined]]);
});
test('repeated pagination is an incomplete result, never a false not-found', async () => {
  mode = 'repeat'; calls = [];
  const result = await cli(['cloudphone', 'adb-info', '--id', id]);
  assert.equal(result.code, 1); assert.match(result.stderr, /result incomplete/); assert.equal(calls.length, 2);
});
test('async startup acceptance stays distinct from pending, ready and business failure', async () => {
  mode = 'async'; calls = [];
  const started = await cli(['cloudphone', 'start', '--id', id]);
  assert.equal(started.code, 0); assert.match(started.stdout, /accepted/);
  assert.doesNotMatch(started.stdout, /started successfully|completed/i);
  state = 1;
  const pending = await cli(['cloudphone', 'info', '--id', id]);
  assert.equal(JSON.parse(pending.stdout).envStatus, 1);
  state = 4;
  const ready = await cli(['cloudphone', 'info', '--id', id]);
  assert.equal(JSON.parse(ready.stdout).envStatus, 4);
  mode = 'business';
  const failed = await cli(['cloudphone', 'info', '--id', id]);
  assert.equal(failed.code, 1); assert.match(failed.stderr, /33301/);
  assert.equal(calls.filter((c) => c.path.endsWith('/powerOn')).length, 1);
  assert.ok(calls.every((c) => ['/api/cloudphone/powerOn', '/api/cloudphone/info'].includes(c.path)));
});
