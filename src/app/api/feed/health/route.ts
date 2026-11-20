import { NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const health = db.prepare("SELECT url, status, error, article_count AS articleCount, checked_at AS checkedAt FROM feed_health ORDER BY checked_at DESC").all();
  return NextResponse.json({ health });
}
