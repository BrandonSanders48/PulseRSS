import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const test = base.extend({
  request: async ({ context }, provide) => { await provide(context.request); },
});
const password = "test-password-123";
async function signIn(request: APIRequestContext, payload: ReturnType<typeof state>) {
  const response = await request.post("/api/auth/login", { data: { email: payload.profile.email, password } });
  expect(response.ok()).toBeTruthy();
}
async function account(request: APIRequestContext, name: string) {
  const payload = state(name);
  payload.profile.email = `${randomUUID()}@example.com`;
  const response = await request.post("/api/auth/register", { data: { name, email: payload.profile.email, password } });
  expect(response.ok()).toBeTruthy();
  payload.profile.id = (await response.json()).profileId;
  return payload;
}

function state(name: string) {
  return {
    profile: { id: randomUUID(), name, email: "", avatarColor: "#2563eb" },
    feeds: [{ title: `${name} feed`, url: `https://example.com/${name}`, color: "#2563eb" }],
    lists: [] as { id: string; name: string; feedUrls: string[] }[],
    watched: [],
    preferences: { compact: false, showLogos: false, notifications: false },
    ollama: { url: "", model: "llama3.2" },
    reading: { saved: [] as string[], readLater: [] as string[], recentlyRead: [] as string[], articles: [] as object[] },
  };
}

test("invalid saves and database failures preserve all previous profile data", async ({ request }) => {
  const original = await account(request, "original");
  expect((await request.put("/api/state", { data: original })).ok()).toBeTruthy();
  const get = () => request.get(`/api/state?profile=${original.profile.id}`).then((r) => r.json());
  const before = await get();
  expect((await request.put("/api/state", { data: { ...original, feeds: [{}] } })).status()).toBe(400);
  expect(await get()).toEqual(before);
  expect((await request.put("/api/state", { data: "{" , headers: { "Content-Type": "application/json" } })).status()).toBe(400);

  const other = await account(request, "other");
  other.lists = [{ id: randomUUID(), name: "Owned list", feedUrls: [] }];
  expect((await request.put("/api/state", { data: other })).ok()).toBeTruthy();
  await signIn(request, original);
  // The global list primary key forces an error after feeds/settings were changed.
  const failed = await request.put("/api/state", { data: {
    ...original, profile: { ...original.profile, name: "changed" }, feeds: [], lists: other.lists,
  } });
  expect(failed.status()).toBe(500);
  expect(await get()).toEqual(before);
});

test("reading state and empty subscriptions survive reloads and remain isolated", async ({ request }) => {
  const first = await account(request, "reading");
  first.feeds = [];
  first.reading.saved = ["saved-article"];
  first.reading.readLater = ["saved-article"];
  first.reading.recentlyRead = ["saved-article"];
  first.reading.articles = [{ id: "saved-article", title: "Archived article", link: "https://example.com/article", pubDate: null, contentSnippet: "Snapshot", creator: "Author", feedTitle: "Feed" }];
  const second = await account(request, "empty");
  for (const payload of [first, second]) { await signIn(request, payload); expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy(); }
  await signIn(request, first);
  const loaded = await request.get(`/api/state?profile=${first.profile.id}`).then((r) => r.json());
  expect(loaded.feeds).toEqual([]);
  expect(loaded.reading).toEqual(first.reading);
  expect((await request.get(`/api/state?profile=${second.profile.id}`)).status()).toBe(404);
  await signIn(request, second);
  expect((await request.get(`/api/state?profile=${second.profile.id}`).then((r) => r.json())).reading.saved).toEqual([]);
});

