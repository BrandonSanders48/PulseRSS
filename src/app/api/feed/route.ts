import { NextResponse } from "next/server";
import Parser from "rss-parser";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let url = "";
  try {
    const body = await request.json();
    if (!body || typeof body.url !== "string" || !URL.canParse(body.url) || !["http:", "https:"].includes(new URL(body.url).protocol)) {
      return NextResponse.json({ error: "A feed URL is required" }, { status: 400 });
    }
    url = body.url;

    const parser = new Parser();
    const response = await fetch(url, {
      headers: { "User-Agent": "Pulse RSS Reader/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const feed = await parser.parseString(await response.text());
    const articles = (feed.items || []).slice(0, 30).map((item) => ({
      title: item.title || "Untitled",
      link: item.link || "",
      pubDate: item.pubDate || item.isoDate || null,
      contentSnippet: item.contentSnippet || item.content?.replace(/<[^>]*>/g, "").slice(0, 500) || "",
      creator: item.creator || feed.title || "",
    }));
    db.prepare("INSERT INTO feed_health (url, status, error, article_count, checked_at) VALUES (?, 'ok', '', ?, CURRENT_TIMESTAMP) ON CONFLICT(url) DO UPDATE SET status='ok', error='', article_count=excluded.article_count, checked_at=CURRENT_TIMESTAMP")
      .run(url, articles.length);
    return NextResponse.json({
      title: feed.title || "Untitled feed",
      description: feed.description || "",
      articles,
    });
  } catch {
    if (url) db.prepare("INSERT INTO feed_health (url, status, error, article_count, checked_at) VALUES (?, 'error', 'Could not load feed', 0, CURRENT_TIMESTAMP) ON CONFLICT(url) DO UPDATE SET status='error', error='Could not load feed', checked_at=CURRENT_TIMESTAMP").run(url);
    return NextResponse.json(
      { error: "Could not load this feed. Check the URL and try again." },
      { status: 422 },
    );
  }
}
