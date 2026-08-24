/**
 * End-to-end smoke test: draw a scene, export it in every format, and confirm
 * a PNG export reopens as an editable drawing.
 *
 * Run against a dev server: node scripts/smoke.mjs [url]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const TARGET_URL = process.argv[2] ?? "http://localhost:5173/";
const OUT = new URL("../.smoke/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(TARGET_URL, { waitUntil: "networkidle" });
await page.waitForSelector(".toolbar");

const canvas = await page.locator(".canvas-container canvas");
const box = await canvas.boundingBox();
const at = (x, y) => ({ x: box.x + x, y: box.y + y });

const drag = async (x1, y1, x2, y2) => {
  const a = at(x1, y1);
  const b = at(x2, y2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
};

const count = () => page.evaluate(() => window.__scene.visibleElements.length);
const types = () =>
  page.evaluate(() => window.__scene.visibleElements.map((el) => el.type));

// --- draw one of each core shape -----------------------------------------

await page.keyboard.press("2"); // rectangle
await drag(300, 200, 480, 320);
check("rectangle drawn", (await count()) === 1);

await page.keyboard.press("3"); // diamond
await drag(560, 200, 700, 320);

await page.keyboard.press("4"); // ellipse
await drag(780, 200, 920, 320);

await page.keyboard.press("5"); // arrow between the first two shapes
await drag(485, 260, 555, 260);

await page.keyboard.press("7"); // freedraw
await drag(320, 420, 460, 500);

await page.keyboard.press("6"); // line
await drag(560, 420, 700, 500);

const drawn = await types();
check(
  "all core element types present",
  ["rectangle", "diamond", "ellipse", "arrow", "freedraw", "line"].every((t) =>
    drawn.includes(t),
  ),
  drawn.join(", "),
);

// --- arrow binding --------------------------------------------------------

const bound = await page.evaluate(() => {
  const arrow = window.__scene.visibleElements.find((el) => el.type === "arrow");
  return { start: !!arrow?.startBinding, end: !!arrow?.endBinding };
});
check("arrow bound at both ends", bound.start && bound.end, JSON.stringify(bound));

// --- text label in a container -------------------------------------------

await page.keyboard.press("1"); // selection
const centre = at(390, 260);
await page.mouse.dblclick(centre.x, centre.y);
await page.waitForSelector(".text-editor");
await page.keyboard.type("Hello");
await page.keyboard.press("Escape");

const labelled = await page.evaluate(() => {
  const rect = window.__scene.visibleElements.find((el) => el.type === "rectangle");
  const text = window.__scene.visibleElements.find((el) => el.type === "text");
  return { boundText: rect?.boundText ?? null, text: text?.text ?? null, containerId: text?.containerId ?? null };
});
check(
  "container label bound and saved",
  labelled.text === "Hello" && labelled.boundText && labelled.containerId,
  JSON.stringify(labelled),
);

// --- undo / redo ----------------------------------------------------------

const beforeUndo = await count();
await page.keyboard.press("Meta+z");
const afterUndo = await count();
await page.keyboard.press("Meta+Shift+z");
const afterRedo = await count();
check("undo and redo change the scene", afterUndo !== beforeUndo && afterRedo === beforeUndo,
  `${beforeUndo} -> ${afterUndo} -> ${afterRedo}`);

// --- selection, grouping, z-order ----------------------------------------

await page.keyboard.press("Meta+a");
const selected = await page.evaluate(() => window.__scene.appState.selectedIds.length);
check("select all", selected >= 6, `${selected} selected`);

await page.keyboard.press("Meta+g");
const grouped = await page.evaluate(() =>
  window.__scene.getSelected().every((el) => el.groupIds.length > 0),
);
check("group selection", grouped);

await page.keyboard.press("Meta+Shift+g");
const ungrouped = await page.evaluate(() =>
  window.__scene.getSelected().every((el) => el.groupIds.length === 0),
);
check("ungroup selection", ungrouped);

// --- export in every format ----------------------------------------------

await page.evaluate(() => window.__scene.setAppState({ selectedIds: [] }));

const exportBlob = async (settings) =>
  page.evaluate(async (overrides) => {
    const mod = await import("/src/io/exportController.ts");
    const blob = await mod.buildExportBlob({ ...mod.DEFAULT_EXPORT_SETTINGS, ...overrides });
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { size: buf.length, bytes: Array.from(buf.slice(0, 16)), type: blob.type };
  }, settings);

const png4k = await exportBlob({ format: "png", resolutionPreset: "4k" });
check("PNG export produced bytes", png4k.size > 5000, `${png4k.size} bytes`);
check(
  "PNG has a valid signature",
  png4k.bytes.slice(0, 4).join(",") === "137,80,78,71",
  png4k.bytes.slice(0, 4).join(","),
);

const dims = await page.evaluate(async () => {
  const mod = await import("/src/io/exportController.ts");
  return mod.previewDimensions({ ...mod.DEFAULT_EXPORT_SETTINGS, resolutionPreset: "4k" });
});
check(
  "4K preset targets a 3840px long edge",
  Math.max(dims.width, dims.height) === 3840,
  `${dims.width}x${dims.height}`,
);

const jpeg = await exportBlob({ format: "jpeg" });
check("JPEG export produced bytes", jpeg.size > 3000 && jpeg.bytes[0] === 255 && jpeg.bytes[1] === 216,
  `${jpeg.size} bytes`);

const webp = await exportBlob({ format: "webp" });
check("WebP export produced bytes", webp.size > 1000, `${webp.size} bytes`);

const svg = await exportBlob({ format: "svg" });
check("SVG export produced bytes", svg.size > 2000, `${svg.size} bytes`);

const json = await exportBlob({ format: "json" });
check("JSON export produced bytes", json.size > 500, `${json.size} bytes`);

// --- round trip: PNG with an embedded scene reopens as a drawing ---------

const roundTrip = await page.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const store = window.__scene;

  const before = store.visibleElements.length;
  const beforeText = store.visibleElements.find((el) => el.type === "text")?.text ?? null;

  const settings = { ...exporter.DEFAULT_EXPORT_SETTINGS, format: "png", embedScene: true };
  const blob = await exporter.buildExportBlob(settings);
  const file = new File([blob], "round-trip.png", { type: "image/png" });

  const result = await opener.readFile(file);
  return {
    before,
    beforeText,
    kind: result.kind,
    after: result.kind === "scene" ? result.doc.elements.length : 0,
    afterText:
      result.kind === "scene"
        ? (result.doc.elements.find((el) => el.type === "text")?.text ?? null)
        : null,
  };
});
check(
  "PNG round-trips back to an editable scene",
  roundTrip.kind === "scene" &&
    roundTrip.after === roundTrip.before &&
    roundTrip.afterText === roundTrip.beforeText,
  JSON.stringify(roundTrip),
);

const svgRoundTrip = await page.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const settings = { ...exporter.DEFAULT_EXPORT_SETTINGS, format: "svg", embedScene: true };
  const blob = await exporter.buildExportBlob(settings);
  const file = new File([blob], "round-trip.svg", { type: "image/svg+xml" });
  const result = await opener.readFile(file);
  return { kind: result.kind, after: result.kind === "scene" ? result.doc.elements.length : 0 };
});
check(
  "SVG round-trips back to an editable scene",
  svgRoundTrip.kind === "scene" && svgRoundTrip.after > 0,
  JSON.stringify(svgRoundTrip),
);

const jsonRoundTrip = await page.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const blob = await exporter.buildExportBlob({
    ...exporter.DEFAULT_EXPORT_SETTINGS,
    format: "json",
  });
  const file = new File([blob], "round-trip.fluxx", { type: "application/json" });
  const result = await opener.readFile(file);
  return { kind: result.kind, after: result.kind === "scene" ? result.doc.elements.length : 0 };
});
check(
  ".fluxx round-trips back to an editable scene",
  jsonRoundTrip.kind === "scene" && jsonRoundTrip.after > 0,
  JSON.stringify(jsonRoundTrip),
);

// --- visual capture -------------------------------------------------------

await page.screenshot({ path: `${OUT}app.png` });

const pngDataUrl = await page.evaluate(async () => {
  const mod = await import("/src/io/exportController.ts");
  const blob = await mod.buildExportBlob({
    ...mod.DEFAULT_EXPORT_SETTINGS,
    resolutionPreset: "2x",
  });
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
});
writeFileSync(`${OUT}export.png`, Buffer.from(pngDataUrl.split(",")[1], "base64"));

check("no runtime errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
