import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse, verifyAuthenticationResponse } from "@simplewebauthn/server";
import db from "@/lib/db";
import { createSession, sessionAccountId } from "@/lib/auth";

export const runtime = "nodejs";

function rp(request: NextRequest) {
  return {
    rpID: process.env.PULSE_WEBAUTHN_RPID || new URL(request.url).hostname,
    origin: process.env.PULSE_WEBAUTHN_ORIGIN || new URL(request.url).origin,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { type?: unknown; response?: Parameters<typeof verifyRegistrationResponse>[0]["response"] | Parameters<typeof verifyAuthenticationResponse>[0]["response"] } | null;
  if (!body || (body.type !== "register" && body.type !== "login") || !body.response) {
    return NextResponse.json({ error: "Invalid passkey response" }, { status: 400 });
  }
  const { rpID, origin } = rp(request);

  if (body.type === "register") {
    const accountId = await sessionAccountId();
    if (!accountId) return NextResponse.json({ error: "Login required" }, { status: 401 });
    const challenge = db.prepare("SELECT challenge FROM webauthn_challenges WHERE account_id = ? AND type = 'register' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1").get(accountId, new Date().toISOString()) as { challenge: string } | undefined;
    if (!challenge) return NextResponse.json({ error: "Registration challenge expired" }, { status: 400 });
    const result = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!result.verified) return NextResponse.json({ error: "Passkey registration failed" }, { status: 400 });
    db.prepare("INSERT INTO passkeys (id, account_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)").run(
      result.registrationInfo.credential.id,
      accountId,
      Buffer.from(result.registrationInfo.credential.publicKey).toString("base64"),
      result.registrationInfo.credential.counter,
      JSON.stringify(("transports" in body.response.response ? body.response.response.transports : []) || []),
    );
    db.prepare("DELETE FROM webauthn_challenges WHERE account_id = ? AND type = 'register'").run(accountId);
    return NextResponse.json({ ok: true });
  }

  const credentialId = body.response.id as string;
  if (!credentialId) return NextResponse.json({ error: "Passkey credential required" }, { status: 400 });
  const challenge = db.prepare("SELECT challenge FROM webauthn_challenges WHERE type = 'login' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1").get(new Date().toISOString()) as { challenge: string } | undefined;
  const passkey = db.prepare("SELECT id, account_id AS accountId, public_key AS publicKey, counter, transports FROM passkeys WHERE id = ?").get(credentialId) as { id: string; accountId: string; publicKey: string; counter: number; transports: string } | undefined;
  if (!challenge || !passkey) return NextResponse.json({ error: "Passkey challenge expired or unknown" }, { status: 400 });
  const result = await verifyAuthenticationResponse({
    response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64")),
      counter: passkey.counter,
      transports: JSON.parse(passkey.transports),
    },
  });
  if (!result.verified) return NextResponse.json({ error: "Passkey login failed" }, { status: 401 });
  db.prepare("UPDATE passkeys SET counter = ? WHERE id = ?").run(result.authenticationInfo.newCounter, passkey.id);
  db.prepare("DELETE FROM webauthn_challenges WHERE type = 'login'");
  const profile = db.prepare("SELECT id FROM profiles WHERE account_id = ? LIMIT 1").get(passkey.accountId) as { id: string };
  const session = createSession(passkey.accountId);
  const response = NextResponse.json({ ok: true, profileId: profile.id });
  response.cookies.set("pulse_session", session.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(session.expires), path: "/" });
  return response;
}
