import db from "@/lib/db";

export function digestDay(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

type Digest = { result: string; generatedAt: string; day: string };
const pending = new Map<string, Promise<Digest>>();

export function savedDigest(profileId: string, day: string): Digest | undefined {
  const row = db.prepare("SELECT result, generated_at AS generatedAt, day FROM daily_digests WHERE profile_id = ? AND day = ?")
    .get(profileId, day) as Digest | undefined;
  return row;
}

export async function dailyDigest(profileId: string, day: string, regenerate: boolean, generate: () => Promise<string>) {
  const saved = savedDigest(profileId, day);
  if (saved && !regenerate) return saved;
  const key = JSON.stringify([profileId, day]);
  const running = pending.get(key);
  if (running) return running;
  const task = (async () => {
    const result = await generate();
    if (!result.trim()) throw new Error("Ollama returned an empty digest. Please try again.");
    const generatedAt = new Date().toISOString();
    db.prepare("INSERT INTO daily_digests (profile_id, day, result, generated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, day) DO UPDATE SET result=excluded.result, generated_at=excluded.generated_at")
      .run(profileId, day, result, generatedAt);
    return { result, generatedAt, day };
  })();
  pending.set(key, task);
  try { return await task; }
  finally { if (pending.get(key) === task) pending.delete(key); }
}
