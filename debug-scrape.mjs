import { chromium } from "playwright";

const ctx = await chromium.launchPersistentContext(
  "/home/nasser/Downloads/test/fb-group-poster/browser-data",
  {
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  }
);

const page = await ctx.newPage();
await page.goto("https://www.facebook.com/groups/joins/?nav_source=tab", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(3000);
console.log("URL:", page.url());

const countIds = () =>
  page.evaluate(() => {
    const ids = new Set();
    for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
      const m = (a.getAttribute("href") || "").match(
        /facebook\.com\/groups\/(\d+)/
      );
      if (m) ids.add(m[1]);
    }
    return ids.size;
  });

console.log("initial id count:", await countIds());

for (let i = 1; i <= 12; i++) {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(() => {
    const scrollables = [];
    for (const el of document.querySelectorAll("*")) {
      if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200) {
        scrollables.push(
          el.tagName +
            "." +
            String(el.className).slice(0, 40) +
            " sh=" +
            el.scrollHeight +
            " ch=" +
            el.clientHeight
        );
      }
    }
    return {
      bodyH: document.body.scrollHeight,
      winY: window.scrollY,
      scrollables: scrollables.slice(0, 5),
    };
  });
  console.log(
    `round ${i}: ids=${await countIds()} bodyH=${metrics.bodyH} winY=${metrics.winY}`
  );
  if (metrics.scrollables.length)
    console.log("  inner scrollables:", metrics.scrollables);
}

// dump candidate expander buttons
const btns = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('[role="button"], button, a')) {
    const t = (el.textContent || "").trim();
    if (/عرض|المزيد|الكل|see more|see all/i.test(t) && t.length < 40)
      out.push(t + " | " + el.tagName + ' role=' + el.getAttribute("role"));
  }
  return [...new Set(out)].slice(0, 15);
});
console.log("expander candidates:", btns);