test("feed failures return JSON and update health; custom Ollama URL is honored", async ({ request }) => {
  const payload = await account(request, "Feed tester");
  const mock = createServer(async (req, res) => {
    if (req.url === "/rss") {
      res.setHeader("Content-Type", "application/rss+xml");
      res.end('<rss version="2.0"><channel><title>Mock feed</title><link>https://example.com</link><description>Test</description><item><title>Parsed item</title><link>https://example.com/item</link></item></channel></rss>');
    } else if (req.url === "/api/generate") {
      let text = "";
      for await (const chunk of req) text += chunk;
      expect(JSON.parse(text).model).toBe("custom-model");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ response: "Custom Ollama summary" }));
    } else { res.writeHead(503); res.end("Unavailable"); }
  });
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const address = mock.address();
  if (!address || typeof address === "string") throw new Error("No mock port");
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const success = await request.post("/api/feed", { data: { url: `${url}/rss` } });
    expect(success.status()).toBe(200);
    expect((await success.json()).articles[0].title).toBe("Parsed item");
    const failed = await request.post("/api/feed", { data: { url } });
    expect(failed.status()).toBe(422);
    expect((await failed.json()).error).toContain("Could not load");
    payload.feeds = [{ title: "Mock", url: new URL(url).href, color: "#2563eb" }];
    expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
    const health = await request.get("/api/feed/health").then((r) => r.json());
    expect(JSON.stringify(health)).toContain(url);
    expect(JSON.stringify(health)).toContain("error");
    const summary = await request.post("/api/ai", { data: { title: "Title", content: "Text", ollamaUrl: url, ollamaModel: "custom-model" } });
    expect(summary.status()).toBe(200);
    expect(await summary.json()).toEqual({ result: "Custom Ollama summary" });
  } finally { await new Promise<void>((resolve, reject) => mock.close((e) => e ? reject(e) : resolve())); }
});

test("sign-in UI creates accounts, restores sessions, and signs out", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Display name").fill("Alice");
  const email = `${randomUUID()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeHidden();
  await expect.poll(async () => (await request.get("/api/auth/me").then(r => r.json())).authenticated).toBe(true);
  await page.reload();
  await expect(page.getByRole("status", { name: "Loading profile" })).toBeHidden();
  await page.getByRole("button", { name: /^Alice / }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Pulse" })).toBeVisible();
  expect((await request.get("/api/state")).status()).toBe(401);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Pulse" })).toBeHidden();
});

test("a fresh browser can read list snapshots without the original feed", async ({ page, request }) => {
  const payload = await account(request, "Archive");
  payload.feeds = [];
  payload.reading.saved = ["archived"];
  payload.reading.readLater = ["archived"];
  payload.reading.articles = [{ id: "archived", title: "An older saved article", link: "https://example.com/old", pubDate: null, contentSnippet: "Preserved body", creator: "Author", feedTitle: "Removed feed" }];
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading profile" })).toBeHidden();
  await page.getByRole("button", { name: /^Read Later/ }).click();
  await expect(page.getByRole("heading", { name: "An older saved article" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status", { name: "Loading profile" })).toBeHidden();
  await page.getByRole("button", { name: /^Read Later/ }).click();
  await expect(page.getByRole("heading", { name: "An older saved article" }).first()).toBeVisible();
});


test("automatic summaries are optional, persist, and follow the viewed article", async ({ page, request }) => {
  const payload = await account(request, "Automatic");
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  await page.route("**/api/feed", (route) => route.fulfill({ json: {
    title: "Feed", articles: ["First article", "Second article"].map((title) => ({
      title, link: `https://example.com/${title}`, pubDate: null, contentSnippet: title, creator: "Author",
    })),
  } }));
  const summaries: string[] = [];
  await page.route("**/api/ai", async (route) => {
    const { title } = route.request().postDataJSON();
    summaries.push(title);
    await new Promise((resolve) => setTimeout(resolve, title === "First article" ? 350 : 10));
    await route.fulfill({ json: { result: `Summary of ${title}` } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "First article" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: /Automatic AI summaries/ });
  await expect(toggle).not.toBeChecked();
  expect(summaries).toEqual([]);
  await toggle.check();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(() => summaries.length).toBe(1);
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: "Second article", exact: true }) }).click();
  await expect(page.getByText("Summary of Second article", { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByText("Summary of First article", { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await request.get(`/api/state?profile=${payload.profile.id}`).then((r) => r.json())).settings.preferences.autoSummarize).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  const count = summaries.length;
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: "Second article", exact: true }) }).click();
  await page.waitForTimeout(400);
  expect(summaries).toHaveLength(count);
  await expect.poll(async () => (await request.get(`/api/state?profile=${payload.profile.id}`).then((r) => r.json())).settings.preferences.autoSummarize).toBe(false);
});


