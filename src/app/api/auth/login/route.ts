import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const account = db.prepare("SELECT id, password_hash AS passwordHash FROM accounts WHERE email = ?").get(email) as { id: string; passwordHash: string | null } | undefined;
  if (!account?.passwordHash || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const profile = db.prepare("SELECT id FROM profiles WHERE account_id = ? LIMIT 1").get(account.id) as { id: string } | undefined;
  if (!profile) return NextResponse.json({ error: "Account profile not found" }, { status: 404 });
  const session = createSession(account.id);
  const response = NextResponse.json({ ok: true, profileId: profile.id });
  response.cookies.set("pulse_session", session.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(session.expires), path: "/" });
  return response;
}
