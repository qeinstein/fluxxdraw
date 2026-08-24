/** Verifies tidy-up produces a clean layered layout and keeps arrows bound. */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

// a deliberately messy graph: A->B, A->C, B->D, C->D, plus a loose shape
await p.evaluate(async () => {
  const store = window.__scene;
  const { newGenericElement, newLinearElement } = await import("/src/elements/factory.ts");
  const { refreshBindings } = await import("/src/actions.ts");
  const spots = { A: [520, 480], B: [140, 120], C: [860, 640], D: [300, 300], Loose: [900, 90] };
  const nodes = {};
  for (const [name, [x, y]] of Object.entries(spots)) {
    const el = newGenericElement("rectangle", store.appState, x, y);
    el.width = 150; el.height = 80;
    store.addElements(el);
    nodes[name] = el.id;
  }
  for (const [from, to] of [["A","B"],["A","C"],["B","D"],["C","D"]]) {
    const arrow = newLinearElement("arrow", store.appState, 0, 0);
    arrow.points = [[0,0],[100,100]];
    arrow.startBinding = { elementId: nodes[from], focus: 0, gap: 4 };
    arrow.endBinding = { elementId: nodes[to], focus: 0, gap: 4 };
    store.addElements(arrow);
  }
  refreshBindings(Object.values(nodes));
  store.emit();
  window.__nodes = nodes;
});

await p.screenshot({ path: new URL("../.smoke/layout-before.png", import.meta.url).pathname });

const before = await p.evaluate(() => {
  const s = window.__scene;
  return Object.fromEntries(Object.entries(window.__nodes).map(([k, id]) =>
    [k, Math.round(s.getElement(id).y)]));
});

await p.keyboard.press("Meta+Shift+t");
await p.waitForTimeout(400);

const after = await p.evaluate(() => {
  const s = window.__scene;
  return Object.fromEntries(Object.entries(window.__nodes).map(([k, id]) =>
    [k, { x: Math.round(s.getElement(id).x), y: Math.round(s.getElement(id).y) }]));
});
console.log("before y:", JSON.stringify(before));
console.log("after   :", JSON.stringify(after));

ok("A sits above B and C", after.A.y < after.B.y && after.A.y < after.C.y);
ok("B and C share a layer", after.B.y === after.C.y, `${after.B.y} vs ${after.C.y}`);
ok("D sits below B and C", after.D.y > after.B.y && after.D.y > after.C.y);
ok("loose shape parked below the graph", after.Loose.y > after.D.y);

// arrows must still touch their shapes after the move
const gaps = await p.evaluate(() => {
  const s = window.__scene;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return s.visibleElements.filter((e) => e.type === "arrow").map((arrow) => {
    const shape = s.getElement(arrow.endBinding.elementId);
    const tip = [arrow.x + arrow.points.at(-1)[0], arrow.y + arrow.points.at(-1)[1]];
    const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
    // distance from the tip to the shape's box, 0 when touching
    const dx = Math.max(Math.abs(tip[0] - cx) - shape.width / 2, 0);
    const dy = Math.max(Math.abs(tip[1] - cy) - shape.height / 2, 0);
    return Math.round(dist([dx, dy], [0, 0]));
  });
});
ok("arrows re-routed onto their shapes", gaps.every((g) => g <= 12), `gaps: ${gaps.join(", ")}`);

const undone = await p.evaluate(() => {
  window.__scene.undo();
  const s = window.__scene;
  return Math.round(s.getElement(window.__nodes.A).y);
});
ok("tidy up is undoable", undone === before.A, `${undone} vs ${before.A}`);
await p.evaluate(() => window.__scene.redo());
await p.waitForTimeout(300);

await p.screenshot({ path: new URL("../.smoke/layout-after.png", import.meta.url).pathname });
await b.close();
