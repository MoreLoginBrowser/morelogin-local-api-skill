const YAML = require('yaml');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv/dist/2020');
const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../local-api.yaml'), 'utf8'));
// Upstream plain YAML contains double-escaped digit expressions. Only the test
// validator repairs those expressions; source snapshots remain byte-for-byte.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k,
    k === 'pattern' ? v.replace(/\\\\d/g, '\\d') : normalize(v)]));
}
const normalized = normalize(spec);
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
function resolve(schema) {
  if (!schema?.$ref) return schema || {};
  return schema.$ref.slice(2).split('/').reduce((o, k) => o[k], normalized);
}
function validator(schema) {
  return ajv.compile({ ...schema, components: normalized.components });
}
function fixture(input, depth = 0) {
  if (depth > 30) throw new Error('Recursive fixture');
  const schema = resolve(input);
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum.find((v) => v !== null) ?? null;
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  if (schema.allOf) {
    const parts = schema.allOf.map(resolve);
    return fixture({ type: 'object', properties: Object.assign({}, ...parts.map((s) => s.properties || {})),
      required: [...new Set(parts.flatMap((s) => s.required || []))] }, depth + 1);
  }
  if (schema.oneOf || schema.anyOf) return fixture((schema.oneOf || schema.anyOf)[0], depth + 1);
  if (type === 'object' || schema.properties) {
    return Object.fromEntries((schema.required || []).map((key) => [key, fixture(schema.properties?.[key] || {}, depth + 1)]));
  }
  if (type === 'array') return Array.from({ length: schema.minItems ?? 1 }, (_, i) => fixture(schema.prefixItems?.[i] || schema.items || {}, depth + 1));
  if (type === 'integer' || type === 'number') return schema.minimum ?? 1;
  if (type === 'boolean') return true;
  if (type === 'null') return null;
  if (schema.pattern) {
    if (schema.pattern.includes('{4}')) return '2026-09-29 12:00:00';
    if (schema.pattern.includes('d') || schema.pattern.includes('[0-9]')) return '12345';
  }
  if (schema.example !== undefined && typeof schema.example === 'string') return schema.example;
  if (schema.format === 'uri') return 'https://example.com/test';
  return 'x'.repeat(Math.max(1, schema.minLength || 1));
}
const operations = [];
for (const [route, methods] of Object.entries(normalized.paths)) {
  for (const method of ['get', 'post']) {
    const operation = methods[method];
    if (!operation) continue;
    const content = operation.requestBody?.content || {};
    const multipart = !!content['multipart/form-data'];
    const schema = content['application/json']?.schema || content['multipart/form-data']?.schema;
    let body = schema ? fixture(schema) : undefined;
    if (multipart) body = { ...body, id: '1993244721490239488', file: 'mock binary bytes' };
    operations.push({ route, endpoint: route.replace('{id}', '12345'), method: method.toUpperCase(), schema,
      validate: schema ? validator(schema) : () => true, body, multipart });
  }
}
module.exports = { operations, spec, fixture, validator };
