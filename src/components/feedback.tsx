"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function useFeedback() {
  const [feedback, setFeedback] = useState<{ message: string; undo?: () => void } | null>(null);
  const notify = useCallback((message: string, undo?: () => void) => setFeedback({ message, undo }), []);
  const dismiss = useCallback(() => setFeedback(null), []);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(dismiss, feedback.undo ? 8000 : 4500);
    return () => window.clearTimeout(timer);
  }, [feedback, dismiss]);
  return { feedback, notify, dismiss };
}

export function Feedback({ feedback, dismiss }: {
  feedback: { message: string; undo?: () => void } | null; dismiss: () => void;
}) {
  if (!feedback) return null;
  return (
    <div role="status" aria-label="Action feedback" className="fixed bottom-5 left-1/2 z-[110] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
      <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
      <span>{feedback.message}</span>
      {feedback.undo && <button type="button" onClick={() => { feedback.undo?.(); dismiss(); }} className="font-bold text-blue-200 underline underline-offset-2">Undo</button>}
      <button type="button" aria-label="Dismiss notification" onClick={dismiss} className="rounded p-1 text-slate-300 hover:bg-white/10"><X size={16} /></button>
    </div>
  );
}
