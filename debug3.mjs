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

// scroll until stable
for (let i = 1; i <= 20; i++) {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await page.waitForTimeout(700);
}

const dump = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
    const href = a.getAttribute("href") || "";
    const m = href.match(/facebook\.com\/groups\/(\d+)/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    // walk up to find a container that looks like a card: contains an image
    // and some heading-ish element
    let card = a;
    for (let i = 0; i < 10; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (card.querySelector("img") && card.textContent.length > 30) break;
    }
    const heading = card.querySelector("h2, h3, [role='heading']");
    out.push({
      id: m[1],
      anchorLabel: a.getAttribute("aria-label"),
      anchorText: (a.textContent || "").trim().slice(0, 40),
      heading: heading ? heading.textContent.trim().slice(0, 50) : null,
      cardText: (card.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
      parentClasses: String(a.parentElement.className).slice(0, 60),
    });
    if (out.length >= 80) break;
  }
  return out;
});
console.log("total:", dump.length);
for (const d of dump.slice(0, 80)) {
  console.log(JSON.stringify(d));
}

await ctx.close();