// dump group links with the app's filtering decisions
const report = await page.evaluate(() => {
  const FEED_LINK =
    /multi_permalinks|comment_id|reply_comment_id|\/posts\/|\/permalink\/|\/share\/|story_fbid|notif_id|notif_t/;
  const CARD_MARKERS =
    /\b(?:members?|group)\b|مجموعة|أعضاء|عضو|آخر نشاط|last (?:activity|active)/i;
  const out = { kept: [], reasons: {} };
  const seen = new Set();
  const note = (r) => (out.reasons[r] = (out.reasons[r] || 0) + 1);
  for (const el of document.querySelectorAll(
    'a[href*="/www.facebook.com/groups/"], a[href*="/groups/"]'
  )) {
    const href = el.getAttribute("href") || "";
    const match = href.match(/https?:\/\/[a-z.]*facebook\.com\/groups\/(\d+)/);
    if (!match) continue;
    const id = match[1];
    if (seen.has(id)) continue;
    if (FEED_LINK.test(href)) { note("feedlink"); continue; }
    let card = el;
    for (let i = 0; i < 8; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (CARD_MARKERS.test(card.textContent || "")) break;
    }
    const cardText = (card.textContent || "")
      .replace(/[\u200e\u200f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!CARD_MARKERS.test(cardText)) { note("no-card-marker"); continue; }
    let name = el.getAttribute("aria-label") || el.textContent || "";
    name = name.replace(/\s+/g, " ").replace(/آخر نشاط.*$/, "")
      .replace(/last (?:activity|active).*$/i, "").trim();
    if (!name || name.length < 2 || name.length > 140) { note("bad-name:" + JSON.stringify(name.slice(0,30))); continue; }
    if (/^غير مقروءة/.test(name)) { note("unread"); continue; }
    if (/^(عرض المجموعة|view group)$/i.test(name)) { note("view-group"); continue; }
    seen.add(id);
    out.kept.push({ id, name: name.slice(0, 50), cardText: cardText.slice(0, 120) });
  }
  return out;
});
console.log("kept:", report.kept.length);
console.log("drop reasons:", report.reasons);
for (const k of report.kept) console.log(" -", k.id, "|", k.name);

// follow the "عرض الكل" (See all) link — the full joined-groups list
const seeAllHref = await page.evaluate(() => {
  for (const el of document.querySelectorAll("a")) {
    const t = (el.textContent || "").trim();
    if (/^(عرض الكل|see all)$/i.test(t))
      return el.href;
  }
  return null;
});
console.log("see-all href:", seeAllHref);
if (seeAllHref) {
  await page.goto(seeAllHref, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("see-all URL:", page.url());
  console.log("see-all initial ids:", await countIds());
  for (let i = 1; i <= 25; i++) {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => ({
      bodyH: document.body.scrollHeight,
      winY: window.scrollY,
    }));
    const ids = await countIds();
    console.log(`see-all round ${i}: ids=${ids} bodyH=${m.bodyH} winY=${m.winY}`);
    if (i > 3 && m.bodyH <= 800 + m.winY + 5) {
      // near bottom and stable
    }
  }
}

// test mobile web version (share session cookies via storageState)
const state = await ctx.storageState();
const mobCtx = await ctx.browser().newContext({
  storageState: state,
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  viewport: { width: 412, height: 915 },
});
const mpage = await mobCtx.newPage();
try {
  await mpage.goto("https://m.facebook.com/groups/joins/?nav_source=tab", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await mpage.waitForTimeout(3000);
  console.log("mobile URL:", mpage.url());
  const mCount = () =>
    mpage.evaluate(() => {
      const ids = new Set();
      for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
        const m = (a.getAttribute("href") || "").match(/groups\/(\d+)/);
        if (m) ids.add(m[1]);
      }
      return ids.size;
    });
  console.log("mobile initial ids:", await mCount());
  for (let i = 1; i <= 20; i++) {
    await mpage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mpage.waitForTimeout(700);
    // click "See More" pagination if present (mobile web paginates)
    const more = mpage
      .locator('a:has-text("عرض المزيد"), a:has-text("See More"), div:has-text("عرض المشاركات الأحدث")[role="button"]')
      .first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await mpage.waitForTimeout(800);
    }
    const n = await mCount();
    console.log(`mobile round ${i}: ids=${n}`);
    if (i > 3 && (await mCount()) === (await mCount()) ) {}
  }
} catch (e) {
  console.log("mobile failed:", e.message.slice(0, 200));
}
await mobCtx.close();

// click the "الكل" (All) expander button and see what it reveals
const clicked = await page.evaluate(() => {
  for (const el of document.querySelectorAll('[role="button"], button')) {
    const t = (el.textContent || "").trim();
    if (/^(الكل|all|see all)$/i.test(t)) {
      el.click();
      return t;
    }
  }
  return null;
});
console.log("clicked button:", clicked);
await page.waitForTimeout(4000);

const afterClick = await page.evaluate(() => {
  const ids = new Set();
  for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
    const m = (a.getAttribute("href") || "").match(/facebook\.com\/groups\/(\d+)/);
    if (m) ids.add(m[1]);
  }
  // also list dialog contents
  const dialogs = document.querySelectorAll('[role="dialog"]');
  return {
    totalIds: ids.size,
    dialogCount: dialogs.length,
    dialogText: dialogs.length
      ? dialogs[0].textContent.slice(0, 500)
      : "",
  };
});
console.log("after click:", JSON.stringify(afterClick, null, 1).slice(0, 800));

// keep scrolling inside whatever we got
for (let i = 1; i <= 15; i++) {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await page.waitForTimeout(700);
  const n = await page.evaluate(() => {
    const ids = new Set();
    for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
      const m = (a.getAttribute("href") || "").match(/facebook\.com\/groups\/(\d+)/);
      if (m) ids.add(m[1]);
    }
    return ids.size;
  });
  console.log(`post-click round ${i}: ids=${n}`);
}

await ctx.close();