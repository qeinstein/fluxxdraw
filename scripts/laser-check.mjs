/** Confirms the laser tapers over time and fades out, as Excalidraw's does. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const box = await (await p.locator(".canvas-container canvas")).boundingBox();

await p.evaluate(() => window.__scene.setAppState({ tool: "laser" }));
await p.mouse.move(box.x + 100, box.y + 300);
await p.mouse.down();
// draw slowly, so points carry a spread of timestamps
for (let i = 0; i < 40; i++) {
  await p.mouse.move(box.x + 100 + i * 20, box.y + 300 + Math.sin(i / 4) * 60);
  await new Promise((r) => setTimeout(r, 12));
}
await p.screenshot({ path: new URL("../.smoke/laser-live.png", import.meta.url).pathname,
  clip: { x: 60, y: 200, width: 900, height: 220 } });
await p.mouse.up();

// count red pixels now and after the decay window
const redAt = async () => p.evaluate(() => {
  const c = document.querySelector(".canvas-container canvas");
  const ctx = c.getContext("2d");
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 180 && data[i + 1] < 90 && data[i + 2] < 90) n++;
  }
  return n;
});
const immediate = await redAt();
await p.waitForTimeout(1300);
const later = await redAt();
console.log(`red pixels: ${immediate} while drawing -> ${later} after 1.3s`);
console.log(`${immediate > 2000 ? "PASS" : "FAIL"}  trail is drawn`);
console.log(`${later === 0 ? "PASS" : "FAIL"}  trail fully fades after the decay window`);
await b.close();
