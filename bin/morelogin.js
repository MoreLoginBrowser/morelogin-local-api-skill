#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  DEFAULT_BASE_URL,
  parseArgs,
  parseJsonInput,
  printObject,
  requestApi,
  splitCsv,
  toBoolean,
  toInt,
  unwrapApiResult,
} = require('./common');


function fail(message, code = 1) {
  console.error(`❌ ${message}`);
  process.exit(code);
}

async function callApi(endpoint, { method = 'POST', body } = {}) {
  const response = await requestApi(endpoint, { method, body });
  const result = unwrapApiResult(response);
  if (!result.success) {
    throw new Error(result.message || 'API request failed');
  }
  return result.data;
}

function ensureProfileIdentity(options) {
  if (options['env-id']) return { envId: options['env-id'] };
  if (options['unique-id']) return { uniqueId: toInt(options['unique-id']) };
  fail('Please provide --env-id or --unique-id');
  return null;
}

function showHelp() {
  console.log(`
🌐 MoreLogin CLI (Official Local API)
Base URL: ${DEFAULT_BASE_URL}

Usage:
  morelogin browser <command> [options]
  morelogin cloudphone <command> [options]
  morelogin proxy <command> [options]
  morelogin group <command> [options]
  morelogin tag <command> [options]
  morelogin api --endpoint <path> [--method POST] [--data '{"k":"v"}']

Browser:
  list                    List profiles (/api/env/page)
  start                   Start profile (/api/env/start)
  close                   Close profile (/api/env/close)
  status                  Query run status (/api/env/status)
  detail                  Query details (/api/env/detail)
  create-quick            Quick create (/api/env/create/quick)
  refresh-fingerprint     Refresh fingerprint (/api/env/fingerprint/refresh)
  clear-cache             Clear local cache (/api/env/removeLocalCache)
  clean-cloud-cache       Clean cloud cache (/api/env/cache/cleanCloud)
  delete                  Batch delete to recycle bin (/api/env/removeToRecycleBin/batch)

CloudPhone:
  list                    List (/api/cloudphone/page)
  create                  Create (/api/cloudphone/create)
  start                   Power on (/api/cloudphone/powerOn)
  stop                    Power off (/api/cloudphone/powerOff)
  info                    Details (/api/cloudphone/info)
  adb-info                Get ADB params (device model)
  adb-connect             Auto-connect ADB by device model
  adb-disconnect          Disconnect ADB and clean tunnel
  adb-devices             List local adb devices
  exec                    Execute command (/api/cloudphone/exeCommand)
  update-adb              Update ADB status (/api/cloudphone/updateAdb)
  new-machine             New machine one-click (/api/cloudphone/newMachine)
  app-installed           Installed apps list (/api/cloudphone/app/installedList)
  app-start|app-stop|app-restart|app-uninstall


Proxy:
  list                    Query proxy list (/api/proxyInfo/page)
  add                     Add proxy (/api/proxyInfo/add)
  update                  Update proxy (/api/proxyInfo/update)
  delete                  Delete proxy (/api/proxyInfo/delete)

Group:
  list                    Query groups (/api/envgroup/page)
  create                  Create group (/api/envgroup/create)
  edit                    Edit group (/api/envgroup/edit)
  delete                  Delete group (/api/envgroup/delete)

Tag:
  list                    Query tags (/api/envtag/all, GET)
  create                  Create tag (/api/envtag/create)
  edit                    Edit tag (/api/envtag/edit)
  delete                  Delete tag (/api/envtag/delete)

Legacy commands (backward compatible):
  morelogin list/start/stop/info/connect
  Equivalent to browser subcommands.
`);
}

function showConnectTips(data) {
  const debugPort = data?.debugPort || data?.port;
  if (!debugPort) return;
  const browserUrl = `http://127.0.0.1:${debugPort}`;
  console.log(`\nCDP address: ${browserUrl}`);
  console.log(`Puppeteer: puppeteer.connect({ browserURL: "${browserUrl}" })`);
  console.log(`Playwright: chromium.connectOverCDP("${browserUrl}")`);
}

