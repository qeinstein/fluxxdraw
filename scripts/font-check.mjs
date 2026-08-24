/** Verifies the drawing fonts load, render distinctly, and embed in SVG. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

const loaded = await p.evaluate(async () => {
  const { FONTS } = await import("/src/fonts.ts");
  await document.fonts.ready;
  return FONTS.map((f) => ({ id: f.id, ok: document.fonts.check(`16px "${f.family}"`) }));
});
ok("all drawing fonts load", loaded.every((f) => f.ok), loaded.map((f) => `${f.id}:${f.ok}`).join(" "));

// each font must actually measure differently, i.e. it really applied
const widths = await p.evaluate(async () => {
  const { FONTS, fontStack } = await import("/src/fonts.ts");
  await document.fonts.ready;
  const ctx = document.createElement("canvas").getContext("2d");
  return FONTS.map((f) => {
    ctx.font = `24px ${fontStack(f.id)}`;
    return { id: f.id, w: Math.round(ctx.measureText("Handwriting sample").width) };
  });
});
const distinct = new Set(widths.map((w) => w.w)).size;
ok("fonts render distinctly", distinct >= widths.length - 1, widths.map((w) => `${w.id}=${w.w}`).join(" "));

// draw text and export SVG with the font inlined
const box = await (await p.locator(".canvas-container canvas")).boundingBox();
await p.keyboard.press("8");
await p.mouse.click(box.x + 300, box.y + 250);
await p.waitForSelector(".text-editor");
await p.keyboard.type("Sketchy handwriting");
await p.keyboard.press("Escape");
await p.waitForTimeout(300);

const svg = await p.evaluate(async () => {
  const mod = await import("/src/io/exportController.ts");
  const blob = await mod.buildExportBlob({ ...mod.DEFAULT_EXPORT_SETTINGS, format: "svg" });
  const text = await blob.text();
  return { hasFace: text.includes("@font-face"), hasData: text.includes("data:font/woff2"), size: text.length };
});
ok("SVG export inlines the font", svg.hasFace && svg.hasData, `${Math.round(svg.size / 1024)} KB`);

// show every font on canvas for a visual check
await p.evaluate(async () => {
  const { FONTS } = await import("/src/fonts.ts");
  const store = window.__scene;
  store.resetScene();
  const { newTextElement } = await import("/src/elements/factory.ts");
  const { refreshTextLayout } = await import("/src/actions.ts");
  FONTS.forEach((f, i) => {
    store.appState.currentStyle.fontFamily = f.id;
    store.appState.currentStyle.fontSize = 28;
    const el = newTextElement(store.appState, 80, 60 + i * 70);
    el.text = `${f.label} — The quick brown fox`;
    store.addElements(el);
    refreshTextLayout([el.id]);
  });
  store.emit();
});
await p.waitForTimeout(400);
await p.screenshot({ path: new URL("../.smoke/fonts.png", import.meta.url).pathname, clip: { x: 60, y: 60, width: 700, height: 470 } });
await b.close();
