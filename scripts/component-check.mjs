/** Verifies component instances: create, propagate edits, detach, persist. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

// build a small badge: rectangle + label, then make it a component
const made = await p.evaluate(async () => {
  const store = window.__scene;
  const { newGenericElement, newTextElement } = await import("/src/elements/factory.ts");
  const { refreshTextLayout } = await import("/src/actions.ts");
  const { createComponentFromSelection } = await import("/src/components-model.ts");

  const rect = newGenericElement("rectangle", store.appState, 200, 200);
  rect.width = 180; rect.height = 90; rect.backgroundColor = "#a5d8ff";
  store.addElements(rect);
  const label = newTextElement(store.appState, 0, 0, rect.id);
  label.text = "Service";
  store.addElements(label);
  store.updateElement(rect.id, () => ({ boundText: label.id }));
  refreshTextLayout([label.id]);
  store.appState.selectedIds = [rect.id];
  store.emit();

  const def = createComponentFromSelection("Service box");
  return {
    defId: def?.id,
    defElements: def?.elements.length,
    elements: store.visibleElements.map((e) => e.type),
  };
});
ok("selection becomes a component", made.defElements === 2 && made.elements.join() === "instance",
  `def has ${made.defElements} elements; canvas: ${made.elements.join(", ")}`);

// place two more instances
const placed = await p.evaluate(async (defId) => {
  const { placeInstance } = await import("/src/components-model.ts");
  placeInstance(defId, 500, 200);
  placeInstance(defId, 800, 200);
  return window.__scene.visibleElements.filter((e) => e.type === "instance").length;
}, made.defId);
ok("instances can be placed", placed === 3, `${placed} instances`);
await p.waitForTimeout(300);
await p.screenshot({ path: new URL("../.smoke/components-before.png", import.meta.url).pathname });

// edit the master: recolour and retitle. every instance must follow.
const edited = await p.evaluate(async () => {
  const store = window.__scene;
  const { beginComponentEdit, commitComponentEdit } = await import("/src/components-model.ts");
  const { refreshTextLayout } = await import("/src/actions.ts");
  const first = store.visibleElements.find((e) => e.type === "instance");
  const session = beginComponentEdit(first.id);

  for (const id of session.elementIds) {
    const el = store.getElement(id);
    if (el.type === "rectangle") store.updateElement(id, () => ({ backgroundColor: "#ffc9c9", strokeColor: "#e03131" }));
    if (el.type === "text") { store.updateElement(id, () => ({ text: "Renamed" })); refreshTextLayout([id]); }
  }
  commitComponentEdit(session, first.id);

  const def = Object.values(store.components)[0];
  return {
    fill: def.elements.find((e) => e.type === "rectangle")?.backgroundColor,
    text: def.elements.find((e) => e.type === "text")?.text,
    instances: store.visibleElements.filter((e) => e.type === "instance").length,
    strays: store.visibleElements.filter((e) => e.type !== "instance").length,
    version: def.version,
  };
});
ok("editing the master updates the definition", edited.fill === "#ffc9c9" && edited.text === "Renamed",
  JSON.stringify(edited));
ok("all instances survive the edit", edited.instances === 3, `${edited.instances}`);
ok("edit session leaves nothing behind", edited.strays === 0, `${edited.strays} stray elements`);
await p.waitForTimeout(300);
await p.screenshot({ path: new URL("../.smoke/components-after.png", import.meta.url).pathname });

// detaching yields independent shapes
const detached = await p.evaluate(async () => {
  const store = window.__scene;
  const { detachInstance } = await import("/src/components-model.ts");
  const target = store.visibleElements.find((e) => e.type === "instance");
  detachInstance(target.id);
  return {
    instances: store.visibleElements.filter((e) => e.type === "instance").length,
    plain: store.visibleElements.filter((e) => e.type !== "instance").length,
  };
});
ok("detach expands into plain shapes", detached.instances === 2 && detached.plain === 2,
  JSON.stringify(detached));

// definitions must survive a save/load round trip
const rt = await p.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const opener = await import("/src/io/openScene.ts");
  const blob = await exporter.buildExportBlob({ ...exporter.DEFAULT_EXPORT_SETTINGS, format: "json" });
  const result = await opener.readFile(new File([blob], "c.fluxx", { type: "application/json" }));
  return Object.keys(result.doc.components ?? {}).length;
});
ok("components travel in the file", rt === 1, `${rt} definitions`);

// and instances must actually render (non-blank export)
const rendered = await p.evaluate(async () => {
  const exporter = await import("/src/io/exportController.ts");
  const blob = await exporter.buildExportBlob({ ...exporter.DEFAULT_EXPORT_SETTINGS, format: "png", resolutionPreset: "1x" });
  return blob.size;
});
ok("instances render in exports", rendered > 5000, `${rendered} bytes`);
await b.close();
