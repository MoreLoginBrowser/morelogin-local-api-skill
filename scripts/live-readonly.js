// Explicit, read-only live checks using the user's required official CLI.
// Never derive mutations from a schema or replay failed calls.
const { execFile } = require('node:child_process');
const cases = [
  ['status', ['status']],
  ['browser profiles', ['env', 'list', '--page-no', '1', '--page-size', '1']],
  ['browser screens', ['env', 'screens']],
  ['browser processes', ['env', 'processes']],
  ['browser debug info', ['env', 'debug-info']],
  ['browser core versions', ['env', 'ua-versions']],
  ['platforms', ['env', 'platform-list']],
  ['mobile devices', ['env', 'mobile-devices']],
  ['cloud browsers', ['cloud-browser', 'list', '--page-no', '1', '--page-size', '1']],
  ['cloud phones', ['cloudphone', 'list', '--page-no', '1', '--page-size', '1']],
  ['groups', ['group', 'list', '--page-no', '1', '--page-size', '1']],
  ['tags', ['tag', 'list']],
  ['proxies', ['proxy', 'list', '--page-no', '1', '--page-size', '1']],
  ['schedules', ['schedule', 'list', '--page-no', '1', '--page-size', '1']],
  ['storage quota', ['cloud-storage', 'info']],
  ['storage files', ['cloud-storage', 'list', '--page-no', '1', '--page-size', '1']],
  ['storage labels', ['cloud-storage', 'labels']],
];
async function run([name, args]) {
  return new Promise((resolve) => execFile('ml-cli', ['--port', process.env.ML_PORT || '40000',
    '--timeout', '15', '--fail-on-business-error', ...args], { timeout: 20000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
    let value; try { value = JSON.parse(stdout); } catch {}
    resolve({ name, command: args.join(' '), exitCode: error?.code || 0,
      businessCode: value?.code ?? null, passed: !error && (value?.code === 0 || (name === 'status' && value?.status === 'ok')) });
  }));
}
(async () => {
  const results = [];
  for (const item of cases) results.push(await run(item));
  console.log(JSON.stringify({ date: new Date().toISOString(), mode: 'live-read-only-via-ml-cli',
    total: results.length, passed: results.filter((r) => r.passed).length, results }, null, 2));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
})();