function runAdb(args, allowFailure = false) {
  const result = spawnSync('adb', args, { encoding: 'utf8' });
  if (result.error) {
    if (allowFailure) return result;
    throw result.error;
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error((result.stderr || result.stdout || 'adb command failed').trim());
  }
  return result;
}

function validateCloudPhoneCreatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('payload must be an object');
  if (!body?.skuId) errors.push('skuId is required');
  if (body?.quantity === undefined || body?.quantity === null) {
    errors.push('quantity is required');
  } else if (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) < 1 || Number(body.quantity) > 10) {
    errors.push('quantity must be an integer between 1 and 10');
  }
  if (errors.length > 0) {
    fail(`cloudphone create validation failed: ${errors.join('; ')}`);
  }
}

function validateProxyAddPayload(body) {
  const errors = [];
  if (!body?.proxyIp) errors.push('proxyIp is required');
  if (body?.proxyPort === undefined || body?.proxyPort === null) errors.push('proxyPort is required');
  if (body?.proxyProvider === undefined || body?.proxyProvider === null) errors.push('proxyProvider is required');
  if (errors.length > 0) {
    fail(`proxy add validation failed: ${errors.join('; ')}`);
  }
}

function validateProxyUpdatePayload(body) {
  const errors = [];
  if (body?.id === undefined || body?.id === null) errors.push('id is required');
  if (!body?.proxyIp) errors.push('proxyIp is required');
  if (body?.proxyPort === undefined || body?.proxyPort === null) errors.push('proxyPort is required');
  if (body?.proxyProvider === undefined || body?.proxyProvider === null) errors.push('proxyProvider is required');
  if (errors.length > 0) {
    fail(`proxy update validation failed: ${errors.join('; ')}`);
  }
}

function validateGroupCreatePayload(body) {
  if (!body?.groupName || !String(body.groupName).trim()) {
    fail('group create validation failed: groupName is required');
  }
}

function validateTagCreatePayload(body) {
  if (!body?.tagName || !String(body.tagName).trim()) {
    fail('tag create validation failed: tagName is required');
  }
}



function toCloudPhoneNumericId(idValue) {
  const n = Number(idValue);
  return Number.isNaN(n) ? idValue : n;
}

async function findCloudPhoneById(id) {
  const targetId = String(id);
  const first = await callApi('/api/cloudphone/page', {
    body: { keyword: targetId, pageNo: 1, pageSize: 20 },
  });
  const fromFirst = (first.dataList || []).find((item) => String(item.id) === targetId);
  if (fromFirst) return fromFirst;

  const fallback = await callApi('/api/cloudphone/page', { body: { pageNo: 1, pageSize: 100 } });
  const fromFallback = (fallback.dataList || []).find((item) => String(item.id) === targetId);
  if (!fromFallback) {
    throw new Error(`Cloud phone not found: ${targetId}`);
  }
  return fromFallback;
}

async function getCloudPhoneInfoById(id) {
  return callApi('/api/cloudphone/info', {
    body: { id: toCloudPhoneNumericId(id) },
  });
}

function normalizeAdbInfo(phone) {
  const adbInfo = phone?.adbInfo || {};
  return {
    supportAdb: Boolean(phone?.supportAdb),
    enableAdb: Boolean(phone?.enableAdb),
    osVersion: phone?.osVersion || phone?.device?.osVersion || '',
    adbIp: String(adbInfo.adbIp || '').trim(),
    adbPort: String(adbInfo.adbPort || '').trim(),
    adbPassword: String(adbInfo.adbPassword || ''),
    sshCommand: String(adbInfo.command || '').trim(),
  };
}

function establishTunnelWithExpect(sshCommand, sshPassword) {
  const script = `
set timeout 45
set cmd $env(ML_SSH_CMD)
set pwd $env(ML_SSH_PWD)
spawn sh -c $cmd
expect {
  -re "yes/no" { send "yes\\r"; exp_continue }
  -re "\\\\[Pp\\\\]assword:" { send "$pwd\\r"; exp_continue }
  eof {}
  timeout { exit 1 }
}
`;
  const result = spawnSync('expect', ['-c', script], {
    env: { ...process.env, ML_SSH_CMD: sshCommand, ML_SSH_PWD: sshPassword || '' },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'SSH tunnel failed').trim());
  }
}

