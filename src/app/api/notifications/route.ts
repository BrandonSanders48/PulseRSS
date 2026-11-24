import { authorize } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;
  const body = await request.json();
  const forbidden = await authorize(body?.profileId ?? null);
  if (forbidden) return forbidden;
  const { profileId, title, notificationBody, link } = body;
  if (!profileId || !title) return NextResponse.json({ error: "Profile and title required" }, { status: 400 });
  const id = `${Date.now()}-${title}`;
  db.prepare("INSERT INTO notifications (id, profile_id, title, body, link) VALUES (?, ?, ?, ?, ?)")
    .run(id, profileId, title, notificationBody || "", link || "");
  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;
  const body = await request.json();
  const forbidden = await authorize(body?.profileId ?? null);
  if (forbidden) return forbidden;
  if (body.profileId) db.prepare("UPDATE notifications SET unread = 0 WHERE profile_id = ?").run(body.profileId);
  return NextResponse.json({ ok: true });
}
