import type { BrowserContext, Page } from "playwright";
import type { FacebookPage } from "../types";

export interface DetectDiagnostics {
  avatarMenuOpened: boolean;
  seeAllProfilesFound: boolean;
  switcherItemsFound: number;
  filteredCandidates: number;
  note?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openAvatarMenu(page: Page): Promise<boolean> {
  // Try several known shapes for the top-right profile/avatar control.
  const strategies: string[] = [
    '[role="banner"] div[role="button"][aria-label*="profile" i]',
    '[role="banner"] div[role="button"][aria-label]',
    '[aria-label="Your profile"]',
    '[role="banner"] a[aria-label]',
    '[role="banner"] div[role="button"]',
  ];

  for (const sel of strategies) {
    const loc = page.locator(sel).last();
    if (await loc.isVisible({ timeout: 1200 }).catch(() => false)) {
      await loc.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1200);

      // Confirm a profile-related surface opened: either "see all profiles",
      // profile-switch radio rows, or the standard profile menu items.
      const isProfileMenu = await page
        .locator(
          'text=/see all profiles|view all profiles|edit profile|log out|logout/i, [role="radio"][aria-checked]'
        )
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      if (isProfileMenu) return true;

      // Close whatever opened before trying the next strategy.
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  return false;
}

async function openAllProfiles(page: Page): Promise<boolean> {
  const seeAll = page.locator(
    'button, div[role="button"], a[role="button"], a, [role="menuitem"]'
  );
  const count = await seeAll
    .filter({ hasText: /see all profiles|view all profiles/i })
    .count()
    .catch(() => 0);

  let clicked = false;
  for (let i = 0; i < count; i++) {
    const candidate = seeAll.filter({ hasText: /see all profiles|view all profiles/i }).nth(i);
    if (await candidate.isVisible({ timeout: 1500 }).catch(() => false)) {
      await candidate.click({ timeout: 3000 }).catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Keyboard fallback: arrow navigation often exposes profile switching.
    await page.keyboard.press("Escape");
  }

  await page.waitForTimeout(2500);
  return clicked;
}

interface RawCandidate {
  text: string;
  href: string;
  avatar: string;
}

async function scrapeSwitcherItems(page: Page): Promise<
  { candidates: RawCandidate[]; itemsFound: number }
> {
  // Prefer the profile-switching dialog when one is present; otherwise scan
  // the whole page (Facebook sometimes renders the switcher over the main feed).
  const dialog = page.locator('div[role="dialog"], [role="dialog"]');
  const root = (await dialog.first().isVisible({ timeout: 1500 }).catch(() => false))
    ? dialog
    : page.locator("body");

  const rows = await root
    .locator('[role="button"], a[role="link"], [role="menuitem"], a')
    .evaluateAll((els) => {
      const out: RawCandidate[] = [];
      const seen = new Set<string>();
      for (const el of els) {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 140) continue;
        if (seen.has(text)) continue;

        let avatar = "";
        const svgImg = el.querySelector("image");
        if (svgImg) {
          avatar =
            svgImg.getAttribute("xlink:href") ||
            svgImg.getAttribute("href") ||
            "";
        }
        if (!avatar) {
          const img = el.querySelector("img");
          if (img) avatar = img.getAttribute("src") || "";
        }
        if (!avatar) {
          const withBg = el.querySelector('[style*="url("]');
          const style = withBg ? withBg.getAttribute("style") : null;
          if (style) {
            const match = style.match(/url\("?([^")]+)"?\)/);
            if (match) avatar = match[1];
          }
        }

        const linkEl = el.closest("a");
        const href = (linkEl || el).getAttribute("href") || "";

        seen.add(text);
        out.push({ text, href, avatar });
      }
      return out;
    })
    .catch(() => []);

  return { candidates: rows, itemsFound: rows.length };
}

function toPages(candidates: RawCandidate[]): {
  pages: FacebookPage[];
  filtered: number;
} {
  const pages: FacebookPage[] = [];
  const seen = new Set<string>();
  let filtered = 0;

  for (const c of candidates) {
    const text = c.text;

    // Skip obvious noise
    if (
      /log out|settings & privacy|help|report|create (new )?profile|switch back|privacy & security|switch\s*$/i.test(
        text
      )
    ) {
      filtered++;
      continue;
    }

    // A profile row typically is just a short name. Skip anything too verbose.
    if (text.length > 60 || text.split(" ").length > 8) {
      filtered++;
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let id = "";
    const idMatches =
      c.href.match(/\/pages\/[^/]+\/(\d+)/) ||
      c.href.match(/profile\.php\?id=(\d+)/) ||
      c.href.match(/profile_id=(\d+)/);
    if (idMatches) id = idMatches[1];
    if (!id) id = `fb_page_${pages.length}`;

    pages.push({
      id,
      name: text,
      avatarUrl: c.avatar,
    });
  }

  return { pages, filtered };
}

export async function detectPages(
  context: BrowserContext,
  existingDiagnostics?: DetectDiagnostics
): Promise<{ pages: FacebookPage[]; diagnostics: DetectDiagnostics }> {
  const diagnostics: DetectDiagnostics = existingDiagnostics ?? {
    avatarMenuOpened: false,
    seeAllProfilesFound: false,
    switcherItemsFound: 0,
    filteredCandidates: 0,
  };

  const page = await context.newPage();
  try {
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);

    const url = page.url();
    if (url.includes("login") || url.includes("checkpoint")) {
      diagnostics.note = "Not logged in to Facebook";
      return { pages: [], diagnostics };
    }

    diagnostics.avatarMenuOpened = await openAvatarMenu(page);

    if (!diagnostics.avatarMenuOpened) {
      diagnostics.note =
        "Could not open the profile menu. Facebook may have changed its layout.";
      return { pages: [], diagnostics };
    }

    // First pass: scan the open avatar menu. Some Facebook layouts list
    // every profile/Page directly here as radio buttons.
    const first = await scrapeSwitcherItems(page);
    diagnostics.switcherItemsFound = first.itemsFound;
    let { pages } = toPages(first.candidates);
    diagnostics.filteredCandidates = first.candidates.length - pages.length;

    // If nothing found, look for the full "See all profiles" switcher dialog.
    if (pages.length === 0) {
      diagnostics.seeAllProfilesFound = await openAllProfiles(page);

      if (!diagnostics.seeAllProfilesFound) {
        diagnostics.note =
          "Profile menu opened but no Pages appeared and 'See all profiles' was not found. No Pages may be linked to this account.";
        return { pages: [], diagnostics };
      }

      await page.waitForTimeout(1500);
      const second = await scrapeSwitcherItems(page);
      diagnostics.switcherItemsFound = second.itemsFound;
      const parsed = toPages(second.candidates);
      pages = parsed.pages;
      diagnostics.filteredCandidates = second.candidates.length - parsed.pages.length;
    }

    if (pages.length === 0) {
      diagnostics.note =
        diagnostics.switcherItemsFound === 0
          ? "Found no avatar rows in the profile switcher."
          : "Found rows but none matched Page names.";
    }

    await page.keyboard.press("Escape").catch(() => {});
    return { pages, diagnostics };
  } catch (err) {
    diagnostics.note = err instanceof Error ? err.message : String(err);
    return { pages: [], diagnostics };
  } finally {
    await page.close();
  }
}

export async function switchToPage(
  context: BrowserContext,
  pageName: string
): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    const menuOpened = await openAvatarMenu(page);
    if (!menuOpened) return false;