async function connectCloudPhoneAdb(id, options) {
  const cloudphoneId = toCloudPhoneNumericId(id);
  const enableAdb = toBoolean(options.enable, true);

  if (enableAdb) {
    await callApi('/api/cloudphone/updateAdb', {
      body: {
        ids: [cloudphoneId],
        enableAdb: true,
      },
    });
  }

  const waitSeconds = toInt(options['wait-seconds'], 0);
  if (waitSeconds > 0) {
    runAdb(['start-server'], true);
    spawnSync('sleep', [String(waitSeconds)], { encoding: 'utf8' });
  }

  const phone = await findCloudPhoneById(cloudphoneId);
  const info = await getCloudPhoneInfoById(cloudphoneId);
  const adb = normalizeAdbInfo(phone);
  if (!adb.supportAdb) {
    throw new Error('This cloud phone does not support ADB');
  }
  if (!adb.enableAdb) {
    throw new Error('ADB is not enabled. Please retry later or check power-on status');
  }
  if (!adb.adbPort) {
    throw new Error('ADB port info not obtained');
  }

  let address = '';
  let method = '';
  if (adb.sshCommand) {
    method = 'android13-14-15a-ssh-tunnel';
    establishTunnelWithExpect(adb.sshCommand, adb.adbPassword);
    address = `localhost:${adb.adbPort}`;
  } else {
    method = 'android12-15-direct';
    if (!adb.adbIp) throw new Error('ADB IP info not obtained');
    address = `${adb.adbIp}:${adb.adbPort}`;
  }

  const connectResult = runAdb(['connect', address], true);
  const connectText = `${connectResult.stdout || ''}${connectResult.stderr || ''}`;
  if (
    connectResult.status !== 0 &&
    !connectText.includes('connected to') &&
    !connectText.includes('already connected')
  ) {
    throw new Error(connectText.trim() || 'adb connect failed');
  }

  const devices = runAdb(['devices'], true);
  const devicesText = devices.stdout || '';
  const hasConnectedDevice = devicesText
    .split('\n')
    .some((line) => line.trim().startsWith(address));
  if (!hasConnectedDevice) {
    throw new Error(`adb connect did not establish device session: ${address}`);
  }
  return {
    id: String(cloudphoneId),
    method,
    address,
    osVersion: adb.osVersion || info?.device?.osVersion || '',
    sshCommand: adb.sshCommand || null,
    devices: devicesText.trim(),
  };
}

async function disconnectCloudPhoneAdb(id, options) {
  const cloudphoneId = toCloudPhoneNumericId(id);
  const phone = await findCloudPhoneById(cloudphoneId);
  const adb = normalizeAdbInfo(phone);
  const address = options.address
    ? String(options.address).trim()
    : adb.sshCommand
      ? `localhost:${adb.adbPort}`
      : `${adb.adbIp}:${adb.adbPort}`;

  const disconnect = runAdb(['disconnect', address], true);
  if (adb.sshCommand) {
    // Try to close tunnel process for this exact command.
    spawnSync('pkill', ['-f', adb.sshCommand], { encoding: 'utf8' });
  }
  return {
    id: String(cloudphoneId),
    address,
    output: `${disconnect.stdout || ''}${disconnect.stderr || ''}`.trim(),
  };
}

function buildLocalCachePayload(options) {
  const body = ensureProfileIdentity(options);
  const localStorage = toBoolean(options['local-storage'], false);
  const indexedDB = toBoolean(options['indexed-db'], false);
  const cookie = toBoolean(options.cookie, false);
  const extension = toBoolean(options.extension, false);
  const extensionFile = toBoolean(options['extension-file'], false);
  const hasAny = localStorage || indexedDB || cookie || extension || extensionFile;
  if (!hasAny) {
    fail(
      'clear-cache requires at least one cache flag, e.g. --cookie true or --local-storage true'
    );
  }
  return { ...body, localStorage, indexedDB, cookie, extension, extensionFile };
}

