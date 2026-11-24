import { authorize } from "@/lib/auth";
import { NextResponse } from "next/server";
import Parser from "rss-parser";
import db from "@/lib/db";

export const runtime = "nodejs";

function normalizeFeedUrl(value: string) {
  try {
    const input = value.trim();
    if (/^[a-z0-9][a-z0-9_-]{1,20}$/i.test(input)) {
      return `https://www.reddit.com/r/${encodeURIComponent(input)}/.rss`;
    }
    const url = new URL(input);
    if (/^r\/[a-z0-9_-]+\/?$/i.test(input.replace(/^\/+/, ""))) {
      const name = input.replace(/^r\//i, "").replace(/\/+$/, "");
      return `https://www.reddit.com/r/${encodeURIComponent(name)}/.rss`;
    }
    if (/(^|\.)reddit\.com$/i.test(url.hostname) && /^\/r\/[^/]+\/?(?:hot|new|top|rising)?\/?$/i.test(url.pathname)) {
      const subreddit = url.pathname.split("/").filter(Boolean)[1];
      if (subreddit) return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/.rss`;
    }
    return url.toString();
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  let url = "";
  try {
    const body = await request.json();
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "A feed URL is required" }, { status: 400 });
    }
    url = normalizeFeedUrl(body.url);
    if (!URL.canParse(url) || !["http:", "https:"].includes(new URL(url).protocol)) {
      return NextResponse.json({ error: "A valid feed URL is required" }, { status: 400 });
    }

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
