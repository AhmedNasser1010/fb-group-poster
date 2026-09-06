import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

// Mirrors the NEW trigger/post-button regexes planned for poster.ts so we can
// verify them against the live page before editing the app code.
const TRIGGER_RE =
  /what'?s on your mind|write something|create (?:a )?public post|start a discussion|announce something|اكتب شيئ|أنشئ منشور|انشئ منشور|اكتب منشور|إنشاء منشور|انشاء منشور|ابدأ مناقشة|ابدا مناقشة|أعلن شيئ|اعلن شيئ/;
const POST_RE = /^(?:post|نشر|أنشر|انشر)$/i;

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
await page.goto("https://www.facebook.com/groups/1121944258704221/", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(6000);
console.log("URL:", page.url());

// Full page HTML for manual inspection
await mkdir("debug", { recursive: true });
await writeFile("debug/group-page.html", await page.content());
console.log("saved debug/group-page.html");

// 1) All contenteditable textboxes on the feed (expected: comment boxes only)
const boxes = await page
  .locator('div[contenteditable="true"][role="textbox"]')
  .all();
for (let i = 0; i < boxes.length; i++) {
  console.log(
    `contenteditable[${i}] aria-label:`,
    await boxes[i].getAttribute("aria-label")
  );
}

// 2) New trigger candidates
const byRole = page.getByRole("button", { name: TRIGGER_RE });
console.log("candidate1 getByRole(button) matches:", await byRole.count());
const byLocator = page
  .locator('[role="button"]')
  .filter({ hasText: TRIGGER_RE });
console.log("candidate2 [role=button]+hasText matches:", await byLocator.count());
const trigger = byLocator.first();
console.log("trigger text:", (await trigger.textContent())?.trim());

// 3) Click the trigger and inspect the composer dialog
await trigger.click();
await page
  .getByRole("dialog")
  .first()
  .waitFor({ state: "visible", timeout: 8000 })
  .catch(() => {});
const dialog = page.getByRole("dialog").first();
const dialogVisible = await dialog.isVisible().catch(() => false);
console.log("dialog visible:", dialogVisible);

if (dialogVisible) {
  await writeFile("debug/group-page-composer-dialog.html", await page.content());
  console.log("saved debug/group-page-composer-dialog.html");

  const info = await dialog.evaluate((d) => {
    const name = (el) =>
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().slice(0, 40);
    return {
      dialogLabel: d.getAttribute("aria-label"),
      textboxes: [...d.querySelectorAll('div[contenteditable="true"][role="textbox"]')].map(name),
      buttons: [...d.querySelectorAll('[role="button"]')]
        .map(name)
        .filter((t) => t && t.length <= 30),
    };
  });
  console.log("dialog info:", JSON.stringify(info, null, 1));

  // 4) Verify Shift+Enter multiline typing WITHOUT posting
  const tb = dialog
    .locator('div[contenteditable="true"][role="textbox"]')
    .first();
  await tb.click();
  await tb.pressSequentially("Cline rehearsal line one", { delay: 10 });
  await tb.press("Shift+Enter");
  await tb.pressSequentially("line two", { delay: 10 });
  const content = await tb.evaluate((el) => el.innerText || el.textContent);
  console.log("textbox content after Shift+Enter:", JSON.stringify(content));

  // 5) Verify the Post button regex matches inside the dialog (no click!)
  console.log(
    "Post-button regex matches in dialog:",
    await dialog.getByRole("button", { name: POST_RE }).count()
  );

  await page.keyboard.press("Escape");
}

await page.waitForTimeout(1500);
await ctx.close();
console.log("done (nothing was published)");