function buildCloudCachePayload(options) {
  const body = ensureProfileIdentity(options);
  const hasCookie = options.cookie !== undefined;
  const hasOthers = options.others !== undefined;
  if (!hasCookie && !hasOthers) {
    fail('clean-cloud-cache requires at least one flag: --cookie or --others');
  }
  return {
    ...body,
    cookie: toBoolean(options.cookie, false),
    others: toBoolean(options.others, false),
  };
}

async function handleBrowser(command, options) {
  switch (command) {
    case 'list': {
      const payload =
        parseJsonInput(options.payload, '--payload') || {
          pageNo: toInt(options.page, 1),
          pageSize: toInt(options['page-size'], 20),
          envName: options.name || '',
        };
      const data = await callApi('/api/env/page', { body: payload });
      printObject(data);
      return;
    }
    case 'start': {
      const payload = parseJsonInput(options.payload, '--payload') || ensureProfileIdentity(options);
      const data = await callApi('/api/env/start', { body: payload });
      console.log('✅ Profile started');
      printObject(data);
      showConnectTips(data);
      return;
    }
    case 'close': {
      const payload = parseJsonInput(options.payload, '--payload') || ensureProfileIdentity(options);
      const data = await callApi('/api/env/close', { body: payload });
      console.log('✅ Profile closed');
      printObject(data);
      return;
    }
    case 'status': {
      const payload = parseJsonInput(options.payload, '--payload') || ensureProfileIdentity(options);
      const data = await callApi('/api/env/status', { body: payload });
      printObject(data);
      showConnectTips(data);
      return;
    }
    case 'detail': {
      const payload = parseJsonInput(options.payload, '--payload');
      const body = payload || (options['env-id'] ? { envId: options['env-id'] } : null);
      if (!body) fail('detail requires --env-id or --payload');
      const data = await callApi('/api/env/detail', { body });
      printObject(data);
      return;
    }
    case 'create-quick': {
      const payload =
        parseJsonInput(options.payload, '--payload') || {
          browserTypeId: toInt(options['browser-type-id'], 1),
          operatorSystemId: toInt(options['operator-system-id'], 1),
          quantity: toInt(options.quantity, 1),
        };
      const data = await callApi('/api/env/create/quick', { body: payload });
      console.log('✅ Profile created successfully');
      printObject(data);
      return;
    }
    case 'refresh-fingerprint': {
      const payload = parseJsonInput(options.payload, '--payload') || ensureProfileIdentity(options);
      const data = await callApi('/api/env/fingerprint/refresh', { body: payload });
      console.log('✅ Fingerprint refresh completed');
      printObject(data);
      return;
    }
    case 'clear-cache': {
      const payload = parseJsonInput(options.payload, '--payload') || buildLocalCachePayload(options);
      const data = await callApi('/api/env/removeLocalCache', { body: payload });
      console.log('✅ Cache cleared');
      printObject(data);
      return;
    }
    case 'clean-cloud-cache': {
      const payload = parseJsonInput(options.payload, '--payload') || buildCloudCachePayload(options);
      const data = await callApi('/api/env/cache/cleanCloud', { body: payload });
      console.log('✅ Cloud cache cleared');
      printObject(data);
      return;
    }
    case 'delete': {
      const payload =
        parseJsonInput(options.payload, '--payload') || {
          envIds: splitCsv(options['env-ids']),
        };
      if (!payload.envIds || payload.envIds.length === 0) {
        fail('delete requires --env-ids "<id1,id2>" or --payload');
      }
      const data = await callApi('/api/env/removeToRecycleBin/batch', { body: payload });
      console.log('✅ Delete request submitted');
      printObject(data);
      return;
    }
    default:
      fail(`Unknown browser command: ${command}`);
  }
}

