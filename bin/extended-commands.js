const {
  normalizeStringArray,
  parseJsonInput,
  parsePageOptions,
  parseRequiredInt,
  printObject,
  requireNonEmptyString,
  requirePlainObject,
  splitCsv,
  toBoolean,
} = require('./common');

function requireKeys(body, keys, label) {
  requirePlainObject(body, `${label} payload`);
  for (const key of keys) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      throw new Error(`${label} requires ${key}`);
    }
  }
  return body;
}

function payloadOr(options, label, fallback, required = []) {
  const body = parseJsonInput(options.payload, '--payload') || fallback;
  return requireKeys(body, required, label);
}

function stringIds(value, label) {
  const values = Array.isArray(value) ? value : splitCsv(value);
  return normalizeStringArray(values, label);
}

function point(value, label) {
  const values = Array.isArray(value) ? value : splitCsv(value);
  if (!Array.isArray(values) || values.length !== 2) {
    throw new Error(`${label} must contain exactly two integers: x,y`);
  }
  return values.map((item, index) => parseRequiredInt(item, `${label}[${index}]`));
}

function printResult(data, options) {
  printObject(data, { redact: !toBoolean(options['raw-output'], false) });
}

function createExtendedBrowserHandler({ callApi, fail }) {
  return async function handleExtendedBrowser(command, options) {
    if (command !== 'kernel-download') return false;
    try {
      const payload = parseJsonInput(options.payload, '--payload') || {
        Cores: [{
          BrowserType: parseRequiredInt(options['browser-type'], '--browser-type', { min: 1, max: 2 }),
          Version: requireNonEmptyString(options.version, '--version'),
        }],
      };
      requirePlainObject(payload, 'kernel-download payload');
      if (!Array.isArray(payload.Cores) || payload.Cores.length < 1 || payload.Cores.length > 20) {
        fail('kernel-download requires Cores with 1..20 items');
      }
      for (const core of payload.Cores) {
        requirePlainObject(core, 'core');
        core.BrowserType = parseRequiredInt(core.BrowserType, 'BrowserType', { min: 1, max: 2 });
        core.Version = requireNonEmptyString(core.Version, 'Version');
      }
      printObject(await callApi('/api/env/core/download', { body: payload, timeoutMs: 1810000 }));
      return true;
    } catch (error) {
      fail(error.message);
      return true;
    }
  };
}

function createCloudBrowserHandler({ callApi, fail }) {
  return async function handleCloudBrowser(command, options) {
    try {
      switch (command) {
        case 'start': {
          const body = payloadOr(options, 'cloudbrowser start', { envId: options['env-id'] }, ['envId']);
          printObject(await callApi('/api/cloudbrowser/start', { body }));
          return;
        }
        case 'stop': {
          const body = payloadOr(options, 'cloudbrowser stop', {
            envId: options['env-id'],
            force: toBoolean(options.force, false),
          }, ['envId']);
          printObject(await callApi('/api/cloudbrowser/stop', { body }));
          return;
        }
        case 'list': {
          const payload = parseJsonInput(options.payload, '--payload');
          const body = payload || {
            ...parsePageOptions(options),
            ...(options.keyword ? { keyword: String(options.keyword) } : {}),
            ...(options['env-id'] ? { envId: String(options['env-id']) } : {}),
          };
          printObject(await callApi('/api/cloudbrowser/page', { body }));
          return;
        }
        case 'connect': {
          const body = payloadOr(options, 'cloudbrowser connect', { envId: options['env-id'] }, ['envId']);
          printResult(await callApi('/api/cloudbrowser/connect', { body }), options, { sensitive: true });
          return;
        }
        case 'help':
          console.log(`
CloudBrowser subcommands:
  start --env-id <envId>
  stop --env-id <envId> [--force true]
  list --page 1 --page-size 20 [--keyword text]
  connect --env-id <envId> [--raw-output]
`);
          return;
        default:
          fail(`Unknown cloudbrowser command: ${command}`);
      }
    } catch (error) {
      fail(error.message);
    }
  };
}

function createAccountHandler({ callApi, fail }) {
  return async function handleAccount(command) {
    if (command === 'help') {
      console.log(`
Account subcommands:
  balance
`);
      return;
    }
    if (command !== 'balance') fail(`Unknown account command: ${command}`);
    printObject(await callApi('/api/balance', { method: 'GET' }));
  };
}

