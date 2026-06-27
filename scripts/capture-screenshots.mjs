import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.OBSCURA_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.resolve("docs/screenshots");
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

await mkdir(outputDirectory, { recursive: true });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.screenshot({
  path: path.join(outputDirectory, "landing.png"),
  fullPage: true,
});

await desktop.goto(`${baseUrl}/wallet`, { waitUntil: "networkidle" });
await desktop.screenshot({
  path: path.join(outputDirectory, "dashboard.png"),
  fullPage: true,
});

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const route of ["/", "/wallet", "/wallet/shield", "/wallet/send"]) {
  await mobile.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (overflow) throw new Error(`Horizontal overflow detected on ${route}`);
}

await browser.close();
