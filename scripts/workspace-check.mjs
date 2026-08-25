/** End-to-end checks for workspace navigation, comments, recovery, and presets. */
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const check = (name, passed, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures.push(name);
};

await page.goto("http://127.0.0.1:5180/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.evaluate(async () => {
  const store = window.__scene;
  const { newGenericElement, newTextElement } = await import("/src/elements/factory.ts");
  const shape = newGenericElement("rectangle", store.appState, 320, 220);
  shape.width = 180; shape.height = 100;
  const label = newTextElement(store.appState, 340, 250);
  label.text = "Gateway"; label.containerId = shape.id;
  shape.boundText = label.id;
  store.addElements(shape, label);
  store.setAppState({ selectedIds: [shape.id] });

  const document = {
    type: "fluxxdraw", version: 1, source: "fluxxdraw",
    elements: [shape, label], files: {},
    appState: { viewBackgroundColor: "#ffffff", gridSize: null, theme: "light" },
  };
  localStorage.setItem("fluxxdraw:recent_documents", JSON.stringify([{ id: "recent", name: "Gateway.fluxx", updatedAt: Date.now(), document }]));
  localStorage.setItem("fluxxdraw:recovery_snapshots", JSON.stringify([{ id: "recovery", name: "Recovery.fluxx", updatedAt: Date.now(), document }]));
});

await page.getByRole("button", { name: "Menu" }).click();
await page.getByRole("menuitem", { name: /Workspace, comments/ }).click();
await page.getByPlaceholder("Search layers…").fill("Gateway");
check("layer search finds labelled object", await page.locator(".workspace-row").count() === 1);
await page.locator(".workspace-row").click();
check("layer click selects object", await page.evaluate(() => window.__scene.appState.selectedIds.length === 1));

await page.getByRole("button", { name: "Comments" }).click();
await page.getByRole("button", { name: "Add comment to selection" }).click();
await page.locator("#input-dialog-field").fill("Review gateway capacity");
await page.getByRole("button", { name: "Add comment", exact: true }).click();
check("comment is persisted", await page.evaluate(() => JSON.parse(localStorage.getItem("fluxxdraw:comments") ?? "[]").length === 1));
check("comment pin appears", await page.locator(".comment-pin").count() === 1);

await page.getByRole("button", { name: "Recent" }).click();
check("recent document is listed", await page.getByText("Gateway.fluxx", { exact: true }).count() === 1);
await page.getByRole("button", { name: "Recovery" }).click();
check("recovery snapshot is listed", await page.getByText("Recovery.fluxx", { exact: true }).count() === 1);

await page.getByRole("button", { name: "Close workspace" }).click();
await page.getByRole("button", { name: "+ Save current" }).click();
await page.locator("#input-dialog-field").fill("Gateway style");
await page.getByRole("button", { name: "Save preset" }).click();
check("style preset is persisted", await page.evaluate(() => JSON.parse(localStorage.getItem("fluxxdraw:style_presets") ?? "[]").length === 1));
check("style preset is visible", await page.locator(".style-preset > button:first-child", { hasText: "Gateway style" }).count() === 1);

await browser.close();
if (failures.length) process.exitCode = 1;
