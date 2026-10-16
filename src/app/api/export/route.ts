export const runtime = "nodejs";

import { buildGroupsWorkbook, type ExportGroupRow } from "@/lib/excel";
import {
  DEFAULT_EXPORT_COLUMNS,
  isExportColumnKey,
  type ExportColumnKey,
} from "@/lib/export-columns";

function isExportRow(value: unknown): value is ExportGroupRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.index === "number" &&
    typeof row.name === "string" &&
    typeof row.memberCount === "string" &&
    typeof row.url === "string" &&
    typeof row.posted === "boolean" &&
    typeof row.hidden === "boolean" &&
    typeof row.manual === "boolean" &&
    typeof row.note === "string" &&
    Array.isArray(row.flags)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rows?: unknown;
      columns?: unknown;
    } | null;
    const rows = body?.rows;

    if (!Array.isArray(rows) || !rows.every(isExportRow)) {
      return Response.json(
        { error: "Invalid export payload: expected an array of group rows." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return Response.json(
        { error: "There are no groups to export." },
        { status: 400 }
      );
    }

    let columns: ExportColumnKey[] = DEFAULT_EXPORT_COLUMNS;
    if (body?.columns !== undefined) {
      if (
        !Array.isArray(body.columns) ||
        !body.columns.every(isExportColumnKey)
      ) {
        return Response.json(
          { error: "Invalid export payload: unknown column selection." },
          { status: 400 }
        );
      }
      if (body.columns.length === 0) {
        return Response.json(
          { error: "Select at least one column to export." },
          { status: 400 }
        );
      }
      columns = body.columns;
    }

    const buffer = await buildGroupsWorkbook(rows, columns);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `fb-groups-${stamp}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build the Excel export";
    return Response.json({ error: message }, { status: 500 });
  }
}
