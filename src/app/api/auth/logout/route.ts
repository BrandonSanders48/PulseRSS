import { NextResponse } from "next/server";
import db from "@/lib/db";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const id = cookieStore.get("pulse_session")?.value;
  if (id) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pulse_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
