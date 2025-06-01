// @ts-nocheck
import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { getLatestIssueId, setLatestIssueId } from './store';

async function setup(url: string) {
  const browser = await puppeteer.launch({
    // headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1600, height: 1500 },
  });
  const page = (await browser.newPage()) as Page;
  const downloadPath = path.resolve(__dirname, '../downloads');
  await fs.promises.mkdir(downloadPath, { recursive: true });
  // Use the official Puppeteer API for downloads
  // @ts-ignore
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath,
  });
  await page.goto(url, { waitUntil: 'networkidle2' });

  return { page, browser, downloadPath };
}

export async function downloadMagazineFromPressReader(
  name: string,
  type: string,
): Promise<string | null> {
  const url = 'https://www.pressreader.com/signin';
  const { page, browser, downloadPath } = await setup(url);

  // Wait for the page to load and display the login form
  await page.waitForSelector('input[type="email"]', { visible: true });
  // Fill in the email and password fields
  console.log('Logging in to PressReader...');
  await page.type('input[type="email"]', process.env.PRESSREADER_USERNAME || '', { delay: 50 });
  await page.type('input[type="password"]', process.env.PRESSREADER_PASSWORD || '', { delay: 50 });
  // submit the form
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  let alertCloseButton = await page.$('.alert-close');
  if (alertCloseButton) {
    await alertCloseButton.click();
  }
  // https://www.pressreader.com/catalog/mypublications

  const urlPath = type === 'magazine' ? 'magazines/m' : 'newspapers/n';
  const publicationPage = `https://pressreader.com/${urlPath}/${name}`;
  // https://pressreader.com/magazines/m/the-economist-uk

  await page.goto(publicationPage, { waitUntil: 'networkidle2' });

  alertCloseButton = await page.$('.alert-close');
  if (alertCloseButton) {
    await alertCloseButton.click();
  }
  console.log(`Navigated to publication page: ${publicationPage}`);

  await page.goto(publicationPage, { waitUntil: 'networkidle2' });
  alertCloseButton = await page.$('.alert-close');
  if (alertCloseButton) {
    await alertCloseButton.click();
  }
  // take screenshot of the page
  const file = path.join(downloadPath, `screenshot.png`);
  await page.screenshot({ path: file });
  await browser.close();
  return file;
  // ignore unreachable code below this point

  // click link with data-testid "readNowButton"
  await page.waitForSelector('a[data-testid="readNowButton"]', { visible: true });
  const readNowButton = await page.$('a[data-testid="readNowButton"]');
  if (!readNowButton) {
    console.error('Read Now button not found');
    await browser.close();
    return null;
  }
  console.log('Clicking Read Now button...');
  await readNowButton.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.waitForSelector('.navmenu-header-meta', { visible: true });

  // get text content from '.navmenu-header-meta'
  const issueText = await page.$eval('.navmenu-header-meta', (el) => el.textContent?.trim());
  const issueDate = issueText?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

  const latestIssueId = await getLatestIssueId(name);
  if (latestIssueId && latestIssueId === issueDate) {
    console.log('Latest issue already downloaded:', issueDate);
    await browser.close();
    return null;
  }
  await page.waitForSelector('.btn-options', { visible: true });

  // click .btn-options
  const optionsButton = await page.$('.btn-options');
  if (!optionsButton) {
    console.error('Options button not found');
    await browser.close();
    return null;
  }
  console.log('Clicking Options button...');
  await optionsButton.click();
  await page.waitForSelector('.pri-exportereader', { visible: true });
  // click .pri-exportereader
  const exportReaderButton = await page.$('.pri-exportereader');
  if (!exportReaderButton) {
    console.error('Export Reader button not found');
    await browser.close();
    return null;
  }
  console.log('Clicking Export Reader button...');
  await exportReaderButton.click();
  await page.waitForSelector('.scroller-wrapper.pop-list', { visible: true });

  // scroll to the bottom of the pop-up
  await page.evaluate(() => {
    const popList = document.querySelector('.pop-list');
    if (popList) {
      popList.scrollTop = popList.scrollHeight;
    }
  });
  // get all label elements inside .pop-list
  const labelHandles = await page.$$('.pop .pop-list label');

  let downloadLinkHandle: any = null;
  for (const handle of labelHandles) {
    const text = await page.evaluate((el) => el.textContent?.trim(), handle);
    if (text === 'Kobo') {
      downloadLinkHandle = handle;
      break;
    }
  }
  if (!downloadLinkHandle) {
    console.error('Download link not found');
    await browser.close();
    return null;
  }
  // click the label to trigger the download
  await downloadLinkHandle.click();

  const doneButton = await page.$('.toolbar-button.b-action');
  if (!doneButton) {
    console.error('Done button not found');
    await browser.close();
    return null;
  }
  // click the done button to close the pop-up
  await doneButton.click();

  // Wait for an epub file to appear in the downloads directory
  let epubFilePath: string | null = null;
  let waited = 0;
  while (waited < 30000) {
    const files = await fs.promises.readdir(downloadPath);
    const epubFile = files.find((f) => f.endsWith('.epub'));
    if (epubFile) {
      epubFilePath = path.join(downloadPath, epubFile);
      break;
    }
    await new Promise((res) => setTimeout(res, 500));
    waited += 500;
  }

  await browser.close();
  if (!epubFilePath || !fs.existsSync(epubFilePath)) {
    console.error('EPUB download failed');
    return null;
  }
  await setLatestIssueId(name, issueDate);
  // Optionally: await setLatestIssueId(name, issueNumber); // if you have issueNumber
  return epubFilePath;
}

export async function downloadMagazineFromRaspberryPi(name: string): Promise<string | null> {
  const url = 'https://magazine.raspberrypi.com';

  const { page, browser, downloadPath } = await setup(url);

  const linkHandles = await page.$$('a');

  let downloadLinkHandle: any = null;
  for (const handle of linkHandles) {
    const text = await page.evaluate((el) => el.textContent?.trim(), handle);
    if (text === 'Get PDF') {
      downloadLinkHandle = handle;
      break;
    }
  }
  if (!downloadLinkHandle) {
    console.error('Download link not found');
    await browser.close();
    return null;
  }

  const href = await page.evaluate((el) => (el as HTMLAnchorElement).href, downloadLinkHandle);

  const issueNumber = href.match(/\/issues\/(\d+)\//)?.[1];

  if (!issueNumber) {
    console.error('Issue number not found in URL');
    await browser.close();
    return null;
  }
  const latestIssueId = await getLatestIssueId(name);
  if (latestIssueId && latestIssueId === issueNumber) {
    console.log('Latest issue already downloaded:', issueNumber);
    await browser.close();
    return null;
  }

  await page.goto(`${url}/issues/${issueNumber}/pdf/download`, { waitUntil: 'networkidle2' });

  const filePath = path.join(downloadPath, `RPOM-${issueNumber}.pdf`);

  // // Wait for file to appear
  let waited = 0;
  while (!fs.existsSync(filePath) && waited < 30000) {
    await new Promise((res) => setTimeout(res, 500));
    waited += 500;
  }

  await browser.close();
  if (!fs.existsSync(filePath)) {
    console.error('Download failed');
    return null;
  }
  await setLatestIssueId(name, issueNumber);

  return filePath;
}
