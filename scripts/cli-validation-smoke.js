#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, '..', 'bin', 'morelogin.js');

const cases = [
  ['browser list invalid page', ['browser', 'list', '--page', '0'], /--page must be >= 1/],
  ['browser start missing identity', ['browser', 'start'], /Please provide --env-id or --unique-id/],
  ['browser close invalid unique-id', ['browser', 'close', '--unique-id', 'abc'], /--unique-id must be an integer/],
  ['browser detail missing identity payload', ['browser', 'detail', '--payload', '{}'], /detail requires envId or uniqueId/],
  ['browser create-quick bad quantity', ['browser', 'create-quick', '--quantity', '0'], /quantity must be >= 1/],
  ['browser refresh-fingerprint missing identity', ['browser', 'refresh-fingerprint'], /Please provide --env-id or --unique-id/],
  ['browser clear-cache no flags', ['browser', 'clear-cache', '--env-id', 'x'], /clear-cache requires at least one cache flag/],
  ['browser clean-cloud-cache no flags', ['browser', 'clean-cloud-cache', '--env-id', 'x'], /clean-cloud-cache requires at least one flag/],
  ['browser delete empty envIds', ['browser', 'delete', '--payload', '{"envIds":[]}'], /envIds must be a non-empty array/],

  ['proxy list bad page-size', ['proxy', 'list', '--page-size', '1000'], /--page-size must be <= 200/],
  ['proxy add missing fields', ['proxy', 'add', '--payload', '{"proxyIp":"1.2.3.4"}'], /proxyPort is required/],
  ['proxy update invalid port', ['proxy', 'update', '--payload', '{"id":"1","proxyIp":"1.2.3.4","proxyPort":"xx","proxyProvider":"x"}'], /proxyPort must be an integer/],
  ['proxy delete empty list', ['proxy', 'delete', '--payload', '[]'], /ids must be a non-empty array/],

  ['group list bad page', ['group', 'list', '--page', '0'], /--page must be >= 1/],
  ['group create missing name', ['group', 'create'], /group create requires --name or --payload/],
  ['group edit missing name', ['group', 'edit', '--id', '1'], /groupName is required/],
  ['group delete empty ids', ['group', 'delete', '--payload', '{"ids":[]}'], /ids must be a non-empty array/],

  ['tag create missing name', ['tag', 'create'], /tag create requires --name or --payload/],
  ['tag edit missing name', ['tag', 'edit', '--id', '1'], /tagName is required/],
  ['tag delete empty ids', ['tag', 'delete', '--payload', '{"ids":[]}'], /ids must be a non-empty array/],

  ['cloudphone list bad page-size', ['cloudphone', 'list', '--page-size', '0'], /--page-size must be >= 1/],
  ['cloudphone create bad quantity', ['cloudphone', 'create', '--payload', '{"skuId":"1","quantity":0}'], /quantity must be >= 1/],
  ['cloudphone start missing id', ['cloudphone', 'start'], /id is required/],
  ['cloudphone stop missing id', ['cloudphone', 'stop'], /id is required/],
  ['cloudphone info missing id', ['cloudphone', 'info'], /id is required/],
  ['cloudphone adb-info missing id', ['cloudphone', 'adb-info'], /id is required/],
  ['cloudphone adb-connect bad wait', ['cloudphone', 'adb-connect', '--id', '1', '--wait-seconds', '-1'], /--wait-seconds must be >= 0/],
  ['cloudphone adb-disconnect bad address', ['cloudphone', 'adb-disconnect', '--id', '1', '--address', 'invalid'], /--address must be host:port/],
  ['cloudphone exec empty command', ['cloudphone', 'exec', '--id', '1', '--command', ''], /command is required/],
  ['cloudphone update-adb empty ids', ['cloudphone', 'update-adb', '--payload', '{"ids":[]}'], /ids must be a non-empty array/],
  ['cloudphone new-machine missing id', ['cloudphone', 'new-machine'], /id is required/],
  ['cloudphone app-installed missing id', ['cloudphone', 'app-installed'], /id is required/],
  ['cloudphone app-start bad package', ['cloudphone', 'app-start', '--id', '1', '--package-name', 'bad package'], /packageName contains unsupported characters/],
  ['cloudphone app-stop bad package', ['cloudphone', 'app-stop', '--id', '1', '--package-name', 'bad package'], /packageName contains unsupported characters/],
  ['cloudphone app-restart bad package', ['cloudphone', 'app-restart', '--id', '1', '--package-name', 'bad package'], /packageName contains unsupported characters/],
  ['cloudphone app-uninstall bad package', ['cloudphone', 'app-uninstall', '--id', '1', '--package-name', 'bad package'], /packageName contains unsupported characters/],

  ['api endpoint prefix check', ['api', '--endpoint', 'env/page'], /requires --endpoint to start with \/api\//],
  ['api method allowlist', ['api', '--endpoint', '/api/env/page', '--method', 'FOO'], /Unsupported --method/],
];

let pass = 0;
for (const [name, args, expected] of cases) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const ok = result.status !== 0 && expected.test(output);
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    console.log(`  exit=${result.status}`);
    console.log(`  expected=${expected}`);
    console.log(`  output=${output.trim().slice(0, 300)}`);
  }
}

console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