test("Today starts with an automatic digest of all today's articles", async ({ page, request }) => {
  const payload = await account(request, "Digest");
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  await page.route("**/api/feed", (route) => route.fulfill({ json: {
    title: "Daily source", articles: [
      { title: "First today", pubDate: today.toISOString() },
      { title: "Second today", pubDate: today.toISOString() },
      { title: "Yesterday news", pubDate: yesterday.toISOString() },
      { title: "Future news", pubDate: tomorrow.toISOString() },
    ].map((article) => ({ ...article, link: `https://example.com/${article.title}`, contentSnippet: `Details of ${article.title}`, creator: "Author" })),
  } }));
  const generations: { action: string; content: string }[] = [];
  await page.route("**/api/ai", (route) => {
    generations.push(route.request().postDataJSON());
    return route.fulfill({ json: { result: "Daily overview of the two stories." } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "First today" }).first()).toBeVisible();
  expect(generations).toEqual([]);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const cards = page.getByRole("button").filter({ has: page.locator("h2") });
  await expect(cards.first()).toContainText("AI digest");
  await expect(cards).toHaveCount(3);
  await expect(page.getByText("Daily overview of the two stories.", { exact: true }).first()).toBeVisible();
  expect(generations).toHaveLength(1);
  expect(generations[0].action).toBe("digest");
  expect(generations[0].content).toContain("First today");
  expect(generations[0].content).toContain("Second today");
  expect(generations[0].content).not.toContain("Yesterday news");
  expect(generations[0].content).not.toContain("Future news");
  await page.setViewportSize({ width: 390, height: 844 });
  await cards.first().click();
  await expect(page.locator("h1").filter({ hasText: "AI digest" }).last()).toBeVisible();
  await expect(page.getByText("Daily overview of the two stories.", { exact: true }).last()).toBeVisible();
});


test("Gravatar images normalize email and article sharing works on desktop and mobile", async ({ page, request }) => {
  const payload = await account(request, "AvatarUser");
  payload.profile.email = "  AvatarUser@Example.COM  ";
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  const expectedHash = createHash("sha256").update("avataruser@example.com").digest("hex");
  const avatar = await request.post("/api/gravatar", { data: { email: payload.profile.email } });
  expect((await avatar.json()).url).toContain(`/avatar/${expectedHash}?`);
  await page.addInitScript((id) => {
    localStorage.setItem("pulse-active-profile-id", JSON.stringify(id));
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      Object.assign(window, { sharedArticle: data });
    } });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => {
      Object.assign(window, { copiedLink: text });
    } } });
  }, payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  await page.route("https://www.gravatar.com/avatar/**", (route) => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="blue"/></svg>',
  }));
  await page.route("**/api/feed", (route) => route.fulfill({ json: {
    title: "Feed", articles: [{ title: "Share this story", link: "https://example.com/share-me", pubDate: null, contentSnippet: "A story", creator: "Author" }],
  } }));
  await page.goto("/");
  const image = page.getByRole("img", { name: "AvatarUser's profile image" }).first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", new RegExp(expectedHash));
  await page.getByRole("button", { name: "Share article", exact: true }).first().click();
  expect(await page.evaluate(() => (window as typeof window & { sharedArticle: ShareData }).sharedArticle)).toEqual({ title: "Share this story", url: "https://example.com/share-me" });
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "Share article", exact: true }).first().click();
  await expect(page.getByRole("status")).toHaveText("Link copied");
  expect(await page.evaluate(() => (window as typeof window & { copiedLink: string }).copiedLink)).toBe("https://example.com/share-me");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: "Share this story", exact: true }) }).click();
  await page.getByRole("button", { name: "Share article", exact: true }).last().click();
  await expect(page.getByRole("status").last()).toHaveText("Link copied");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "Share article", exact: true }).last().click();
  await expect(page.getByRole("textbox", { name: "Article link" })).toHaveValue("https://example.com/share-me");
  await page.route("https://www.gravatar.com/avatar/**", (route) => route.fulfill({ status: 404 }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByRole("button", { name: /AvatarUser.*AvatarUser@Example.COM/ })).toBeVisible();
  await expect(image).toHaveCount(0);
});


