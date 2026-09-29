const puppeteer = require('puppeteer-core');

const CDP_URL = process.env.CDP_URL;
if (!CDP_URL) throw new Error('Set CDP_URL to the actual running profile debug URL');
const FORM_URL = process.env.FORM_URL || 'https://example.com/login';

async function main() {
  const browser = await puppeteer.connect({
    browserURL: CDP_URL,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.goto(FORM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Demo selectors only; replace with real selectors on your target page.
    await page.type('#username', 'myuser').catch(() => {});
    await page.type('#password', 'mypassword').catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

    const isLoggedIn = await page.$('.user-profile');
    console.log('Login successful:', Boolean(isLoggedIn));
  } finally {
    await browser.disconnect();
  }
}

main().catch((error) => {
  console.error(`form-example failed: ${error.message}`);
  process.exit(1);
});
