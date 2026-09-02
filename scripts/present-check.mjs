/** Verifies presentation mode: frames become slides, navigation, clipping. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

// build three frames, each containing a shape
await p.evaluate(async () => {
  const store = window.__scene;
  const { newFrameElement, newGenericElement, newTextElement } = await import("/src/elements/factory.ts");
  const { reconcileFrameMembership, refreshTextLayout } = await import("/src/actions.ts");
  ["One", "Two", "Three"].forEach((name, i) => {
    const frame = newFrameElement(store.appState, i * 900, 0);
    frame.width = 800; frame.height = 500; frame.name = name;
    store.addElements(frame);
    const shape = newGenericElement("rectangle", store.appState, i * 900 + 120, 120);
    shape.width = 300; shape.height = 180;
    store.addElements(shape);
    const label = newTextElement(store.appState, i * 900 + 120, 340);
    label.text = `Slide ${name}`; label.fontSize = 48;
    store.addElements(label);
    refreshTextLayout([label.id]);
  });
  reconcileFrameMembership();
  store.emit();
});

await p.keyboard.press("Shift+p");
await p.waitForSelector(".presentation-canvas");
await p.waitForTimeout(500);
ok("presentation opens", true);

const first = await p.textContent(".presentation-count");
ok("starts on the first slide", first.trim() === "1 / 3", first.trim());
await p.screenshot({ path: new URL("../.smoke/present.png", import.meta.url).pathname });

await p.keyboard.press("ArrowRight");
await p.waitForTimeout(250);
ok("arrow advances", (await p.textContent(".presentation-count")).trim() === "2 / 3");

await p.keyboard.press("End");
await p.waitForTimeout(250);
ok("End jumps to the last slide", (await p.textContent(".presentation-count")).trim() === "3 / 3");
ok("slide name is shown", (await p.textContent(".presentation-name")).trim() === "Three");

await p.keyboard.press("ArrowRight");
await p.waitForTimeout(200);
ok("does not run past the end", (await p.textContent(".presentation-count")).trim() === "3 / 3");

await p.keyboard.press("Escape");
await p.waitForTimeout(400);
ok("Escape exits", (await p.locator(".presentation").count()) === 0);
ok("canvas is intact after presenting", (await p.evaluate(() => window.__scene.visibleElements.length)) === 9);

// with no frames at all, it should explain itself rather than show a blank screen
await p.evaluate(() => window.__scene.resetScene());
await p.keyboard.press("Shift+p");
await p.waitForTimeout(300);
ok("empty state explains frames", (await p.locator(".presentation-empty-card").count()) === 1);
await b.close();
