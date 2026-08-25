import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });

await page.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.toolbar');

const checks = [];
const check = (name, ok, detail='') => checks.push({ name, ok, detail });

check('canvas receives pointer down', await page.evaluate(async () => {
  const store = window.__scene;
  const before = store.visibleElements.length;
  const canvas = document.querySelector('.canvas-container canvas');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: rect.left + 100, clientY: rect.top + 100, pointerId: 1, button: 0, isPrimary: true,
  }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
  return store.visibleElements.length > before;
}));

await page.screenshot({ path: '/tmp/fluxx-ui.png' });

check('command palette opens', await page.keyboard.press('Meta+k') !== undefined);
await page.waitForTimeout(150);
check('command palette rendered', await page.locator('.command-palette').count() === 1);
await page.screenshot({ path: '/tmp/fluxx-command.png' });
await page.keyboard.press('Escape');

check('view mode toggle exists', await page.getByLabel('Enter view-only mode').count() === 1);
await page.getByLabel('Enter view-only mode').click();
await page.waitForTimeout(100);
check('view mode banner shown', (await page.locator('.view-mode-banner').count()) === 1);
check('pointer blocked in view mode', await page.evaluate(() => {
  const store = window.__scene;
  const before = store.visibleElements.length;
  const canvas = document.querySelector('.canvas-container canvas');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left+200, clientY: rect.top+200, pointerId: 2, button: 0, isPrimary: true }));
  return store.visibleElements.length === before;
}));
await page.getByLabel('Exit view-only mode').click();

check('minimap control exists', await page.getByLabel('Show minimap').count() === 1);
await page.getByLabel('Show minimap').click();
await page.waitForTimeout(100);

// Name pill centering.
const menuBox = await page.locator('.menu').boundingBox();
const nameBox = await page.locator('.file-meta').boundingBox();
const triggerBox = await page.locator('.menu-trigger').boundingBox();
const nameCenter = nameBox.x + nameBox.width / 2;
const pillCenter = triggerBox.x + triggerBox.width + 4 + (menuBox.x + menuBox.width - triggerBox.x - triggerBox.width - 10) / 2;
check('name centered in remaining pill space', Math.abs(nameCenter - pillCenter) < 8, `${nameCenter} vs ${pillCenter}`);

await browser.close();
console.log(JSON.stringify({ checks, errors }, null, 2));
if (checks.some(c => !c.ok) || errors.length) process.exitCode = 1;
