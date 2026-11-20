"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function ArticleShare({ title, link }: { title: string; link: string }) {
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  if (!URL.canParse(link) || !["http:", "https:"].includes(new URL(link).protocol)) return null;

  async function share() {
    setMessage("");
    setManualCopy(false);
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied");
    } catch {
      setManualCopy(true);
      setMessage("Copy this link to share");
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button type="button" onClick={() => void share()} aria-label="Share article" title="Share article"
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <Share2 size={18} />
      </button>
      {message && <span role="status" className="absolute right-0 top-full z-10 w-48 rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal normal-case tracking-normal text-slate-700 shadow">
        {message}
        {manualCopy && <input aria-label="Article link" readOnly value={link} onFocus={(event) => event.currentTarget.select()}
          className="mt-2 w-full rounded border border-slate-200 p-1" />}
      </span>}
    </span>
  );
}
