const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { operations } = require('./contract-fixtures');
const confirmations = require('./expected-confirmations');
const { commands } = require('../bin/options');
const id = '1993244721490239488';
const paging = { pageNo: 1, pageSize: 20 };
const cases = [];
const add = (scope, command, args, route, body, method = 'POST') => cases.push({ scope, command, args, route, body, method });
const payload = (body) => ['--payload', JSON.stringify(body)];
add('browser', 'list', [], '/api/env/page', { ...paging, envName: '' });
for (const [cmd, route] of Object.entries({ start: 'start', close: 'close', status: 'status', detail: 'detail', 'refresh-fingerprint': 'fingerprint/refresh' }))
  add('browser', cmd, ['--env-id', id], `/api/env/${route}`, { envId: id });
add('browser', 'create-quick', [], '/api/env/create/quick', { browserTypeId: 1, operatorSystemId: 1, quantity: 1 });
add('browser', 'clear-cache', ['--env-id', id, '--cookie', 'true'], '/api/env/removeLocalCache', { envId: id, localStorage: false, indexedDB: false, cookie: true, extension: false, extensionFile: false });
add('browser', 'clean-cloud-cache', ['--env-id', id, '--cookie', 'true'], '/api/env/cache/cleanCloud', { envId: id, cookie: true, others: false });
add('browser', 'delete', ['--env-ids', id], '/api/env/removeToRecycleBin/batch', { envIds: [id] });
add('browser', 'kernel-download', ['--browser-type', '1', '--version', '146'], '/api/env/core/download', { Cores: [{ BrowserType: 1, Version: '146' }] });
for (const cmd of ['start', 'connect']) add('cloudbrowser', cmd, ['--env-id', id], `/api/cloudbrowser/${cmd}`, { envId: id });
add('cloudbrowser', 'stop', ['--env-id', id], '/api/cloudbrowser/stop', { envId: id, force: false });
add('cloudbrowser', 'list', [], '/api/cloudbrowser/page', paging);
add('cloudphone', 'list', [], '/api/cloudphone/page', paging);
add('cloudphone', 'create', payload({ skuId: id, quantity: 1 }), '/api/cloudphone/create', { skuId: id, quantity: 1 });
add('cloudphone', 'start', ['--id', id, '--headless', 'false', '--disable-money-saving-mode', 'false'], '/api/cloudphone/powerOn', { id, headless: false, disableMoneySavingMode: false });
for (const [cmd, route] of Object.entries({ stop: 'powerOff', info: 'info', 'new-machine': 'newMachine', 'app-installed': 'app/installedList', restart: 'restart', reset: 'reset', screenshot: 'screenCap', 'screenshot-base64': 'screenCapBase64' }))
  add('cloudphone', cmd, ['--id', id], `/api/cloudphone/${route}`, { id });
