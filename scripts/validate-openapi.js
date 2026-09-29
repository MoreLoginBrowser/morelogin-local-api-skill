const { execFileSync } = require('node:child_process');
const { merge } = require('./sync-openapi');
const { combined: spec } = merge();
let operations = 0, refs = 0;
const ids = new Set();
for (const operationsByMethod of Object.values(spec.paths)) {
  for (const method of ['get', 'post']) {
    const op = operationsByMethod[method];
    if (!op) continue;
    operations++;
    if (!op.responses) throw new Error('Missing responses');
    if (op.operationId && ids.has(op.operationId)) throw new Error(`Duplicate operationId ${op.operationId}`);
    ids.add(op.operationId);
  }
}
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    refs++;
    if (!value.$ref.startsWith('#/')) throw new Error(`External ref: ${value.$ref}`);
    let target = spec;
    for (const key of value.$ref.slice(2).split('/')) target = target?.[key.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (!target) throw new Error(`Missing ref: ${value.$ref}`);
  }
  Object.values(value).forEach(walk);
}
walk(spec);
if (operations !== 113) throw new Error(`Expected 113 operations, got ${operations}; review upstream changes`);
execFileSync(process.execPath, [require.resolve('./sync-openapi'), '--check'], { stdio: 'inherit' });
console.log(`${operations} operations; ${refs} internal references resolved`);
