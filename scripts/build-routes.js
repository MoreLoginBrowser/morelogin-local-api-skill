// Generated allowlist is packaged; YAML and its parser remain development-only.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const root = path.resolve(__dirname, '..');
const spec = YAML.parse(fs.readFileSync(path.join(root, 'local-api.yaml'), 'utf8'));
const routes = Object.entries(spec.paths).flatMap(([route, methods]) =>
  ['get', 'post'].filter((method) => methods[method]).map((method) => [method.toUpperCase(), route]));
const text = JSON.stringify(routes, null, 2) + '\n';
const file = path.join(root, 'bin/routes.json');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) throw new Error('Stale route allowlist: run node scripts/build-routes.js');
} else fs.writeFileSync(file, text);
