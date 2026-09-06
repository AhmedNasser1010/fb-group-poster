import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";

export interface PostResult {
  success: boolean;
  message: string;
}

// Per-post comment boxes must NEVER be treated as the group composer. Their
// accessible labels look like "Comment as …" (en) / "تعليق باسم …" (ar).
// Typing into one and pressing Enter (which happens for any newline in the
// text) posts a COMMENT on the first post in the feed instead of a group post.
const COMMENT_LABEL_RE = /تعليق|comment/i;

// Text of the composer trigger on the group page (Arabic + English layouts):
// "اكتب شيئًا...", "أنشئ منشورًا عامًا", "What's on your mind...",
// "Write something...", "Start a discussion", "Announce something", etc.
// NOTE: no "u" flag — Playwright fails to serialize flagged regexes for
// locator.filter({ hasText }) (Invalid flags supplied to RegExp constructor).
const TRIGGER_TEXT_RE =
  /what'?s on your mind|write something|create (?:a )?public post|start a discussion|announce something|اكتب شيئ|أنشئ منشور|انشئ منشور|اكتب منشور|إنشاء منشور|انشاء منشور|ابدأ مناقشة|ابدا مناقشة|أعلن شيئ|اعلن شيئ/;

// Submit button of the composer dialog: "Post" (en) / "نشر" / "أنشر" (ar).
const POST_BUTTON_RE = /^(?:post|نشر|أنشر|انشر)$/i;

