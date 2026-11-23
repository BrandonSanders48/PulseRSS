import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sessionAccountId } from "@/lib/auth";

export async function GET() {
  const accountId = await sessionAccountId();
  if (!accountId) return NextResponse.json({ authenticated: false });
  const account = db.prepare("SELECT id, email FROM accounts WHERE id = ?").get(accountId) as { id: string; email: string } | undefined;
  const profile = db.prepare("SELECT id, name, email, avatar_color AS avatarColor FROM profiles WHERE account_id = ? LIMIT 1").get(accountId) as { id: string; name: string; email: string; avatarColor: string } | undefined;
  return NextResponse.json({ authenticated: true, account, profile });
}
