import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import db from "@/lib/db";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, expected] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createSession(accountId: string) {
  const id = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (id, account_id, expires_at) VALUES (?, ?, ?)").run(id, accountId, expires);
  return { id, expires };
}

export async function sessionAccountId() {
  const cookieStore = await cookies();
  const id = cookieStore.get("pulse_session")?.value;
  if (!id) return null;
  const row = db.prepare(
    "SELECT account_id AS accountId, expires_at AS expiresAt FROM sessions WHERE id = ?",
  ).get(id) as { accountId: string; expiresAt: string } | undefined;
  if (!row || new Date(row.expiresAt).getTime() <= Date.now()) {
    if (row) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  return row.accountId;
}

// Return a response so every route can reject requests before accessing data.
export async function authorize(profileId?: unknown) {
  const accountId = await sessionAccountId();
  if (!accountId) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (profileId !== undefined && (typeof profileId !== "string" || !db.prepare(
    "SELECT 1 FROM profiles WHERE id = ? AND account_id = ?",
  ).get(profileId, accountId))) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }
  return null;
}
