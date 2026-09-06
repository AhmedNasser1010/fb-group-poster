export const runtime = "nodejs";

import { readCache, updateCache } from "@/lib/cache";
import { getBrowserContext, isLoggedIn } from "@/lib/playwright";
import { detectPages } from "@/lib/facebook/pages";

export async function GET() {
  const cache = await readCache();
  return Response.json({ pages: cache.pages, selectedPageId: cache.selectedPageId });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === "select") {
      const pageId: string | null = typeof body.pageId === "string" ? body.pageId : null;
      const updated = await updateCache({ selectedPageId: pageId });
      if (pageId === null) {
        return Response.json({ selectedPageId: null });
      }
      return Response.json({ selectedPageId: updated.selectedPageId });
    }

    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      return Response.json(
        { error: "Not logged in to Facebook. Please log in first." },
        { status: 401 }
      );
    }

    const context = await getBrowserContext();
    const result = await detectPages(context);

    if (result.pages.length === 0) {
      console.error(
        "[pages] detection failed:",
        JSON.stringify(result.diagnostics, null, 2)
      );
    }

    const updated = await updateCache({ pages: result.pages });
    return Response.json({
      pages: updated.pages,
      diagnostics: result.diagnostics,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to detect pages";
    return Response.json({ error: message }, { status: 500 });
  }
}
