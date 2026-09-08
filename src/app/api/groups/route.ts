export const runtime = "nodejs";

import { readCache, updateCache, backupCache } from "@/lib/cache";
import { getBrowserContext, isLoggedIn } from "@/lib/playwright";
import { scrapeGroups } from "@/lib/facebook/scraper";export async function GET() {
  const cache = await readCache();
  return Response.json(cache);
}

export async function POST(request: Request) {
  try {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      return Response.json(
        { error: "Not logged in to Facebook. Please log in first." },
        { status: 401 }
      );
    }

    let backup = false;
    try {
      const body = (await request.json()) as { backup?: boolean } | null;
      backup = body?.backup === true;
    } catch {
      // No or invalid JSON body — treat as no backup
    }

    // Manually added groups live in the cache file, so they must be captured
    // BEFORE a backup renames it — otherwise they would be lost on refresh.
    const existingCache = await readCache();
    const manualGroups = existingCache.manualGroups;

    if (backup) {
      await backupCache();
    }

    const context = await getBrowserContext();
    const groups = await scrapeGroups(context);

    // Keep manual groups that the scraper did not also discover (scraped
    // groups win on id collision), so they survive every cache refresh.
    const scrapedIds = new Set(groups.map((g) => g.id));
    const preservedManualGroups = manualGroups.filter(
      (g) => !scrapedIds.has(g.id)
    );

    const updated = await updateCache({
      groups,
      manualGroups: preservedManualGroups,
      lastUpdated: new Date().toISOString(),
    });

    return Response.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh groups";
    return Response.json({ error: message }, { status: 500 });
  }
}
