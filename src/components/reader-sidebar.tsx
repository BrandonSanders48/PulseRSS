"use client";

import { useState } from "react";
import { Bell, Check, ListFilter, Bookmark, ChevronDown, CirclePlus, History, Inbox, Layers2, Plus, Settings, Sparkles, Sun, Trash2, X } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";

type View = "all" | "today" | "recent" | "watch" | "readLater" | "list" | "feed";
type Feed = { title: string; url: string; color: string };
type List = { id: string; name: string; feedUrls: string[] };
type Profile = { name: string; email: string; avatarColor: string };

type Props = {
  open: boolean; activeView: string; activeFeed: string | null; selectedFeedUrls: string[];
  articleCount: number; readLaterCount: number; watchCount: number;
  feeds: Feed[]; lists: List[]; feedCounts: Record<string, number>;
  showLogos: boolean; profile: Profile | null; saving: boolean; saveError: boolean;
  onNavigate: (view: View, feed?: string) => void;
  onSelectFeed: (feed: Feed, multiple: boolean) => void; onClearFeeds: () => void;
  onClose: () => void; onAddFeed: () => void; onCreateList: () => void;
  onDeleteList: (id: string) => void; onProfile: () => void; onSettings: () => void;
};

function row(active: boolean) {
  return `sidebar-row ${active ? "sidebar-row-active" : ""}`;
}

