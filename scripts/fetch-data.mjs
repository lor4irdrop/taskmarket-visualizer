// Fetch Taskmarket public API data server-side and bake it into data/*.json.
// Runs on a schedule (at least hourly) from the operator's server, and locally with:  node scripts/fetch-data.mjs
// No key needed. Every number in the dashboard comes from these files.
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://api.taskmarket.dev";
const CHAINS = [
  { id: 4217, slug: "tempo", name: "Tempo", currency: "OUSD" },
  { id: 8453, slug: "base", name: "Base", currency: "USDC" },
];
const OUT = new URL("../data/", import.meta.url).pathname;
const CUTOFF = new Date(Date.now() - 84 * 24 * 3600 * 1000); // 12 weeks back
const DAYS30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

async function get(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": "taskmarket-visualizer/1.0" } });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function fetchChain(chain) {
  const q = `chainId=${chain.id}`;
  const [stats, breakdowns, feed] = await Promise.all([
    get(`/api/market/stats?${q}`),
    get(`/api/stats/breakdowns?${q}`),
    get(`/api/stats/activity-feed?${q}&limit=50`),
  ]);
  const series = {};
  for (const [range, bucket] of [["7d", "day"], ["30d", "day"], ["90d", "day"], ["all", "week"]]) {
    series[range] = await get(`/api/stats/platform-time-series?${q}&range=${range}&bucket=${bucket}`);
  }
  const [heatmapHour, heatmapMode] = await Promise.all([
    get(`/api/stats/activity-heatmap?${q}&range=30d&dimension=hourOfWeek`),
    get(`/api/stats/activity-heatmap?${q}&range=90d&dimension=mode`),
  ]);

  // Paginate the task list (newest first) until the API stops returning pages.
  // Note: the API currently ends the list after ~826 tasks (oldest ~22 Oct 2026),
  // so derived poster figures cover that returned window, not the full history.
  const tasks = [];
  let cursor = null, pages = 0;
  while (pages < 40) {
    const url = `/api/tasks?${q}&sort=newest&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page = await get(url);
    pages++;
    for (const t of page.tasks || []) {
      tasks.push({
        id: t.id, code: t.referenceCode, createdAt: t.createdAt, expiryTime: t.expiryTime,
        status: t.status, mode: t.mode, reward: t.reward, netReward: t.netReward,
        requester: t.requester, requesterName: t.requesterDisplayName || null,
        requesterType: t.requesterActorType || null, submissions: t.submissionCount || 0,
        awards: t.awardCount || 0, tags: t.tags || [],
        title: (t.description || "").split("\n")[0].slice(0, 140),
      });
    }
    if (!page.hasMore || !page.nextCursor) break;
    const last = tasks[tasks.length - 1];
    if (last && new Date(last.createdAt) < CUTOFF) break;
    cursor = page.nextCursor;
  }

  // --- Derived views, computed only from the fetched tasks + breakdowns ---
  const byWeek = {};
  for (const t of tasks) {
    const w = isoWeek(new Date(t.createdAt));
    byWeek[w] ??= { week: w, tasks: 0, posters: new Set(), rewards: 0 };
    byWeek[w].tasks++;
    byWeek[w].posters.add(t.requester);
    byWeek[w].rewards += Number(t.netReward || 0);
  }
  const postersPerWeek = Object.values(byWeek)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({ week: w.week, tasks: w.tasks, distinctPosters: w.posters.size, rewardsMicro: w.rewards }));

  const recent = tasks.filter((t) => new Date(t.createdAt) >= DAYS30);
  const byPoster = {};
  for (const t of recent) {
    byPoster[t.requester] ??= { address: t.requester, name: t.requesterName, tasks: 0, rewardsMicro: 0 };
    byPoster[t.requester].tasks++;
    byPoster[t.requester].rewardsMicro += Number(t.netReward || 0);
  }
  const topPosters = Object.values(byPoster).sort((a, b) => b.tasks - a.tasks).slice(0, 5);
  const totalStatus = (breakdowns.status || []).reduce((s, x) => s + x.count, 0);
  const died = (breakdowns.status || []).filter((x) => x.status === "expired" || x.status === "cancelled")
    .reduce((s, x) => s + x.count, 0);
  const completed = (breakdowns.status || []).find((x) => x.status === "completed")?.count || 0;
  const s30 = series["30d"] || [];
  const sum = (k) => s30.reduce((s, b) => s + Number(b[k] || 0), 0);
  const peakDay = [...s30].sort((a, b) => Number(b.tasksCreated) - Number(a.tasksCreated))[0];
  const hourCells = (heatmapHour.cells || []).reduce((m, c) => { m[c.col] = (m[c.col] || 0) + c.count; return m; }, {});
  const busiestHour = Object.entries(hourCells).sort((a, b) => b[1] - a[1])[0];

  const openTasks = tasks.filter((t) => t.status === "open")
    .sort((a, b) => Number(b.netReward || 0) - Number(a.netReward || 0)).slice(0, 12);
  const newestOpen = tasks.filter((t) => t.status === "open")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  return {
    chain, stats, breakdowns,
    series, heatmapHour, heatmapMode,
    feed: feed.items || [],
    derived: {
      tasksFetched: tasks.length, pagesFetched: pages,
      postersPerWeek,
      topPosters30d: topPosters,
      distinctPosters30d: Object.keys(byPoster).length,
      top5Share30d: recent.length ? topPosters.reduce((s, p) => s + p.tasks, 0) / recent.length : 0,
      tasks30d: recent.length,
      diedCount: died, diedShare: totalStatus ? died / totalStatus : 0,
      completedCount: completed, totalTasks: totalStatus,
      totals30d: {
        tasksCreated: sum("tasksCreated"), rewardVolumeMicro: sum("rewardVolume"),
        paidVolumeMicro: sum("paidVolume"), settlements: sum("settlements"),
        completedTasks: sum("completedTasks"),
        avgActiveAgents: s30.length ? sum("activeAgents") / s30.length : 0,
        peakDay: peakDay ? { date: peakDay.bucket, tasks: peakDay.tasksCreated } : null,
      },
      busiestHourUTC: busiestHour ? { hour: Number(busiestHour[0]), events: busiestHour[1] } : null,
      openTasks, newestOpen,
    },
  };
}

const endpoints = [
  "/api/market/stats", "/api/stats/breakdowns", "/api/stats/platform-time-series",
  "/api/stats/activity-heatmap", "/api/stats/activity-feed", "/api/tasks",
];
const out = {};
for (const chain of CHAINS) {
  console.log("fetching", chain.name);
  out[chain.slug] = await fetchChain(chain);
}
mkdirSync(OUT, { recursive: true });
for (const chain of CHAINS) writeFileSync(`${OUT}${chain.slug}.json`, JSON.stringify(out[chain.slug]));
const now = new Date();
const meta = {
  fetchedAt: now.toISOString(),
  fetchedAtWIB: new Date(now.getTime() + 7 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19) + " WIB",
  baseUrl: BASE, chains: CHAINS, endpoints,
  refresh: "Scheduled server-side fetch, at least hourly; data baked into the static site.",
  note: "All numbers are copied verbatim from api.taskmarket.dev. Amounts are in micro-units (1,000,000 = 1 OUSD/USDC).",
};
writeFileSync(`${OUT}meta.json`, JSON.stringify(meta, null, 2));
console.log("done", meta.fetchedAt, "tempo tasks:", out.tempo.derived.tasksFetched, "base tasks:", out.base.derived.tasksFetched);
