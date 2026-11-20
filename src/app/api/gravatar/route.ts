import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const hash = createHash("sha256").update(body.email.trim().toLowerCase()).digest("hex");
  return NextResponse.json({ url: `https://www.gravatar.com/avatar/${hash}?s=80&d=404&r=g` });
}
