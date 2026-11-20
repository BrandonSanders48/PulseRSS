"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReaderSidebar } from "@/components/reader-sidebar";
import { DigestContent } from "@/components/digest-content";
import { Feedback, useFeedback } from "@/components/feedback";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ArticleShare } from "@/components/article-share";
import { useArticleSummary } from "@/lib/use-article-summary";
import {
  Bell, Bookmark, Check, ChevronDown, CirclePlus, Inbox, LogOut,
  LoaderCircle, Menu, RefreshCw, Search, Sparkles, Star, Trash2, UserRound, X,
} from "lucide-react";

type Article = {
  id: string;
  title: string;
  link: string;
  pubDate: string | null;
  contentSnippet: string;
  creator: string;
  feedTitle: string;
  feedUrl?: string;
  digestContent?: string;
  digestDay?: string;
};

type Feed = { title: string; url: string; color: string };
type WatchedKeyword = { id: string; query: string; enabled: boolean };
type Profile = { id: string; name: string; email: string; avatarColor: string };
type UserPreferences = { compact: boolean; showLogos: boolean; notifications: boolean; autoSummarize: boolean };
type FeedList = { id: string; name: string; feedUrls: string[] };
type OllamaSettings = { url: string; model: string };

function feedLogoUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return "";
  }
}

const DEFAULT_FEEDS: Feed[] = [
  { title: "TechCrunch", url: "https://techcrunch.com/feed/", color: "#10b981" },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", color: "#8b5cf6" },
];

const FEED_CATEGORIES = [
  {
    name: "Major tech",
    color: "#2563eb",
    topics: ["Artificial intelligence", "Apple", "Microsoft", "Google", "Meta", "Amazon", "Nvidia", "AMD", "Intel", "Tesla", "Samsung", "Sony", "Startups", "Venture capital", "Robotics", "Drones", "Electric vehicles", "Semiconductors", "Cloud computing", "Data centers"],
  },
  {
    name: "Cyber security",
    color: "#dc2626",
    topics: ["Cyber security", "Ransomware", "Malware", "Phishing", "Data breaches", "Zero-day exploits", "Threat intelligence", "Vulnerability research", "CVE", "Bug bounties", "Penetration testing", "Digital forensics", "Endpoint security", "Identity security", "Cloud security", "Network security", "Critical infrastructure", "Supply chain attacks", "Cryptography", "Dark web"],
  },
  {
    name: "Developers",
    color: "#7c3aed",
    topics: ["Open source", "JavaScript", "Python", "TypeScript", "Rust", "Go", "Java", "C++", "Kubernetes", "Docker", "DevOps", "GitHub", "Git", "Linux", "PostgreSQL", "MongoDB", "Redis", "React", "Next.js", "Node.js"],
  },
  {
    name: "AI & data",
    color: "#059669",
    topics: ["Machine learning", "Generative AI", "Large language models", "Computer vision", "Natural language processing", "AI regulation", "AI safety", "Open models", "AI chips", "Data science", "Big data", "Analytics", "MLOps", "Prompt engineering", "Autonomous systems", "AI research", "A.I. agents", "Vector databases", "Synthetic data", "Foundation models"],
  },
  {
    name: "Enterprise",
    color: "#0891b2",
    topics: ["SaaS", "Enterprise software", "B2B technology", "IT management", "Software licensing", "Remote work", "Collaboration", "Digital transformation", "ERP", "CRM", "Business intelligence", "Cyber insurance", "Fintech", "Payments", "Blockchain", "Web3", "Cryptocurrency", "Quantum computing", "5G", "Edge computing"],
  },
  {
    name: "Consumer",
    color: "#db2777",
    topics: ["Smartphones", "Wearables", "Gaming", "PC gaming", "Console gaming", "Virtual reality", "Augmented reality", "Streaming", "Social media", "Smart home", "Home automation", "Audio", "Displays", "Laptops", "PC hardware", "Software apps", "Mobile apps", "Space technology", "Science", "Internet policy"],
  },
  {
    name: "Security operations",
    color: "#b91c1c",
    topics: ["SIEM", "SOC", "Incident response", "Security orchestration", "Threat hunting", "Intrusion detection", "EDR", "XDR", "SOAR", "Security analytics", "Risk management", "GRC", "Compliance", "Zero trust", "Privileged access", "Multi-factor authentication", "Secrets management", "Password security", "Email security", "Browser security"],
  },
  {
    name: "Infrastructure",
    color: "#0369a1",
    topics: ["Servers", "Storage", "Databases", "Cloud storage", "Serverless", "Containers", "Virtualization", "Microservices", "API security", "CDN", "DNS security", "Observability", "Telemetry", "SRE", "Platform engineering", "OpenTelemetry", "Distributed systems", "Edge infrastructure", "Hybrid cloud", "Multi-cloud"],
  },
  {
    name: "Privacy & policy",
    color: "#4f46e5",
    topics: ["Data privacy", "GDPR", "Online surveillance", "Encryption", "Anonymity", "Digital rights", "Online safety", "Child safety", "Misinformation", "Disinformation", "Content moderation", "Platform regulation", "Antitrust", "Net neutrality", "Open internet", "Facial recognition", "Biometric privacy", "Location privacy", "Export controls", "Sanctions"],
  },
  {
    name: "Emerging tech",
    color: "#ca8a04",
    topics: ["6G", "Satellite internet", "SpaceX", "Space startups", "Lunar technology", "Climate tech", "Clean energy", "Nuclear fusion", "Battery technology", "Autonomous vehicles", "Self-driving cars", "Robotaxis", "Healthcare technology", "Biotechnology", "Genomics", "Medtech", "Digital health", "Biometric technology", "Materials science", "Nanotechnology"],
  },
];

