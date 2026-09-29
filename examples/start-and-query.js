// Explicitly starts the caller-selected profile, opens a demo page, then disconnects.
const puppeteer = require('puppeteer-core');
const { requestApi, unwrapApiResult, requireNonEmptyString } = require('../bin/common');
async function main() {
  const envId = requireNonEmptyString(process.argv[2], 'envId command-line argument');
  const result = unwrapApiResult(await requestApi('/api/env/start', { body: { envId } }));
  if (!result.success) throw new Error(result.message);
  const port = result.data?.debugPort || result.data?.port;
  if (!port) throw new Error('No debug port returned; inspect status before retrying startup');
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  try {
    const page = await browser.newPage();
    try {
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(await page.title());
    } finally { await page.close(); }
  } finally { await browser.disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
