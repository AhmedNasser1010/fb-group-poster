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

    if (backup) {
      await backupCache();
    }

    const context = await getBrowserContext();
    const groups = await scrapeGroups(context);

    const updated = await updateCache({
      groups,
      lastUpdated: new Date().toISOString(),
    });

    return Response.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh groups";
    return Response.json({ error: message }, { status: 500 });
  }
}
