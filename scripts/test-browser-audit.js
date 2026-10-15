const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Tushar Pandey\\.gemini\\antigravity-ide\\brain\\a20d3b86-f180-40e9-a8bf-e26c316544cd';

async function run() {
  console.log('Starting Puppeteer browser session...');
  
  // Try launching Puppeteer with headless or system chrome
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (err) {
    console.log('Standard launch failed, trying with system Chrome/Edge...', err.message);
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    let execPath = possiblePaths.find(p => fs.existsSync(p));
    if (!execPath) {
      throw new Error('No browser executable found: ' + err.message);
    }
    console.log('Using executable:', execPath);
    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:3000/audits/new ...');
  await page.goto('http://localhost:3000/audits/new', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Filling form with https://www.resultfirst.com/ ...');
  
  // Find textarea or input for URLs
  const textareaSelector = 'textarea';
  await page.waitForSelector(textareaSelector);
  await page.type(textareaSelector, 'https://www.resultfirst.com/\n');

  // Take screenshot of new audit page
  const screenshot1 = path.join(ARTIFACT_DIR, '01_audit_form.png');
  await page.screenshot({ path: screenshot1 });
  console.log('Captured form screenshot:', screenshot1);

  // Submit the form
  console.log('Clicking Start Audit button...');
  const submitButtonSelector = 'button[type="submit"]';
  await page.waitForSelector(submitButtonSelector);
  await page.click(submitButtonSelector);

  console.log('Waiting for navigation to progress or audit report...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  const currentUrl = page.url();
  console.log('Current URL after submit:', currentUrl);

  const screenshotProgress = path.join(ARTIFACT_DIR, '02_audit_progress.png');
  await page.screenshot({ path: screenshotProgress });

  // If on progress page, wait for completion / redirection
  if (currentUrl.includes('/progress')) {
    console.log('Monitoring progress page until audit completes...');
    // Poll or wait for navigation to the report page (or for progress to reach 100%)
    let maxWait = 180; // up to 3 minutes
    let completed = false;
    for (let i = 0; i < maxWait; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const url = page.url();
      if (!url.includes('/progress') && url.includes('/audits/')) {
        console.log('Audit completed! Redirected to report page:', url);
        completed = true;
        break;
      }
      // Check text content on progress page
      const statusText = await page.evaluate(() => {
        const h = document.querySelector('h1, h2, h3, p');
        return document.body.innerText.slice(0, 300);
      });
      if (i % 5 === 0) {
        console.log(`[${i * 2}s] Progress status snapshot:`, statusText.replace(/\n+/g, ' | ').slice(0, 150));
      }
    }
  }

  // Allow report page to settle
  await new Promise(r => setTimeout(r, 4000));
  const finalUrl = page.url();
  console.log('Final Page URL:', finalUrl);

  // Take full page screenshot of the audit report
  const screenshotReport = path.join(ARTIFACT_DIR, '03_audit_report.png');
  await page.screenshot({ path: screenshotReport, fullPage: true });
  console.log('Captured full report screenshot:', screenshotReport);

  // Extract report data from DOM
  const pageData = await page.evaluate(() => {
    return {
      title: document.title,
      heading: document.querySelector('h1')?.innerText,
      bodyText: document.body.innerText
    };
  });

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'report_summary.json'), JSON.stringify(pageData, null, 2));
  console.log('Saved report summary JSON');

  await browser.close();
  console.log('Browser session closed successfully.');
}

run().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
