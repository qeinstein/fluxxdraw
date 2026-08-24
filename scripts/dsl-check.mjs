/** Verifies the text <-> diagram sync holds in both directions without looping. */
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 880 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
p.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector(".toolbar");
const ok = (n, c, d = "") => console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

const shapes = () =>
  p.evaluate(() =>
    window.__scene.visibleElements
      .filter((e) => ["rectangle", "ellipse", "diamond"].includes(e.type))
      .map((e) => ({
        key: e.dslKey,
        type: e.type,
        fill: e.backgroundColor,
        label: e.boundText ? window.__scene.getElement(e.boundText)?.text : "",
        x: Math.round(e.x),
        y: Math.round(e.y),
      })),
  );
const arrows = () =>
  p.evaluate(() =>
    window.__scene.visibleElements
      .filter((e) => e.type === "arrow" || e.type === "line")
      .map((e) => ({
        type: e.type,
        style: e.strokeStyle,
        bound: !!(e.startBinding && e.endBinding),
        label: e.boundText ? window.__scene.getElement(e.boundText)?.text : "",
      })),
  );
const panelText = () => p.inputValue(".diagram-text-input");
const type = async (source) => {
  await p.click(".diagram-text-input");
  await p.fill(".diagram-text-input", source);
  await p.waitForTimeout(900);
};

// --- text -> canvas --------------------------------------------------------
await p.keyboard.press("Meta+/");
await p.waitForSelector(".diagram-text");
ok("panel opens", true);

await type(`api: API Gateway
db: Postgres [ellipse] {blue}
cache: Redis [diamond]

api -> db: queries
api --> cache`);

let s = await shapes();
let a = await arrows();
ok("text creates the nodes", s.length === 3, s.map((n) => `${n.key}:${n.type}`).join(" "));
ok("labels applied", s.find((n) => n.key === "api")?.label === "API Gateway",
  JSON.stringify(s.map((n) => n.label)));
ok("shape modifier applied", s.find((n) => n.key === "db")?.type === "ellipse");
ok("colour modifier applied", s.find((n) => n.key === "db")?.fill !== "transparent",
  s.find((n) => n.key === "db")?.fill);
ok("edges created and bound", a.length === 2 && a.every((e) => e.bound), JSON.stringify(a));
ok("dashed edge honoured", a.some((e) => e.style === "dashed"));
ok("edge label applied", a.some((e) => e.label === "queries"));
ok("new diagram was laid out", s.some((n) => n.y !== s[0].y), s.map((n) => `${n.key}@${n.x},${n.y}`).join(" "));

await p.screenshot({ path: new URL("../.smoke/dsl.png", import.meta.url).pathname });

// --- positions survive an edit --------------------------------------------
const before = await shapes();
await type(`api: API Gateway
db: Postgres [ellipse] {blue}
cache: Redis [diamond]

api -> db: reads
api --> cache`);
const after = await shapes();
ok(
  "editing a label leaves positions alone",
  before.every((n) => {
    const m = after.find((x) => x.key === n.key);
    return m && m.x === n.x && m.y === n.y;
  }),
  "positions preserved",
);
ok("edge label updated in place", (await arrows()).some((e) => e.label === "reads"));

// --- canvas -> text --------------------------------------------------------
await p.click("body");
await p.waitForTimeout(200);
await p.evaluate(async () => {
  const store = window.__scene;
  const { refreshTextLayout } = await import("/src/actions.ts");
  const api = store.visibleElements.find((e) => e.dslKey === "api");
  store.mutate(() => {
    store.updateElement(api.boundText, () => ({ text: "Edge Gateway" }));
    refreshTextLayout([api.boundText]);
  });
});
await p.waitForTimeout(700);
ok("canvas edits flow back into the text", (await panelText()).includes("Edge Gateway"),
  (await panelText()).split("\n")[0]);

// a shape drawn by hand should appear as a new line
await p.evaluate(async () => {
  const store = window.__scene;
  const { newGenericElement, newTextElement } = await import("/src/elements/factory.ts");
  const { refreshTextLayout } = await import("/src/actions.ts");
  store.mutate(() => {
    const el = newGenericElement("rectangle", store.appState, 900, 600);
    el.width = 160; el.height = 80;
    store.addElements(el);
    const t = newTextElement(store.appState, 900, 600, el.id);
    t.text = "Worker";
    store.addElements(t);
    store.updateElement(el.id, () => ({ boundText: t.id }));
    refreshTextLayout([t.id]);
  });
});
await p.waitForTimeout(700);
ok("a hand-drawn shape shows up in the text", (await panelText()).includes("Worker"));

// --- no feedback loop ------------------------------------------------------
const settled1 = await p.evaluate(() => window.__scene.getVersion());
await p.waitForTimeout(1600);
const settled2 = await p.evaluate(() => window.__scene.getVersion());
ok("the two views settle instead of looping", settled1 === settled2, `${settled1} -> ${settled2}`);

// --- deletions and errors --------------------------------------------------
await type(`api: Edge Gateway
db: Postgres [ellipse] {blue}
worker: Worker

api -> db: reads`);
ok("removing a line deletes its shape", (await shapes()).length === 3,
  (await shapes()).map((n) => n.key).join(" "));
ok("removing an edge deletes its arrow", (await arrows()).length === 1);

await type(`api: Edge Gateway
bad name here!: nope
api -> db`);
const issues = await p.locator(".diagram-issues li").allTextContents();
ok("bad syntax is reported with a line number", issues.length > 0, issues.join(" | "));

// --- untranslatable content is never destroyed -----------------------------
await p.evaluate(async () => {
  const store = window.__scene;
  const { newFreedrawElement } = await import("/src/elements/factory.ts");
  store.mutate(() => {
    const el = newFreedrawElement(store.appState, 200, 700);
    el.points = [[0, 0], [40, 20], [80, 0]];
    store.addElements(el);
  });
});
await p.waitForTimeout(600);
await type(`only: Just one box`);
const freehandLeft = await p.evaluate(
  () => window.__scene.visibleElements.filter((e) => e.type === "freedraw").length,
);
ok("freehand strokes survive a text rewrite", freehandLeft === 1, `${freehandLeft} left`);

await b.close();
