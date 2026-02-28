const { spawnSync } = require('child_process');
const {
  normalizeStringArray,
  parseJsonInput,
  parseOptionalInt,
  parsePageOptions,
  parseRequiredInt,
  printObject,
  requireNonEmptyString,
  requirePlainObject,
  toBoolean,
} = require('./common');

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

function parseAndValidateSshCommand(command) {
  const raw = String(command || '').trim();
  if (!raw) {
    throw new Error('SSH command is empty');
  }
  // Block shell metacharacters to avoid command injection.
  if (/[`$;&|<>]/.test(raw)) {
    throw new Error('SSH command contains blocked shell characters');
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens[0] !== 'ssh') {
    throw new Error('Only ssh command is allowed for tunnel mode');
  }
  for (const token of tokens.slice(1)) {
    if (!/^[\w@.:,/+=-]+$/.test(token)) {
      throw new Error(`SSH argument contains unsupported characters: ${token}`);
    }
  }
  return {
    binary: tokens[0],
    args: tokens.slice(1),
  };
}

function toCloudPhoneNumericId(idValue) {
  const n = Number(idValue);
  return Number.isNaN(n) ? idValue : n;
}

function validateCloudPhoneCreatePayload(body, fail) {
  try {
    requirePlainObject(body, 'cloudphone create payload');
    requireNonEmptyString(body.skuId, 'skuId');
    body.quantity = parseRequiredInt(body.quantity, 'quantity', { min: 1, max: 10 });
  } catch (error) {
    fail(error.message);
  }
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
  const parsed = parseAndValidateSshCommand(sshCommand);
  const script = `
set timeout 45
set bin $env(ML_SSH_BIN)
set argv [split $env(ML_SSH_ARGS)]
set pwd $env(ML_SSH_PWD)
spawn $bin {*}$argv
expect {
  -re "yes/no" { send "yes\\r"; exp_continue }
  -re "\\\\[Pp\\\\]assword:" { send "$pwd\\r"; exp_continue }
  eof {}
  timeout { exit 1 }
}
`;
  const result = spawnSync('expect', ['-c', script], {
    env: {
      ...process.env,
      ML_SSH_BIN: parsed.binary,
      ML_SSH_ARGS: parsed.args.join(' '),
      ML_SSH_PWD: sshPassword || '',
    },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'SSH tunnel failed').trim());
  }
}

function createCloudPhoneHandler({ callApi, fail }) {
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

    const waitSeconds = parseOptionalInt(options['wait-seconds'], '--wait-seconds', { min: 0, max: 600 }) ?? 0;
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
    return {
      id: String(cloudphoneId),
      address,
      output: `${disconnect.stdout || ''}${disconnect.stderr || ''}`.trim(),
    };
  }

  return async function handleCloudPhone(command, options) {
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
        let body;
        if (payload) {
          requirePlainObject(payload, 'cloudphone list payload');
          body = {
            ...payload,
            pageNo: payload.pageNo === undefined ? 1 : parseRequiredInt(payload.pageNo, 'pageNo', { min: 1 }),
            pageSize: payload.pageSize === undefined ? 20 : parseRequiredInt(payload.pageSize, 'pageSize', { min: 1, max: 200 }),
          };
        } else {
          body = parsePageOptions(options);
        }
        const data = await callApi('/api/cloudphone/page', { body });
        printObject(data);
        return;
      }
      case 'create': {
        if (!payload) fail('create: use --payload to pass full parameters');
        validateCloudPhoneCreatePayload(payload, fail);
        const data = await callApi('/api/cloudphone/create', { body: payload });
        console.log('✅ Cloud phone created successfully');
        printObject(data);
        return;
      }
      case 'start': {
        const body = payload || { id: options.id };
        requirePlainObject(body, 'start payload');
        body.id = requireNonEmptyString(body.id, 'id');
        const data = await callApi('/api/cloudphone/powerOn', { body });
        console.log('✅ Cloud phone started');
        printObject(data);
        return;
      }
      case 'stop': {
        const body = payload || { id: options.id };
        requirePlainObject(body, 'stop payload');
        body.id = requireNonEmptyString(body.id, 'id');
        const data = await callApi('/api/cloudphone/powerOff', { body });
        console.log('✅ Cloud phone stopped');
        printObject(data);
        return;
      }
      case 'info': {
        const body = payload || { id: options.id };
        requirePlainObject(body, 'info payload');
        body.id = requireNonEmptyString(body.id, 'id');
        const data = await callApi('/api/cloudphone/info', { body });
        printObject(data);
        return;
      }
      case 'adb-info': {
        const cloudphoneId = payload?.id || options.id;
        requireNonEmptyString(cloudphoneId, 'id');
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
        requireNonEmptyString(cloudphoneId, 'id');
        if (options['wait-seconds'] !== undefined) {
          parseRequiredInt(options['wait-seconds'], '--wait-seconds', { min: 0, max: 600 });
        }
        const data = await connectCloudPhoneAdb(cloudphoneId, options);
        console.log('✅ ADB connected');
        printObject(data);
        return;
      }
      case 'adb-disconnect': {
        const cloudphoneId = payload?.id || options.id;
        requireNonEmptyString(cloudphoneId, 'id');
        if (options.address !== undefined) {
          const address = requireNonEmptyString(options.address, '--address');
          if (!/^[\w.-]+:\d{1,5}$/.test(address)) {
            fail('--address must be host:port');
          }
        }
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
        requirePlainObject(body, 'exec payload');
        body.id = requireNonEmptyString(body.id, 'id');
        body.command = requireNonEmptyString(body.command, 'command');
        if (body.command.length > 300) {
          fail('command is too long (max 300 chars)');
        }
        const data = await callApi('/api/cloudphone/exeCommand', { body });
        printObject(data);
        return;
      }
      case 'update-adb': {
        const body = payload || {
          ids: [toCloudPhoneNumericId(options.id)],
          enableAdb: toBoolean(options.enable, true),
        };
        requirePlainObject(body, 'update-adb payload');
        body.ids = normalizeStringArray(body.ids, 'ids').map(toCloudPhoneNumericId);
        body.enableAdb = toBoolean(body.enableAdb, true);
        const data = await callApi('/api/cloudphone/updateAdb', { body });
        printObject(data);
        return;
      }
      case 'new-machine': {
        const body = payload || { id: options.id };
        requirePlainObject(body, 'new-machine payload');
        body.id = requireNonEmptyString(body.id, 'id');
        const data = await callApi('/api/cloudphone/newMachine', { body });
        printObject(data);
        return;
      }
      case 'app-installed': {
        const body = payload || { id: options.id };
        requirePlainObject(body, 'app-installed payload');
        body.id = requireNonEmptyString(body.id, 'id');
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
        requirePlainObject(body, `${command} payload`);
        body.id = requireNonEmptyString(body.id, 'id');
        body.packageName = requireNonEmptyString(body.packageName, 'packageName');
        if (!/^[A-Za-z0-9._-]+$/.test(body.packageName)) {
          fail('packageName contains unsupported characters');
        }
        const data = await callApi(endpointMap[command], { body });
        printObject(data);
        return;
      }
      default:
        fail(`Unknown cloudphone command: ${command}`);
    }
  };
}

module.exports = { createCloudPhoneHandler };
