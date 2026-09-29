const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const root = path.resolve(__dirname, '..');
const sources = {
  browser: 'https://guide.morelogin.com/_bundle/API Reference/Browser/local-api.yaml',
  cloudphone: 'https://guide.morelogin.com/_bundle/API Reference/Cloud Phone/local-api.yaml',
  shared: 'https://guide.morelogin.com/_bundle/API Reference/Shared Resources/shared-api.yaml',
  cloudstorage: 'https://guide.morelogin.com/_bundle/API Reference/Cloud Storage/local-api.yaml',
};

function merge() {
  const combined = { openapi: '3.1.0', info: { title: 'MoreLogin Local API (Combined)', version: '2026-09-05' },
    servers: [{ url: 'http://127.0.0.1:40000' }], paths: {}, components: {}, 'x-source-specs': Object.values(sources) };
  const provenance = [];
  for (const [name, url] of Object.entries(sources)) {
    const file = path.join(root, 'specs', `${name}.yaml`);
    const text = fs.readFileSync(file, 'utf8');
    const spec = YAML.parse(text);
    function namespace(value) {
      if (Array.isArray(value)) return value.map(namespace);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
        key === '$ref' && item.startsWith('#/components/')
          ? item.replace(/^(#\/components\/[^/]+\/)/, `$1${name}_`) : namespace(item)]));
    }
    const namespaced = namespace(spec);
    for (const [route, operation] of Object.entries(namespaced.paths)) {
      if (combined.paths[route]) throw new Error(`Duplicate route: ${route}`);
      combined.paths[route] = operation;
    }
    for (const [kind, definitions] of Object.entries(namespaced.components || {})) {
      combined.components[kind] ||= {};
      for (const [key, value] of Object.entries(definitions)) combined.components[kind][`${name}_${key}`] = value;
    }
    provenance.push({ name, url, file: `specs/${name}.yaml`, version: spec.info.version,
      sha256: crypto.createHash('sha256').update(text).digest('hex') });
  }
  return { combined, provenance };
}

async function main() {
  if (process.argv.includes('--fetch')) {
    const downloads = [];
    for (const [name, url] of Object.entries(sources)) {
      const response = await fetch(encodeURI(url), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      const text = await response.text();
      if (!YAML.parse(text)?.paths) throw new Error(`${name}: not an OpenAPI document`);
      downloads.push([name, text]);
    }
    for (const [name, text] of downloads) fs.writeFileSync(path.join(root, 'specs', `${name}.yaml`), text);
  }
  const { combined, provenance } = merge();
  const output = YAML.stringify(combined, { lineWidth: 120 });
  const manifest = JSON.stringify(provenance, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(path.join(root, 'local-api.yaml'), 'utf8') !== output ||
        fs.readFileSync(path.join(root, 'specs/sources.json'), 'utf8') !== manifest) throw new Error('Generated specification is stale; run npm run sync:openapi');
  } else {
    fs.writeFileSync(path.join(root, 'local-api.yaml'), output);
    fs.writeFileSync(path.join(root, 'specs/sources.json'), manifest);
    require('node:child_process').execFileSync(process.execPath, [path.join(root, 'scripts/build-routes.js')]);
  }
  console.log(`OpenAPI: ${Object.keys(combined.paths).length} paths, source hashes verified`);
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { merge };
