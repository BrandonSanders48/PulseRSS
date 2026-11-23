import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: unknown; email?: unknown; password?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (name.length < 1 || name.length > 80) return NextResponse.json({ error: "Name must be 1–80 characters" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
  if (db.prepare("SELECT 1 FROM accounts WHERE email = ?").get(email)) return NextResponse.json({ error: "An account already exists for this email" }, { status: 409 });

  const accountId = randomUUID();
  const profileId = randomUUID();
  db.transaction(() => {
    db.prepare("INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)").run(accountId, email, hashPassword(password));
    db.prepare("INSERT INTO profiles (id, name, email, avatar_color, account_id) VALUES (?, ?, ?, ?, ?)").run(profileId, name, email, "#2563eb", accountId);
    db.prepare("INSERT INTO settings (profile_id) VALUES (?)").run(profileId);
  })();
  const session = createSession(accountId);
  const response = NextResponse.json({ ok: true, profileId });
  response.cookies.set("pulse_session", session.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(session.expires), path: "/" });
  return response;
}
