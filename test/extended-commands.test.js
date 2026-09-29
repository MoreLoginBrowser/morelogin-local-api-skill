const assert = require('node:assert/strict');
const test = require('node:test');
const { operations } = require('./contract-fixtures');
const {
  createAccountHandler,
  createCloudBrowserHandler,
  createCloudStorageHandler,
  createExtendedBrowserHandler,
  createExtendedCloudPhoneHandler,
  createWebhookHandler,
} = require('../bin/extended-commands');

function harness() {
  const calls = [];
  const callApi = async (endpoint, options = {}) => {
    const operation = operations.find((op) => op.endpoint === endpoint);
    assert.ok(operation, `Undocumented route ${endpoint}`);
    assert.equal(options.method || 'POST', operation.method);
    if (operation.schema) assert.ok(operation.validate(options.body), `${endpoint}: ${JSON.stringify(operation.validate.errors)}`);
    calls.push({ endpoint, ...options });
    return { ok: true };
  };
  const fail = (message) => {
    throw new Error(message);
  };
  return { calls, callApi, fail };
}

test('new command families map to all newly documented endpoints', async (t) => {
  t.mock.method(console, 'log', () => {});
  const h = harness();
  const deps = { callApi: h.callApi, fail: h.fail };

  const cloudbrowser = createCloudBrowserHandler(deps);
  await cloudbrowser('start', { 'env-id': '101' });
  await cloudbrowser('stop', { 'env-id': '101', force: 'true' });
  await cloudbrowser('list', { page: '1', 'page-size': '10' });
  await cloudbrowser('connect', { 'env-id': '101' });

  await createAccountHandler(deps)('balance', {});
  await createWebhookHandler(deps)('config', {
    url: 'https://example.com/hook',
    enabled: 'true',
  });

  const storage = createCloudStorageHandler(deps);
  await storage('info', {});
  await storage('list', {});
  await storage('upload-init', { 'file-names': 'a.apk,b.mp4' });
  await storage('upload-complete', { id: '201' });
  await storage('delete', { ids: '201,202' });
  await storage('set-tags', { 'file-id': '201', 'tag-ids': '301,302' });
  await storage('add-tags', { 'file-id': '201', 'tag-ids': '301' });
  await storage('file-tags', { 'file-ids': '201,202' });
  await storage('tag-list', {});
  await storage('tag-create', { name: 'assets' });
  await storage('tag-edit', { id: '301', name: 'media' });
  await storage('tag-delete', { ids: '301' });

  const phone = createExtendedCloudPhoneHandler(deps);
  await phone('monthly-skus', {});
  await phone('monthly-activate', { ids: '401,402', 'confirm-charge': 'true' });
  await phone('live-start', { id: '401', 'file-id': '201' });
  await phone('live-status', { id: '401' });
  await phone('live-stop', { id: '401' });
  await phone('team-apps', {});
  await phone('app-root', { id: '401', 'package-names': 'com.example.app' });
  await phone('restart', { id: '401' });
  await phone('reset', { id: '401' });
  await phone('set-proxy', { payload: '{"ids":["401"],"proxy":{"proxyIp":"1.2.3.4","proxyPort":8080,"proxyProvider":0}}' });
  await phone('find-android', { 'android-id': 'android1' });
  await phone('root', { id: '401', enable: 'true' });
  await phone('screenshot', { id: '401' });
  await phone('screenshot-base64', { id: '401' });
  await phone('adb-batch', { ids: '401,402' });
  await phone('tap', { id: '401', pos: '10,20' });
  await phone('double-tap', { id: '401', pos: '10,20' });
  await phone('long-press', { id: '401', pos: '10,20', duration: '1000' });
  await phone('swipe', { id: '401', from: '10,20', to: '30,40' });
  await phone('drag', { id: '401', from: '10,20', to: '30,40' });

  const expected = [
    '/api/cloudbrowser/start', '/api/cloudbrowser/stop', '/api/cloudbrowser/page',
    '/api/cloudbrowser/connect', '/api/balance', '/api/webhook/config',
    '/api/cloudstorage/info', '/api/cloudstorage/file/page',
    '/api/cloudstorage/upload/init', '/api/cloudstorage/upload/complete',
    '/api/cloudstorage/file/delete/batch', '/api/cloudstorage/file/tag/set',
    '/api/cloudstorage/file/tag/add', '/api/cloudstorage/file/tag/query',
    '/api/cloudstorage/tag/all', '/api/cloudstorage/tag/create',
    '/api/cloudstorage/tag/edit', '/api/cloudstorage/tag/delete/batch',
    '/api/cloudphone/monthly/skus', '/api/cloudphone/monthly/activate',
    '/api/cloudphone/live/start', '/api/cloudphone/live/status',
    '/api/cloudphone/live/end', '/api/cloudphone/team/app/page',
    '/api/cloudphone/app/openRoot', '/api/cloudphone/restart',
    '/api/cloudphone/reset', '/api/cloudphone/setProxy',
    '/api/cloudphone/queryByAndroidId', '/api/cloudphone/enableRoot',
    '/api/cloudphone/screenCap', '/api/cloudphone/screenCapBase64',
    '/api/cloudphone/batchAdbInfo', '/api/cloudphone/touch/click',
    '/api/cloudphone/touch/doubleClick', '/api/cloudphone/touch/longClick',
    '/api/cloudphone/touch/swipe', '/api/cloudphone/touch/drag',
  ];
  assert.deepEqual(h.calls.map((call) => call.endpoint), expected);
});

test('paid activation requires an explicit confirmation flag', async () => {
  const h = harness();
  const phone = createExtendedCloudPhoneHandler({ callApi: h.callApi, fail: h.fail });
  await assert.rejects(() => phone('monthly-activate', { ids: '401' }), /confirm-charge/);
  assert.equal(h.calls.length, 0);
});

test('webhook callback URL must use HTTPS', async () => {
  const h = harness();
  const webhook = createWebhookHandler({ callApi: h.callApi, fail: h.fail });
  await assert.rejects(
    () => webhook('config', { url: 'http://localhost/hook', enabled: 'true' }),
    /must use HTTPS/
  );
  assert.equal(h.calls.length, 0);
});

test('browser kernel-download reaches the documented route', async (t) => {
  t.mock.method(console, 'log', () => {});
  const h = harness();
  const browser = createExtendedBrowserHandler({ callApi: h.callApi, fail: h.fail });
  await browser('kernel-download', { 'browser-type': '1', version: '146' });
  assert.deepEqual(h.calls, [{
    endpoint: '/api/env/core/download',
    body: { Cores: [{ BrowserType: 1, Version: '146' }] },
    timeoutMs: 1810000,
  }]);
});
