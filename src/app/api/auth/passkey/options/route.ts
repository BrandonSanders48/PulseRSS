import { NextResponse } from "next/server";
import { generateRegistrationOptions, generateAuthenticationOptions } from "@simplewebauthn/server";
import { randomBytes } from "node:crypto";
import db from "@/lib/db";
import { sessionAccountId } from "@/lib/auth";

export const runtime = "nodejs";

function rp(request: Request) {
  const url = new URL(request.url);
  return { rpID: process.env.PULSE_WEBAUTHN_RPID || url.hostname, origin: process.env.PULSE_WEBAUTHN_ORIGIN || url.origin };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { type?: string };
  const { rpID } = rp(request);
  const challenge = randomBytes(32).toString("base64url");
  if (body.type === "register") {
    const accountId = await sessionAccountId();
    if (!accountId) return NextResponse.json({ error: "Login required" }, { status: 401 });
    const account = db.prepare("SELECT email FROM accounts WHERE id = ?").get(accountId) as { email: string };
    const options = await generateRegistrationOptions({
      rpName: "Pulse",
      rpID,
      userName: account.email,
      userID: new TextEncoder().encode(accountId),
      challenge,
      excludeCredentials: (db.prepare("SELECT id, transports FROM passkeys WHERE account_id = ?").all(accountId) as { id: string; transports: string }[]).map((row) => ({
        id: row.id,
        transports: JSON.parse(row.transports),
      })),
    });
    db.prepare("INSERT INTO webauthn_challenges (id, account_id, challenge, type, expires_at) VALUES (?, ?, ?, 'register', ?)").run(randomBytes(16).toString("hex"), accountId, options.challenge, new Date(Date.now() + 10 * 60 * 1000).toISOString());
    return NextResponse.json(options);
  }

  const options = await generateAuthenticationOptions({ rpID, challenge });
  db.prepare("INSERT INTO webauthn_challenges (id, account_id, challenge, type, expires_at) VALUES (?, NULL, ?, 'login', ?)").run(randomBytes(16).toString("hex"), options.challenge, new Date(Date.now() + 10 * 60 * 1000).toISOString());
  return NextResponse.json(options);
}
