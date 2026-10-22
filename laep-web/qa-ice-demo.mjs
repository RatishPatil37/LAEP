import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(process.env.LAEP_PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const output = process.env.LAEP_QA_OUTPUT || './qa-ice-output';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.LAEP_BROWSER_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const tileResponses = [];
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', r => { if (r.url().includes('/nasa-tiles/')) tileResponses.push({status:r.status(), url:r.url()}); });
page.on('pageerror', e => errors.push(e.message));
const start = performance.now();
try {
  await page.goto('http://127.0.0.1:5173/ice-demo');
  await page.getByText('scored samples', { exact: true }).waitFor();
  const readyMs = Math.round(performance.now() - start);
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Fit scored samples' }).click();
  const product = await page.evaluate(async () => (await fetch('/demo/predictions.json')).json());
  const sample = product.samples.find(s => s.score !== null);
  await page.getByPlaceholder('Sample ID').fill(sample.id);
  await page.getByRole('button', { name: `Inspect ${sample.id}`, exact: true }).click();
  await page.locator('.ice-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const box = await page.locator('.ice-map').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.ice-map-hover').waitFor();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.ice-inspector h3').waitFor();
  await page.waitForTimeout(500);
  await page.locator('.ice-inspector h3').waitFor();
  await page.getByRole('button', { name: 'Fit scored samples' }).click();
  try {
    await page.waitForFunction(() => document.querySelector('.ice-map-status')?.textContent === 'NASA Moon Trek · LRO WAC', null, { timeout: 30000 });
  } catch (error) {
    console.log('BASEMAP FAILURE:', await page.locator('.ice-map-status').innerText());
    console.log(JSON.stringify({tileResponses:tileResponses.slice(0,12), consoleErrors, errors}));
    throw error;
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/desktop.png` });
  const normalConsoleErrors = consoleErrors.slice();
  const performanceStats = await page.evaluate(async () => {
    const frames = [];
    await new Promise(resolve => {
      let previous;
      const frame = time => {
        if (previous !== undefined) frames.push(time - previous);
        previous = time;
        if (frames.length === 60) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return { meanIdleFrameMs: frames.reduce((a,b) => a+b,0)/frames.length,
      predictionBytes: Math.max(...performance.getEntriesByType('resource').filter(r => r.name.includes('/demo/predictions.json')).map(r => r.decodedBodySize), 0) };
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Fit scored samples' }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  await page.getByRole('checkbox').uncheck();
  await page.getByPlaceholder('Sample ID').fill('not-a-sample');
  await page.getByText('No matching samples.').waitFor();
  await page.route('**/demo/predictions.json', route => route.fulfill({ status: 503, body: '{}' }));
  await page.reload();
  await page.getByRole('alert').waitFor();
  await page.unroute('**/demo/predictions.json');
  await page.getByRole('button', { name: 'Retry product' }).click();
  await page.getByText('scored samples', { exact: true }).waitFor();
  await page.route('**/nasa-tiles/**', route => route.fulfill({ status: 503, body: 'Deliberate QA outage' }));
  await page.reload();
  await page.getByRole('button', { name: 'Retry basemap' }).waitFor();
  await page.unroute('**/nasa-tiles/**');
  await page.getByRole('button', { name: 'Retry basemap' }).click();
  await page.waitForFunction(() => document.querySelector('.ice-map-status')?.textContent === 'NASA Moon Trek · LRO WAC', null, { timeout: 30000 });
  const nasaXmlChecks = await page.evaluate(async () => {
    const { parseNasaCapabilities } = await import('/src/lib/nasaWmts.js');
    const xml = '<Capabilities xmlns="http://www.opengis.net/wmts/1.0"><Contents><TileMatrixSet><TileMatrix><MatrixWidth>2.5</MatrixWidth></TileMatrix></TileMatrixSet></Contents></Capabilities>';
    try { parseNasaCapabilities(xml); return false; } catch { return true; }
  });
  assert.equal(nasaXmlChecks, true, 'Fractional tile dimensions must be rejected, never rounded');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ passed: true, readyMs, counts: product.counts, runtimeErrors: errors,
    normalConsoleErrors, performanceStats, successfulNasaTiles: tileResponses.filter(r => r.status === 200 && !r.url.endsWith('.xml')).length,
    basemap: await page.locator('.ice-map-status').innerText(), screenshots: output }));
} finally { await browser.close(); }
