/** Verifies in-file version history: recording, scrubbing, restore, persistence. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 880 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
p.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const box = await (await p.locator(".canvas-container canvas")).boundingBox();
const at = (x, y) => [box.x + x, box.y + y];
const drag = async (x1, y1, x2, y2) => {
  await p.mouse.move(...at(x1, y1));
  await p.mouse.down();
  await p.mouse.move(...at(x2, y2), { steps: 6 });
  await p.mouse.up();
};
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

// draw four shapes, spaced past the coalesce window so each is its own checkpoint
for (const [i, coords] of [[300,200,420,300],[470,200,590,300],[640,200,760,300],[810,200,930,300]].entries()) {
  await p.keyboard.press("2");
  await drag(...coords);
  if (i < 3) await p.waitForTimeout(4200);
}
const counts = await p.evaluate(() => ({
  elements: window.__scene.visibleElements.length,
  checkpoints: window.__scene.timeline.checkpoints.length,
}));
ok("history recorded checkpoints", counts.checkpoints >= 4, JSON.stringify(counts));

// reconstruct an earlier state
const recon = await p.evaluate(() => {
  const t = window.__scene.timeline;
  return t.checkpoints.map((_, i) => t.reconstruct(i).length);
});
ok("each checkpoint reconstructs a growing scene", recon[recon.length - 1] === 4 && recon[0] <= 1, JSON.stringify(recon));

// open the panel and scrub back
await p.keyboard.press("Shift+h");
await p.waitForSelector(".timeline");
await p.locator(".timeline-slider").fill("1");
await p.waitForTimeout(250);
const scrubbed = await p.evaluate(() => window.__scene.visibleElements.length);
ok("scrubbing previews an earlier state", scrubbed < 4, `${scrubbed} elements shown`);

// closing without restoring must give the present back
await p.click(".timeline .icon-button");
await p.waitForTimeout(250);
const afterClose = await p.evaluate(() => window.__scene.visibleElements.length);
ok("closing restores the live scene", afterClose === 4, `${afterClose} elements`);

// restore for real
await p.keyboard.press("Shift+h");
await p.waitForSelector(".timeline");
await p.locator(".timeline-slider").fill("1");
await p.waitForTimeout(200);
await p.getByRole("button", { name: "Restore this version" }).click();
await p.waitForTimeout(300);
const restored = await p.evaluate(() => window.__scene.visibleElements.length);
ok("restore applies the old version", restored < 4, `${restored} elements`);

const undone = await p.evaluate(() => { window.__scene.undo(); return window.__scene.visibleElements.length; });
ok("restore is undoable", undone === 4, `${undone} elements`);

// history survives a save/load round trip through the file
const roundTrip = await p.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const before = window.__scene.timeline.checkpoints.length;
  const blob = await exporter.buildExportBlob({ ...exporter.DEFAULT_EXPORT_SETTINGS, format: "json" });
  const result = await opener.readFile(new File([blob], "h.fluxx", { type: "application/json" }));
  return { before, after: result.doc.history?.length ?? 0, bytes: blob.size };
});
ok("history travels inside the .fluxx file", roundTrip.after === roundTrip.before, JSON.stringify(roundTrip));

const png = await p.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const blob = await exporter.buildExportBlob({ ...exporter.DEFAULT_EXPORT_SETTINGS, format: "png", embedScene: true });
  const result = await opener.readFile(new File([blob], "h.png", { type: "image/png" }));
  return result.doc?.history?.length ?? 0;
});
ok("an exported PNG carries its own history", png > 0, `${png} checkpoints in the PNG`);

await p.keyboard.press("Shift+h");
await p.waitForSelector(".timeline");
await p.screenshot({ path: new URL("../.smoke/timeline.png", import.meta.url).pathname });
await b.close();
