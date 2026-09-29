const {
  normalizeStringArray,
  parseJsonInput,
  parsePageOptions,
  parseRequiredInt,
  printObject,
  requireNonEmptyString,
  requirePlainObject,
  toBoolean,
} = require('./common');

function toCloudPhoneNumericId(idValue) {
  return requireNonEmptyString(idValue, 'id');
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

function createCloudPhoneHandler({ callApi, fail }) {
  const { createExtendedCloudPhoneHandler } = require('./extended-commands');
  const handleExtendedCloudPhone = createExtendedCloudPhoneHandler({ callApi, fail });
  async function findCloudPhoneById(id) {
    const targetId = String(id);
    const seenPages = new Set();
    const deadline = Date.now() + 120000;
    for (let pageNo = 1; pageNo <= 100; pageNo++) {
      if (Date.now() >= deadline) throw new Error('Cloud phone lookup deadline reached; result incomplete');
      const page = await callApi('/api/cloudphone/page', { body: { pageNo, pageSize: 100 } });
      if (!Array.isArray(page?.dataList)) throw new Error('Invalid cloud phone page response');
      const matches = page.dataList.filter((item) => String(item.id) === targetId);
      if (matches.length > 1) throw new Error('Ambiguous cloud phone ID in page response');
      if (matches.length === 1) return matches[0];
      const signature = JSON.stringify(page.dataList.map((item) => item.id));
      if (seenPages.has(signature)) throw new Error('Cloud phone pagination repeated; result incomplete');
      seenPages.add(signature);
      const pages = page.pages === undefined ? undefined : parseRequiredInt(page.pages, 'pages', { min: 0 });
      if (!page.dataList.length || (pages !== undefined ? pageNo >= pages : page.dataList.length < 100)) {
        throw new Error(`Cloud phone not found: ${targetId}`);
      }
    }
    throw new Error('Cloud phone lookup exceeded 100 pages; result incomplete');
  }

  async function getCloudPhoneInfoById(id) {
    return callApi('/api/cloudphone/info', {
      body: { id: toCloudPhoneNumericId(id) },
    });
  }

  return async function handleCloudPhone(command, options) {
    const payload = parseJsonInput(options.payload, '--payload');

    switch (command) {
      case 'help':
        console.log(`
CloudPhone subcommands:
  list --page 1 --page-size 20
  create --payload '{"skuId":"10002", ...}'
  start --id <cloudPhoneId> [--headless false] [--disable-money-saving-mode false]
  stop --id <cloudPhoneId>
  info --id <cloudPhoneId>
  adb-info --id <cloudPhoneId>
  update-adb --id <cloudPhoneId> --enable true
  new-machine --id <cloudPhoneId>
  app-installed --id <cloudPhoneId>
  app-start --id <cloudPhoneId> --package-name com.example.app
  app-stop --id <cloudPhoneId> --package-name com.example.app
  app-restart --id <cloudPhoneId> --package-name com.example.app
  app-uninstall --id <cloudPhoneId> --package-name com.example.app
  restart|reset --id <cloudPhoneId>
  monthly-skus
  monthly-activate --ids id1,id2 --confirm-charge true
  live-start --id <cloudPhoneId> --file-id <cloudStorageFileId>
  live-status|live-stop --id <cloudPhoneId>
  team-apps --page 1 --page-size 20 [--name text]
  app-root --id <cloudPhoneId> --package-names com.example.app
  set-proxy --payload '{"ids":["..."],"proxy":{...}}'
  find-android --android-id <androidId>
  root --id <cloudPhoneId> --enable true|false
  screenshot|screenshot-base64 --id <cloudPhoneId>
  adb-batch --ids id1,id2
  tap|double-tap|long-press --id <id> --pos x,y [--duration ms]
  swipe|drag --id <id> --from x,y --to x,y [--duration ms]
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
        printObject(data, { redact: !options['raw-output'] });
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
        const body = payload || { id: options.id,
          ...(options.headless !== undefined ? { headless: toBoolean(options.headless) } : {}),
          ...(options['disable-money-saving-mode'] !== undefined ? { disableMoneySavingMode: toBoolean(options['disable-money-saving-mode']) } : {}),
        };
        requirePlainObject(body, 'start payload');
        body.id = requireNonEmptyString(body.id, 'id');
        for (const field of ['headless', 'disableMoneySavingMode']) {
          if (body[field] !== undefined) body[field] = toBoolean(body[field]);
        }
        const data = await callApi('/api/cloudphone/powerOn', { body });
        console.log('✅ Startup request accepted; poll cloudphone info until envStatus is 4');
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
        printObject(data, { redact: !options['raw-output'] });
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
        }, { redact: !options['raw-output'] });
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
        if (await handleExtendedCloudPhone(command, options)) return;
        fail(`Unknown cloudphone command: ${command}`);
    }
  };
}

module.exports = { createCloudPhoneHandler };