const CYBER_SECURITY_SOURCES: (Feed & { category: string })[] = [
  { title: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Dark Reading", url: "https://www.darkreading.com/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", color: "#dc2626", category: "Cyber security" },
  { title: "SecurityWeek", url: "https://feeds.feedburner.com/securityweek", color: "#dc2626", category: "Cyber security" },
  { title: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Tenable Blog", url: "https://www.tenable.com/blog/feed", color: "#dc2626", category: "Cyber security" },
  { title: "Rapid7 Blog", url: "https://blog.rapid7.com/rss/", color: "#dc2626", category: "Cyber security" },
  { title: "Sophos News", url: "https://news.sophos.com/en-us/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Cisco Talos", url: "https://feeds.feedburner.com/Talosblog", color: "#dc2626", category: "Cyber security" },
  { title: "Palo Alto Unit 42", url: "https://unit42.paloaltonetworks.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Check Point Research", url: "https://blog.checkpoint.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "SANS Internet Storm Center", url: "https://isc.sans.edu/rssfeed.xml", color: "#dc2626", category: "Cyber security" },
  { title: "CISA Alerts", url: "https://www.cisa.gov/cybersecurity-advisories/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Exploit Database", url: "https://www.exploit-db.com/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Cybersecurity Dive", url: "https://www.cybersecuritydive.com/feeds/news/", color: "#dc2626", category: "Cyber security" },
  { title: "Security Intelligence", url: "https://securityintelligence.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "SC Media", url: "https://www.scworld.com/feed", color: "#dc2626", category: "Cyber security" },
  { title: "The CyberWire", url: "https://thecyberwire.com/feeds/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "The Register - Security", url: "https://www.theregister.com/security/headlines.rss", color: "#dc2626", category: "Cyber security" },
  { title: "Trend Micro Research", url: "https://feeds.feedburner.com/trendmicroresearch", color: "#dc2626", category: "Cyber security" },
  { title: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Data Breach Today", url: "https://www.databreachtoday.com/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Government Security News", url: "https://gcn.com/rss/", color: "#dc2626", category: "Cyber security" },
  { title: "Threatpost", url: "https://threatpost.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Infosec News", url: "https://www.infosecurity-magazine.com/rss/news/", color: "#dc2626", category: "Cyber security" },
  { title: "HackerOne Blog", url: "https://www.hackerone.com/blog/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Naked Security", url: "https://nakedsecurity.sophos.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Schneier on Security", url: "https://www.schneier.com/feed/atom/", color: "#dc2626", category: "Cyber security" },
  { title: "Bruce Schneier Security", url: "https://www.schneier.com/blog/atom.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Cisco Security", url: "https://blogs.cisco.com/security/feed", color: "#dc2626", category: "Cyber security" },
  { title: "Anton on Security", url: "https://news.google.com/rss/search?q=Anton%20on%20Security&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "Center for Internet Security", url: "https://www.cisecurity.org/feed", color: "#dc2626", category: "Cyber security" },
  { title: "CERT Recently Published Vulnerability Notes", url: "https://www.kb.cert.org/vuls/rss/vuls_rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "CISA Current Activity", url: "https://www.cisa.gov/cybersecurity-advisories/current-activity/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Cloud Threat Landscape", url: "https://news.google.com/rss/search?q=cloud%20threat%20landscape&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "CyberScoop", url: "https://cyberscoop.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Data and computer security", url: "https://news.google.com/rss/search?q=data%20and%20computer%20security&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "Darknet", url: "https://www.darknet.org.uk/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Defense in Depth", url: "https://news.google.com/rss/search?q=Defense%20in%20Depth%20cybersecurity&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "Full Disclosure", url: "https://seclists.org/rss/fulldisclosure.rss", color: "#dc2626", category: "Cyber security" },
  { title: "Graham Cluley", url: "https://grahamcluley.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Have I Been Pwned", url: "https://feeds.feedburner.com/HaveIBeenPwnedLatestBreaches", color: "#dc2626", category: "Cyber security" },
  { title: "IT Security Guru", url: "https://www.itsecurityguru.org/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "National Vulnerability Database", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Security Affairs", url: "https://securityaffairs.com/feed", color: "#dc2626", category: "Cyber security" },
  { title: "Security Leadership and Management", url: "https://news.google.com/rss/search?q=security%20leadership%20management&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "The Exploit Database", url: "https://www.exploit-db.com/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", color: "#dc2626", category: "Cyber security" },
  { title: "The CyberWire", url: "https://thecyberwire.com/feeds/rss.xml", color: "#dc2626", category: "Cyber security" },
  { title: "Obyte", url: "https://news.google.com/rss/search?q=Obyte%20security&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "r/IntTechNews", url: "https://www.reddit.com/r/technews/.rss", color: "#dc2626", category: "Cyber security" },
  { title: "Security Intelligence", url: "https://securityintelligence.com/feed/", color: "#dc2626", category: "Cyber security" },
  { title: "Targeted Threats", url: "https://news.google.com/rss/search?q=targeted%20threats%20cybersecurity&hl=en-US&gl=US&ceid=US:en", color: "#dc2626", category: "Cyber security" },
  { title: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml", color: "#dc2626", category: "Cyber security" },
];

const TECH_SOURCE_PICKER: (Feed & { category: string })[] = [
  ...CYBER_SECURITY_SOURCES,
  ...FEED_CATEGORIES.flatMap((category) => {
    return category.topics.map((topic) => ({
      title: topic,
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${topic} when:7d`)}&hl=en-US&gl=US&ceid=US:en`,
      color: category.color,
      category: category.name,
    }));
  }),
];

const DEFAULT_PREFERENCES = { compact: false, showLogos: true, notifications: true, autoSummarize: false };
const DEFAULT_OLLAMA = { url: "", model: "" };

function stored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
function storedText(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* SQLite remains the source of truth. */ }
}

export default function Home() {
  const { feedback, notify, dismiss } = useFeedback();
  const [addingFeed, setAddingFeed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [failedFeeds, setFailedFeeds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [calendarDay, setCalendarDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 50);
    const timer = window.setTimeout(() => setCalendarDay(new Date().toDateString()), midnight.getTime() - Date.now());
    const checkDay = () => setCalendarDay(new Date().toDateString());
    window.addEventListener("focus", checkDay);
    document.addEventListener("visibilitychange", checkDay);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", checkDay); document.removeEventListener("visibilitychange", checkDay); };
  }, [calendarDay]);
  const [ready, setReady] = useState(false);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [saveRevision, setSaveRevision] = useState(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [archivedArticles, setArchivedArticles] = useState<Article[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>(DEFAULT_FEEDS);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelected] = useState<Article | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [selectedFeedUrls, setSelectedFeedUrls] = useState<string[]>([]);
  const [failedFeedUrls, setFailedFeedUrls] = useState<string[]>([]);
  const [feedProgress, setFeedProgress] = useState({ done: 0, total: 0 });
  const [addError, setAddError] = useState("");
  const [readLater, setReadLater] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [recentlyRead, setRecentlyRead] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<"all" | "today" | "readLater" | "saved" | "recent" | "feed" | "watch" | "list">("all");
  const [activeFeed, setActiveFeed] = useState<string | null>(null);
  const [feedFilterUrls, setFeedFilterUrls] = useState<string[]>([]);
  const [feedLists, setFeedLists] = useState<FeedList[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [listFeedUrls, setListFeedUrls] = useState<string[]>([]);
  const [watchedKeywords, setWatchedKeywords] = useState<WatchedKeyword[]>([]);
  const [watchQuery, setWatchQuery] = useState("");
  const [watchResults, setWatchResults] = useState<Article[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("All");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileError, setProfileError] = useState("");
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [ollamaSettings, setOllamaSettings] = useState<OllamaSettings>(DEFAULT_OLLAMA);
  const [ollamaStatus, setOllamaStatus] = useState<"unknown" | "available" | "unavailable">("unknown");
  const [ollamaModalOpen, setOllamaModalOpen] = useState(false);
  const [ollamaNoticeDismissed, setOllamaNoticeDismissed] = useState(false);
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [ollamaError, setOllamaError] = useState("");

  useEffect(() => {
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    if (!dialog.contains(document.activeElement)) focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !addingFeed && !importing) {
        setSettingsOpen(false); setProfileOpen(false); setListOpen(false); setAddOpen(false);
        setOllamaModalOpen(false); setOllamaNoticeDismissed(true);
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [settingsOpen, profileOpen, listOpen, addOpen, ollamaModalOpen, addingFeed, importing]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null;

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) throw new Error("Could not load profiles.");
        const data = await response.json();
        if (cancelled) return;
        const legacy = stored<Profile[]>("pulse-profiles", []);
        const merged: Profile[] = [...data.profiles];
        for (const profile of Array.isArray(legacy) ? legacy : []) {
          if (profile?.id && !merged.some((item) => item.id === profile.id)) merged.push(profile);
        }
        setProfiles(merged);
        const last = storedText("pulse-active-profile-id") === null
          ? storedText("pulse-active-profile") : stored<string | null>("pulse-active-profile-id", null);
        setActiveProfileId(merged.some((profile) => profile.id === last) ? last : null);
        setReady(true);
      } catch (error) {
        if (!cancelled) setSyncError(error instanceof Error ? error.message : "Could not load profiles.");
      }
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !activeProfileId) return;
    const controller = new AbortController();
    async function load() {
      try {
        // A profile read must follow all queued writes, including its last edit.
        await saveQueue.current;
        const response = await fetch(`/api/state?profile=${encodeURIComponent(activeProfileId!)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load profile. Reload to retry.");
        const data = await response.json();
        if (controller.signal.aborted) return;
        const migrate = storedText("pulse-active-profile") === activeProfileId;
        const legacy = <T,>(key: string, fallback: T): T => migrate ? stored(key, fallback) : fallback;
        setFeeds(data.exists ? data.feeds : legacy("pulse-feeds", DEFAULT_FEEDS));
        setFeedLists(data.exists ? data.lists : legacy("pulse-feed-lists", []));
        setWatchedKeywords(data.exists ? data.watched : legacy("pulse-watched-keywords", []));
        setPreferences({ ...DEFAULT_PREFERENCES, ...(data.exists ? data.settings.preferences : legacy("pulse-preferences", {})) });
        setOllamaSettings({ ...DEFAULT_OLLAMA, ...(data.exists ? data.settings.ollama : legacy("pulse-ollama", {})) });
        setSaved(data.reading?.saved || legacy("pulse-saved", []));
        setReadLater(data.reading?.readLater || legacy("pulse-read-later", []));
        setRecentlyRead(data.reading?.recentlyRead || legacy("pulse-recently-read", []));
        setArchivedArticles(data.reading?.articles || []);
        setArticles([]);
        setSelectedFeedUrls([]); setFailedFeedUrls([]); setFeedUrl(""); setAddError("");
        setSelected(null);
        setWatchResults([]);
        setActiveView("all");
        setActiveFeed(null);
        setFeedFilterUrls([]);
        setSyncError("");
        setLoadedProfileId(activeProfileId);
      } catch (error) {
        if (!controller.signal.aborted) setSyncError(error instanceof Error ? error.message : "Could not load profile.");
      }
    }
    void load();
    return () => controller.abort();
  }, [ready, activeProfileId]);

  useEffect(() => {
    if (!ready || importing || !activeProfile || loadedProfileId !== activeProfile.id) return;
    const snapshot = JSON.stringify({
      profile: activeProfile, feeds, lists: feedLists, watched: watchedKeywords,
      preferences, ollama: ollamaSettings,
      reading: { saved, readLater, recentlyRead, articles: [...new Map([...archivedArticles, ...articles, ...watchResults].map((article) => [article.id, article])).values()].filter((article) =>
        saved.includes(article.id) || readLater.includes(article.id) || recentlyRead.includes(article.id)) },
    });
    saveQueue.current = saveQueue.current.then(async () => {
      setSaving(true);
      const response = await fetch("/api/state", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot,
      });
      if (!response.ok) throw new Error("Could not save changes. Retry before leaving this page.");
      setSyncError("");
    }).catch((error) => setSyncError(error instanceof Error ? error.message : "Could not save changes.")).finally(() => setSaving(false));
  }, [ready, loadedProfileId, activeProfile, feeds, feedLists, watchedKeywords, preferences, ollamaSettings, saved, readLater, recentlyRead, archivedArticles, articles, watchResults, saveRevision, importing]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai?url=${encodeURIComponent(ollamaSettings.url)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setOllamaStatus(data.available ? "available" : "unavailable");
        if (!data.available && activeProfile && !ollamaNoticeDismissed) setOllamaModalOpen(true);
      })
      .catch(() => {
        if (!cancelled) setOllamaStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile, ollamaNoticeDismissed, ollamaSettings.url]);

  useEffect(() => {
    if (!ready) return;
    store("pulse-profiles", profiles);
    store("pulse-active-profile-id", activeProfileId);
  }, [ready, profiles, activeProfileId]);

  useEffect(() => {
    if (!activeProfileId || loadedProfileId !== activeProfileId || !("Notification" in window) || !preferences.notifications || !watchedKeywords.some((item) => item.enabled)) return;

    const checkWatchedKeywords = async () => {
      if ("Notification" in window && Notification.permission !== "granted") return;
      const seen = stored<string[]>(`pulse-watch-seen:${activeProfileId}`, []);
      const nextSeen = new Set(seen);

      for (const watch of watchedKeywords.filter((item) => item.enabled)) {
        try {
          const response = await fetch("/api/google-news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: watch.query }),
          });
          if (!response.ok) continue;
          const data = await response.json();
          for (const article of data.articles.slice(0, 5)) {
            const id = `${watch.query}-${article.link || article.title}`;
            if (!nextSeen.has(id)) {
              nextSeen.add(id);
              new Notification(`New result: ${watch.query}`, {
                body: article.title,
                tag: id,
              });
              if (activeProfileId) {
                void fetch("/api/notifications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    profileId: activeProfileId,
                    title: `New result: ${watch.query}`,
                    notificationBody: article.title,
                    link: article.link,
                  }),
                });
              }
            }
          }
        } catch {
          // Keep the next scheduled check running even if one query fails.
        }
      }
      store(`pulse-watch-seen:${activeProfileId}`, [...nextSeen].slice(-500));
    };

    const timer = window.setInterval(checkWatchedKeywords, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [activeProfileId, loadedProfileId, preferences.notifications, watchedKeywords]);

  useEffect(() => {
    if (!activeProfileId || loadedProfileId !== activeProfileId) return;
    const controller = new AbortController();
    async function refresh() {
      setLoading(true);
      const groups: PromiseSettledResult<Article[]>[] = [];
      for (let offset = 0; offset < feeds.length; offset += 4) {
        if (controller.signal.aborted) return;
        groups.push(...await Promise.allSettled(feeds.slice(offset, offset + 4).map(async (feed) => {
        const response = await fetch("/api/feed", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: feed.url }), signal: controller.signal,
        });
        if (!response.ok) throw new Error(feed.title);
        const data = await response.json();
        return data.articles.map((article: Omit<Article, "id" | "feedTitle">) => ({
          ...article, id: `${feed.url}-${article.link || article.title}`,
          feedTitle: data.title || feed.title, feedUrl: feed.url,
        })) as Article[];
        })));
      }
      if (controller.signal.aborted) return;
      setArticles((previous) => groups.flatMap((group, index) => group.status === "fulfilled"
        ? group.value : previous.filter((article) => article.feedUrl === feeds[index].url))
        .sort((a, b) => (Date.parse(b.pubDate || "") || 0) - (Date.parse(a.pubDate || "") || 0)));
      setFailedFeeds(groups.flatMap((group, index) => group.status === "rejected" ? [feeds[index].title] : []));
      setLoading(false);
    }
    void refresh();
    return () => controller.abort();
  }, [feeds, activeProfileId, loadedProfileId, refreshRevision]);

  const todayArticles = useMemo(() => {
    const start = new Date(calendarDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return articles.filter((article) => {
      const date = Date.parse(article.pubDate || "");
      return date >= start.getTime() && date < end.getTime();
    });
  }, [articles, calendarDay]);
  const dailyDigest = useMemo<Article | null>(() => activeProfileId ? {
    id: `daily-digest:${activeProfileId}:${calendarDay}`,
    title: "Today’s AI digest",
    link: "",
    pubDate: new Date().toISOString(),
    contentSnippet: todayArticles.length ? `${todayArticles.length} ${todayArticles.length === 1 ? "article" : "articles"} available today across your feeds. Regenerate to include newly loaded stories.` : "No articles published today yet. Your saved digest will appear here if one is available.",
    digestDay: calendarDay,
    creator: "Pulse AI",
    feedTitle: "Daily digest",
    digestContent: todayArticles.map((article, index) =>
      `[${index + 1}] ${article.title}\nSource: ${article.feedTitle}\n${article.contentSnippet}\nLink: ${article.link}`,
    ).join("\n\n"),
  } : null, [todayArticles, activeProfileId, calendarDay]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const readingView = ["readLater", "saved", "recent"].includes(activeView);
    let result = activeView === "watch" ? watchResults : readingView
      ? [...new Map([...archivedArticles, ...articles].map((article) => [article.id, article])).values()] : articles;

    if (activeView === "today") {
      result = dailyDigest ? [dailyDigest, ...todayArticles] : [];
    }

    if (activeView === "readLater") {
      result = result.filter((article) => readLater.includes(article.id));
    }

    if (activeView === "saved") {
      result = result.filter((article) => saved.includes(article.id));
    }

    if (activeView === "recent") {
      result = result.filter((article) => recentlyRead.includes(article.id))
        .sort((a, b) => recentlyRead.indexOf(a.id) - recentlyRead.indexOf(b.id));
    }

    if (activeView === "feed" && activeFeed) {
      result = result.filter((article) => feedFilterUrls.length ? feedFilterUrls.includes(article.feedUrl || "") : article.feedTitle === activeFeed);
    }

    if (activeView === "list" && activeFeed) {
      const list = feedLists.find((item) => item.id === activeFeed);
      result = list
        ? result.filter((article) => article.feedUrl && list.feedUrls.includes(article.feedUrl))
        : [];
    }

    if (needle) {
      result = result.filter((article) =>
        article.digestContent !== undefined || `${article.title} ${article.feedTitle} ${article.contentSnippet}`.toLowerCase().includes(needle),
      );
    }
    return result;
  }, [activeFeed, feedFilterUrls, activeView, articles, archivedArticles, feedLists, readLater, recentlyRead, saved, search, watchResults, todayArticles, dailyDigest]);

  const pickerSources = useMemo(() => [...new Map(TECH_SOURCE_PICKER.map((source) => [source.url, source])).values()].filter((source) =>
    (pickerCategory === "All" || source.category === pickerCategory) &&
    `${source.title} ${source.category}`.toLowerCase().includes(pickerSearch.trim().toLowerCase()),
  ), [pickerSearch, pickerCategory]);
  const pendingFeedUrls = [...new Set([...selectedFeedUrls, ...(feedUrl.trim() ? [feedUrl.trim()] : [])])];

  const feedCounts = useMemo(() => articles.reduce<Record<string, number>>((counts, article) => {
    if (article.feedUrl) counts[article.feedUrl] = (counts[article.feedUrl] || 0) + 1;
    return counts;
  }, {}), [articles]);

  const selected = filtered.find((article) => article.id === selectedArticle?.id) || filtered[0] || null;
  const { result: aiResult, loading: aiLoading, error: aiError, errorMessage: aiErrorMessage, generatedAt: digestGeneratedAt, generate: generateSummary } = useArticleSummary(
    selected, loadedProfileId === activeProfileId ? activeProfileId : null,
    ollamaSettings, selected?.digestContent !== undefined || preferences.autoSummarize, ollamaStatus === "available",
  );

  function createProfile(event: React.FormEvent) {
    event.preventDefault();
    if (importing) { notify("Please wait for the import to finish"); return; }
    const name = profileName.trim();
    const email = profileEmail.trim();
    if (!name) {
      setProfileError("Enter a display name.");
      return;
    }
    dismiss();
    const profile: Profile = {
      id: `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      email,
      avatarColor: ["#2563eb", "#7c3aed", "#059669", "#db2777", "#ea580c"][profiles.length % 5],
    };
    setProfiles((current) => [...current, profile]);
    setLoadedProfileId(null);
    setActiveProfileId(profile.id);
    setProfileName("");
    setProfileEmail("");
    setProfileError("");
    setProfileOpen(false);
  }

  function switchProfile(profileId: string) {
    if (importing) { notify("Please wait for the import to finish"); return; }
    dismiss();
    if (profileId === activeProfileId) {
      setProfileOpen(false);
      return;
    }
    setLoadedProfileId(null);
    setActiveProfileId(profileId);
    setProfileOpen(false);
  }

  function logoutProfile() {
    if (importing) { notify("Please wait for the import to finish"); return; }
    dismiss();
    setLoadedProfileId(null);
    setActiveProfileId(null);
    setProfileOpen(true);
  }

  function openListCreator() {
    setListName("");
    setListFeedUrls([]);
    setListOpen(true);
  }

  function createFeedList(event: React.FormEvent) {
    event.preventDefault();
    const name = listName.trim();
    if (!name) return;
    const id = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    setFeedLists((current) => [...current, { id, name, feedUrls: listFeedUrls }]);
    setListOpen(false);
    notify(`List "${name}" created`);
  }

  function deleteFeedList(id: string) {
    const removed = feedLists.find((list) => list.id === id);
    if (removed) notify(`List "${removed.name}" removed`, () => setFeedLists((current) => [...current, removed]));
    setFeedLists((current) => current.filter((list) => list.id !== id));
    if (activeView === "list" && activeFeed === id) {
      setActiveView("all");
      setActiveFeed(null);
    }
  }

  async function addFeed(event: React.FormEvent) {
    event.preventDefault();
    if (addingFeed || !pendingFeedUrls.length) return;
    setAddError("");
    const urls = pendingFeedUrls;
    if (urls.some((url) => !URL.canParse(url) || !["http:", "https:"].includes(new URL(url).protocol))) {
      setAddError("Enter a valid feed URL starting with https:// or http://.");
      return;
    }
    if (urls.some((url) => feeds.some((feed) => feed.url === url))) {
      setAddError("You already follow this feed. Clear the custom URL or choose another source.");
      return;
    }
    setAddingFeed(true);
    setFailedFeedUrls([]);
    setFeedProgress({ done: 0, total: urls.length });
    const added: Feed[] = [];
    const failed: { url: string; message: string }[] = [];
    try {
      // Limit simultaneous requests so large selections do not flood feed servers.
      for (let offset = 0; offset < urls.length; offset += 4) {
        await Promise.all(urls.slice(offset, offset + 4).map(async (url) => {
          const source = TECH_SOURCE_PICKER.find((item) => item.url === url);
          try {
            const response = await fetch("/api/feed", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not load this feed. Try again.");
            added.push({ title: data.title || source?.title || "Untitled feed", url, color: source?.color || "#3b82f6" });
          } catch (error) {
            failed.push({ url, message: `${source?.title || url}: ${error instanceof Error ? error.message : "Connection failed. Please try again."}` });
          } finally { setFeedProgress((current) => ({ ...current, done: current.done + 1 })); }
        }));
      }
      if (added.length) {
        const ordered = urls.flatMap((url) => added.filter((feed) => feed.url === url));
        setFeeds((current) => [...new Map([...current, ...ordered].map((feed) => [feed.url, feed])).values()]);
        notify(added.length === 1 ? `Following ${added[0].title}` : `Following ${added.length} new feeds`);
      }
      setSelectedFeedUrls((current) => current.filter((url) => failed.some((item) => item.url === url)));
      if (!failed.some((item) => item.url === feedUrl.trim())) setFeedUrl("");
      setFailedFeedUrls(failed.map((item) => item.url));
      if (failed.length) {
        setAddError(`${added.length ? `${added.length} ${added.length === 1 ? "feed added" : "feeds added"}. ` : ""}${failed.length === 1 ? "One feed could not be added" : `${failed.length} feeds could not be added`}. Retry the remaining selection.\n${failed.map((item) => item.message).join("\n")}`);
      } else {
        setSelectedFeedUrls([]);
        setAddOpen(false);
      }
    } finally { setAddingFeed(false); }
  }

    async function searchWatchedKeyword(query: string) {
      const phrase = query.trim();
      if (!phrase) return;
      setWatchLoading(true);
      setWatchError("");
      try {
        const response = await fetch("/api/google-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: phrase }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load Google News results");
        const results = data.articles.map((article: Omit<Article, "id">) => ({
          ...article,
          id: `watch-${phrase}-${article.link || article.title}`,
        }));
        setWatchResults(results);
      } catch (error) {
        setWatchError(error instanceof Error ? error.message : "Could not load Google News results");
      } finally {
        setWatchLoading(false);
      }
    }

    async function enableNotifications() {
      if (!("Notification" in window)) {
        setWatchError("Browser notifications are not supported.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") setWatchError("Notification permission was not granted. You can enable it in your browser settings.");
      else notify("Notifications enabled");
    }

    async function testOllama() {
      setOllamaTesting(true);
      setOllamaError("");
      try {
        const response = await fetch(`/api/ai?url=${encodeURIComponent(ollamaSettings.url)}`);
        const data = await response.json();
        if (!response.ok || !data.available) throw new Error(data.error || "Ollama is not reachable");
        setOllamaStatus("available");
        notify("Ollama connected");
        if (!ollamaSettings.model && data.models?.[0]) {
          setOllamaSettings((current) => ({ ...current, model: data.models[0] }));
        }
      } catch (error) {
        setOllamaStatus("unavailable");
        setOllamaError(error instanceof Error ? error.message : "Could not connect to Ollama");
      } finally {
        setOllamaTesting(false);
      }
    }

    function saveOllamaSettings() {
      store("pulse-ollama", ollamaSettings);
      setOllamaNoticeDismissed(true);
      void testOllama();
    }

    async function addWatch(event: React.FormEvent) {
      event.preventDefault();
      const query = watchQuery.trim();
      if (!query) return;
      setWatchedKeywords((current) => [
        ...current.filter((item) => item.query.toLowerCase() !== query.toLowerCase()),
        { id: `${Date.now()}-${query}`, query, enabled: true },
      ]);
      setWatchQuery("");
      setActiveView("watch");
      await searchWatchedKeyword(query);
    }

    function removeWatch(id: string) {
      notify("Watched topic removed");
      setWatchedKeywords((current) => current.filter((item) => item.id !== id));
    }

    async function summarize(_article: Article, action: "summarize" | "bullets") {
      if (ollamaStatus !== "available") {
        setOllamaNoticeDismissed(false);
        setOllamaModalOpen(true);
        return;
      }
      await generateSummary(action, selected?.digestContent !== undefined);
    }

    function archiveArticle(id: string) {
      const article = [...articles, ...watchResults, ...archivedArticles].find((item) => item.id === id);
      if (article) setArchivedArticles((current) => [...current.filter((item) => item.id !== id), article]);
    }

    function toggleReadLater(id: string) {
      archiveArticle(id);
      notify(readLater.includes(id) ? "Removed from Read Later" : "Added to Read Later");
      setReadLater((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    }

    function toggleSaved(id: string) {
      archiveArticle(id);
      notify(saved.includes(id) ? "Bookmark removed" : "Article bookmarked");
      setSaved((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    }

    function markRecentlyRead(id: string) {
      archiveArticle(id);
      setRecentlyRead((current) => [id, ...current.filter((item) => item !== id)].slice(0, 100));
    }

    function timeLabel(value: string | null) {
      if (!value) return "Recently";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    return (
      <main className="h-dvh overflow-hidden bg-[#f5f6f8] lg:flex">
        <Feedback feedback={feedback} dismiss={dismiss} />
        {syncError && (
          <div role="alert" className="fixed left-4 right-4 top-4 z-[100] rounded-xl bg-red-50 p-4 text-sm text-red-800 shadow">
            {syncError} <button className="ml-3 font-semibold underline" onClick={() => {
              if (!ready || loadedProfileId !== activeProfileId) window.location.reload();
              else setSaveRevision((current) => current + 1);
            }}>Retry</button>
          </div>
        )}
        {(!ready || (activeProfileId && loadedProfileId !== activeProfileId)) && (
          <div role="status" aria-label="Loading profile" className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-50">Loading profile…</div>
        )}
        {ready && !activeProfile && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <form onSubmit={createProfile} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <UserRound size={23} />
              </div>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
                {profiles.length ? "Welcome back" : "Create your profile"}
              </h1>
              <p className="mt-2 text-center text-sm leading-6 text-slate-500">
                {profiles.length ? "Choose a profile or create a new one." : "Set up your first local account for this Pulse container."}
              </p>

              {profiles.length > 0 && (
                <div className="mt-5 grid gap-2">
                  {profiles.map((profile) => (
                    <button
                      type="button"
                      key={profile.id}
                      onClick={() => switchProfile(profile.id)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:border-slate-400"
                    >
                      <ProfileAvatar profile={profile} />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{profile.name}</span>
                        {profile.email && <span className="block text-xs text-slate-500">{profile.email}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={profiles.length ? "mt-5 border-t border-slate-100 pt-5" : "mt-6"}>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Display name</label>
                <input
                  autoFocus
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Your name"
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email <span className="font-normal normal-case">(optional)</span></label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
                {profileError && <p className="mt-2 text-sm text-red-600">{profileError}</p>}
                <button type="submit" className="mt-5 h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white">
                  {profiles.length ? "Create another profile" : "Create profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {sidebarOpen && (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <ReaderSidebar
          key={activeProfileId || "guest"}
          open={sidebarOpen} activeView={activeView} activeFeed={activeFeed} selectedFeedUrls={activeView === "feed" ? feedFilterUrls : []}
          articleCount={articles.length} readLaterCount={readLater.length} watchCount={watchedKeywords.length}
          feeds={feeds} lists={feedLists} feedCounts={feedCounts} showLogos={preferences.showLogos}
          profile={activeProfile} saving={saving} saveError={Boolean(syncError)}
          onNavigate={(view, feed) => {
            setActiveView(view); setActiveFeed(feed ?? null); setFeedFilterUrls([]); setSidebarOpen(false);
            if (view === "today") setSelected(null);
          }}
          onSelectFeed={(feed, multiple) => {
            const next = multiple ? (activeView === "feed" && feedFilterUrls.includes(feed.url) ? feedFilterUrls.filter((url) => url !== feed.url) : [...(activeView === "feed" ? feedFilterUrls : []), feed.url]) : [feed.url];
            setFeedFilterUrls(next); setActiveView(next.length ? "feed" : "all");
            setActiveFeed(next.length > 1 ? `${next.length} feeds` : feeds.find((item) => item.url === next[0])?.title || null);
            if (!multiple) setSidebarOpen(false);
          }}
          onClearFeeds={() => { setFeedFilterUrls([]); setActiveFeed(null); setActiveView("all"); }}
          onClose={() => setSidebarOpen(false)} onAddFeed={() => setAddOpen(true)}
          onCreateList={openListCreator} onDeleteList={deleteFeedList}
          onProfile={() => setProfileOpen(true)} onSettings={() => setSettingsOpen(true)}
        />

        <section className="flex min-w-0 flex-1">
          <div className="flex min-w-0 w-full flex-col lg:w-[340px] lg:min-w-[340px] xl:w-[380px] xl:min-w-[380px] border-r border-slate-200 bg-white">
            <header className="flex h-16 items-center gap-2 border-b border-slate-100 px-4 lg:px-5">
              <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 lg:hidden" aria-label="Open navigation">
                <Menu size={20} />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search articles"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <button onClick={() => setAddOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Add feed">
                <CirclePlus size={20} />
              </button>
            </header>

            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="flex items-center gap-1 text-sm font-semibold">
                {activeView === "today" ? "Today" : activeView === "readLater" ? "Read Later" : activeView === "saved" ? "Saved" : activeView === "recent" ? "Recently Read" : activeView === "watch" ? "Google Watch" : activeView === "list" ? feedLists.find((list) => list.id === activeFeed)?.name || "List" : activeView === "feed" ? activeFeed : "Latest"}
              </h2>
              {activeView !== "watch" && <button type="button" disabled={loading} aria-busy={loading} onClick={() => setRefreshRevision((current) => current + 1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Refresh feeds" title="Refresh feeds">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>}
            </div>

            {activeView === "watch" && (
              <div className="border-b border-slate-100 px-4 pb-3">
                <form onSubmit={addWatch} className="flex gap-2">
                  <input
                    value={watchQuery}
                    onChange={(event) => setWatchQuery(event.target.value)}
                    placeholder="Watch a keyword or sentence"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-slate-400"
                  />
                  <button type="submit" className="rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white" aria-label="Add Google Watch" disabled={watchLoading || !watchQuery.trim()} aria-busy={watchLoading}>
                    {watchLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Bell size={16} />}
                  </button>
                </form>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={enableNotifications} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    Enable notifications
                  </button>
                  {watchError && <span role="alert" className="truncate text-xs text-red-600">{watchError}</span>}
                </div>
                {watchedKeywords.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {watchedKeywords.map((watch) => (
                      <div key={watch.id} className="flex shrink-0 items-center rounded-full border border-slate-200 bg-white pl-3 text-xs">
                        <button disabled={watchLoading} onClick={() => searchWatchedKeyword(watch.query)} className="py-1.5 font-semibold text-slate-700">
                          {watch.query}
                        </button>
                        <button onClick={() => removeWatch(watch.id)} className="ml-1 p-1.5 text-slate-400 hover:text-red-600" aria-label={`Remove ${watch.query}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {failedFeeds.length > 0 && !loading && (
              <div role="alert" className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">{failedFeeds.length} {failedFeeds.length === 1 ? "feed could" : "feeds could"} not be refreshed</p>
                <p className="mt-1">{failedFeeds.join(", ")}. Existing articles are still available.</p>
                <button type="button" onClick={() => setRefreshRevision((current) => current + 1)} className="mt-2 inline-flex items-center gap-1 font-semibold"><RefreshCw size={12} />Retry feeds</button>
              </div>
            )}
            <div className="overflow-y-auto px-2 pb-4">
              {loading || (activeView === "watch" && watchLoading) ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  <Inbox size={28} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-700">{search ? "No matching articles" : activeView === "today" ? "No articles published today yet" : activeView === "readLater" ? "Your reading list is empty" : "No articles here yet"}</p>
                  <p className="mt-2 text-xs leading-5">{search ? "Try a different phrase or clear your search." : activeView === "readLater" ? "Use the star on an article to keep it for later." : "Articles from your followed feeds will appear here."}</p>
                  {search && <button type="button" onClick={() => setSearch("")} className="mt-4 font-semibold text-blue-600">Clear search</button>}
                </div>
              ) : (
                filtered.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => { setSelected(article); if (article.digestContent === undefined) markRecentlyRead(article.id); setMobileDetail(true); setSidebarOpen(false); }}
                    className={`mb-1 w-full rounded-xl text-left transition ${preferences.compact ? "p-2.5" : "p-4"} ${selected?.id === article.id ? "bg-[#edf1f7]" : "hover:bg-slate-50"}`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                      {preferences.showLogos && article.feedUrl && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
                          <span
                            role="img"
                            aria-label=""
                            className="h-3.5 w-3.5 bg-contain bg-center bg-no-repeat"
                            style={{ backgroundImage: `url("${feedLogoUrl(article.feedUrl)}")` }}
                          />
                        </span>
                      )}
                      {article.digestContent !== undefined && <Sparkles size={14} className="text-violet-600" />}
                      <span className="truncate font-semibold text-slate-700">{article.feedTitle}</span>
                      <span>•</span>
                      <span>{timeLabel(article.pubDate)}</span>
                    </div>
                    <h2 className="article-card-title line-clamp-2 text-slate-900">{article.title}</h2>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-slate-500">{article.contentSnippet}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {selected ? (
            <article className="hidden flex-1 overflow-y-auto bg-white lg:block">
              <div className="mx-auto max-w-[50rem] px-6 py-9 xl:px-12 xl:py-12">
                <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  {selected.feedTitle}
                  <div className="ml-auto flex gap-1">
                    <ArticleShare key={selected.id} title={selected.title} link={selected.link} />
                    {selected.digestContent === undefined && <>
                    <button
                      onClick={() => toggleSaved(selected.id)}
                      className={`rounded-md p-2 hover:bg-slate-100 ${saved.includes(selected.id) ? "text-blue-600" : "text-slate-400"}`}
                      aria-label={saved.includes(selected.id) ? "Remove bookmark" : "Bookmark article"}
                      title={saved.includes(selected.id) ? "Remove bookmark" : "Bookmark article"}
                    >
                      <Bookmark size={18} fill={saved.includes(selected.id) ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => toggleReadLater(selected.id)}
                      className={`rounded-md p-2 hover:bg-slate-100 ${readLater.includes(selected.id) ? "text-amber-500" : "text-slate-400"}`}
                      aria-label="Save article"
                    >
                      <Star size={18} fill={readLater.includes(selected.id) ? "currentColor" : "none"} />
                    </button>
                    </>}
                    <button
                      onClick={() => summarize(selected, "summarize")}
                      disabled={aiLoading || selected.digestContent === ""} aria-busy={aiLoading}
                      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700 hover:bg-slate-50"
                    >
                      {aiLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {aiLoading ? "Generating…" : selected.digestContent !== undefined ? "Regenerate digest" : "AI summary"}
                    </button>
                  </div>
                </div>
                <h1 className="article-title max-w-2xl text-slate-900">{selected.title}</h1>
                <div className="mt-5 flex items-center gap-3 text-sm text-slate-500">
                  <span>{selected.creator}</span>
                  <span>•</span>
                  <span>{timeLabel(selected.pubDate)}</span>
                </div>
                {selected.digestContent !== undefined && digestGeneratedAt && <p className="mt-3 text-xs text-slate-500">Saved for today · Generated {new Date(digestGeneratedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Regenerate whenever you want a fresh briefing.</p>}

                {(aiLoading || aiResult || aiError) && (
                  <div className="mt-8 rounded-2xl border border-violet-100 bg-violet-50/40 p-6 xl:p-7">
                    <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-700">
                      <Sparkles size={14} /> {selected.digestContent !== undefined ? "Daily briefing" : "AI insight"}
                    </div>
                    {aiLoading ? (
                      <div role="status" aria-label="Generating AI summary" className="flex h-16 items-center gap-2 rounded bg-violet-100/70 px-3 text-sm text-violet-700"><LoaderCircle size={16} className="animate-spin" />Generating summary…</div>
                    ) : (
                      <div>
                        {aiError && <p role="alert" aria-label="Summary error" className="mb-3 text-sm leading-7 text-red-700">{aiErrorMessage}{selected.digestContent !== undefined && aiResult ? " Your saved digest is still shown below." : ""}</p>}
                        {selected.digestContent !== undefined && aiResult ? <DigestContent text={aiResult} /> : aiResult && <p className="reading-copy whitespace-pre-wrap text-slate-700">{aiResult}</p>}
                        {aiError && <button onClick={() => summarize(selected, "summarize")} className="mt-2 text-xs font-semibold text-violet-700">Retry summary</button>}
                      </div>
                    )}
                    {!aiLoading && aiResult && !aiError && selected.digestContent === undefined && (
                      <button onClick={() => summarize(selected, "bullets")} className="mt-3 text-xs font-semibold text-violet-700">
                        Convert to bullets
                      </button>
                    )}
                  </div>
                )}

                {(selected.digestContent === undefined || !aiResult) && <p className="reading-copy mt-8 text-slate-700">{selected.digestContent !== undefined && !aiResult && ollamaStatus !== "available" ? "Connect Ollama in Settings to generate today’s digest." : selected.contentSnippet}</p>}
                {selected.link && (
                  <a href={selected.link} target="_blank" rel="noreferrer" className="mt-8 inline-block rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    Read original article
                  </a>
                )}
              </div>
            </article>
          ) : (
            <article className="hidden flex-1 items-center justify-center text-sm text-slate-400 lg:flex">Select an article</article>
          )}
        </section>

        {selected && mobileDetail && (
          <div className="fixed inset-0 z-20 overflow-y-auto bg-white lg:hidden">
            <header className="sticky top-0 flex h-14 items-center border-b border-slate-100 bg-white px-4">
              <button onClick={() => setMobileDetail(false)} className="rounded-md px-2 py-2 text-sm font-semibold text-slate-600">
                Back
              </button>
              <span className="ml-auto"><ArticleShare key={selected.id} title={selected.title} link={selected.link} /></span>
              {selected.digestContent === undefined && <>
              <button
                onClick={() => toggleSaved(selected.id)}
                className={`ml-auto rounded-md p-2 ${saved.includes(selected.id) ? "text-blue-600" : "text-slate-400"}`}
                aria-label={saved.includes(selected.id) ? "Remove bookmark" : "Bookmark article"}
              >
                <Bookmark size={18} fill={saved.includes(selected.id) ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => toggleReadLater(selected.id)}
                className={`rounded-md p-2 ${readLater.includes(selected.id) ? "text-amber-500" : "text-slate-400"}`}
                aria-label={readLater.includes(selected.id) ? "Remove from Read Later" : "Add to Read Later"}
              >
                <Star size={18} fill={readLater.includes(selected.id) ? "currentColor" : "none"} />
              </button>
              </>}
            </header>
            <article className="mx-auto max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                {selected.feedTitle}
              </div>
              <h1 className="article-title text-slate-900">{selected.title}</h1>
              <div className="mt-4 text-sm text-slate-500">{selected.creator} • {timeLabel(selected.pubDate)}</div>
              {selected.digestContent !== undefined && digestGeneratedAt && <p className="mt-3 text-xs text-slate-500">Saved for today · Generated {new Date(digestGeneratedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
              <button
                onClick={() => summarize(selected, "summarize")}
                      disabled={aiLoading || selected.digestContent === ""} aria-busy={aiLoading}
                className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                {aiLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {aiLoading ? "Generating…" : selected.digestContent !== undefined ? "Regenerate digest" : "Summarize with AI"}
              </button>
              {(aiLoading || aiResult || aiError) && (
                <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-violet-700">
                    <Sparkles size={14} /> {selected.digestContent !== undefined ? "Daily briefing" : "AI insight"}
                  </div>
                  {aiLoading ? <div role="status" aria-label="Generating AI summary" className="flex h-16 items-center gap-2 rounded bg-violet-100/70 px-3 text-sm text-violet-700"><LoaderCircle size={16} className="animate-spin" />Generating summary…</div> : (
                    <div>
                        {aiError && <p role="alert" aria-label="Summary error" className="mb-3 text-sm leading-7 text-red-700">{aiErrorMessage}{selected.digestContent !== undefined && aiResult ? " Your saved digest is still shown below." : ""}</p>}
                        {selected.digestContent !== undefined && aiResult ? <DigestContent text={aiResult} /> : aiResult && <p className="reading-copy whitespace-pre-wrap text-slate-700">{aiResult}</p>}
                        {aiError && <button onClick={() => summarize(selected, "summarize")} className="mt-2 text-xs font-semibold text-violet-700">Retry summary</button>}
                      </div>
                  )}
                </div>
              )}
              {(selected.digestContent === undefined || !aiResult) && <p className="reading-copy mt-7 text-slate-700">{selected.digestContent !== undefined && !aiResult && ollamaStatus !== "available" ? "Connect Ollama in Settings to generate today’s digest." : selected.contentSnippet}</p>}
              {selected.link && (
                <a href={selected.link} target="_blank" rel="noreferrer" className="mt-7 inline-block rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                  Read original article
                </a>
              )}
            </article>
          </div>
        )}

        {profileOpen && activeProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center">
                <h2 className="text-lg font-semibold">Profiles</h2>
                <button type="button" onClick={() => setProfileOpen(false)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
              <div className="grid gap-2">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => switchProfile(profile.id)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${profile.id === activeProfileId ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:border-slate-400"}`}
                  >
                    <ProfileAvatar profile={profile} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{profile.name}</span>
                      {profile.email && <span className="block truncate text-xs text-slate-500">{profile.email}</span>}
                    </span>
                    {profile.id === activeProfileId && <span className="text-xs font-semibold text-blue-600">Active</span>}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); setActiveProfileId(null); }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
                >
                  <UserRound size={16} /> Add profile
                </button>
                <button
                  type="button"
                  onClick={logoutProfile}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center">
                <h2 className="text-lg font-semibold">Settings</h2>
                <button type="button" onClick={() => setSettingsOpen(false)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                <label className="flex items-center py-4 text-sm font-semibold text-slate-700">
                  <span className="flex-1">
                    Compact article list
                    <span className="block text-xs font-normal text-slate-500">Reduce spacing in article cards</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.compact}
                    onChange={(event) => setPreferences((current) => ({ ...current, compact: event.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center py-4 text-sm font-semibold text-slate-700">
                  <span className="flex-1">
                    Show source logos
                    <span className="block text-xs font-normal text-slate-500">Display favicons beside feeds</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.showLogos}
                    onChange={(event) => setPreferences((current) => ({ ...current, showLogos: event.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center py-4 text-sm font-semibold text-slate-700">
                  <span className="flex-1">
                    Watch notifications
                    <span className="block text-xs font-normal text-slate-500">Check watched topics for new Google results</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.notifications}
                    onChange={(event) => setPreferences((current) => ({ ...current, notifications: event.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center py-4 text-sm font-semibold text-slate-700">
                  <span className="flex-1">
                    Automatic AI summaries
                    <span className="block text-xs font-normal text-slate-500">Summarize articles when you open them, while Ollama is connected</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.autoSummarize}
                    onChange={(event) => setPreferences((current) => ({ ...current, autoSummarize: event.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setSettingsOpen(false); setOllamaModalOpen(true); }}
                  className="flex w-full items-center py-4 text-left text-sm font-semibold text-slate-700"
                >
                  <span className="flex-1">
                    Ollama AI
                    <span className="block text-xs font-normal text-slate-500">
                      {ollamaStatus === "available" ? "Connected" : ollamaStatus === "unavailable" ? "Not connected" : "Check connection"}
                    </span>
                  </span>
                  <span className={`mr-2 h-2 w-2 rounded-full ${ollamaStatus === "available" ? "bg-emerald-500" : ollamaStatus === "unavailable" ? "bg-amber-500" : "bg-slate-300"}`} />
                  <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                </button>
              </div>
              {activeProfile && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="cursor-pointer rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700">
                    {importing ? "Importing…" : "Import OPML"}
                    <input disabled={importing} aria-label="Import OPML" aria-busy={importing}
                      type="file"
                      accept=".opml,.xml,text/xml"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file || !activeProfile) return;
                        setImporting(true);
                        setImportError("");
                        try {
                          await saveQueue.current;
                          const response = await fetch(`/api/opml?profile=${encodeURIComponent(activeProfile.id)}`, {
                            method: "POST", headers: { "Content-Type": "application/xml" }, body: await file.text(),
                          });
                          const data = await response.json();
                          if (!response.ok) throw new Error(data.error || "Could not import this file. Please try again.");
                          if (!data.imported) throw new Error("No feeds found. Choose an OPML file exported by an RSS reader.");
                          setFeeds(data.feeds);
                          notify(`Imported ${data.imported} ${data.imported === 1 ? "feed" : "feeds"}`);
                        } catch (error) {
                          setImportError(error instanceof Error ? error.message : "Connection failed. Please try again.");
                        } finally { setImporting(false); event.target.value = ""; }
                      }}
                    />
                  </label>
                  <a
                    href={`/api/opml?profile=${encodeURIComponent(activeProfile.id)}`}
                    download
                    className="rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700"
                  >
                    Export OPML
                  </a>
                  <a
                    href="/api/feed/health"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700"
                  >
                    Feed health
                  </a>
                </div>
              )}
              {importError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{importError}</p>}
              <button type="button" onClick={() => setSettingsOpen(false)} className="mt-5 h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          </div>
        )}

        {ollamaModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center">
                <div>
                  <h2 className="text-lg font-semibold">Set up Ollama</h2>
                  <p className="mt-1 text-xs text-slate-500">AI summaries are an optional feature.</p>
                </div>
                <button type="button" onClick={() => { setOllamaModalOpen(false); setOllamaNoticeDismissed(true); }} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
              {ollamaStatus === "unavailable" && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Ollama is not connected. AI summaries will remain unavailable until a server is configured.
                </div>
              )}
              {ollamaStatus === "available" && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Ollama is connected and ready.
                </div>
              )}
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Server URL</label>
              <input
                value={ollamaSettings.url}
                onChange={(event) => setOllamaSettings((current) => ({ ...current, url: event.target.value }))}
                placeholder="Server default (leave blank)"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Model</label>
              <input
                value={ollamaSettings.model}
                onChange={(event) => setOllamaSettings((current) => ({ ...current, model: event.target.value }))}
                placeholder="Server default (leave blank)"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
              {ollamaError && <p className="mt-3 text-sm text-red-600">{ollamaError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => void testOllama()} disabled={ollamaTesting} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                  {ollamaTesting ? "Testing..." : "Test connection"}
                </button>
                <button type="button" onClick={saveOllamaSettings} disabled={ollamaTesting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {listOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
            <form onSubmit={createFeedList} className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center">
                <h2 className="text-lg font-semibold">Create feed list</h2>
                <button type="button" onClick={() => setListOpen(false)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">List name</label>
              <input
                autoFocus
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="Cyber security morning"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
              <label className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Choose feeds</label>
              <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {feeds.map((feed) => {
                  const checked = listFeedUrls.includes(feed.url);
                  return (
                    <button
                      type="button"
                      key={feed.url}
                      onClick={() => setListFeedUrls((current) =>
                        checked ? current.filter((url) => url !== feed.url) : [...current, feed.url],
                      )}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${checked ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}
                    >
                      <span className={`h-4 w-4 rounded border ${checked ? "border-blue-600 bg-blue-600" : "border-slate-300"}`} />
                      <span className="truncate font-semibold text-slate-700">{feed.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setListOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={!listName.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Create list</button>
              </div>
            </form>
          </div>
        )}

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
            <form onSubmit={addFeed} className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center">
                <div><h2 className="text-lg font-semibold">Follow RSS feeds</h2><p className="mt-1 text-xs text-slate-500">Choose multiple sources, then add them together.</p></div>
                <button type="button" disabled={addingFeed} onClick={() => setAddOpen(false)} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-60 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    value={pickerSearch}
                    onChange={(event) => setPickerSearch(event.target.value)}
                    placeholder="Search 200 technology and security feeds"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <select
                  value={pickerCategory}
                  onChange={(event) => setPickerCategory(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option>All</option>
                  {FEED_CATEGORIES.map((category) => <option key={category.name}>{category.name}</option>)}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span aria-live="polite">{selectedFeedUrls.length} {selectedFeedUrls.length === 1 ? "source" : "sources"} selected</span>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={addingFeed || !pickerSources.some((source) => !feeds.some((feed) => feed.url === source.url) && !selectedFeedUrls.includes(source.url))} onClick={() => setSelectedFeedUrls((current) => [...new Set([...current, ...pickerSources.filter((source) => !feeds.some((feed) => feed.url === source.url)).map((source) => source.url)])])} className="font-semibold text-blue-600">Select all shown</button>
                  <button type="button" disabled={addingFeed || !pendingFeedUrls.length} onClick={() => { setSelectedFeedUrls([]); setFeedUrl(""); setAddError(""); setFailedFeedUrls([]); }} className="font-medium">Clear selection</button>
                </div>
              </div>
              <div className="mt-3 grid min-h-0 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {pickerSources.map((source) => {
                  const isFollowing = feeds.some((feed) => feed.url === source.url);
                  const checked = selectedFeedUrls.includes(source.url);
                  return (
                    <button
                      key={source.url}
                      type="button"
                      disabled={isFollowing || addingFeed}
                      aria-pressed={checked}
                      aria-label={source.title}
                      onClick={() => { setSelectedFeedUrls((current) => checked ? current.filter((url) => url !== source.url) : [...current, source.url]); setAddError(""); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-400 ${checked ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : failedFeedUrls.includes(source.url) ? "border-red-200 bg-red-50" : "border-slate-200"}`}
                    >
                      <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked || isFollowing ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{(checked || isFollowing) && <Check size={12} strokeWidth={3} />}</span>
                      {preferences.showLogos && (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                          {feedLogoUrl(source.url) ? (
                          <span
                            role="img"
                            aria-label=""
                            className="h-6 w-6 bg-contain bg-center bg-no-repeat"
                            style={{ backgroundImage: `url("${feedLogoUrl(source.url)}")` }}
                          />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                          )}
                        </span>
                      )}
                      <span className="truncate">{source.title}</span>
                      {isFollowing && <span className="ml-auto text-[11px] uppercase">Added</span>}
                    </button>
                  );
                })}
              </div>
              {!pickerSources.length && <p className="py-4 text-center text-sm text-slate-500">No matching sources. Try another search or add a custom URL below.</p>}
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Custom feed URL <span className="font-normal normal-case tracking-normal">(optional)</span></label>
              <input
                autoFocus
                value={feedUrl}
                onChange={(event) => { setFeedUrl(event.target.value); setAddError(""); }}
                aria-label="Custom feed URL" aria-invalid={Boolean(addError)} aria-describedby={addError ? "feed-error" : undefined}
                disabled={addingFeed}
                placeholder="https://example.com/rss.xml"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
              {addError && <p id="feed-error" role="alert" className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-700">{addError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={addingFeed} onClick={() => setAddOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={addingFeed || !pendingFeedUrls.length} aria-busy={addingFeed} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{addingFeed && <LoaderCircle size={16} className="animate-spin" />}{addingFeed ? feedProgress.total > 1 ? `Adding ${feedProgress.done} of ${feedProgress.total}…` : "Adding feed…" : pendingFeedUrls.length > 1 ? `Add ${pendingFeedUrls.length} feeds` : "Add feed"}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    );
  }
