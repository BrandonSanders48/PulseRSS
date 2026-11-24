import { authorize } from "@/lib/auth";
import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "A search phrase is required" }, { status: 400 });
    }

    const parser = new Parser();
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query.trim())}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Pulse RSS Reader/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const feed = await parser.parseString(await response.text());

    return NextResponse.json({
      articles: (feed.items || []).slice(0, 50).map((item) => ({
        title: item.title || "Untitled",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || null,
        contentSnippet: item.contentSnippet || item.content?.replace(/<[^>]*>/g, "").slice(0, 500) || "",
        creator: item.creator || "Google News",
        feedTitle: `Google: ${query.trim()}`,
        sourceQuery: query.trim(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load Google News results. Try a different phrase." },
      { status: 422 },
    );
  }
}
