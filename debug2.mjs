import { chromium } from "playwright";

const ctx = await chromium.launchPersistentContext(
  "/home/nasser/Downloads/test/fb-group-poster/browser-data",
  {
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ["--no-first-run"],
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  }
);

const page = await ctx.newPage();
await page.goto("https://www.facebook.com/groups/joins/?nav_source=tab", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(4000);

// section headers on the page
const headers = await page.evaluate(() =>
  [...document.querySelectorAll("h2, h3, [role='heading']")]
    .map((h) => h.textContent.trim())
    .filter(Boolean)
    .slice(0, 20)
);
console.log("headers:", JSON.stringify(headers));

// all anchors whose text is عرض الكل / see all — click the first with real click
const link = page.locator('a:has-text("عرض الكل"), a:has-text("See all")').first();
if (await link.isVisible().catch(() => false)) {
  console.log("clicking عرض الكل link...");
  await link.click();
  await page.waitForTimeout(5000);
  console.log("URL after click:", page.url());
}

const state = await page.evaluate(() => {
  const ids = new Set();
  const names = [];
  for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
    const m = (a.getAttribute("href") || "").match(/facebook\.com\/groups\/(\d+)/);
    if (!m) continue;
    ids.add(m[1]);
    const label = a.getAttribute("aria-label");
    if (label && label.length > 2) names.push(label.slice(0, 40));
  }
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  return {
    ids: ids.size,
    uniqueNames: [...new Set(names)].slice(0, 100),
    dialogCount: dialogs.length,
    dialogSnippet: dialogs[0] ? dialogs[0].textContent.slice(0, 300) : "",
    bodyH: document.body.scrollHeight,
  };
});
console.log("ids:", state.ids, "bodyH:", state.bodyH, "dialogs:", state.dialogCount);
console.log("names:", JSON.stringify(state.uniqueNames, null, 0));
console.log("dialog:", state.dialogSnippet);

await ctx.close();