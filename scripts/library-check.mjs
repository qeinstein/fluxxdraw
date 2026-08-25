/** End-to-end check for remote library install, persistence, and placement. */
import "dotenv/config";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL ?? process.env.VITE_DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or VITE_DATABASE_URL is required");

const sql = neon(databaseUrl);
const libraries = await sql`
  select id, name, description, preview
  from libraries
  where content is not null
`;
if (!libraries.length) throw new Error("No installable library found");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const check = (name, passed, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures.push(name);
};

await page.route("**/api/libraries", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify(libraries.map(({ content: _content, ...library }) => library)),
}));
await page.route("**/api/libraries/*/content", async (route) => {
  const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2));
  const [library] = await sql`select content from libraries where id = ${id} limit 1`;
  return route.fulfill({
    status: library ? 200 : 404,
    contentType: "application/json",
    body: JSON.stringify(library?.content ?? { error: "Not found" }),
  });
});

await page.goto("http://127.0.0.1:5180/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Library" }).click();
await page.getByRole("button", { name: "Browse", exact: true }).click();
const expectedFirst = await page.evaluate(async (items) => {
  const { rankLibraries } = await import("/src/libraryRanking.ts");
  return rankLibraries(items)[0].name;
}, libraries);
const visibleFirst = await page.locator(".library-browse-card .library-browse-info strong").first().textContent();
check("architecture ranking controls first result", visibleFirst === expectedFirst, `${visibleFirst}`);
await page.getByRole("button", { name: "Add to FluxxDraw" }).first().click();
await page.waitForSelector(".library-status.success");

const installedBeforeReload = await page.evaluate(() => {
  const items = JSON.parse(localStorage.getItem("fluxxdraw:local_library") ?? "[]");
  return { count: items.length, hasElements: items.every((item) => item.elements?.length > 0) };
});
check("library saved locally", installedBeforeReload.count > 0, `${installedBeforeReload.count} components`);
check("saved components contain elements", installedBeforeReload.hasElements);

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Library" }).click();
const persisted = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("fluxxdraw:local_library") ?? "[]").length,
);
check("library survives reload", persisted === installedBeforeReload.count, `${persisted} components`);

const before = await page.evaluate(() => window.__scene.visibleElements.length);
await page.locator(".library-item").first().click();
await page.locator(".canvas-container canvas").click({ position: { x: 720, y: 450 } });
const after = await page.evaluate(() => window.__scene.visibleElements.length);
check("installed component places on canvas", after > before, `${before} -> ${after} elements`);

await browser.close();
if (failures.length) process.exitCode = 1;
