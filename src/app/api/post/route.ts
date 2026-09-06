export const runtime = "nodejs";

import { getBrowserContext, isLoggedIn } from "@/lib/playwright";
import { postToGroup } from "@/lib/facebook/poster";
import { readCache } from "@/lib/cache";
import { switchToPage } from "@/lib/facebook/pages";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const groupUrl = formData.get("groupUrl") as string;
    const text = formData.get("text") as string;
    const image = formData.get("image") as File | null;

    if (!groupUrl || !text) {
      return Response.json(
        { error: "groupUrl and text are required" },
        { status: 400 }
      );
    }

    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      return Response.json(
        { error: "Not logged in to Facebook. Please log in first." },
        { status: 401 }
      );
    }

    const context = await getBrowserContext();

    const cache = await readCache();
    if (cache.selectedPageId) {
      const selectedPage = cache.pages.find(
        (p) => p.id === cache.selectedPageId
      );
      const pageName = selectedPage?.name;
      if (!pageName) {
        return Response.json(
          {
            success: false,
            message:
              "Selected Page was not found. Please re-detect your Pages.",
          },
          { status: 400 }
        );
      }

      const switched = await switchToPage(context, pageName);
      if (!switched) {
        return Response.json(
          {
            success: false,
            message:
              "Could not switch to the selected Page. The Page may no longer be accessible.",
          },
          { status: 400 }
        );
      }
    }

    let imagePath: string | undefined;
    if (image && image.size > 0) {
      const fs = await import("fs/promises");
      const os = await import("os");
      const path = await import("path");

      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1] || "jpg";
      imagePath = path.join(os.tmpdir(), `fb_upload_${Date.now()}.${ext}`);
      await fs.writeFile(imagePath, buffer);
    }

    const expectedPageName =
      cache.selectedPageId
        ? cache.pages.find((p) => p.id === cache.selectedPageId)?.name
        : undefined;

    const result = await postToGroup(
      context,
      groupUrl,
      text,
      imagePath,
      expectedPageName
    );

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
