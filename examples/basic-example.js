const puppeteer = require('puppeteer-core');

const CDP_URL = process.env.CDP_URL;
if (!CDP_URL) throw new Error('Set CDP_URL to the actual running profile debug URL');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: CDP_URL,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.screenshot({ path: 'basic-example.png', fullPage: true });
    console.log('Title:', await page.title());
  } finally {
    await browser.disconnect();
  }
}

main().catch((error) => {
  console.error(`basic-example failed: ${error.message}`);
  process.exit(1);
});