    const seeAll = page
      .locator('button, div[role="button"], a, [role="menuitem"]')
      .filter({ hasText: /see all profiles|view all profiles/i });
    const count = await seeAll.count().catch(() => 0);
    let clicked = false;
    for (let i = 0; i < count; i++) {
      if (await seeAll.nth(i).isVisible({ timeout: 1500 }).catch(() => false)) {
        await seeAll.nth(i).click({ timeout: 3000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await page.keyboard.press("Escape");
      return false;
    }
    await page.waitForTimeout(2500);

    const escaped = escapeRegExp(pageName);
    const target = page
      .locator(
        'div[role="button"], a[role="link"], [role="menuitem"], a'
      )
      .filter({ hasText: new RegExp(escaped, "i") })
      .first();

    const found = await target
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!found) {
      await page.keyboard.press("Escape");
      return false;
    }

    await target.click({ timeout: 5000 });
    await page.waitForTimeout(3000);

    const cookies = await context.cookies("https://www.facebook.com");
    const cUser = cookies.find((c) => c.name === "c_user")?.value;
    const iUser = cookies.find((c) => c.name === "i_user")?.value;

    return iUser !== null && iUser !== cUser;
  } catch (err) {
    console.error("Failed to switch to page:", err);
    return false;
  } finally {
    await page.close();
  }
}