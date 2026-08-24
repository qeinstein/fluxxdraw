/** Checks the overflow toolbar, embed flow, rename, and laser rendering. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
p.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
const box = await (await p.locator(".canvas-container canvas")).boundingBox();

// toolbar is shorter, extras live behind the overflow button
const primary = await p.locator(".toolbar .tool-button").count();
ok("toolbar is trimmed down", primary <= 13, `${primary} buttons on the bar`);
await p.click('.toolbar-overflow button[aria-label="More tools"]');
await p.waitForSelector(".overflow-popover");
const extras = await p.locator(".overflow-item").allTextContents();
ok("extras moved into the overflow menu", extras.length === 4, extras.join(" | "));

// embed: in-app dialog, no browser prompt
await p.click('.overflow-item:has-text("Embed a link")');
await p.mouse.click(box.x + 420, box.y + 260);
await p.waitForSelector(".dialog.compact");
ok("embed asks in-app, not via window.prompt", true);

await p.fill("#input-dialog-field", "not a url at all !!");
await p.click(".dialog.compact .primary");
ok("invalid URLs are rejected", (await p.locator(".hint.error").count()) === 1);

await p.fill("#input-dialog-field", "github.com/qeinstein/fluxxdraw");
await p.click(".dialog.compact .primary");
await p.waitForTimeout(400);
const embed = await p.evaluate(() => {
  const el = window.__scene.visibleElements.find((e) => e.type === "embed");
  return el ? { url: el.url } : null;
});
ok("bare hostnames get an https scheme", embed?.url === "https://github.com/qeinstein/fluxxdraw", embed?.url);

// clicking a selected embed opens the link in a new tab
const popupPromise = p.waitForEvent("popup", { timeout: 4000 }).catch(() => null);
await p.mouse.click(box.x + 430, box.y + 270);
await p.waitForTimeout(200);
await p.mouse.click(box.x + 430, box.y + 270);
const popup = await popupPromise;
ok("clicking a selected embed opens the link", popup !== null, popup ? popup.url() : "no popup");
await popup?.close();

// rename in place
await p.click(".file-meta");
await p.waitForSelector(".file-name-input");
await p.fill(".file-name-input", "architecture");
await p.keyboard.press("Enter");
await p.waitForTimeout(200);
const named = await p.textContent(".file-name");
ok("renaming in place works", named.startsWith("architecture"), named);

// laser trail draws as a smooth beam, not banded dots
await p.evaluate(() => window.__scene.setAppState({ tool: "laser" }));
await p.mouse.move(box.x + 200, box.y + 500);
await p.mouse.down();
for (let i = 0; i < 25; i++) await p.mouse.move(box.x + 200 + i * 16, box.y + 500 + Math.sin(i / 3) * 40);
await p.waitForTimeout(60);
await p.screenshot({ path: new URL("../.smoke/laser.png", import.meta.url).pathname, clip: { x: 150, y: 430, width: 600, height: 200 } });
await p.mouse.up();
ok("laser captured for review", true);

await p.screenshot({ path: new URL("../.smoke/ui.png", import.meta.url).pathname });
await b.close();
