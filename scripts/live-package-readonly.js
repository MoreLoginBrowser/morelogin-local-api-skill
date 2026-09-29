// Opt-in integration verification of the installed tarball. Fixed read-only cases only.
// Never persist API response bodies, resource IDs, account balances or credentials.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const paging = ['--page', '1', '--page-size', '1'];
const cases = [
  ['health', ['api', '--endpoint', '/status', '--data', '{}']],
  ['browser profiles', ['browser', 'list', ...paging]],
  ['browser screens', ['api', '--endpoint', '/api/env/getAllScreen', '--data', '{}']],
  ['browser processes', ['api', '--endpoint', '/api/env/getAllProcessIds', '--data', '{}']],
  ['browser debug info', ['api', '--endpoint', '/api/env/getAllDebugInfo', '--data', '{}']],
  ['browser core versions', ['api', '--endpoint', '/api/env/advanced/ua/versions', '--method', 'GET']],
  ['platforms', ['api', '--endpoint', '/api/system/platform/list', '--method', 'GET']],
  ['mobile devices', ['api', '--endpoint', '/api/env/base/mobile/devices']],
  ['cloud browsers', ['cloudbrowser', 'list', ...paging]],
  ['cloud phones', ['cloudphone', 'list', ...paging]],
  ['groups', ['group', 'list', ...paging]],
  ['tags', ['tag', 'list']],
  ['proxies', ['proxy', 'list', ...paging]],
  ['schedules', ['api', '--endpoint', '/api/cloudphone/rpa/task/page', '--data', '{"pageNo":1,"pageSize":1}']],
  ['storage quota', ['cloudstorage', 'info']],
  ['storage files', ['cloudstorage', 'list', ...paging]],
  ['storage labels', ['cloudstorage', 'tag-list']],
];
async function main() {
  if (!process.argv.includes('--run')) throw new Error('Opt in with --run after authorizing live read-only checks; no live writes are supported');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'morelogin-live-package-'));
  try {
    const npm = require('./npm-command').npmCommand();
    const invokeNpm = (args) => execFileSync(npm.executable, [...npm.prefix, ...args], { cwd: root, encoding: 'utf8' });
    const packed = JSON.parse(invokeNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp]))[0];
    const tarball = path.join(temp, packed.filename);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
    invokeNpm(['install', '--prefix', path.join(temp, 'consumer'), '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', tarball]);
    const cli = path.join(temp, 'consumer/node_modules/morelogin-cli/bin/morelogin.js');
    const results = [];
    for (const [name, args] of cases) {
      const result = await new Promise((resolve) => execFile(process.execPath, [cli, ...args, '--timeout-ms', '15000'],
        { timeout: 20000, maxBuffer: 40 * 1024 * 1024 }, (error, stdout, stderr) => {
          let parsed; try { parsed = JSON.parse(stdout); } catch {}
          // Keep only safe classifications; stderr may include request IDs.
          resolve({ name, passed: !error && parsed !== undefined,
            exitCode: error?.code || 0, businessCode: parsed?.code ?? null,
            reason: error ? (/timeout/i.test(stderr) ? 'timeout' : 'command-failed') : parsed === undefined ? 'invalid-json' : 'ok' });
        }));
      results.push(result);
      if (name === 'health' && !result.passed) break;
    }
    const report = { date: new Date().toISOString(), mode: 'live-read-only-installed-project-tarball', runtime: process.version,
      platform: process.platform, package: packed.filename, sha256, planned: cases.length, executed: results.length,
      passed: results.filter((r) => r.passed).length, liveWrites: 'not-run', results };
    fs.writeFileSync(path.join(root, 'reports/live-package-readonly.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (results.length !== cases.length || results.some((r) => !r.passed)) process.exitCode = 1;
  } finally { fs.rmSync(temp, { recursive: true }); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
