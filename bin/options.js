// Explicit command surface: unsupported flags must never silently change intent.
const globalOptions = new Set(['raw-output', 'timeout-ms', ...[
  'charge', 'close-all', 'delete', 'reset', 'power-off', 'uninstall', 'clear-cache',
  'exec', 'security', 'schedule', 'webhook', 'proxy', 'force-stop',
].map((name) => `confirm-${name}`)]);
const identity = 'env-id unique-id';
const paging = 'page page-size';
const commands = {
  browser: {
    list: `${paging} name`, start: identity, close: identity,
    status: 'env-id', detail: 'env-id', 'refresh-fingerprint': 'env-id',
    'clear-cache': 'env-id local-storage indexed-db cookie extension extension-file',
    'clean-cloud-cache': `${identity} cookie others`,
    'create-quick': 'browser-type-id operator-system-id quantity', delete: 'env-ids',
    'kernel-download': 'browser-type version',
  },
  cloudbrowser: { start: 'env-id', stop: 'env-id force', list: `${paging} keyword env-id`, connect: 'env-id' },
  cloudphone: {
    list: paging, create: '', start: 'id headless disable-money-saving-mode', stop: 'id',
    info: 'id', 'adb-info': 'id', 'update-adb': 'id enable', 'new-machine': 'id',
    'app-installed': 'id', 'app-start': 'id package-name', 'app-stop': 'id package-name',
    'app-restart': 'id package-name', 'app-uninstall': 'id package-name',
    restart: 'id', reset: 'id', screenshot: 'id', 'screenshot-base64': 'id',
    'monthly-skus': null, 'monthly-activate': 'ids', 'live-start': 'id phone-id file-id',
    'live-status': 'id phone-id', 'live-stop': 'id phone-id', 'team-apps': `${paging} name`,
    'app-root': 'id package-names', 'set-proxy': '', 'find-android': 'android-id',
    root: 'id enable', 'adb-batch': 'ids', tap: 'id pos', 'double-tap': 'id pos',
    'long-press': 'id pos duration', swipe: 'id from to duration', drag: 'id from to duration',
  },
  cloudstorage: {
    info: null, list: `${paging} name tag-ids`, 'upload-init': 'file-names', 'upload-complete': 'id',
    delete: 'ids', 'set-tags': 'file-id tag-ids', 'add-tags': 'file-id tag-ids',
    'file-tags': 'file-ids', 'tag-list': null, 'tag-create': 'name', 'tag-edit': 'id name', 'tag-delete': 'ids',
  },
  account: { balance: null }, webhook: { config: 'url enabled' },
  proxy: { list: paging, add: '', update: '', delete: 'ids' },
  group: { list: `${paging} name`, create: 'name', edit: 'id name', delete: 'ids' },
  tag: { list: null, create: 'name', edit: 'id name', delete: 'ids' },
};
function validateOptions(scope, command, options, positional = []) {
  if (positional.length) throw new Error('Unexpected positional arguments; use named options');
  for (const [alias, canonical] of [['profile-id', 'env-id'], ['instance-id', 'id']]) {
    if (options[alias] !== undefined) {
      if (options[canonical] !== undefined) throw new Error(`Use only --${canonical}, not both identity aliases`);
      options[canonical] = options[alias]; delete options[alias];
    }
  }
  if (command === '--help') command = 'help';
  const definition = scope === 'api' ? 'endpoint method data file' : commands[scope]?.[command];
  if (definition === undefined && command !== 'help') throw new Error(`Unknown command: ${scope} ${command || ''}`);
  const fields = new Set((definition || '').split(' ').filter(Boolean));
  const allowed = new Set([...globalOptions, ...fields]);
  if (definition !== null && command !== 'help') allowed.add('payload');
  for (const [key, value] of Object.entries(options)) {
    if (!allowed.has(key)) throw new Error(`Unsupported option --${key} for ${scope} ${command || ''}`);
    if (value === true && key !== 'raw-output' && !key.startsWith('confirm-')) throw new Error(`--${key} requires an explicit value`);
  }
  if (options.payload !== undefined) {
    const conflicts = [...fields].filter((key) => options[key] !== undefined && !(scope === 'api' && ['endpoint', 'method', 'file'].includes(key)));
    if (conflicts.length) throw new Error('Use --payload or shortcut fields, not both');
  }
  if (options['env-id'] !== undefined && options['unique-id'] !== undefined) throw new Error('Use one profile identity only');
  if (options.id !== undefined && options['phone-id'] !== undefined) throw new Error('Use --id or --phone-id, not both');
}
module.exports = { validateOptions, commands };