function createWebhookHandler({ callApi, fail }) {
  return async function handleWebhook(command, options) {
    if (command === 'help') {
      console.log(`
Webhook subcommands:
  config --url <https-url> --enabled true|false
`);
      return;
    }
    if (command !== 'config') fail(`Unknown webhook command: ${command}`);
    const body = payloadOr(options, 'webhook config', {
      callbackUrl: options.url,
      enabled: options.enabled === undefined ? undefined : toBoolean(options.enabled),
    }, ['callbackUrl', 'enabled']);
    requireNonEmptyString(body.callbackUrl, 'callbackUrl');
    let url;
    try { url = new URL(body.callbackUrl); } catch { fail('webhook callbackUrl must use HTTPS and a valid public URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      fail('webhook callbackUrl must use HTTPS');
    }
    body.enabled = toBoolean(body.enabled);
    printObject(await callApi('/api/webhook/config', { body }));
  };
}

function createCloudStorageHandler({ callApi, fail }) {
  return async function handleCloudStorage(command, options) {
    try {
      const payload = parseJsonInput(options.payload, '--payload');
      switch (command) {
        case 'info':
          printObject(await callApi('/api/cloudstorage/info', { method: 'GET' }));
          return;
        case 'list': {
          const body = payload || {
            ...parsePageOptions(options),
            ...(options.name ? { fileName: String(options.name) } : {}),
            ...(options['tag-ids'] ? { tagIds: stringIds(options['tag-ids'], 'tagIds') } : {}),
          };
          printObject(await callApi('/api/cloudstorage/file/page', { body }));
          return;
        }
        case 'upload-init': {
          const body = payload || { fileNames: stringIds(options['file-names'], 'fileNames') };
          requireKeys(body, ['fileNames'], 'cloudstorage upload-init');
          body.fileNames = stringIds(body.fileNames, 'fileNames');
          printResult(await callApi('/api/cloudstorage/upload/init', { body }), options, { sensitive: true });
          return;
        }
        case 'upload-complete': {
          const body = payloadOr(options, 'cloudstorage upload-complete', { id: options.id }, ['id']);
          printObject(await callApi('/api/cloudstorage/upload/complete', { body }));
          return;
        }
        case 'delete':
        case 'tag-delete': {
          const ids = payload?.ids || options.ids;
          const body = { ...(payload || {}), ids: stringIds(ids, 'ids') };
          const endpoint = command === 'delete'
            ? '/api/cloudstorage/file/delete/batch'
            : '/api/cloudstorage/tag/delete/batch';
          printObject(await callApi(endpoint, { body }));
          return;
        }
        case 'set-tags':
        case 'add-tags': {
          const body = payload || {
            fileId: options['file-id'],
            tagIds: stringIds(options['tag-ids'], 'tagIds'),
          };
          requireKeys(body, ['fileId', 'tagIds'], `cloudstorage ${command}`);
          body.tagIds = command === 'set-tags' && Array.isArray(body.tagIds) && body.tagIds.length === 0
            ? [] : stringIds(body.tagIds, 'tagIds');
          const endpoint = command === 'set-tags'
            ? '/api/cloudstorage/file/tag/set'
            : '/api/cloudstorage/file/tag/add';
          printObject(await callApi(endpoint, { body }));
          return;
        }
        case 'file-tags': {
          const body = payload || { fileIds: stringIds(options['file-ids'], 'fileIds') };
          requireKeys(body, ['fileIds'], 'cloudstorage file-tags');
          body.fileIds = stringIds(body.fileIds, 'fileIds');
          printObject(await callApi('/api/cloudstorage/file/tag/query', { body }));
          return;
        }
        case 'tag-list':
          printObject(await callApi('/api/cloudstorage/tag/all', { method: 'GET' }));
          return;
        case 'tag-create': {
          const body = payloadOr(options, 'cloudstorage tag-create', { tagName: options.name }, ['tagName']);
          printObject(await callApi('/api/cloudstorage/tag/create', { body }));
          return;
        }
        case 'tag-edit': {
          const body = payloadOr(options, 'cloudstorage tag-edit', { id: options.id, tagName: options.name }, ['id', 'tagName']);
          printObject(await callApi('/api/cloudstorage/tag/edit', { body }));
          return;
        }
        case 'help':
          console.log(`
CloudStorage subcommands:
  info | list [--name text] [--tag-ids id1,id2]
  upload-init --file-names a.apk,b.mp4 [--raw-output]
  upload-complete --id <fileId> | delete --ids id1,id2
  set-tags|add-tags --file-id <id> --tag-ids id1,id2
  file-tags --file-ids id1,id2
  tag-list | tag-create --name text | tag-edit --id <id> --name text | tag-delete --ids id1,id2
`);
          return;
        default:
          fail(`Unknown cloudstorage command: ${command}`);
      }
    } catch (error) {
      fail(error.message);
    }
  };
}

function createExtendedCloudPhoneHandler({ callApi, fail }) {
  return async function handleExtendedCloudPhone(command, options) {
    try {
      const payload = parseJsonInput(options.payload, '--payload');
      const idBody = (label) => payloadOr(options, label, { id: options.id }, ['id']);
      const simpleIdRoutes = {
        restart: '/api/cloudphone/restart',
        reset: '/api/cloudphone/reset',
        screenshot: '/api/cloudphone/screenCap',
        'screenshot-base64': '/api/cloudphone/screenCapBase64',
      };
      if (simpleIdRoutes[command]) {
        printResult(await callApi(simpleIdRoutes[command], { body: idBody(`cloudphone ${command}`) }), options, {
          sensitive: command.startsWith('screenshot'),
        });
        return true;
      }

      switch (command) {
        case 'monthly-skus':
          printObject(await callApi('/api/cloudphone/monthly/skus', { method: 'GET' }));
          return true;
        case 'monthly-activate': {
          if (!toBoolean(options['confirm-charge'], false)) {
            fail('monthly-activate charges the team wallet; pass --confirm-charge true');
          }
          const body = payload || { ids: stringIds(options.ids, 'ids') };
          requireKeys(body, ['ids'], 'cloudphone monthly-activate');
          body.ids = stringIds(body.ids, 'ids');
          printObject(await callApi('/api/cloudphone/monthly/activate', { body }));
          return true;
        }
        case 'live-start': {
          const body = payloadOr(options, 'cloudphone live-start', {
            phoneId: options.id || options['phone-id'],
            fileId: options['file-id'],
          }, ['phoneId', 'fileId']);
          printObject(await callApi('/api/cloudphone/live/start', { body }));
          return true;
        }
        case 'live-status':
        case 'live-stop': {
          const body = payloadOr(options, `cloudphone ${command}`, {
            phoneId: options.id || options['phone-id'],
          }, ['phoneId']);
          const endpoint = command === 'live-status'
            ? '/api/cloudphone/live/status'
            : '/api/cloudphone/live/end';
          printObject(await callApi(endpoint, { body }));
          return true;
        }
        case 'team-apps': {
          const body = payload || {
            ...parsePageOptions(options),
            ...(options.name ? { appName: String(options.name) } : {}),
          };
          printObject(await callApi('/api/cloudphone/team/app/page', { body }));
          return true;
        }
        case 'app-root': {
          const body = payload || {
            id: options.id,
            packageNames: stringIds(options['package-names'], 'packageNames'),
          };
          requireKeys(body, ['id', 'packageNames'], 'cloudphone app-root');
          body.packageNames = stringIds(body.packageNames, 'packageNames');
          printObject(await callApi('/api/cloudphone/app/openRoot', { body }));
          return true;
        }
        case 'set-proxy': {
          if (!payload) fail('cloudphone set-proxy requires --payload with ids/uniqueIds and proxy');
          printObject(await callApi('/api/cloudphone/setProxy', { body: payload }));
          return true;
        }
        case 'find-android': {
          const body = payloadOr(options, 'cloudphone find-android', { androidId: options['android-id'] }, ['androidId']);
          printResult(await callApi('/api/cloudphone/queryByAndroidId', { body }), options, { sensitive: true });
          return true;
        }
        case 'root': {
          if (options.enable === undefined && payload?.enableRoot === undefined) {
            fail('cloudphone root requires --enable true|false or --payload');
          }
          const body = payload || { id: options.id, enableRoot: toBoolean(options.enable) };
          requireKeys(body, ['id', 'enableRoot'], 'cloudphone root');
          body.enableRoot = toBoolean(body.enableRoot);
          printObject(await callApi('/api/cloudphone/enableRoot', { body }));
          return true;
        }
        case 'adb-batch': {
          const body = payload || { envIds: stringIds(options.ids, 'envIds') };
          requireKeys(body, ['envIds'], 'cloudphone adb-batch');
          body.envIds = stringIds(body.envIds, 'envIds');
          printResult(await callApi('/api/cloudphone/batchAdbInfo', { body }), options, { sensitive: true });
          return true;
        }
        case 'tap':
        case 'double-tap':
        case 'long-press': {
          const body = payload || {
            id: options.id,
            pos: point(options.pos, 'pos'),
            ...(options.duration !== undefined
              ? { duration: parseRequiredInt(options.duration, 'duration', { min: 0, max: 60000 }) }
              : {}),
          };
          requireKeys(body, ['id', 'pos'], `cloudphone ${command}`);
          body.pos = point(body.pos, 'pos');
          const route = {
            tap: '/api/cloudphone/touch/click',
            'double-tap': '/api/cloudphone/touch/doubleClick',
            'long-press': '/api/cloudphone/touch/longClick',
          }[command];
          printObject(await callApi(route, { body }));
          return true;
        }
        case 'swipe':
        case 'drag': {
          const body = payload || {
            id: options.id,
            pos1: point(options.from, 'from'),
            pos2: point(options.to, 'to'),
            ...(options.duration !== undefined
              ? { duration: parseRequiredInt(options.duration, 'duration', { min: 0, max: 60000 }) }
              : {}),
          };
          requireKeys(body, ['id', 'pos1', 'pos2'], `cloudphone ${command}`);
          body.pos1 = point(body.pos1, 'pos1');
          body.pos2 = point(body.pos2, 'pos2');
          const route = command === 'swipe'
            ? '/api/cloudphone/touch/swipe'
            : '/api/cloudphone/touch/drag';
          printObject(await callApi(route, { body }));
          return true;
        }
        default:
          return false;
      }
    } catch (error) {
      fail(error.message);
      return true;
    }
  };
}

module.exports = {
  createAccountHandler,
  createCloudBrowserHandler,
  createCloudStorageHandler,
  createExtendedBrowserHandler,
  createExtendedCloudPhoneHandler,
  createWebhookHandler,
};
