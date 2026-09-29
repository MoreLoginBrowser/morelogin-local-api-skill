const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { operations } = require('./contract-fixtures');
const confirmations = require('./expected-confirmations');
let server, baseUrl, expected, mode, seen, assertionError, temp;
const root = path.resolve(__dirname, '..');

function cli(args) {
  return new Promise((resolve) => execFile(process.execPath, [path.join(root, 'bin/morelogin.js'), ...args], {
    cwd: root, env: { ...process.env, MORELOGIN_LOCAL_API_URL: baseUrl }, timeout: 15000,
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}
before(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'morelogin-fixture-'));
  fs.writeFileSync(path.join(temp, 'sample.bin'), Buffer.from([0, 1, 2, 255]));
  server = http.createServer(async (req, res) => {
    seen++;
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const bytes = Buffer.concat(chunks);
    try {
      assert.equal(req.method, expected.method);
      assert.equal(req.url, expected.endpoint);
      if (expected.multipart) {
        assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
        assert.ok(bytes.includes(Buffer.from([0, 1, 2, 255])));
        assert.ok(bytes.includes(Buffer.from('name="file"; filename="sample.bin"')));
        assert.ok(bytes.includes(Buffer.from('1993244721490239488')));
      } else {
        const actual = bytes.length ? JSON.parse(bytes.toString()) : undefined;
        assert.deepEqual(actual, expected.body);
        assert.ok(expected.validate(actual), JSON.stringify(expected.validate.errors));
      }
    } catch (e) { assertionError = e; }
    if (mode === 'http') res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ code: mode === 'business' ? 33301 : 0, requestId: 'mock-test',
      data: { observed: req.url, password: 'PRIVATE-FIXTURE', otpSecret: 'OTP-FIXTURE',
        nested: { cdpUrl: 'https://example.com/PRIVATE-CDP' } } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (temp) fs.rmSync(temp, { recursive: true });
});

assert.equal(operations.length, 113);
for (const operation of operations) {
  test(`${operation.method} ${operation.route}: generic transport`, async (t) => {
    expected = operation;
    if (operation.schema) assert.ok(operation.validate(operation.body), JSON.stringify(operation.validate.errors));
    const args = ['api', '--endpoint', operation.endpoint, '--method', operation.method];
    if (operation.body !== undefined) {
      const body = { ...operation.body };
      if (operation.multipart) delete body.file;
      args.push('--data', JSON.stringify(operation.multipart ? body : operation.body));
    }
    if (operation.multipart) args.push('--file', path.join(temp, 'sample.bin'));
    const flag = confirmations[operation.route];
    if (flag) args.push(`--${flag}`, 'true');
    for (const responseMode of ['success', 'business', 'http']) {
      await t.test(`transport ${operation.method} ${operation.route} :: ${responseMode}`, async () => {
      mode = responseMode; seen = 0; assertionError = undefined;
      const result = await cli(args);
      assert.equal(result.code, mode === 'success' ? 0 : 1, result.stderr);
      assert.equal(seen, 1, result.stderr);
      assert.ifError(assertionError);
      assert.ok(!result.stdout.includes('PRIVATE-FIXTURE'));
      assert.ok(!result.stdout.includes('OTP-FIXTURE'));
      assert.ok(!result.stdout.includes('PRIVATE-CDP'));
      const output = JSON.parse(result.stdout);
      assert.equal(output.code, mode === 'business' ? 33301 : 0);
      assert.equal(output.data.observed, operation.endpoint);
      });
    }
    if (flag) {
      await t.test(`transport ${operation.method} ${operation.route} :: confirmation`, async () => {
      seen = 0;
      const result = await cli(args.slice(0, -2));
      assert.equal(result.code, 1);
      assert.match(result.stderr, new RegExp(flag));
      assert.equal(seen, 0, 'Blocked operation must not reach server');
      });
    }
  });
}
