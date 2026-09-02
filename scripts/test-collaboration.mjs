import { chromium } from 'playwright';

const browser = await chromium.launch();
const context1 = await browser.newContext();
const context2 = await browser.newContext();

const host = await context1.newPage();
const guest = await context2.newPage();

const errors = [];
host.on('pageerror', (err) => errors.push(`Host Error: ${err.message}`));
guest.on('pageerror', (err) => errors.push(`Guest Error: ${err.message}`));

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  if (ok) console.log(`✅ ${name}`);
  else console.log(`❌ ${name} ${detail}`);
};

try {
  console.log("Loading Host...");
  await host.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
  await host.evaluate(() => localStorage.clear());
  await host.reload({ waitUntil: 'networkidle' });
  
  // Wait for canvas
  await host.waitForSelector('.canvas-container canvas');

  console.log("Host drawing a rectangle...");
  // Host draws a rectangle
  await host.evaluate(() => {
    window.__scene.setAppState({ tool: "rectangle" });
    const canvas = document.querySelector('.canvas-container canvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 100, clientY: rect.top + 100, pointerId: 1, button: 0, isPrimary: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + 200, clientY: rect.top + 200, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
  });

  check('Host has 1 element', await host.evaluate(() => window.__scene.visibleElements.length) === 1);

  console.log("Host creating collaboration session...");
  await host.getByLabel('Collaboration menu').click();
  await host.waitForSelector('.collab-popover');
  
  await host.locator('button:has-text("Start Session")').click();
  await host.waitForURL(url => url.pathname.includes('/session/'));
  await host.keyboard.press('Escape'); // Close the popover
  
  const shareLink = host.url();
  check('Share link generated', shareLink.includes('/session/'));

  console.log(`Guest joining link: ${shareLink}...`);
  await guest.goto(shareLink, { waitUntil: 'networkidle' });
  await guest.evaluate(() => localStorage.clear());
  await guest.reload({ waitUntil: 'networkidle' });

  // Wait for Join dialog
  console.log("Guest accepting join dialog...");
  await guest.waitForSelector('.dialog');
  await guest.locator('button:has-text("Join Session")').click();

  // Guest should see Host's rectangle
  console.log("Waiting for Guest to receive Host's drawing...");
  await guest.waitForFunction(() => window.__scene && window.__scene.visibleElements.length === 1, { timeout: 10000 });
  check('Guest sees Host drawing', await guest.evaluate(() => window.__scene.visibleElements.length) === 1);

  // Guest draws a line
  console.log("Guest drawing a line...");
  await guest.evaluate(() => {
    window.__scene.setAppState({ tool: "arrow" });
    const canvas = document.querySelector('.canvas-container canvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + 300, clientY: rect.top + 300, pointerId: 2, button: 0, isPrimary: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + 400, clientY: rect.top + 400, pointerId: 2 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, button: 0 }));
  });

  // Host should see Guest's line
  console.log("Waiting for Host to receive Guest's drawing...");
  await host.waitForFunction(() => window.__scene && window.__scene.visibleElements.length === 2, { timeout: 10000 });
  check('Host sees Guest drawing', await host.evaluate(() => window.__scene.visibleElements.length) === 2);

  // Test UI text
  await host.getByLabel('Collaboration menu').click();
  await host.waitForSelector('.collab-popover');
  const hostEndText = await host.locator('.collab-popover button.ghost-button').textContent();
  check('Host button says "End Session"', hostEndText.trim() === 'End Session', `(was "${hostEndText.trim()}")`);
  
  // Close host dialog
  await host.keyboard.press('Escape');

  // Guest opens collab dialog
  await guest.getByLabel('Collaboration menu').click();
  await guest.waitForSelector('.collab-popover');
  const guestEndText = await guest.locator('.collab-popover button.ghost-button').textContent();
  check('Guest button says "Leave Session"', guestEndText.trim() === 'Leave Session');

  // Close guest dialog
  await guest.keyboard.press('Escape');

  // Test Host ending session kicks guest seamlessly (no page reload)
  console.log("Host ending session...");
  
  await host.getByLabel('Collaboration menu').click();
  await host.waitForSelector('.collab-popover');
  await host.locator('button:has-text("End Session")').click();
  
  // Wait for guest path to be cleared
  let guestKicked = false;
  try {
    await guest.waitForURL(url => !url.pathname.includes('/session/'), { timeout: 5000 });
    guestKicked = true;
  } catch (e) {
    console.log("waitForURL timed out!");
  }
  check('Guest kicked and path cleared', guestKicked);
  const notice = guest.locator('.dialog.compact').filter({ hasText: 'host has ended' });
  const alertFired = await notice.count() === 1;
  check('End-session notice was observed once', alertFired);
  check(
    'End-session notice has the right message',
    alertFired && (await notice.first().textContent())?.includes('The host has ended this collaboration session.'),
    `(notice=${JSON.stringify(await notice.first().textContent())})`,
  );

  const failed = checks.filter(({ ok }) => !ok);
  if (failed.length || errors.length) {
    console.error(`❌ Collaboration checks failed: ${failed.length}; runtime errors: ${errors.length}`);
    process.exitCode = 1;
  } else {
    console.log("✅ All E2E collaboration checks passed!");
  }
  
} catch (e) {
  console.error("Test failed:", e);
  process.exit(1);
} finally {
  await browser.close();
}
