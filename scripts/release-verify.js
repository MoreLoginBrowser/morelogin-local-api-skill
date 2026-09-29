const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildMatrix } = require('./test-results');
const root = path.resolve(__dirname, '..');
const reportName = process.env.MORELOGIN_REPORT_NAME || '';
if (reportName && !/^[a-z0-9-]+$/.test(reportName)) throw new Error('Invalid report name');
const reports = path.join(root, 'reports', reportName);
fs.mkdirSync(reports, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(reports, name), JSON.stringify(value, null, 2) + '\n');
function run(script, args = []) {
  return execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}
// Invalidate previous success before any preflight can fail.
write('endpoint-matrix.json', { generatedAt: new Date().toISOString(), status: 'not-run' });
write('package.json', { status: 'not-run' });
fs.writeFileSync(path.join(reports, 'tests.tap'), 'TAP version 13\n# not-run: release verification started\n');
fs.writeFileSync(path.join(reports, 'test-events.jsonl'), '');
let output = '', testError;
try {
  console.log(run('scripts/validate-openapi.js').trim());
  console.log(run('scripts/check-source.js').trim());
  const files = fs.readdirSync(path.join(root, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`);
  try {
    output = execFileSync(process.execPath, ['--test', '--test-reporter=./scripts/event-reporter.js', '--test-reporter-destination=stdout',
      '--test-reporter=tap', `--test-reporter-destination=${path.join(reports, 'tests.tap')}`, ...files],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (error) { output = String(error.stdout || ''); testError = error; }
  fs.writeFileSync(path.join(reports, 'test-events.jsonl'), output);
  const events = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const { operations } = require('../test/contract-fixtures');
  const results = buildMatrix(events, operations);
  if (testError) results.status = 'failed-run';
  write('endpoint-matrix.json', results);
  if (testError || results.status !== 'pass') throw new Error('Release tests incomplete or failed; inspect test-events.jsonl');
  const packageResult = JSON.parse(run('scripts/check-package.js'));
  write('package.json', packageResult);
  console.log(JSON.stringify({ tests: results.testEvents, operations: results.operations.length, package: packageResult }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
