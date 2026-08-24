/** Renders the SVG mark into the PNG sizes the web manifest requires. */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const OUT = new URL("../public/", import.meta.url).pathname;

const mark = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512">
  <rect width="32" height="32" rx="${padding ? 0 : 7}" fill="#5b57d1"/>
  <g transform="translate(16 16) scale(${padding ? 0.72 : 1}) translate(-16 -16)">
    <path d="M9 22.5c2.2-3.4 4.4-6.8 7-9.6 1.3-1.4 2.9-2.8 4.7-2.6 1.5.2 2.4 1.7 2.3 3"
      fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="22.4" cy="21.6" r="2.2" fill="#fff"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable.png", 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0">${mark(maskable).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`,
  );
  writeFileSync(`${OUT}${name}`, await page.screenshot({ omitBackground: !maskable }));
  console.log("wrote", name);
}

await browser.close();
