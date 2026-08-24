/** Captures light/dark UI screenshots for visual review. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const TARGET_URL = process.argv[2] ?? "http://localhost:5173/";
const OUT = new URL("../.smoke/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

await page.goto(TARGET_URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".toolbar");

const box = await (await page.locator(".canvas-container canvas")).boundingBox();
const at = (x, y) => ({ x: box.x + x, y: box.y + y });
const drag = async (x1, y1, x2, y2) => {
  const a = at(x1, y1);
  const b = at(x2, y2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
};

await page.keyboard.press("2");
await drag(430, 210, 640, 330);
await page.mouse.dblclick(...Object.values(at(535, 270)));
await page.waitForSelector(".text-editor");
await page.keyboard.type("Design review");
await page.keyboard.press("Escape");

await page.keyboard.press("3");
await drag(760, 210, 920, 330);

await page.keyboard.press("5");
await drag(645, 270, 755, 270);

await page.keyboard.press("4");
await drag(430, 420, 600, 540);

await page.keyboard.press("7");
await drag(700, 430, 900, 540);

// select a shape so the style panel is visible
await page.keyboard.press("1");
await page.mouse.click(...Object.values(at(535, 212)));
await page.waitForTimeout(400);

await page.screenshot({ path: `${OUT}light.png` });

// dark mode via the menu, so the real toggle path is exercised
await page.click(".menu-trigger");
await page.waitForTimeout(200);
await page.getByText("Dark mode").click();
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.mouse.click(...Object.values(at(535, 212)));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}dark.png` });

// tooltip + export dialog
await page.mouse.move(...Object.values(at(0, 0)));
await page.hover(".toolbar .tooltip-anchor:nth-child(6) button");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}tooltip.png`, clip: { x: 380, y: 0, width: 700, height: 130 } });

await page.click(".export-button");
await page.waitForSelector(".dialog");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}export.png` });

await browser.close();
console.log("screenshots written to .smoke/");
