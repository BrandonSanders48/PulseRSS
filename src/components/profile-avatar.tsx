"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const avatars = new Map<string, Promise<string>>();

function avatarUrl(email: string) {
  let pending = avatars.get(email);
  if (!pending) {
    pending = fetch("/api/gravatar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Avatar unavailable");
      return (await response.json()).url as string;
    }).catch((error) => { avatars.delete(email); throw error; });
    avatars.set(email, pending);
  }
  return pending;
}

export function ProfileAvatar({ profile }: { profile: { name: string; email: string; avatarColor: string } }) {
  const email = profile.email.trim().toLowerCase();
  const [avatar, setAvatar] = useState({ email: "", url: "" });
  useEffect(() => {
    let cancelled = false;
    if (email) void avatarUrl(email).then((url) => {
      if (!cancelled) setAvatar({ email, url });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [email]);

  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white" style={{ backgroundColor: profile.avatarColor }}>
      <span aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
      {avatar.email === email && avatar.url && (
        <Image src={avatar.url} alt={`${profile.name}'s profile image`} width={36} height={36} unoptimized
          referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover"
          onError={() => setAvatar({ email, url: "" })} />
      )}
    </span>
  );
}