function favicon(url: string) {
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`; }
  catch { return ""; }
}

export function ReaderSidebar(props: Props) {
  const [multiple, setMultiple] = useState(false);
  function navigate(view: View, feed?: string) { setMultiple(false); props.onNavigate(view, feed); }
  const primary = [
    { view: "all" as const, label: "All articles", icon: Inbox, count: props.articleCount },
    { view: "today" as const, label: "Today", icon: Sun },
    { view: "recent" as const, label: "Recently Read", icon: History },
    { view: "watch" as const, label: "Google News", icon: Bell, count: props.watchCount || undefined },
  ];
  return (
    <aside aria-label="Primary sidebar" className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-[#f6f7f9] transition-transform duration-200 lg:relative lg:z-0 lg:translate-x-0 ${props.open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex shrink-0 items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm"><Sparkles size={22} fill="currentColor" strokeWidth={1.5} /></div>
        <div><span className="block text-[23px] font-bold leading-7 tracking-[-0.045em] text-slate-900">Pulse</span><span className="text-[11px] font-medium text-slate-500">Your daily briefing</span></div>
        <button type="button" aria-label="Close sidebar" onClick={props.onClose} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 lg:hidden"><X size={18} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-3 pb-6">
        <nav aria-label="Main navigation" className="space-y-1">
          {primary.map(({ view, label, icon: Icon, count }) => (
            <button type="button" key={view} onClick={() => navigate(view)} aria-current={props.activeView === view ? "page" : undefined} className={row(props.activeView === view)}>
              <Icon size={18} strokeWidth={1.8} className="sidebar-icon" />
              <span className="min-w-0 flex-1 text-left">{label}</span>
              {view === "today" ? <span aria-hidden="true" className="inline-flex items-center gap-1 rounded-md bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-700"><Sparkles size={10} />AI</span>
                : count !== undefined && <span className="sidebar-count">{count}</span>}
            </button>
          ))}
        </nav>

        <nav aria-label="Lists" className="space-y-1">
          <div className="sidebar-section-label"><span>Lists</span><button type="button" onClick={props.onCreateList} aria-label="Create list" title="Create list" className="sidebar-section-action"><Plus size={15} /></button></div>
          <button type="button" onClick={() => navigate("readLater")} aria-current={props.activeView === "readLater" ? "page" : undefined} className={row(props.activeView === "readLater")}>
            <Bookmark size={18} strokeWidth={1.8} className="sidebar-icon" /><span className="flex-1 text-left">Read Later</span><span className="sidebar-count">{props.readLaterCount}</span>
          </button>
          {props.lists.map((list) => {
            const active = props.activeView === "list" && props.activeFeed === list.id;
            return <div key={list.id} className={`group flex items-center rounded-xl ${active ? "sidebar-list-active" : "hover:bg-white/80"}`}>
              <button type="button" title={list.name} onClick={() => navigate("list", list.id)} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-sm text-slate-600">
                <Layers2 size={17} strokeWidth={1.8} className={`shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} /><span className={`truncate ${active ? "font-semibold text-slate-900" : ""}`}>{list.name}</span><span className="ml-auto pl-1 text-[11px] tabular-nums text-slate-400">{list.feedUrls.length}</span>
              </button>
              <button type="button" onClick={() => props.onDeleteList(list.id)} aria-label={`Delete ${list.name}`} className="mx-1 rounded-md p-1.5 text-slate-400 transition-opacity hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"><Trash2 size={13} /></button>
            </div>;
          })}
        </nav>

        <nav aria-label="Following" className="space-y-1">
          <div className="sidebar-section-label"><span>Following <span className="ml-1 font-normal tracking-normal text-slate-400">{props.feeds.length}</span></span><span className="flex gap-1"><button type="button" onClick={() => setMultiple((current) => !current)} aria-label="Select multiple feeds" aria-pressed={multiple} title="Select feeds to read together" className={`sidebar-section-action ${multiple ? "bg-blue-100 text-blue-600" : ""}`}><ListFilter size={15} /></button><button type="button" onClick={props.onAddFeed} aria-label="Add feed" title="Follow a feed" className="sidebar-section-action"><Plus size={15} /></button></span></div>
          {multiple && <div className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <div className="flex items-center justify-between"><span>{props.selectedFeedUrls.length} selected</span><button type="button" onClick={props.onClearFeeds} disabled={!props.selectedFeedUrls.length} className="font-semibold">Clear</button></div>
            <p className="mt-1 text-[11px] leading-4">Choose feeds to combine their articles.</p>
          </div>}
          {props.feeds.map((feed) => {
            const active = props.activeView === "feed" && props.selectedFeedUrls.includes(feed.url);
            const logo = props.showLogos ? favicon(feed.url) : "";
            return <button type="button" key={feed.url} title={feed.title} onClick={(event) => props.onSelectFeed(feed, multiple || event.ctrlKey || event.metaKey)} aria-pressed={multiple ? active : undefined} aria-current={!multiple && active ? "page" : undefined} className={row(active)}>
              {multiple && <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{active && <Check size={12} strokeWidth={3} />}</span>}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white">
                {logo ? <span aria-hidden="true" className="h-4 w-4 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${logo}")` }} /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: feed.color }} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{feed.title}</span><span className="sidebar-count">{props.feedCounts[feed.url] || 0}</span>
            </button>;
          })}
          {!props.feeds.length && <button type="button" onClick={props.onAddFeed} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/50 px-3 py-3 text-left text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600"><CirclePlus size={16} />Follow your first feed</button>}
        </nav>
      </div>

      {props.profile && <div className="shrink-0 border-t border-slate-200/80 bg-[#f6f7f9] p-3">
        <div className="flex items-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <button type="button" onClick={props.onProfile} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 text-left hover:bg-slate-50">
            <ProfileAvatar profile={props.profile} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-800">{props.profile.name}</span><span className="block truncate text-xs text-slate-500">{props.profile.email || "Local profile"}</span></span>
            <ChevronDown size={13} className="shrink-0 text-slate-400" />
          </button>
          <button type="button" onClick={props.onSettings} aria-label="Settings" title="Settings" className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Settings size={17} strokeWidth={1.8} /></button>
        </div>
        <p aria-live="polite" className={`mt-2 flex min-h-4 items-center justify-center gap-1.5 text-[11px] ${props.saveError ? "text-amber-700" : "text-slate-400"}`}><span className={`h-1 w-1 rounded-full ${props.saveError ? "bg-amber-500" : props.saving ? "animate-pulse bg-blue-400" : "bg-emerald-500"}`} />{props.saveError ? "Changes need attention" : props.saving ? "Saving changes…" : "All changes saved"}</p>
      </div>}
    </aside>
  );
}