/** Best-effort HTML dump for debugging (enabled with FB_DEBUG_HTML=1). */
async function dumpHtml(page: Page, tag: string): Promise<void> {
  if (!process.env.FB_DEBUG_HTML) return;
  try {
    const dir = path.join(process.cwd(), "debug");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${tag}.html`), await page.content());
  } catch {
    // Debug dump is best-effort only
  }
}

/** True when the element is a per-post comment box rather than a composer. */
function isCommentBox(loc: Locator): Promise<boolean> {
  // NOTE: fail-open on inspection errors. React swaps the composer textbox out
  // right after the dialog opens (element detached → evaluate throws); treating
  // that as "comment box" wrongly aborts real posts. Comment boxes are already
  // excluded at candidate-selection time, so this guard only acts on a
  // positively identified "تعليق باسم …"/"Comment as …" label.
  return loc
    .evaluate((el) => {
      const label = el.getAttribute("aria-label") || "";
      const placeholder = el.getAttribute("data-placeholder") || "";
      return COMMENT_LABEL_RE.test(label) || COMMENT_LABEL_RE.test(placeholder);
    })
    .catch(() => false);
}

export async function postToGroup(
  context: BrowserContext,
  groupUrl: string,
  text: string,
  imagePath?: string,
  expectedPageName?: string
): Promise<PostResult> {
  const page = await context.newPage();
  try {
    await page.goto(groupUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes("login") || url.includes("checkpoint")) {
      return { success: false, message: "Not logged in to Facebook" };
    }
    await dumpHtml(page, "group-page");

    // The composer trigger can appear in several forms depending on FB layout:
    // - a button labeled "What's on your mind" / "اكتب شيئًا..." / ...
    // - a div with role="button" carrying the same text (common in groups)
    // - an inline composer textbox (no click needed) on some layouts.
    // The last candidate explicitly excludes the per-post comment boxes —
    // those are also div[contenteditable][role=textbox] but live inside the
    // feed with a "تعليق باسم …"/"Comment as …" label.
    const triggerCandidates: Locator[] = [
      page.getByRole("button", { name: TRIGGER_TEXT_RE }).first(),
      page
        .locator('[role="button"]')
        .filter({ hasText: TRIGGER_TEXT_RE })
        .first(),
      page
        .locator(
          'div[contenteditable="true"][role="textbox"]:not([aria-label*="تعليق"]):not([aria-label*="comment" i])'
        )
        .first(),
    ];

    let composerEl: Locator | null = null;
    let inlineComposer = false;
    for (let i = 0; i < triggerCandidates.length; i++) {
      const candidate = triggerCandidates[i];
      const visible = await candidate.isVisible({ timeout: 5000 }).catch(() => false);
      if (!visible) continue;

      // Defense in depth: the raw-textbox fallback must not be a comment box
      // (e.g. an unlabeled comment input on some layouts).
      if (i === triggerCandidates.length - 1 && (await isCommentBox(candidate))) {
        continue;
      }

      composerEl = candidate;
      // If it's already a textbox, we can type directly without clicking
      const role = await candidate
        .evaluate((el) => el.getAttribute("role"))
        .catch(() => null);
      inlineComposer = role === "textbox";
      break;
    }

    if (!composerEl) {
      await dumpHtml(page, "composer-not-found");
      // Gather page hints to help diagnose why the composer wasn't found
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 3000 })
        .catch(() => "");
      const hints: string[] = [];
      if (/pending|request to join|membership/i.test(bodyText ?? "")) {
        hints.push("your membership may be pending approval");
      }
      if (/only admins|posting is turned off|turned off|not allowed/i.test(bodyText ?? "")) {
        hints.push("posting may be turned off for members");
      }
      if (/you'?,?ve been blocked|muted/i.test(bodyText ?? "")) {
        hints.push("you may be muted or blocked from this group");
      }
      const hint = hints.length ? ` (${hints.join("; ")})` : "";
      return {
        success: false,
        message: `Could not find the post composer${hint}. If none apply, Facebook's layout may have changed or you don't have permission to post in this group.`,
      };
    }

    if (!inlineComposer) {
      await composerEl.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    }

    const dialog = page.getByRole("dialog").first();
    let dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inlineComposer && !dialogVisible) {
      // The first click is sometimes swallowed while the feed is still
      // hydrating — retry once before giving up.
      await composerEl.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
      dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    }

    let textbox;
    if (inlineComposer && !dialogVisible) {
      // Inline layout: type directly into the composer element
      textbox = composerEl!;
    } else {
      if (!dialogVisible) {
        await dumpHtml(page, "dialog-not-open");
        return {
          success: false,
          message: "Post composer dialog did not open",
        };
      }
      // Let the composer finish loading before resolving its textbox — while
      // the dialog shows a spinner, its first render (including the textbox)
      // is often replaced, which detaches the element mid-flow.
      await page.waitForTimeout(1500);
      textbox = dialog
        .locator('div[contenteditable="true"][role="textbox"]')
        .first();
    }

    const textboxVisible = await textbox
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!textboxVisible) {
      return {
        success: false,
        message: "Could not find the text input in the composer",
      };
    }

    // Defense in depth: whatever textbox we resolved, bail out if it is a
    // per-post comment box instead of the composer.
    if (await isCommentBox(textbox)) {
      await dumpHtml(page, "comment-box-instead-of-composer");
      return {
        success: false,
        message:
          "Refused to post: only a comment box was found, not the group composer.",
      };
    }

    if (expectedPageName) {
      const identityCheck = dialog
        .locator('[role="button"]')
        .filter({ hasText: new RegExp(expectedPageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
      const identityVisible = await identityCheck
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (!identityVisible) {
        await page.keyboard.press("Escape");
        return {
          success: false,
          message:
            "This group does not allow Page posting. The composer is profile-only. Try posting as your personal profile instead.",
        };
      }
    }

    await textbox.click();
    await textbox.fill("");

    // Fast path: put the text on the clipboard and Ctrl+V it into the
    // composer. Pasted newlines are inserted as line breaks in one input
    // event — fast, and no Enter keypress is ever sent (which could submit).
    // The clipboard API needs explicit permission in Chromium.
    let pasted = false;
    try {
      const origin = new URL(page.url()).origin;
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin,
      });
      pasted = await page.evaluate(async (t) => {
        try {
          await navigator.clipboard.writeText(t);
          return true;
        } catch {
          return false;
        }
      }, text);
      if (pasted) {
        await page.keyboard.press(
          process.platform === "darwin" ? "Meta+v" : "Control+v"
        );
        await page.waitForTimeout(300);
      }
    } catch {
      pasted = false;
    }

    // Verify the editor actually received the text; otherwise fall back to
    // human-style typing (Shift+Enter for line breaks — a plain Enter
    // submits comment boxes).
    const editorText = await textbox
      .evaluate((el) => (el as HTMLElement).innerText)
      .catch(() => "");
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    if (normalize(editorText) !== normalize(text)) {
      const typeDelayMs = Math.max(
        0,
        Number.parseInt(process.env.FB_TYPE_DELAY_MS || "80", 10) || 80
      );
      const lines = text.replace(/\r\n?/g, "\n").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) await textbox.press("Shift+Enter");
        await textbox.pressSequentially(lines[i], { delay: typeDelayMs });
      }
    }

    await page.waitForTimeout(1000);

    if (imagePath) {
      try {
        // FB keeps a hidden <input type="file"> inside the composer. Set the
        // file on it directly — clicking the "Photo/Video" button would open
        // the OS file explorer instead. setInputFiles works on hidden inputs.
        const fileInput = dialog
          .locator('input[type="file"][accept*="image"], input[type="file"]')
          .first();
        const inputAttached = await fileInput
          .waitFor({ state: "attached", timeout: 3000 })
          .then(() => true)
          .catch(() => false);

        if (inputAttached) {
          await fileInput.setInputFiles(imagePath);
          await page.waitForTimeout(3000);
        } else {
          // No pre-rendered input: click the Photo/Video button and intercept
          // the native file chooser that FB opens.
          const photoBtn = dialog
            .getByRole("button", { name: /photo|image|video|صور|فيديو/i })
            .first();

          const photoBtnVisible = await photoBtn
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          if (photoBtnVisible) {
            const [chooser] = await Promise.all([
              page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null),
              photoBtn.click(),
            ]);
            if (chooser) {
              await chooser.setFiles(imagePath);
              await page.waitForTimeout(3000);
            }
          }
        }
      } catch {
        // Image upload failed, continue without image
      }
    }

    const postBtn = dialog
      .getByRole("button", { name: POST_BUTTON_RE })
      .first();

    const postBtnVisible = await postBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!postBtnVisible) {
      await dumpHtml(page, "post-button-not-found");
      return {
        success: false,
        message: "Could not find the Post button",
      };
    }

    const isDisabled = await postBtn.isDisabled();
    if (isDisabled) {
      return {
        success: false,
        message: "Post button is disabled. The content may not be valid.",
      };
    }

    await postBtn.click({ timeout: 5000 });

    // After clicking Post, FB often shows a transient status like
    // "جارٍ النشر…" (Posting in progress) instead of closing the dialog
    // right away — that is NOT an error. Poll for the actual outcome: any
    // status that isn't an error means FB is still processing → keep waiting.
    const errorRe = /error|failed|فشل|حاول مجددًا|حاول مرة أخرى|try again/i;

    const deadline = Date.now() + 20000;
    let lastStatus = "";
    while (Date.now() < deadline) {
      await page.waitForTimeout(1500);

      const dialogStillVisible = await dialog
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (!dialogStillVisible) {
        return { success: true, message: "Post published successfully" };
      }

      const statusText = await dialog
        .locator('[role="alert"], [role="status"]')
        .first()
        .textContent({ timeout: 1000 })
        .catch(() => "");

      if (statusText) {
        lastStatus = statusText.trim();
        if (errorRe.test(lastStatus)) {
          return { success: false, message: `Post failed: ${lastStatus}` };
        }
        // progress status (e.g. "جارٍ النشر") → keep waiting
      }
    }

    // Timed out without a clear outcome — the post was submitted (FB may
    // still be processing, e.g. pending admin approval) but verify manually.
    await dumpHtml(page, "post-uncertain");
    return {
      success: true,
      message: `Post submitted (still processing on Facebook${lastStatus ? `: ${lastStatus}` : ""}) — verify on Facebook`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Post failed: ${message}` };
  } finally {
    await page.close();
  }
}
