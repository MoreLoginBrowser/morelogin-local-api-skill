const http = require('node:http');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
async function runSmoke(cli) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    calls.push({ path: req.url, body: chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined });
    const data = req.url === '/api/env/page' ? { total: '1', current: '1', pages: '1', dataList: [{ id: '123', envName: '中文环境😀' }] } : undefined;
    res.end(JSON.stringify({ code: 0, msg: null, requestId: 'package-mock', data }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const invoke = (args) => new Promise((resolve) => execFile(process.execPath, [cli, ...args], {
    env: { ...process.env, MORELOGIN_LOCAL_API_URL: `http://127.0.0.1:${server.address().port}` }, timeout: 5000,
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
  try {
    const listed = await invoke(['browser', 'list']);
    assert.equal(listed.code, 0, listed.stderr);
    assert.equal(JSON.parse(listed.stdout).dataList[0].envName, '中文环境😀');
    const started = await invoke(['cloudphone', 'start', '--id', '123', '--headless', 'false']);
    assert.equal(started.code, 0, started.stderr);
    assert.match(started.stdout, /accepted/);
    assert.deepEqual(calls.at(-1).body, { id: '123', headless: false });
    const count = calls.length;
    const blocked = await invoke(['api', '--endpoint', '/api/cloudphone/monthly/activate', '--data', '{"ids":["123"]}']);
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /confirm-charge/);
    assert.equal(calls.length, count);
    return ['installed browser list with Unicode', 'installed startup mapping and accepted state', 'installed generic charge guard'];
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
module.exports = { runSmoke };
