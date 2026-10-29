const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'images');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  const pages = [
    { url: 'http://localhost:3000/dashboard', name: 'dashboard-real.png', wait: 2500 },
    { url: 'http://localhost:3000/dashboard/profile', name: 'profile-real.png', wait: 2500 },
    { url: 'http://localhost:3000/dashboard/excel-automation', name: 'excel-automation-real.png', wait: 2500 },
    { url: 'http://localhost:3000/dashboard/data-extractor', name: 'data-extractor-real.png', wait: 2500 },
    { url: 'http://localhost:3000/dashboard/studio', name: 'studio-real.png', wait: 2500 }
  ];

  for (const item of pages) {
    console.log(`Navigating to ${item.url}...`);
    try {
      await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, item.wait));
      const targetPath = path.join(OUT_DIR, item.name);
      await page.screenshot({ path: targetPath, fullPage: false });
      console.log(`Captured: ${targetPath}`);
    } catch (err) {
      console.error(`Failed ${item.url}:`, err.message);
    }
  }

  // Also capture profile with Projects tab clicked
  try {
    console.log('Navigating to profile for projects tab...');
    await page.goto('http://localhost:3000/dashboard/profile', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    // Click on the projects tab button if available
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await (await btn.getProperty('textContent')).jsonValue();
      if (text && text.toLowerCase().includes('projects')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 1000));
        break;
      }
    }
    const projectsPath = path.join(OUT_DIR, 'profile-projects-real.png');
    await page.screenshot({ path: projectsPath, fullPage: false });
    console.log(`Captured: ${projectsPath}`);
  } catch (err) {
    console.error('Failed to capture profile projects:', err.message);
  }

  await browser.close();
  console.log('Screenshot capture finished successfully!');
}

capture().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
