import { authorize, sessionAccountId } from "@/lib/auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  const health = db.prepare("SELECT url, status, error, article_count AS articleCount, checked_at AS checkedAt FROM feed_health WHERE url IN (SELECT feeds.url FROM feeds JOIN profiles ON profiles.id = feeds.profile_id WHERE profiles.account_id = ?) ORDER BY checked_at DESC").all(await sessionAccountId());
  return NextResponse.json({ health });
}
