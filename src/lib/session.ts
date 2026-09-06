import fs from "fs/promises";
import path from "path";

const SESSION_FILE = path.join(process.cwd(), "data", "session.json");

export interface SessionStatus {
  valid: boolean | null;
  checkedAt: string | null;
}

export async function readSession(): Promise<SessionStatus> {
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf-8");
    return JSON.parse(raw) as SessionStatus;
  } catch {
    return { valid: null, checkedAt: null };
  }
}

export async function writeSession(valid: boolean): Promise<void> {
  const dir = path.dirname(SESSION_FILE);
  await fs.mkdir(dir, { recursive: true });
  const status: SessionStatus = {
    valid,
    checkedAt: new Date().toISOString(),
  };
  await fs.writeFile(SESSION_FILE, JSON.stringify(status, null, 2), "utf-8");
}