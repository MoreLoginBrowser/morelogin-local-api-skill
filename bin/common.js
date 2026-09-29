const http = require('http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { context, boolean, guard, timeoutFor } = require('./policy');

const DEFAULT_BASE_URL = process.env.MORELOGIN_LOCAL_API_URL || 'http://127.0.0.1:40000';
const routes = require('./routes.json').map(([method, route]) => ({ method,
  pattern: new RegExp(`^${route.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{id}', '[0-9]+')}$`) }));

function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`Invalid option: ${token}`);
      if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${token}`);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        options[key] = true;
      } else {
        options[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }

  return { options, positional };
}

function parseJsonInput(value, fieldName) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    function check(item) {
      if (typeof item === 'number' && Number.isInteger(item) && !Number.isSafeInteger(item)) {
        throw new Error('Unsafe integer in JSON; encode resource IDs as strings');
      }
      if (item && typeof item === 'object') Object.values(item).forEach(check);
    }
    check(parsed);
    return parsed;
  } catch (error) {
    throw new Error(`${fieldName} must be valid JSON with safe numbers; encode large IDs as strings`);
  }
}

function toBoolean(value, defaultValue = false) {
  return boolean(value, defaultValue);
}

function toInt(value, defaultValue) {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return parsed;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestApi(endpoint, { method = 'POST', body, baseUrl = DEFAULT_BASE_URL, timeoutMs, file, ...explicit } = {}) {
  return new Promise((resolve, reject) => {
    const cliOptions = { ...context.getStore(), ...explicit };
    if (!endpoint.startsWith('/api/') && endpoint !== '/status') throw new Error('Expected a Local API path');
    if (!/^\/(?:status|api\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/.test(endpoint)) throw new Error('Invalid API path: use a canonical documented path');
    const url = new URL(endpoint, baseUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
      throw new Error('Local API requires an HTTP loopback address without credentials');
    }
    if (url.pathname !== endpoint) throw new Error('Invalid API path');
    if (!['GET', 'POST'].includes(method)) throw new Error('Unsupported HTTP method');
    if (!(endpoint === '/status' && method === 'POST') && !routes.some((route) => route.method === method && route.pattern.test(endpoint))) {
      throw new Error('Undocumented method/path; check local-api.yaml and rebuild the route allowlist after a contract update');
    }
    guard(url.pathname, body, cliOptions);
    const configured = cliOptions['timeout-ms'] ?? timeoutMs ?? process.env.MORELOGIN_LOCAL_API_TIMEOUT_MS ?? timeoutFor(endpoint);
    const requestTimeout = parseRequiredInt(configured, 'timeout-ms', { min: 1, max: 3600000 });
    const responseLimit = parseRequiredInt(process.env.MORELOGIN_MAX_RESPONSE_BYTES ?? 33554432, 'MORELOGIN_MAX_RESPONSE_BYTES', { min: 1, max: 536870912 });
    const uploadLimit = parseRequiredInt(process.env.MORELOGIN_MAX_UPLOAD_BYTES ?? 536870912, 'MORELOGIN_MAX_UPLOAD_BYTES', { min: 1, max: 2147483648 });
    let payload = body === undefined ? undefined : JSON.stringify(body);
    if (payload && Buffer.byteLength(payload) > 1048576) throw new Error('JSON request exceeds 1 MiB');
    let contentType = 'application/json';
    let upload, uploadStream;
    if (file) {
      if (endpoint !== '/api/cloudphone/uploadFile' || method !== 'POST') throw new Error('--file is supported only by POST /api/cloudphone/uploadFile');
      requirePlainObject(body, 'upload fields');
      requireNonEmptyString(body.id, 'id');
      const boundary = `morelogin-${require('node:crypto').randomUUID()}`;
      const chunks = [];
      for (const [key, value] of Object.entries(body)) {
        if (!/^[A-Za-z0-9_]+$/.test(key)) throw new Error('Invalid multipart field name');
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
      }
      const filename = path.basename(file).replace(/["\r\n\\]/g, '_');
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error('Upload source must be a regular file');
      if (stat.size > uploadLimit) throw new Error(`Upload exceeds ${uploadLimit} bytes`);
      upload = { prefix: Buffer.concat(chunks), suffix: Buffer.from(`\r\n--${boundary}--\r\n`), size: stat.size };
      payload = undefined;
      contentType = `multipart/form-data; boundary=${boundary}`;
    } else if (endpoint === '/api/cloudphone/uploadFile') {
      throw new Error('uploadFile requires --file <local-path> and --data containing id');
    }

    const options = {
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        'Content-Type': contentType,
      },
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (upload) options.headers['Content-Length'] = upload.prefix.length + upload.size + upload.suffix.length;

    let deadline, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      uploadStream?.destroy();
      if (error) reject(error); else resolve(value);
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > responseLimit) {
          const error = new Error(`Response exceeds ${responseLimit} bytes; outcome unknown, inspect status before retrying`);
          finish(error);
          req.destroy(error);
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'), (key, value, source) => {
            // Preserve int64 response IDs if a server emits numeric tokens.
            if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
              if (!source?.source) throw new Error('Lossless integer parsing requires a supported Node.js version');
              return source.source;
            }
            return value;
          });
        } catch (error) {
          finish(new Error(`Invalid JSON response (HTTP ${res.statusCode})`));
          return;
        }

        finish(null, {
          statusCode: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          body: parsed,
        });
      });
      res.on('aborted', () => finish(new Error('Response interrupted; outcome unknown, inspect status before retrying')));
      res.on('error', (error) => finish(error));
    });

    deadline = setTimeout(() => {
      const error = new Error(`Request timeout after ${requestTimeout}ms; outcome unknown, inspect status before retrying`);
      finish(error);
      req.destroy(error);
    }, requestTimeout);
    req.on('error', (error) => finish(error));

    if (upload) {
      // Backpressure bounds memory. A changing file must not silently alter the request.
      uploadStream = fs.createReadStream(file);
      const parts = async function* () {
        yield upload.prefix;
        let size = 0;
        for await (const chunk of uploadStream) {
          size += chunk.length;
          if (size > upload.size) throw new Error('Upload source changed during read; outcome unknown');
          yield chunk;
        }
        if (size !== upload.size) throw new Error('Upload source changed during read; outcome unknown');
        yield upload.suffix;
      };
      pipeline(Readable.from(parts()), req).catch((error) => finish(error));
    } else {
      req.end(payload);
    }
  });
}

function unwrapApiResult(response, { endpoint } = {}) {
  const payload = response.body;
  if (!response.ok) {
    return {
      success: false,
      message: `HTTP ${response.statusCode}${payload?.code !== undefined ? `; code=${payload.code}` : ''}${payload?.requestId ? `; requestId=${payload.requestId}` : ''}`,
      payload,
    };
  }

  // Desktop health check is intentionally not a business API envelope.
  if (endpoint === '/status' && payload?.status === 'ok') {
    return { success: true, payload, data: payload };
  }

  if (payload && typeof payload.code === 'number') {
    return {
      success: payload.code === 0,
      message: `code=${payload.code}; requestId=${payload.requestId || 'unavailable'}`,
      payload,
      data: payload.data,
    };
  }

  return {
    success: false,
    message: 'Invalid API envelope: numeric code is required',
    payload,
    data: payload?.data,
  };
}

const SENSITIVE_KEYS = new Set([
  'password',
  'adbPassword',
  'phoneNumber',
  'imei',
  'proxyInfo',
  'cdpUrl',
  'accessUrl',
  'presignedUrl',
  'captureBase64',
  'captureUrl', 'url', 'downUrl', 'signedUrl', 'otpSecret', 'encryptKey',
  'cookies', 'cookie', 'username', 'androidId', 'token', 'accessToken',
  'refreshToken', 'apiKey', 'secret', 'authorization', 'gaid', 'wifiBssid', 'bluetoothMac', 'imsi', 'macAddress',
]);

function redactSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const redacted = {};
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = ([...SENSITIVE_KEYS].some((s) => s.toLowerCase() === key.toLowerCase()) || /password|secret|token/i.test(key)) && child !== null && child !== undefined
      ? '[REDACTED]'
      : redactSensitive(child);
  }
  return redacted;
}

function printObject(value, { redact = !boolean(context.getStore()?.['raw-output'], false) } = {}) {
  console.log(JSON.stringify(redact ? redactSensitive(value) : value, null, 2));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requirePlainObject(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value;
}

function requireNonEmptyString(value, fieldName) {
  if (value === undefined || value === null || typeof value === 'boolean' || typeof value === 'object') {
    throw new Error(`${fieldName} is required`);
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`${fieldName} must use a string for large IDs`);
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function parseRequiredInt(value, fieldName, { min, max } = {}) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  const intValue = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(intValue)) throw new Error(`${fieldName} exceeds safe integer range; keep resource IDs as strings`);
  if (min !== undefined && intValue < min) {
    throw new Error(`${fieldName} must be >= ${min}`);
  }
  if (max !== undefined && intValue > max) {
    throw new Error(`${fieldName} must be <= ${max}`);
  }
  return intValue;
}

function parseOptionalInt(value, fieldName, { min, max } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return parseRequiredInt(value, fieldName, { min, max });
}

function requireNonEmptyArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }
  return value;
}

function normalizeStringArray(value, fieldName) {
  const arr = requireNonEmptyArray(value, fieldName);
  const normalized = arr.map((item) => requireNonEmptyString(item, fieldName));
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must include at least one non-empty item`);
  }
  return normalized;
}

function parsePageOptions(options, { defaultPageNo = 1, defaultPageSize = 20, maxPageSize = 200 } = {}) {
  const pageNo = options.page !== undefined
    ? parseRequiredInt(options.page, '--page', { min: 1 })
    : defaultPageNo;
  const pageSize = options['page-size'] !== undefined
    ? parseRequiredInt(options['page-size'], '--page-size', { min: 1, max: maxPageSize })
    : defaultPageSize;
  return { pageNo, pageSize };
}

module.exports = {
  DEFAULT_BASE_URL,
  isPlainObject,
  parseArgs,
  parseOptionalInt,
  parsePageOptions,
  parseRequiredInt,
  parseJsonInput,
  printObject,
  redactSensitive,
  normalizeStringArray,
  requireNonEmptyArray,
  requireNonEmptyString,
  requirePlainObject,
  requestApi,
  splitCsv,
  toBoolean,
  toInt,
  unwrapApiResult,
};