async function handleCloudPhone(command, options) {
  const payload = parseJsonInput(options.payload, '--payload');

  switch (command) {
    case 'help':
      console.log(`
CloudPhone subcommands:
  list --page 1 --page-size 20
  create --payload '{"skuId":"10002", ...}'
  start --id <cloudPhoneId>
  stop --id <cloudPhoneId>
  info --id <cloudPhoneId>
  adb-info --id <cloudPhoneId>
  adb-connect --id <cloudPhoneId> [--wait-seconds 90]
  adb-disconnect --id <cloudPhoneId> [--address host:port]
  adb-devices
  exec --id <cloudPhoneId> --command "ls /sdcard"
  update-adb --id <cloudPhoneId> --enable true
  new-machine --id <cloudPhoneId>
  app-installed --id <cloudPhoneId>
  app-start --id <cloudPhoneId> --package-name com.example.app
  app-stop --id <cloudPhoneId> --package-name com.example.app
  app-restart --id <cloudPhoneId> --package-name com.example.app
  app-uninstall --id <cloudPhoneId> --package-name com.example.app
`);
      return;
    case 'list': {
      const body = payload || { pageNo: toInt(options.page, 1), pageSize: toInt(options['page-size'], 20) };
      const data = await callApi('/api/cloudphone/page', { body });
      printObject(data);
      return;
    }
    case 'create': {
      if (!payload) fail('create: use --payload to pass full parameters');
      validateCloudPhoneCreatePayload(payload);
      const data = await callApi('/api/cloudphone/create', { body: payload });
      console.log('✅ Cloud phone created successfully');
      printObject(data);
      return;
    }
    case 'start': {
      const body = payload || { id: options.id };
      if (!body.id) fail('start requires --id or --payload');
      const data = await callApi('/api/cloudphone/powerOn', { body });
      console.log('✅ Cloud phone started');
      printObject(data);
      return;
    }
    case 'stop': {
      const body = payload || { id: options.id };
      if (!body.id) fail('stop requires --id or --payload');
      const data = await callApi('/api/cloudphone/powerOff', { body });
      console.log('✅ Cloud phone stopped');
      printObject(data);
      return;
    }
    case 'info': {
      const body = payload || { id: options.id };
      if (!body.id) fail('info requires --id or --payload');
      const data = await callApi('/api/cloudphone/info', { body });
      printObject(data);
      return;
    }
    case 'adb-info': {
      const cloudphoneId = payload?.id || options.id;
      if (!cloudphoneId) fail('adb-info requires --id or --payload');
      const phone = await findCloudPhoneById(cloudphoneId);
      const info = await getCloudPhoneInfoById(cloudphoneId);
      printObject({
        id: String(phone.id),
        osVersion: info?.device?.osVersion || phone.osVersion || '',
        supportAdb: phone.supportAdb,
        enableAdb: phone.enableAdb,
        adbInfo: phone.adbInfo || null,
      });
      return;
    }
    case 'adb-connect': {
      const cloudphoneId = payload?.id || options.id;
      if (!cloudphoneId) fail('adb-connect requires --id or --payload');
      const data = await connectCloudPhoneAdb(cloudphoneId, options);
      console.log('✅ ADB connected');
      printObject(data);
      return;
    }
    case 'adb-disconnect': {
      const cloudphoneId = payload?.id || options.id;
      if (!cloudphoneId) fail('adb-disconnect requires --id or --payload');
      const data = await disconnectCloudPhoneAdb(cloudphoneId, options);
      console.log('✅ ADB disconnected');
      printObject(data);
      return;
    }
    case 'adb-devices': {
      const devices = runAdb(['devices'], true);
      console.log((devices.stdout || devices.stderr || '').trim());
      return;
    }
    case 'exec': {
      const body = payload || { id: options.id, command: options.command };
      if (!body.id || !body.command) fail('exec requires --id and --command, or use --payload');
      const data = await callApi('/api/cloudphone/exeCommand', { body });
      printObject(data);
      return;
    }
    case 'update-adb': {
      const body = payload || {
        ids: [toCloudPhoneNumericId(options.id)],
        enableAdb: toBoolean(options.enable, true),
      };
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        fail('update-adb requires --id (or ids in payload)');
      }
      const data = await callApi('/api/cloudphone/updateAdb', { body });
      printObject(data);
      return;
    }
    case 'new-machine': {
      const body = payload || { id: options.id };
      if (!body.id) fail('new-machine requires --id or --payload');
      const data = await callApi('/api/cloudphone/newMachine', { body });
      printObject(data);
      return;
    }
    case 'app-installed': {
      const body = payload || { id: options.id };
      if (!body.id) fail('app-installed requires --id or --payload');
      const data = await callApi('/api/cloudphone/app/installedList', { body });
      printObject(data);
      return;
    }
    case 'app-start':
    case 'app-stop':
    case 'app-restart':
    case 'app-uninstall': {
      const endpointMap = {
        'app-start': '/api/cloudphone/app/start',
        'app-stop': '/api/cloudphone/app/stop',
        'app-restart': '/api/cloudphone/app/restart',
        'app-uninstall': '/api/cloudphone/app/uninstall',
      };
      const body = payload || { id: options.id, packageName: options['package-name'] };
      if (!body.id || !body.packageName) fail(`${command} requires --id and --package-name, or --payload`);
      const data = await callApi(endpointMap[command], { body });
      printObject(data);
      return;
    }
    default:
      fail(`Unknown cloudphone command: ${command}`);
  }
}

