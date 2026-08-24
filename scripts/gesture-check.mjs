/** Verifies pinch-zoom, wheel-zoom and panning behave like an infinite canvas. */
import { chromium, devices } from "playwright";

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["Desktop Chrome"], hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const box = await (await p.locator(".canvas-container canvas")).boundingBox();
const view = () => p.evaluate(() => {
  const s = window.__scene.appState;
  return { zoom: +s.zoom.toFixed(3), x: Math.round(s.scrollX), y: Math.round(s.scrollY) };
});

const start = await view();

// ctrl+wheel = trackpad pinch
await p.mouse.move(box.x + 500, box.y + 400);
await p.keyboard.down("Control");
await p.mouse.wheel(0, -240);
await p.keyboard.up("Control");
const afterWheelZoom = await view();
console.log("trackpad pinch zoom:", start.zoom, "->", afterWheelZoom.zoom, afterWheelZoom.zoom > start.zoom ? "OK" : "FAIL");

// plain wheel = pan
await p.mouse.wheel(0, 300);
const afterScroll = await view();
console.log("two-finger scroll pans:", afterScroll.y !== afterWheelZoom.y ? "OK" : "FAIL");

// space-drag pan
const before = await view();
await p.keyboard.down("Space");
await p.mouse.move(box.x + 400, box.y + 400);
await p.mouse.down();
await p.mouse.move(box.x + 560, box.y + 480, { steps: 8 });
await p.mouse.up();
await p.keyboard.up("Space");
const afterSpace = await view();
console.log("space-drag pans:", afterSpace.x !== before.x && afterSpace.y !== before.y ? "OK" : "FAIL");

// real two-finger touch pinch
await p.evaluate(() => window.__scene.setAppState({ zoom: 1, scrollX: 0, scrollY: 0 }));
const pinch = await p.evaluate(async () => {
  const canvas = document.querySelector(".canvas-container canvas");
  const send = (type, points) => {
    for (const pt of points) {
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: pt.id, pointerType: "touch", isPrimary: pt.id === 1,
        clientX: pt.x, clientY: pt.y, bubbles: true, cancelable: true,
      }));
    }
  };
  canvas.setPointerCapture = () => {};
  send("pointerdown", [{ id: 1, x: 500, y: 400 }]);
  send("pointerdown", [{ id: 2, x: 600, y: 400 }]);
  for (let i = 1; i <= 10; i++) {
    const spread = 50 + i * 15;
    send("pointermove", [{ id: 1, x: 550 - spread, y: 400 }, { id: 2, x: 550 + spread, y: 400 }]);
    await new Promise((r) => requestAnimationFrame(r));
  }
  const zoomed = window.__scene.appState.zoom;
  send("pointerup", [{ id: 1, x: 300, y: 400 }]);
  send("pointerup", [{ id: 2, x: 800, y: 400 }]);
  return { zoom: +zoomed.toFixed(3), elements: window.__scene.visibleElements.length };
});
console.log("touch pinch zoom -> ", pinch.zoom, pinch.zoom > 1.5 ? "OK" : "FAIL");
console.log("pinch created no stray shapes:", pinch.elements === 0 ? "OK" : `FAIL (${pinch.elements})`);

// a second finger must not leave a half-drawn shape behind
const stray = await p.evaluate(async () => {
  const canvas = document.querySelector(".canvas-container canvas");
  canvas.setPointerCapture = () => {};
  window.__scene.setAppState({ tool: "rectangle" });
  const send = (type, pts) => pts.forEach((pt) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: pt.id, pointerType: "touch", isPrimary: pt.id === 1,
      clientX: pt.x, clientY: pt.y, bubbles: true, cancelable: true })));
  send("pointerdown", [{ id: 1, x: 400, y: 300 }]);
  send("pointermove", [{ id: 1, x: 450, y: 350 }]);
  send("pointerdown", [{ id: 2, x: 600, y: 300 }]);
  for (let i = 0; i < 5; i++) {
    send("pointermove", [{ id: 1, x: 400 - i * 10, y: 300 }, { id: 2, x: 600 + i * 10, y: 300 }]);
    await new Promise((r) => requestAnimationFrame(r));
  }
  send("pointerup", [{ id: 1, x: 350, y: 300 }]);
  send("pointerup", [{ id: 2, x: 650, y: 300 }]);
  return window.__scene.visibleElements.length;
});
console.log("interrupted draw discarded:", stray === 0 ? "OK" : `FAIL (${stray} left)`);

await b.close();
