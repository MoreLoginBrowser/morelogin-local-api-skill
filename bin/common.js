const http = require('http');

const DEFAULT_BASE_URL = process.env.MORELOGIN_LOCAL_API_URL || 'http://127.0.0.1:40000';

function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
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
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${fieldName} is not valid JSON: ${error.message}`);
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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

function requestApi(endpoint, { method = 'POST', body, baseUrl = DEFAULT_BASE_URL, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const payload = body === undefined ? undefined : JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          parsed = { raw: data };
        }

        resolve({
          statusCode: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          body: parsed,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function unwrapApiResult(response) {
  const payload = response.body;
  if (!response.ok) {
    return {
      success: false,
      message: `HTTP ${response.statusCode}`,
      payload,
    };
  }

  if (payload && typeof payload.code === 'number') {
    return {
      success: payload.code === 0,
      message: payload.msg || '',
      payload,
      data: payload.data,
    };
  }

  return {
    success: true,
    payload,
    data: payload.data || payload,
  };
}

function printObject(value) {
  console.log(JSON.stringify(value, null, 2));
}

module.exports = {
  DEFAULT_BASE_URL,
  parseArgs,
  parseJsonInput,
  printObject,
  requestApi,
  splitCsv,
  toBoolean,
  toInt,
  unwrapApiResult,
};
