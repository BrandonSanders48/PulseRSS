import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profile") || "";
  const feeds = db.prepare("SELECT title, url FROM feeds WHERE profile_id = ?").all(profileId) as { title: string; url: string }[];
  const outlines = feeds.map((feed) =>
    `<outline text="${feed.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" title="${feed.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" type="rss" xmlUrl="${feed.url.replace(/&/g, "&amp;")}"/>`,
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>Pulse subscriptions</title></head><body>${outlines}</body></opml>`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "text/xml",
      "Content-Disposition": 'attachment; filename="pulse-feeds.opml"',
    },
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const profileId = new URL(request.url).searchParams.get("profile") || "";
  const insert = db.prepare("INSERT INTO feeds (profile_id, title, url, color) VALUES (?, ?, ?, '#2563eb') ON CONFLICT(profile_id, url) DO UPDATE SET title=excluded.title");
  const outlines = body.match(/<outline[^>]*>/gi) || [];
  let imported = 0;
  for (const outline of outlines) {
    const title = outline.match(/(?:text|title)="([^"]*)"/i)?.[1] || "Imported feed";
    const url = outline.match(/xmlUrl="([^"]+)"/i)?.[1];
    if (url && profileId) {
      insert.run(profileId, title, url.replace(/&amp;/g, "&"));
      imported++;
    }
  }
  return NextResponse.json({ imported, feeds: db.prepare("SELECT title, url, color FROM feeds WHERE profile_id = ?").all(profileId) });
}