async function handleApi(options) {
  const endpoint = options.endpoint;
  if (!endpoint) fail('api mode requires --endpoint');
  const method = String(options.method || 'POST').toUpperCase();
  const body = parseJsonInput(options.data, '--data');
  const response = await requestApi(endpoint, { method, body });
  printObject(response.body);
}

async function handleProxy(command, options) {
  const payload = parseJsonInput(options.payload, '--payload');
  switch (command) {
    case 'list': {
      const body = payload || { pageNo: toInt(options.page, 1), pageSize: toInt(options['page-size'], 20) };
      const data = await callApi('/api/proxyInfo/page', { body });
      printObject(data);
      return;
    }
    case 'add': {
      if (!payload) fail('proxy add: use --payload to pass full parameters');
      validateProxyAddPayload(payload);
      const data = await callApi('/api/proxyInfo/add', { body: payload });
      printObject(data);
      return;
    }
    case 'update': {
      if (!payload) fail('proxy update: use --payload to pass full parameters');
      validateProxyUpdatePayload(payload);
      const data = await callApi('/api/proxyInfo/update', { body: payload });
      printObject(data);
      return;
    }
    case 'delete': {
      let body = payload;
      if (!body) {
        body = splitCsv(options.ids);
      } else if (!Array.isArray(body)) {
        if (Array.isArray(body.ids)) {
          body = body.ids;
        } else if (Array.isArray(body.proxyIds)) {
          body = body.proxyIds;
        }
      }
      if (!Array.isArray(body) || body.length === 0) {
        fail('proxy delete requires --ids "<id1,id2>" or --payload');
      }
      const data = await callApi('/api/proxyInfo/delete', { body });
      printObject(data);
      return;
    }
    case 'help':
      console.log(`
Proxy subcommands:
  list --page 1 --page-size 20
  add --payload '{"proxyIp":"1.2.3.4",...}'
  update --payload '{"id":"...","proxyIp":"..."}'
  delete --ids "id1,id2" or --payload '["id1","id2"]'
`);
      return;
    default:
      fail(`Unknown proxy command: ${command}`);
  }
}

async function handleGroup(command, options) {
  const payload = parseJsonInput(options.payload, '--payload');
  switch (command) {
    case 'list': {
      const body = payload || { groupName: options.name || '', pageNo: toInt(options.page, 1), pageSize: toInt(options['page-size'], 20) };
      const data = await callApi('/api/envgroup/page', { body });
      printObject(data);
      return;
    }
    case 'create': {
      const body = payload || (options.name ? { groupName: options.name } : null);
      if (!body) fail('group create requires --name or --payload');
      validateGroupCreatePayload(body);
      const data = await callApi('/api/envgroup/create', { body });
      printObject(data);
      return;
    }
    case 'edit': {
      const body = payload || { id: options.id, groupName: options.name };
      if (!body.id || !body.groupName) fail('group edit requires --id and --name, or --payload');
      const data = await callApi('/api/envgroup/edit', { body });
      printObject(data);
      return;
    }
    case 'delete': {
      const body = payload || { ids: splitCsv(options.ids) };
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        fail('group delete requires --ids "<id1,id2>" or --payload');
      }
      const data = await callApi('/api/envgroup/delete', { body });
      printObject(data);
      return;
    }
    case 'help':
      console.log(`
Group subcommands:
  list --page 1 --page-size 20
  create --name "My Group" or --payload '{"groupName":"My Group"}'
  edit --id "<groupId>" --name "New Name" or --payload '{"id":"<groupId>","groupName":"New Name"}'
  delete --ids "id1,id2" or --payload '{"ids":["id1","id2"]}'
`);
      return;
    default:
      fail(`Unknown group command: ${command}`);
  }
}

