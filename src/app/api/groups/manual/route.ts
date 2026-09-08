export const runtime = "nodejs";

import { readCache, updateCache } from "@/lib/cache";
import type { Group } from "@/lib/types";

function extractGroupId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    // Strip a trailing "posts"/"permalink" style suffix if present
    return id || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      name?: string;
      memberCount?: string;
      privacy?: string;
    } | null;
    const rawUrl = body?.url?.trim();
    const name = body?.name?.trim();
    const memberCount = body?.memberCount?.trim();
    const privacy = body?.privacy?.trim().toLowerCase();

    if (!rawUrl) {
      return Response.json({ error: "Group URL is required" }, { status: 400 });
    }

    const groupId = extractGroupId(rawUrl);
    if (!groupId) {
      return Response.json(
        { error: "Invalid Facebook group URL. Expected something like https://www.facebook.com/groups/<your-group>" },
        { status: 400 }
      );
    }

    const cache = await readCache();
    const scraped = cache.groups.find((g) => g.id === groupId);
    if (cache.manualGroups.some((g) => g.id === groupId) || scraped) {
      return Response.json(
        { error: "This group is already in your list" },
        { status: 409 }
      );
    }

    const group: Group = {
      id: groupId,
      name: name || groupId,
      privacy: privacy === "public" || privacy === "private" ? privacy : "unknown",
      memberCount: memberCount || "—",
      logoUrl: "",
      url: `https://www.facebook.com/groups/${groupId}/`,
    };

    const updated = await updateCache({
      manualGroups: [...cache.manualGroups, group],
    });

    return Response.json(updated, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add group";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { groupId?: string } | null;
    const groupId = body?.groupId;
    if (!groupId) {
      return Response.json({ error: "groupId is required" }, { status: 400 });
    }

    const cache = await readCache();
    if (!cache.manualGroups.some((g) => g.id === groupId)) {
      return Response.json(
        { error: "Group is not a manually added group" },
        { status: 404 }
      );
    }

    const updated = await updateCache({
      manualGroups: cache.manualGroups.filter((g) => g.id !== groupId),
    });

    return Response.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove group";
    return Response.json({ error: message }, { status: 500 });
  }
}
