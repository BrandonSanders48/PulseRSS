import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profile");
  if (!profileId) {
    return NextResponse.json({
      profiles: db.prepare("SELECT id, name, email, avatar_color AS avatarColor FROM profiles").all(),
    });
  }

  return NextResponse.json({
    exists: Boolean(db.prepare("SELECT 1 FROM profiles WHERE id = ?").get(profileId)),
    reading: (() => {
      const row = db.prepare("SELECT data FROM reading_state WHERE profile_id = ?").get(profileId) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    })(),
    feeds: db.prepare("SELECT title, url, color FROM feeds WHERE profile_id = ?").all(profileId),
    lists: (db.prepare("SELECT id, name, feed_urls AS feedUrls FROM feed_lists WHERE profile_id = ?").all(profileId) as { id: string; name: string; feedUrls: string }[]).map((row) => ({
      ...row,
      feedUrls: JSON.parse(row.feedUrls),
    })),
    watched: (db.prepare("SELECT id, query, enabled FROM watched_keywords WHERE profile_id = ?").all(profileId) as { id: string; query: string; enabled: number }[]).map((row) => ({
      ...row,
      enabled: Boolean(row.enabled),
    })),
    notifications: db.prepare("SELECT id, title, body, link, unread, created_at AS createdAt FROM notifications WHERE profile_id = ? ORDER BY created_at DESC LIMIT 100").all(profileId),
    settings: (() => {
      const row = db.prepare("SELECT preferences, ollama FROM settings WHERE profile_id = ?").get(profileId) as { preferences: string; ollama: string } | undefined;
      return {
        preferences: JSON.parse(row?.preferences || "{}"),
        ollama: JSON.parse(row?.ollama || "{}"),
      };
    })(),
  });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!validState(body)) {
    return NextResponse.json({ error: "Invalid profile state" }, { status: 400 });
  }
  const { profile, feeds, lists, watched, preferences, ollama, reading } = body;
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO profiles (id, name, email, avatar_color) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, avatar_color=excluded.avatar_color")
        .run(profile.id, profile.name, profile.email || "", profile.avatarColor || "#2563eb");
      db.prepare("INSERT INTO settings (profile_id, preferences, ollama) VALUES (?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET preferences=excluded.preferences, ollama=excluded.ollama")
        .run(profile.id, JSON.stringify(preferences || {}), JSON.stringify(ollama || {}));

      const deleteFeeds = db.prepare("DELETE FROM feeds WHERE profile_id = ?");
      deleteFeeds.run(profile.id);
      const insertFeed = db.prepare("INSERT INTO feeds (profile_id, title, url, color) VALUES (?, ?, ?, ?)");
      for (const feed of feeds || []) insertFeed.run(profile.id, feed.title, feed.url, feed.color);

      db.prepare("DELETE FROM feed_lists WHERE profile_id = ?").run(profile.id);
      const insertList = db.prepare("INSERT INTO feed_lists (id, profile_id, name, feed_urls) VALUES (?, ?, ?, ?)");
      for (const list of lists || []) insertList.run(list.id, profile.id, list.name, JSON.stringify(list.feedUrls || []));

      db.prepare("DELETE FROM watched_keywords WHERE profile_id = ?").run(profile.id);
      const insertWatch = db.prepare("INSERT INTO watched_keywords (id, profile_id, query, enabled) VALUES (?, ?, ?, ?)");
      for (const watch of watched || []) insertWatch.run(watch.id, profile.id, watch.query, watch.enabled ? 1 : 0);

      db.prepare("INSERT INTO reading_state (profile_id, data) VALUES (?, ?) ON CONFLICT(profile_id) DO UPDATE SET data=excluded.data")
        .run(profile.id, JSON.stringify(reading));
    })();
  } catch (error) {
    console.error("Profile save failed", error);
    return NextResponse.json({ error: "Could not save profile. Previous data was preserved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


type StatePayload = {
  profile: { id: string; name: string; email: string; avatarColor: string };
  feeds: { title: string; url: string; color: string }[];
  lists: { id: string; name: string; feedUrls: string[] }[];
  watched: { id: string; query: string; enabled: boolean }[];
  preferences: Record<string, unknown>;
  ollama: { url: string; model: string };
  reading: { saved: string[]; readLater: string[]; recentlyRead: string[]; articles: Record<string, unknown>[] };
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function unique(items: { id: string }[]) {
  return new Set(items.map((item) => item.id)).size === items.length;
}
function validState(value: unknown): value is StatePayload {
  if (!object(value) || !object(value.profile)) return false;
  const { profile, feeds, lists, watched, preferences, ollama, reading } = value;
  return typeof profile.id === "string" && profile.id.length > 0 &&
    typeof profile.name === "string" && profile.name.trim().length > 0 &&
    typeof profile.email === "string" && typeof profile.avatarColor === "string" &&
    Array.isArray(feeds) && feeds.every((feed) => object(feed) && typeof feed.title === "string" &&
      typeof feed.url === "string" && URL.canParse(feed.url) && ["http:", "https:"].includes(new URL(feed.url).protocol) && typeof feed.color === "string") &&
    new Set(feeds.map((feed) => feed.url)).size === feeds.length &&
    Array.isArray(lists) && lists.every((list) => object(list) && typeof list.id === "string" && list.id.length > 0 && typeof list.name === "string" && strings(list.feedUrls)) && unique(lists) &&
    Array.isArray(watched) && watched.every((watch) => object(watch) && typeof watch.id === "string" && watch.id.length > 0 && typeof watch.query === "string" && typeof watch.enabled === "boolean") && unique(watched) &&
    object(preferences) && ["compact", "showLogos", "notifications"].every((key) => typeof preferences[key] === "boolean") &&
    (preferences.autoSummarize === undefined || typeof preferences.autoSummarize === "boolean") &&
    object(ollama) && typeof ollama.url === "string" && typeof ollama.model === "string" &&
    object(reading) && strings(reading.saved) && strings(reading.readLater) && strings(reading.recentlyRead) &&
    Array.isArray(reading.articles) && reading.articles.every((article) => object(article) &&
      ["id", "title", "link", "contentSnippet", "creator", "feedTitle"].every((key) => typeof article[key] === "string") &&
      (article.pubDate === null || typeof article.pubDate === "string"));
}
