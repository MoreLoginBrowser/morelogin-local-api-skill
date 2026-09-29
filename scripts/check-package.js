const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'morelogin-package-'));
const npm = require('./npm-command').npmCommand();
async function main() {
try {
  // validate and test must run before this command; avoid recursive prepack.
  const result = JSON.parse(execFileSync(npm.executable, [...npm.prefix, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], { cwd: root, encoding: 'utf8' }))[0];
  const paths = result.files.map((f) => f.path);
  for (const required of ['bin/extended-commands.js', 'bin/policy.js', 'bin/options.js', 'bin/routes.json', 'agents/openai.yaml', 'SKILL.md', 'references/safety.md', 'local-api.yaml']) {
    if (!paths.includes(required)) throw new Error(`Missing package file ${required}`);
  }
  if (paths.some((p) => /\.DS_Store|^skills\/morelogin-skills\/|^test\/|^node_modules\/|^specs\//.test(p))) throw new Error('Unexpected package content');
  execFileSync(npm.executable, [...npm.prefix, 'install', '--prefix', path.join(temp, 'consumer'), '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, result.filename)], { encoding: 'utf8' });
  const installed = path.join(temp, 'consumer/node_modules/morelogin-cli');
  for (const args of [['help'], ['cloudphone', 'help'], ['cloudstorage', 'help'], ['account', 'help'], ['webhook', 'help']]) {
    execFileSync(process.execPath, [path.join(installed, 'bin/morelogin.js'), ...args], { encoding: 'utf8' });
  }
  const smoke = await require('./package-smoke').runSmoke(path.join(installed, 'bin/morelogin.js'));
  console.log(JSON.stringify({ status: 'pass', platform: process.platform, runtime: process.version,
    package: result.filename, files: paths.length, unpackedSize: result.unpackedSize,
    installedWithoutDevDependencies: true, helpSmokeTests: 5, functionalMockChecks: smoke, excludedUnrelatedFiles: true }, null, 2));
} finally { fs.rmSync(temp, { recursive: true }); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
