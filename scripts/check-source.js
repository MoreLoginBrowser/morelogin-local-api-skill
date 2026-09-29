const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'scripts/build-routes.js'), '--check']);
for (const dir of ['bin', 'scripts', 'test', 'examples']) {
  for (const file of fs.readdirSync(path.join(root, dir))) {
    if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(root, dir, file)]);
  }
}
const pkg = require('../package.json');
if (!pkg.files || !pkg.engines?.node || !pkg.repository) throw new Error('Missing release metadata');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
if (!skill.startsWith('---\nname: morelogin-local-api\n')) throw new Error('Invalid skill name');
for (const match of skill.matchAll(/\]\(([^)]+)\)/g)) {
  if (!match[1].startsWith('https:') && !fs.existsSync(path.join(root, match[1]))) throw new Error(`Missing reference ${match[1]}`);
}
for (const file of ['README.md', 'INSTALL.md', 'QUICKSTART.md', 'USAGE.md', 'API-CONTRACT.md', 'SKILL.md']) {
  for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    if (!/^https?:/.test(match[1]) && !fs.existsSync(path.join(root, match[1]))) throw new Error(`Broken link in ${file}: ${match[1]}`);
  }
}
console.log('Syntax, skill links and package metadata validated');
