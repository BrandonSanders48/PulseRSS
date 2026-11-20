"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SummaryState = { key: string; result: string; loading: boolean; error: string; generatedAt: string };
const EMPTY: SummaryState = { key: "", result: "", loading: false, error: "", generatedAt: "" };

export function useArticleSummary(
  article: { id: string; title: string; contentSnippet: string; digestContent?: string; digestDay?: string } | null,
  profileId: string | null,
  settings: { url: string; model: string },
  automatic: boolean,
  available: boolean,
) {
  const id = article?.id;
  const title = article?.title;
  const content = article?.digestContent ?? article?.contentSnippet;
  const digest = article?.digestContent !== undefined;
  const day = article?.digestDay;
  const key = digest ? JSON.stringify([profileId, day, "digest"])
    : JSON.stringify([profileId, id, title, content, settings.url, settings.model]);
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<SummaryState>(EMPTY);

  const generate = useCallback(async (action: "summarize" | "bullets", regenerate = false) => {
    if (!id || !profileId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) => ({ ...(digest && current.key === key ? current : EMPTY), key, loading: true, error: "" }));
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (digest && !regenerate) {
        const cached = await fetch(`/api/ai?action=digest&profile=${encodeURIComponent(profileId)}&timeZone=${encodeURIComponent(timeZone)}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (!cached.ok) throw new Error("Could not load the saved digest. Please try again.");
        const data = await cached.json();
        if (controller.signal.aborted) return;
        if (data.result) {
          setState({ key, result: data.result, generatedAt: data.generatedAt || "", loading: false, error: "" });
          return;
        }
        if (!available || !content?.trim()) {
          setState({ ...EMPTY, key });
          return;
        }
      }
      const response = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, action: digest ? "digest" : action, profileId, timeZone, regenerate,
          ollamaUrl: settings.url, ollamaModel: settings.model }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate a summary. Please try again.");
      if (!controller.signal.aborted) setState({ key, result: data.result, generatedAt: data.generatedAt || "", loading: false, error: "" });
    } catch (error) {
      if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false,
        error: error instanceof Error ? error.message : "Could not reach Ollama. Check your connection and try again." }));
    } finally {
      if (controller.signal.aborted && request.current === controller) setState((current) => ({ ...current, loading: false }));
    }
  }, [id, profileId, key, title, content, digest, available, settings.url, settings.model]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (digest || (automatic && available)) void generate("summarize");
    }, 0);
    return () => { window.clearTimeout(timer); request.current?.abort(); };
  }, [automatic, available, digest, generate]);

  return {
    result: state.key === key ? state.result : "",
    loading: state.key === key && state.loading,
    error: state.key === key && Boolean(state.error),
    errorMessage: state.key === key ? state.error : "",
    generatedAt: state.key === key ? state.generatedAt : "",
    generate,
  };
}