async function handleTag(command, options) {
  const payload = parseJsonInput(options.payload, '--payload');
  switch (command) {
    case 'list': {
      const data = await callApi('/api/envtag/all', { method: 'GET' });
      printObject(data);
      return;
    }
    case 'create': {
      const body = payload || (options.name ? { tagName: options.name } : null);
      if (!body) fail('tag create requires --name or --payload');
      validateTagCreatePayload(body);
      const data = await callApi('/api/envtag/create', { body });
      printObject(data);
      return;
    }
    case 'edit': {
      const body = payload || { id: options.id, tagName: options.name };
      if (!body.id || !body.tagName) fail('tag edit requires --id and --name, or --payload');
      const data = await callApi('/api/envtag/edit', { body });
      printObject(data);
      return;
    }
    case 'delete': {
      const body = payload || { ids: splitCsv(options.ids) };
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        fail('tag delete requires --ids "<id1,id2>" or --payload');
      }
      const data = await callApi('/api/envtag/delete', { body });
      printObject(data);
      return;
    }
    case 'help':
      console.log(`
Tag subcommands:
  list
  create --name "tag-name" or --payload '{"tagName":"tag-name"}'
  edit --id "<tagId>" --name "new-tag-name" or --payload '{"id":"<tagId>","tagName":"new-tag-name"}'
  delete --ids "id1,id2" or --payload '{"ids":["id1","id2"]}'
`);
      return;
    default:
      fail(`Unknown tag command: ${command}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const [scope, command, ...rest] = argv;

  if (!scope || scope === 'help' || scope === '--help') {
    showHelp();
    return;
  }

  // Backward compatibility for legacy commands
  const legacyMap = {
    list: ['browser', 'list'],
    start: ['browser', 'start'],
    stop: ['browser', 'close'],
    info: ['browser', 'detail'],
    connect: ['browser', 'status'],
  };

  let effectiveScope = scope;
  let effectiveCommand = command;
  let optionsSource = rest;

  if (legacyMap[scope]) {
    [effectiveScope, effectiveCommand] = legacyMap[scope];
    optionsSource = [command, ...rest].filter((item) => item !== undefined);
  }
  if (effectiveScope === 'api') {
    optionsSource = command ? [command, ...rest] : rest;
  }

  const { options } = parseArgs(optionsSource);
  if (options['profile-id'] && !options['env-id']) {
    options['env-id'] = options['profile-id'];
  }
  if (options['instance-id'] && !options.id) {
    options.id = options['instance-id'];
  }

  try {
    if (effectiveScope === 'browser') {
      if (!effectiveCommand) fail('Missing browser subcommand');
      await handleBrowser(effectiveCommand, options);
      return;
    }
    if (effectiveScope === 'cloudphone') {
      if (!effectiveCommand) fail('Missing cloudphone subcommand');
      await handleCloudPhone(effectiveCommand, options);
      return;
    }

    if (effectiveScope === 'api') {
      await handleApi(options);
      return;
    }
    if (effectiveScope === 'proxy') {
      if (!effectiveCommand) fail('Missing proxy subcommand');
      await handleProxy(effectiveCommand, options);
      return;
    }
    if (effectiveScope === 'group') {
      if (!effectiveCommand) fail('Missing group subcommand');
      await handleGroup(effectiveCommand, options);
      return;
    }
    if (effectiveScope === 'tag') {
      if (!effectiveCommand) fail('Missing tag subcommand');
      await handleTag(effectiveCommand, options);
      return;
    }
    fail(`Unknown command scope: ${effectiveScope}`);
  } catch (error) {
    fail(error.message);
  }
}

main();