test("actions show progress, recover from errors, and support undo", async ({ page, request }) => {
  const payload = await account(request, "Feedback"); payload.feeds = [];
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  let feedCalls = 0;
  await page.route("**/api/feed", async (route) => {
    feedCalls++;
    if (feedCalls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({ status: 422, json: { error: "This feed is temporarily unavailable. Try again." } });
    }
    return route.fulfill({ json: { title: "Recovery feed", articles: [{ title: "Recovered article", link: "https://example.com/recovery", pubDate: null, contentSnippet: "Article text", creator: "Author" }] } });
  });
  let aiCalls = 0;
  await page.route("**/api/ai", async (route) => {
    aiCalls++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return aiCalls === 1 ? route.fulfill({ status: 503, json: { error: "Ollama is temporarily unavailable" } })
      : route.fulfill({ json: { result: "Recovered summary" } });
  });
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading profile" })).toBeHidden();
  await page.getByRole("button", { name: "Add feed", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Custom feed URL" }).fill("https://example.com/rss");
  await dialog.getByRole("button", { name: "Add feed", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Adding feed" })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("temporarily unavailable");
  expect(feedCalls).toBe(1);
  await expect(dialog.getByRole("textbox", { name: "Custom feed URL" })).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Add feed", exact: true }).click();
  await expect(page.getByRole("status", { name: "Action feedback" })).toContainText("Following Recovery feed");
  await expect(page.getByRole("heading", { name: "Recovered article" }).first()).toBeVisible();
  await page.getByRole("button", { name: "AI summary", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generating", exact: false }).first()).toBeDisabled();
  await expect(page.getByRole("alert", { name: "Summary error" })).toContainText("Ollama is temporarily unavailable");
  await page.getByRole("button", { name: "Retry summary", exact: true }).first().click();
  await expect(page.getByText("Recovered summary", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await dialog.getByPlaceholder("Cyber security morning").fill("Morning reading");
  await dialog.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(page.getByRole("status", { name: "Action feedback" })).toContainText('List "Morning reading" created');
  await page.getByRole("button", { name: "Delete Morning reading", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Morning reading", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Morning reading", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import OPML", { exact: true }).setInputFiles({ name: "invalid.opml", mimeType: "text/xml", buffer: Buffer.from("<opml><body /></opml>") });
  await expect(dialog.getByRole("alert")).toContainText("No feeds found");
  await page.getByLabel("Import OPML", { exact: true }).setInputFiles({ name: "feeds.opml", mimeType: "text/xml", buffer: Buffer.from('<opml><body><outline text="Imported source" xmlUrl="https://example.com/imported" /></body></opml>') });
  await expect(page.getByRole("status", { name: "Action feedback" })).toContainText("Imported 2 feeds");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Imported source/ })).toBeVisible();
  await page.screenshot({ path: "test-results/feedback-desktop.png" });
});


test("daily digests are saved once, regenerate explicitly, and survive failed regeneration", async ({ request, page }) => {
  let calls = 0;
  let fail = false;
  let online = true;
  const prompts: string[] = [];
  const mock = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags") {
      res.writeHead(online ? 200 : 503);
      res.end(JSON.stringify({ models: [{ name: "test" }] })); return;
    }
    let body = ""; for await (const chunk of req) body += chunk;
    calls++;
    prompts.push(JSON.parse(body).prompt);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (fail || !online) { res.writeHead(503); res.end("offline"); return; }
    res.end(JSON.stringify({ response: `Overview\nCombined briefing version ${calls}.\n\nTech news\n- AI investment and product launches are converging.\n\nCybersecurity\n- Organizations face renewed vulnerability pressure.\n\nKey points\n- Prioritize the major developments across the day.` }));
  });
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const address = mock.address(); if (!address || typeof address === "string") throw new Error("No mock port");
  const url = `http://127.0.0.1:${address.port}`;
  const payload = await account(request, "PersistedDigest"); payload.ollama.url = url;
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const data = { action: "digest", profileId: payload.profile.id, title: "Daily briefing", content: "Tech headline about AI. Security headline about a vulnerability.", ollamaUrl: url, timeZone };
  const cached = () => request.get(`/api/ai?action=digest&profile=${payload.profile.id}&timeZone=${encodeURIComponent(timeZone)}`).then((r) => r.json());
  try {
    // Parallel requests share one inference, then subsequent requests read SQLite.
    const responses = await Promise.all([request.post("/api/ai", { data }), request.post("/api/ai", { data })]);
    expect(responses.every((response) => response.ok())).toBeTruthy();
    expect(calls).toBe(1);
    const original = await responses[0].json();
    expect(await responses[1].json()).toEqual(original);
    expect(await cached()).toEqual(original);
    await request.post("/api/ai", { data: { ...data, content: "Newer stories", ollamaUrl: "http://127.0.0.1:1" } });
    expect(calls).toBe(1);
    expect(prompts[0]).toContain("Do NOT break down individual articles");
    for (const heading of ["Overview", "Tech news", "Cybersecurity", "Key points"]) expect(prompts[0]).toContain(heading);
    expect((await request.get(`/api/ai?action=digest&profile=${randomUUID()}`)).status()).toBe(404);

    // These two zones always fall on different calendar days; one cannot reuse today's row.
    const days = await Promise.all(["Pacific/Kiritimati", "Etc/GMT+12"].map((zone) => request.get(`/api/ai?action=digest&profile=${payload.profile.id}&timeZone=${encodeURIComponent(zone)}`).then((r) => r.json())));
    expect(days[0].day).not.toBe(days[1].day);
    expect(days.some((day) => day.result === null)).toBeTruthy();
    expect((await request.get(`/api/ai?action=digest&profile=${payload.profile.id}&timeZone=invalid`)).status()).toBe(400);

    await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
    await page.route("**/api/feed", (route) => route.fulfill({ json: { title: "Feed", articles: [{ title: "New technology story", link: "https://example.com/tech", pubDate: new Date().toISOString(), contentSnippet: "New details", creator: "Author" }] } }));
    await page.goto("/");
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("Combined briefing version 1.", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tech news", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cybersecurity", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /All articles/ }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("Combined briefing version 1.", { exact: true }).first()).toBeVisible();
    expect(calls).toBe(1);
    await page.getByRole("button", { name: "Refresh feeds", exact: true }).click();
    await expect(page.getByRole("button", { name: "Refresh feeds", exact: true })).toBeEnabled();
    expect(calls).toBe(1);
    await page.getByRole("button", { name: "Regenerate digest", exact: true }).first().click();
    await expect(page.getByText("Combined briefing version 2.", { exact: true }).first()).toBeVisible();
    expect(calls).toBe(2);
    expect(prompts[1]).toContain("New technology story");
    fail = true;
    await page.getByRole("button", { name: "Regenerate digest", exact: true }).first().click();
    await expect(page.getByRole("alert", { name: "Summary error" })).toContainText("Your saved digest is still shown below");
    await expect(page.getByText("Combined briefing version 2.", { exact: true }).first()).toBeVisible();
    expect((await cached()).result).toContain("Combined briefing version 2.");
    expect(calls).toBe(3);
    online = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Set up Ollama" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("Combined briefing version 2.", { exact: true }).first()).toBeVisible();
    expect(calls).toBe(3);
    await page.screenshot({ path: "test-results/digest-desktop.png" });
  } finally { await new Promise<void>((resolve, reject) => mock.close((error) => error ? reject(error) : resolve())); }
});


test("feed picker supports multiple selections, deduplicates, and retries partial failures", async ({ page, request }) => {
  const payload = await account(request, "BulkFeeds"); payload.feeds = [];
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  let failHacker = true;
  await page.route("**/api/feed", async (route) => {
    const { url } = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (url.includes("TheHackersNews") && failHacker) return route.fulfill({ status: 422, json: { error: "Temporarily offline" } });
    return route.fulfill({ json: { title: url.includes("TheHackersNews") ? "The Hacker News" : "BleepingComputer", articles: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add feed", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const search = dialog.getByPlaceholder("Search 200 technology and security feeds");
  await search.fill("Bleeping");
  await dialog.getByRole("button", { name: "BleepingComputer", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "BleepingComputer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await search.fill("Hacker");
  await dialog.getByRole("button", { name: "The Hacker News", exact: true }).click();
  await expect(dialog.getByText("2 sources selected", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Custom feed URL" }).fill("https://www.bleepingcomputer.com/feed/");
  await dialog.getByRole("button", { name: "Add 2 feeds", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Adding.*of 2/ })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("1 feed added");
  await expect(dialog.getByRole("alert")).toContainText("The Hacker News: Temporarily offline");
  await expect(dialog.getByText("1 source selected", { exact: true })).toBeVisible();
  const getFeeds = () => request.get(`/api/state?profile=${payload.profile.id}`).then((r) => r.json()).then((data) => data.feeds);
  await expect.poll(async () => (await getFeeds()).length).toBe(1);
  failHacker = false;
  await dialog.getByRole("button", { name: "Add feed", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await getFeeds()).length).toBe(2);
  expect(new Set((await getFeeds()).map((feed: { url: string }) => feed.url)).size).toBe(2);
  await page.getByRole("button", { name: "Add feed", exact: true }).first().click();
  await search.fill("Security Intelligence");
  await expect(dialog.getByRole("button", { name: "Security Intelligence", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Select all shown", exact: true }).click();
  await expect(dialog.getByText("1 source selected", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Clear selection", exact: true }).click();
  await expect(dialog.getByText("0 sources selected", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add feed", exact: true })).toBeDisabled();
});

test("sidebar combines selected feeds and supports deselecting and clearing", async ({ page, request }) => {
  const payload = await account(request, "FeedSelection");
  payload.feeds = ["Alpha", "Beta", "Gamma"].map((title) => ({ title, url: `https://example.com/${title}`, color: "#2563eb" }));
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.addInitScript((id) => localStorage.setItem("pulse-active-profile-id", JSON.stringify(id)), payload.profile.id);
  await page.route("**/api/ai?*", (route) => route.fulfill({ json: { available: true, models: [] } }));
  await page.route("**/api/feed", (route) => {
    const title = new URL(route.request().postDataJSON().url).pathname.slice(1);
    return route.fulfill({ json: { title, articles: [{ title: `${title} article`, link: `https://example.com/${title}/story`, pubDate: null, creator: "Author", contentSnippet: "Story text" }] } });
  });
  await page.goto("/");
  const following = page.getByRole("navigation", { name: "Following", exact: true });
  const cards = page.getByRole("button").filter({ has: page.locator("h2") });
  await expect(cards).toHaveCount(3);
  await following.getByRole("button", { name: "Select multiple feeds", exact: true }).click();
  await following.getByRole("button", { name: /^Alpha/ }).click();
  await following.getByRole("button", { name: /^Beta/ }).click();
  await expect(cards).toHaveCount(2);
  await expect(following.getByText("2 selected", { exact: true })).toBeVisible();
  await expect(following.getByRole("button", { name: /^Alpha/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Gamma article", exact: true })).toHaveCount(0);
  await following.getByRole("button", { name: /^Alpha/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Beta article");
  await following.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await following.getByRole("button", { name: /^Alpha/ }).click();
  await following.getByRole("button", { name: /^Gamma/ }).click();
  await expect(following.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
  await expect(cards).toHaveCount(2);
});

test("sessions enforce ownership across state, OPML, notifications, and digests", async ({ request, playwright }) => {
  for (const url of ["/api/state", "/api/opml", "/api/feed/health", "/api/ai"]) {
    expect((await request.get(url)).status()).toBe(401);
  }
  const alice = await account(request, "Private Alice");
  expect((await request.put("/api/state", { data: alice })).ok()).toBeTruthy();
  const cookie = (await request.storageState()).cookies.find(c => c.name === "pulse_session")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  const bobRequest = await playwright.request.newContext({ baseURL: "http://localhost:3217" });
  try {
    const bob = await account(bobRequest, "Private Bob");
    expect((await bobRequest.get("/api/state").then(r => r.json())).profiles.map((p: { id: string }) => p.id)).toEqual([bob.profile.id]);
    for (const url of [`/api/state?profile=${alice.profile.id}`, `/api/opml?profile=${alice.profile.id}`, `/api/ai?action=digest&profile=${alice.profile.id}`]) {
      expect((await bobRequest.get(url)).status()).toBe(404);
    }
    expect((await bobRequest.put("/api/state", { data: alice })).status()).toBe(404);
    expect((await bobRequest.post(`/api/opml?profile=${alice.profile.id}`, { data: "<opml/>" })).status()).toBe(404);
    expect((await bobRequest.post("/api/notifications", { data: { profileId: alice.profile.id, title: "Attack" } })).status()).toBe(404);
    expect((await bobRequest.put("/api/notifications", { data: { profileId: alice.profile.id } })).status()).toBe(404);
    expect((await bobRequest.post("/api/ai", { data: { action: "digest", profileId: alice.profile.id, content: "Private" } })).status()).toBe(404);
    expect((await bobRequest.post("/api/auth/login", { data: { email: alice.profile.email, password: "incorrect" } })).status()).toBe(401);
    expect((await request.get(`/api/state?profile=${alice.profile.id}`).then(r => r.json())).feeds).toEqual(alice.feeds);
    await request.post("/api/auth/logout");
    // Replaying a signed-out token must fail even if the cookie is retained.
    const replay = await playwright.request.newContext({ baseURL: "http://localhost:3217", extraHTTPHeaders: { Cookie: `pulse_session=${cookie.value}` } });
    expect((await replay.get("/api/state")).status()).toBe(401);
    await replay.dispose();
  } finally { await bobRequest.dispose(); }
});


test("background updates keep the reader visible, retain failed feeds, and never overlap", async ({ page, request }) => {
  const payload = await account(request, "Background reader");
  payload.feeds = [
    { title: "Live feed", url: "https://example.com/live", color: "#2563eb" },
    { title: "Flaky feed", url: "https://example.com/flaky", color: "#2563eb" },
  ];
  expect((await request.put("/api/state", { data: payload })).ok()).toBeTruthy();
  await page.route("**/api/ai?*", route => route.fulfill({ json: { available: true, models: [] } }));
  let liveRequests = 0;
  let flakyRequests = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/feed", async route => {
    const flaky = route.request().postDataJSON().url.endsWith("/flaky");
    const count = flaky ? ++flakyRequests : ++liveRequests;
    if (count === 2) await pending;
    if (flaky && count > 1) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const title = flaky ? "Retained story" : count === 1 ? "Original story" : "New story";
    return route.fulfill({ json: { title: flaky ? "Flaky feed" : "Live feed", articles: [{
      title, link: `https://example.com/${title.replaceAll(" ", "-")}`,
      pubDate: count > 1 ? "2026-11-23T12:00:00Z" : "2026-11-22T12:00:00Z",
      contentSnippet: `${title} body`, creator: "Author",
    }] } });
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Original story", exact: true }).first()).toBeVisible();
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: "Original story", exact: true }) }).click();
  const reader = page.getByRole("article");
  await expect(reader).toContainText("Original story");
  await page.clock.fastForward(5 * 60 * 1000);
  await expect.poll(() => liveRequests).toBe(2);
  await expect.poll(() => flakyRequests).toBe(2);
  await expect(page.getByRole("button", { name: "Refresh feeds", exact: true })).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: "Original story", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retained story", exact: true }).first()).toBeVisible();
  await expect(reader).toContainText("Original story");
  await page.clock.fastForward(5 * 60 * 1000);
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
  expect(liveRequests).toBe(2);
  expect(flakyRequests).toBe(2);
  release();
  await expect(page.getByRole("heading", { name: "New story", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retained story", exact: true }).first()).toBeVisible();
  await expect(reader).toContainText("Original story");
  await expect(page.getByRole("button", { name: "Refresh feeds", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("alert").filter({ hasText: "Flaky feed" })).toBeVisible();
  // Advance the wall clock without running timers, as when a browser suspends a tab.
  await page.clock.setSystemTime(new Date(Date.now() + 60 * 60 * 1000));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => liveRequests).toBe(3);
  await expect.poll(() => flakyRequests).toBe(3);
});