add('cloudphone', 'update-adb', ['--id', id, '--enable', 'false'], '/api/cloudphone/updateAdb', { ids: [id], enableAdb: false });
for (const cmd of ['start', 'stop', 'restart', 'uninstall']) add('cloudphone', `app-${cmd}`, ['--id', id, '--package-name', 'com.example.app'], `/api/cloudphone/app/${cmd}`, { id, packageName: 'com.example.app' });
add('cloudphone', 'monthly-skus', [], '/api/cloudphone/monthly/skus', undefined, 'GET');
add('cloudphone', 'monthly-activate', ['--ids', id], '/api/cloudphone/monthly/activate', { ids: [id] });
add('cloudphone', 'live-start', ['--id', id, '--file-id', '123'], '/api/cloudphone/live/start', { phoneId: id, fileId: '123' });
for (const [cmd, route] of [['live-status', 'status'], ['live-stop', 'end']]) add('cloudphone', cmd, ['--id', id], `/api/cloudphone/live/${route}`, { phoneId: id });
add('cloudphone', 'team-apps', [], '/api/cloudphone/team/app/page', paging);
add('cloudphone', 'app-root', ['--id', id, '--package-names', 'com.example.app'], '/api/cloudphone/app/openRoot', { id, packageNames: ['com.example.app'] });
const proxy = { ids: [id], proxy: { proxyIp: '127.0.0.1', proxyPort: 8080, proxyProvider: 0 } };
add('cloudphone', 'set-proxy', payload(proxy), '/api/cloudphone/setProxy', proxy);
add('cloudphone', 'find-android', ['--android-id', 'test-android'], '/api/cloudphone/queryByAndroidId', { androidId: 'test-android' });
add('cloudphone', 'root', ['--id', id, '--enable', 'false'], '/api/cloudphone/enableRoot', { id, enableRoot: false });
add('cloudphone', 'adb-batch', ['--ids', id], '/api/cloudphone/batchAdbInfo', { envIds: [id] });
for (const [cmd, route] of [['tap', 'click'], ['double-tap', 'doubleClick'], ['long-press', 'longClick']]) add('cloudphone', cmd, ['--id', id, '--pos', '10,20'], `/api/cloudphone/touch/${route}`, { id, pos: [10, 20] });
for (const cmd of ['swipe', 'drag']) add('cloudphone', cmd, ['--id', id, '--from', '10,20', '--to', '30,40'], `/api/cloudphone/touch/${cmd}`, { id, pos1: [10, 20], pos2: [30, 40] });
add('cloudstorage', 'info', [], '/api/cloudstorage/info', undefined, 'GET');
add('cloudstorage', 'list', [], '/api/cloudstorage/file/page', paging);
add('cloudstorage', 'upload-init', ['--file-names', '测试.apk'], '/api/cloudstorage/upload/init', { fileNames: ['测试.apk'] });
add('cloudstorage', 'upload-complete', ['--id', id], '/api/cloudstorage/upload/complete', { id });
add('cloudstorage', 'delete', ['--ids', id], '/api/cloudstorage/file/delete/batch', { ids: [id] });
for (const cmd of ['set', 'add']) add('cloudstorage', `${cmd}-tags`, ['--file-id', id, '--tag-ids', '123'], `/api/cloudstorage/file/tag/${cmd}`, { fileId: id, tagIds: ['123'] });
add('cloudstorage', 'file-tags', ['--file-ids', id], '/api/cloudstorage/file/tag/query', { fileIds: [id] });
add('cloudstorage', 'tag-list', [], '/api/cloudstorage/tag/all', undefined, 'GET');
add('cloudstorage', 'tag-create', ['--name', '测试'], '/api/cloudstorage/tag/create', { tagName: '测试' });
add('cloudstorage', 'tag-edit', ['--id', id, '--name', '测试'], '/api/cloudstorage/tag/edit', { id, tagName: '测试' });
add('cloudstorage', 'tag-delete', ['--ids', id], '/api/cloudstorage/tag/delete/batch', { ids: [id] });
add('account', 'balance', [], '/api/balance', undefined, 'GET');
add('webhook', 'config', ['--url', 'https://example.com/hook', '--enabled', 'false'], '/api/webhook/config', { callbackUrl: 'https://example.com/hook', enabled: false });
add('proxy', 'list', [], '/api/proxyInfo/page', paging);
for (const cmd of ['add', 'update']) {
  const body = { ...(cmd === 'update' ? { id } : {}), proxyIp: '127.0.0.1', proxyPort: '8080', proxyProvider: '0' };
  add('proxy', cmd, payload(body), `/api/proxyInfo/${cmd}`, { ...body, proxyPort: 8080, proxyProvider: 0 });
}
add('proxy', 'delete', ['--ids', id], '/api/proxyInfo/delete', [Number(id)]);
for (const [scope, prefix, key] of [['group', 'envgroup', 'groupName'], ['tag', 'envtag', 'tagName']]) {
  add(scope, 'list', [], `/api/${prefix}/${scope === 'tag' ? 'all' : 'page'}`, scope === 'tag' ? undefined : { ...paging, groupName: '' }, scope === 'tag' ? 'GET' : 'POST');
  add(scope, 'create', ['--name', '测试'], `/api/${prefix}/create`, { [key]: '测试' });
  add(scope, 'edit', ['--id', id, '--name', '测试'], `/api/${prefix}/edit`, { id, [key]: '测试' });
  add(scope, 'delete', ['--ids', id], `/api/${prefix}/delete`, { ids: [id] });
}
let server, baseUrl, calls = [], rawBody;
before(async () => {
  server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    rawBody = Buffer.concat(chunks).toString('utf8');
    calls.push({ route: req.url, method: req.method, body: chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined });
    res.end(JSON.stringify({ code: 0, msg: null, requestId: 'named-fixture', data: { id, envName: '中文😀', password: 'do-not-print' } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise((resolve) => server.close(resolve)); });
function cli(args) {
  return new Promise((resolve) => execFile(process.execPath, [path.join(__dirname, '../bin/morelogin.js'), ...args], {
    env: { ...process.env, MORELOGIN_LOCAL_API_URL: baseUrl }, timeout: 5000,
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
for (const c of cases) test(`named ${c.scope} ${c.command}: HTTP mapping and request contract`, async () => {
  calls = [];
  const args = [c.scope, c.command, ...c.args];
  if (confirmations[c.route]) args.push(`--${confirmations[c.route]}`, 'true');
  const result = await cli(args);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(calls, [{ route: c.route, method: c.method, body: c.body }]);
  if (c.scope === 'proxy' && c.command === 'delete') assert.equal(rawBody, `[${id}]`, 'int64 decimal digits must be unchanged on the wire');
  const operation = operations.find((op) => op.route === c.route && op.method === c.method);
  assert.ok(operation.validate(c.body), JSON.stringify(operation.validate.errors));
  assert.ok(!result.stdout.includes('do-not-print'));
});
test('every named command has an HTTP mapping case or explicit multi-request scenario', () => {
  for (const [scope, group] of Object.entries(commands)) for (const command of Object.keys(group)) {
    if (scope === 'cloudphone' && command === 'adb-info') continue; // paginated scenario in workflow tests
    assert.ok(cases.some((c) => c.scope === scope && c.command === command), `${scope} ${command}`);
  }
});
test('invalid browser identity and pagination never reach HTTP', async () => {
  calls = [];
  for (const args of [['browser', 'status', '--payload', '{"uniqueId":123}'], ['browser', 'detail', '--unique-id', '123'],
    ['browser', 'list', '--page-size', '101'], ['browser', 'list', '--payload', '{"pageSize":101}'],
    ['cloudphone', 'start', '--id', id, '--headless', 'flase']]) assert.equal((await cli(args)).code, 1);
  assert.equal(calls.length, 0);
});
