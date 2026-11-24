import { authorize } from "@/lib/auth";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function redditPost(url: URL, userAgent: string) {
  if (!/(^|\.)reddit\.com$/i.test(url.hostname)) return null;
  const jsonUrl = new URL(url.toString());
  jsonUrl.search = "";
  jsonUrl.hash = "";
  jsonUrl.pathname = `${jsonUrl.pathname.replace(/\/+$/, "")}.json`;

  const response = await fetch(jsonUrl, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const json = await response.json();
  const post = json?.[0]?.data?.children?.[0]?.data;
  if (!post) return null;

  const destination = safeUrl(post.url_overridden_by_dest || post.url);
  if (destination && !/(^|\.)reddit\.com$/i.test(destination.hostname)) return destination;

  if (typeof post.selftext === "string" && post.selftext.trim()) {
    return {
      title: typeof post.title === "string" ? post.title : "",
      text: post.selftext,
      url: url,
      source: "Reddit",
    };
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const url = safeUrl(body?.url);
  if (!url) return NextResponse.json({ error: "A valid article URL is required" }, { status: 400 });

  const userAgent = "Pulse RSS Reader/1.0";
  try {
    const reddit = await redditPost(url, userAgent);
    if (reddit) {
      if (reddit instanceof URL) {
        url.protocol = reddit.protocol;
        url.hostname = reddit.hostname;
        url.port = reddit.port;
        url.pathname = reddit.pathname;
        url.search = reddit.search;
        url.hash = reddit.hash;
      } else {
        return NextResponse.json(reddit);
      }
    }

    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return NextResponse.json({ error: `Article returned HTTP ${response.status}` }, { status: 502 });

    const html = await response.text();
    const dom = new JSDOM(html, { url: response.url || url.toString() });

    let article = new Readability(dom.window.document.cloneNode(true) as unknown as Document).parse();
    if (!article?.textContent?.trim()) {
      const jsonLd = Array.from(dom.window.document.querySelectorAll('script[type="application/ld+json"]'))
        .map((node) => {
          try { return JSON.parse(node.textContent || ""); } catch { return null; }
        })
        .flat() as Array<{ "@type"?: string | string[]; articleBody?: unknown; headline?: unknown }>;
      const match = jsonLd.find((item) =>
        item && (item["articleBody"] || (Array.isArray(item["@type"])
          ? item["@type"].includes("Article")
          : item["@type"]?.toLowerCase().includes("article"))),
      );
      if (typeof match?.articleBody === "string") {
        article = {
          title: typeof match.headline === "string" ? match.headline : "",
          textContent: match.articleBody,
        } as ReturnType<Readability["parse"]>;
      }
    }

    const text = article?.textContent?.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return NextResponse.json({ error: "Could not extract the full article text" }, { status: 422 });

    return NextResponse.json({
      title: article?.title || "",
      text,
      url: response.url || url.toString(),
      source: new URL(response.url || url.toString()).hostname.replace(/^www\./, ""),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? `Could not load article: ${error.message}` : "Could not load the article",
    }, { status: 502 });
  }
}
