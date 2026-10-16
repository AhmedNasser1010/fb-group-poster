export type ExportColumnKey =
  | "index"
  | "name"
  | "privacy"
  | "members"
  | "posted"
  | "hidden"
  | "manual"
  | "flags"
  | "note"
  | "url";

export interface ExportColumnMeta {
  key: ExportColumnKey;
  label: string;
  width: number;
  selectedByDefault: boolean;
}

export const EXPORT_COLUMNS: ExportColumnMeta[] = [
  { key: "index", label: "Row number (#)", width: 5, selectedByDefault: true },
  { key: "name", label: "Name", width: 42, selectedByDefault: true },
  { key: "privacy", label: "Privacy", width: 11, selectedByDefault: true },
  { key: "members", label: "Members", width: 12, selectedByDefault: true },
  { key: "posted", label: "Posted", width: 9, selectedByDefault: true },
  { key: "hidden", label: "Hidden", width: 9, selectedByDefault: true },
  { key: "manual", label: "Manual", width: 9, selectedByDefault: true },
  { key: "flags", label: "Flags", width: 32, selectedByDefault: true },
  { key: "note", label: "Note", width: 36, selectedByDefault: true },
  { key: "url", label: "URL", width: 48, selectedByDefault: true },
];

export const EXPORT_COLUMN_KEYS: ExportColumnKey[] = EXPORT_COLUMNS.map(
  (c) => c.key
);

export const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = EXPORT_COLUMNS.filter(
  (c) => c.selectedByDefault
).map((c) => c.key);

export function isExportColumnKey(value: unknown): value is ExportColumnKey {
  return (
    typeof value === "string" &&
    (EXPORT_COLUMN_KEYS as string[]).includes(value)
  );
}
