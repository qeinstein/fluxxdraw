/** Focused check: free text entry should grow with content and not clip. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const box = await (await p.locator(".canvas-container canvas")).boundingBox();
const at = (x, y) => [box.x + x, box.y + y];

const sizeOf = () =>
  p.evaluate(() => {
    const ta = document.querySelector(".text-editor");
    return ta ? { w: Math.round(ta.getBoundingClientRect().width), h: Math.round(ta.getBoundingClientRect().height) } : null;
  });

// free text via the text tool
await p.keyboard.press("8");
await p.mouse.click(...at(300, 250));
await p.waitForSelector(".text-editor");
const empty = await sizeOf();

await p.keyboard.type("The quick brown fox jumps over the lazy dog");
const oneLine = await sizeOf();

await p.keyboard.press("Enter");
await p.keyboard.type("and a second, much much much longer line of text here");
const twoLines = await sizeOf();

console.log("empty   ", empty);
console.log("1 line  ", oneLine);
console.log("2 lines ", twoLines);
console.log("grew wider:", oneLine.w > empty.w, "| grew taller:", twoLines.h > oneLine.h);
console.log("widened again:", twoLines.w > oneLine.w);

await p.keyboard.press("Escape");
await p.waitForTimeout(300);

const committed = await p.evaluate(() => {
  const t = window.__scene.visibleElements.find((e) => e.type === "text");
  return { text: t?.text, w: Math.round(t?.width ?? 0), h: Math.round(t?.height ?? 0) };
});
console.log("committed", committed);
console.log("text intact:", committed.text?.includes("lazy dog") && committed.text?.includes("second"));

// label inside a shape should wrap, not overflow
await p.keyboard.press("2");
await p.mouse.move(...at(600, 420));
await p.mouse.down();
await p.mouse.move(...at(800, 520), { steps: 6 });
await p.mouse.up();
await p.keyboard.press("1");
await p.mouse.dblclick(...at(700, 470));
await p.waitForSelector(".text-editor");
await p.keyboard.type("a label long enough that it must wrap onto several lines inside the box");
await p.waitForTimeout(200);
const label = await sizeOf();
const rectH = await p.evaluate(
  () => Math.round(window.__scene.visibleElements.find((e) => e.type === "rectangle").height),
);
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
console.log("label box", label, "| container height", rectH);
console.log("container grew to fit:", rectH >= label.h);

await p.screenshot({ path: new URL("../.smoke/text.png", import.meta.url).pathname });
await b.close();
