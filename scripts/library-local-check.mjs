/** Verifies personal-library search and readable placement of white ink. */
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
page.setDefaultTimeout(8000);
const failures = [];
const check = (name, passed, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures.push(name);
};

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".toolbar");
await page.evaluate(() => localStorage.clear());
const whiteItem = await page.evaluate(async () => {
  const { store } = await import("/src/store.ts");
  const { newGenericElement } = await import("/src/elements/factory.ts");
  const shape = newGenericElement("rectangle", store.appState, 0, 0);
  shape.width = 140;
  shape.height = 80;
  shape.strokeColor = "#ffffff";
  shape.textColor = "#ffffff";
  return { id: "white-component", name: "White Component", elements: [shape], lastUsed: 1, useCount: 0 };
});
await page.evaluate((item) => {
  localStorage.setItem("fluxxdraw:local_library", JSON.stringify([item, {
    ...item,
    id: "database-component",
    name: "Database Component",
    elements: item.elements.map((element) => ({ ...element, strokeColor: "#1e1e1e", textColor: "#1e1e1e" })),
  }]));
}, whiteItem);
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "More options" }).click();
await page.getByRole("button", { name: "Library" }).click();

const search = page.getByRole("searchbox", { name: "Search your library" });
await search.fill("white component");
await page.waitForTimeout(100);
const labels = await page.locator(".library-item-label").allTextContents();
check("personal library has a search field", await search.count() === 1);
check("personal library search filters by name", labels.length > 0 && labels.every((label) => label === "White Component"), labels.join(" | "));

const previewBackground = await page.locator(".library-item-content.preview-bg").first().evaluate((element) => getComputedStyle(element).backgroundColor);
check("white component preview has a readable surface", previewBackground === "rgb(255, 255, 255)", previewBackground);

const before = await page.evaluate(() => window.__scene.visibleElements.length);
await page.locator(".library-item").first().click();
await page.locator(".canvas-container canvas").click({ position: { x: 500, y: 400 } });
const placed = await page.evaluate(() => window.__scene.visibleElements.find((element) => element.dslKey === undefined && element.type === "rectangle"));
check("personal component places on canvas", (await page.evaluate(() => window.__scene.visibleElements.length)) > before);
check("white component ink adapts to the light canvas", placed?.strokeColor === "#1e1e1e", placed?.strokeColor);

await browser.close();
if (failures.length) process.exitCode = 1;
