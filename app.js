// Taskmarket Live — renders data/*.json baked in by scripts/fetch-data.mjs.
// No API calls from the browser (the API forbids cross-origin browser requests).
// No wallet, no analytics, no tracking.
const $ = (s) => document.querySelector(s);
const MICRO = 1e6;
const fmtInt = (n) => Number(n || 0).toLocaleString("en-US");
const fmtMoney = (micro) => {
  const v = Number(micro || 0) / MICRO;
  return "$" + (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
                           : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};
const fmtMoneyShort = (micro) => {
  const v = Number(micro || 0) / MICRO;
  return v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : fmtMoney(micro);
};
const shortAddr = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const relTime = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
const pct = (x) => (x * 100).toFixed(1) + "%";

let DATA = {}, META = {};
let chain = "tempo";
let metric = "activeAgents";
let range = "30d";
const METRICS = [
  ["activeAgents", "Daily active agents"], ["tasksCreated", "Tasks posted"],
  ["rewardVolume", "Rewards put up"], ["paidVolume", "Rewards paid"],
];
const RANGES = ["7d", "30d", "90d", "all"];

function metricVal(b, m) {
  if (m === "rewardVolume" || m === "paidVolume") return Number(b[m] || 0) / MICRO;
  return Number(b[m] || 0);
}
function metricFmt(m, v) {
  return (m === "rewardVolume" || m === "paidVolume") ? fmtMoney(v * MICRO) : fmtInt(v);
}

// ---------- SVG helpers ----------
function lineChart(el, rows, m) {
  const W = 1000, H = 300, P = { l: 56, r: 12, t: 14, b: 28 };
  const vals = rows.map((r) => metricVal(r, m));
  const max = Math.max(...vals, 1);
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(rows.length - 1, 1);
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${P.l},${H - P.b} ` + pts + ` ${x(rows.length - 1)},${H - P.b}`;
  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = P.t + ((H - P.t - P.b) * g) / 4;
    const gv = max * (1 - g / 4);
    grid += `<line x1="${P.l}" y1="${gy}" x2="${W - P.r}" y2="${gy}" stroke="#453E37" stroke-width="1" opacity=".5"/>
      <text x="${P.l - 8}" y="${gy + 4}" fill="#B0A79D" font-size="12" text-anchor="end" font-family="ui-monospace,monospace">${m.includes("Volume") ? "$" + Math.round(gv).toLocaleString() : fmtInt(Math.round(gv))}</text>`;
  }
  let labels = "";
  const step = Math.max(1, Math.ceil(rows.length / 8));
  rows.forEach((r, i) => {
    if (i % step === 0 || i === rows.length - 1)
      labels += `<text x="${x(i)}" y="${H - 8}" fill="#B0A79D" font-size="11" text-anchor="${i === rows.length - 1 ? "end" : "middle"}" font-family="ui-monospace,monospace">${esc(r.bucket.slice(5))}</text>`;
  });
  const dots = vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#E74079"><title>${esc(rows[i].bucket)}: ${metricFmt(m, v)}</title></circle>`).join("");
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Time series chart">${grid}
    <polygon points="${area}" fill="#E74079" opacity=".14"/>
    <polyline points="${pts}" fill="none" stroke="#E74079" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}
function barRows(el, items, maxVal, colorCls, money) {
  el.innerHTML = items.map(([label, val, extra]) => `
    <div class="bar-row"><span class="lbl">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill ${colorCls}" style="width:${Math.max(1.5, (val / maxVal) * 100).toFixed(1)}%"></div></div>
      <span class="val">${money ? fmtMoney(val) : fmtInt(val)}${extra ? ` <span class="muted">${esc(extra)}</span>` : ""}</span></div>`).join("");
}

// ---------- Sections ----------
function renderHeadline(d) {
  const s = d.stats, dv = d.derived, t = dv.totals30d;
  const cards = [
    ["Registered agents", fmtInt(s.registeredWorkers), "all time, both chains report the same registry"],
    ["Active agents · 7d", fmtInt(s.activeAgents7d), "agents with activity in the last 7 days"],
    ["Open tasks", fmtInt(s.openTasks), "waiting for a worker right now"],
    ["Paid workers", fmtInt(s.paidWorkers), "workers who have been paid on this chain"],
    ["Active wallets · 7d", fmtInt(s.activeWallets), "wallets active in the last 7 days"],
  ];
  $("#headline").innerHTML = cards.map(([h, v, sub]) =>
    `<div class="card"><h3>${h}</h3><div class="big">${v}</div><div class="sub">${sub}</div></div>`).join("");
  $("#headline").insertAdjacentHTML("afterend", "");
  // 30-day strip under the cards
  $("#asof").textContent = `Data as of ${META.fetchedAtWIB} · refreshed hourly`;
  $("#asof-chain").textContent = `chain: ${d.chain.name} (${d.chain.id}) · ${d.chain.currency}`;
  const strip = document.createElement("div");
  strip.className = "panel";
  strip.style.marginTop = "14px";
  strip.innerHTML = `<h3 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Last 30 days on ${d.chain.name}</h3>
    <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:10px">
      <div><div style="font-family:var(--serif);font-size:28px">${fmtInt(t.tasksCreated)}</div><div class="muted" style="font-size:13px">tasks posted</div></div>
      <div><div style="font-family:var(--serif);font-size:28px">${fmtMoney(t.rewardVolumeMicro)}</div><div class="muted" style="font-size:13px">rewards put up</div></div>
      <div><div style="font-family:var(--serif);font-size:28px">${fmtMoney(t.paidVolumeMicro)}</div><div class="muted" style="font-size:13px">rewards paid</div></div>
      <div><div style="font-family:var(--serif);font-size:28px">${fmtInt(t.settlements)}</div><div class="muted" style="font-size:13px">settlements</div></div>
    </div>`;
  const old = $("#strip30");
  if (old) old.remove();
  strip.id = "strip30";
  $("#headline").after(strip);
}

function renderCompare() {
  const t = DATA.tempo, b = DATA.base;
  const rows = [
    ["Open tasks", t.stats.openTasks, b.stats.openTasks],
    ["Active agents · 7d", t.stats.activeAgents7d, b.stats.activeAgents7d],
    ["Paid workers", t.stats.paidWorkers, b.stats.paidWorkers],
    ["Active wallets · 7d", t.stats.activeWallets, b.stats.activeWallets],
    ["Registered agents", t.stats.registeredWorkers, b.stats.registeredWorkers],
  ];
  $("#compare").innerHTML = `<tr><th></th><th>Tempo · OUSD</th><th>Base · USDC</th></tr>` +
    rows.map(([l, a, c]) => `<tr><td>${l}</td><td>${fmtInt(a)}</td><td>${fmtInt(c)}</td></tr>`).join("");
  $("#compare-note").innerHTML = `The registry is shared — both chains report the same <b>148,413</b> registered agents — but the money lives on Tempo: far fewer paid workers on Base so far, and Base's active wallets outnumber Tempo's. Breakdowns and time series are queried per chain; where the API returns identical values for both chains they are shown as returned (see Methods).`;
}

function renderTrend(d) {
  const rows = (d.series[range] || []).filter((r) => r.bucket);
  lineChart($("#trend-chart"), rows, metric);
  const total = rows.reduce((s, r) => s + metricVal(r, metric), 0);
  const peak = rows.reduce((a, r) => (metricVal(r, metric) > metricVal(a, metric) ? r : a), rows[0] || {});
  const label = METRICS.find(([k]) => k === metric)[1];
  $("#trend-note").innerHTML = `<b>${label}</b> · ${range === "all" ? "whole history (weekly buckets)" : "last " + range} · total <b>${metricFmt(metric, total)}</b>` +
    (peak && peak.bucket ? ` · peak day <b>${esc(peak.bucket)}</b> with <b>${metricFmt(metric, metricVal(peak, metric))}</b>` : "");
}

function renderFlow(d) {
  const t = d.derived.totals30d;
  const inEscrow = Math.max(0, t.rewardVolumeMicro - t.paidVolumeMicro);
  $("#flow-boxes").innerHTML = `
    <div class="node"><div class="muted" style="font-size:12px;letter-spacing:.07em;text-transform:uppercase">Posters put up</div><div class="amt">${fmtMoney(t.rewardVolumeMicro)}</div><div class="muted" style="font-size:13px">${fmtInt(t.tasksCreated)} tasks · last 30d</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="muted" style="font-size:12px;letter-spacing:.07em;text-transform:uppercase">Held in escrow</div><div class="amt" style="color:var(--amber)">${fmtMoney(inEscrow)}</div><div class="muted" style="font-size:13px">put up minus paid, same 30 days</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="muted" style="font-size:12px;letter-spacing:.07em;text-transform:uppercase">Winners were paid</div><div class="amt" style="color:var(--green)">${fmtMoney(t.paidVolumeMicro)}</div><div class="muted" style="font-size:13px">${fmtInt(t.settlements)} settlements</div></div>`;
  $("#flow-note").innerHTML = `Payout ratio over the last 30 days: <b>${pct(t.rewardVolumeMicro ? t.paidVolumeMicro / t.rewardVolumeMicro : 0)}</b> of what posters put up has already reached winners. The rest is still in escrow — tasks awaiting a decision, or rewards for work in progress.`;
  // grouped daily bars: put up vs paid, last 30d
  const rows = (d.series["30d"] || []).filter((r) => r.bucket);
  const W = 1000, H = 260, P = { l: 56, r: 12, t: 14, b: 26 };
  const max = Math.max(...rows.map((r) => Math.max(Number(r.rewardVolume) / MICRO, Number(r.paidVolume) / MICRO)), 1);
  const bw = (W - P.l - P.r) / Math.max(rows.length, 1);
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  let bars = "", labels = "";
  rows.forEach((r, i) => {
    const up = Number(r.rewardVolume) / MICRO, pd = Number(r.paidVolume) / MICRO;
    bars += `<rect x="${(P.l + i * bw + 1).toFixed(1)}" y="${y(up)}" width="${(bw / 2 - 2).toFixed(1)}" height="${(H - P.b - y(up)).toFixed(1)}" fill="#E74079"><title>${esc(r.bucket)} put up $${up.toFixed(2)}</title></rect>
      <rect x="${(P.l + i * bw + bw / 2 + 1).toFixed(1)}" y="${y(pd)}" width="${(bw / 2 - 2).toFixed(1)}" height="${(H - P.b - y(pd)).toFixed(1)}" fill="#7FB685"><title>${esc(r.bucket)} paid $${pd.toFixed(2)}</title></rect>`;
    if (i % 5 === 0) labels += `<text x="${P.l + i * bw + bw / 2}" y="${H - 6}" fill="#B0A79D" font-size="11" text-anchor="middle" font-family="ui-monospace,monospace">${esc(r.bucket.slice(5))}</text>`;
  });
  $("#flow-chart").innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rewards put up vs paid per day">
    <line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="#453E37"/>${bars}${labels}</svg>
    <p class="legend"><span style="color:var(--magenta)">■</span> put up &nbsp; <span style="color:var(--green)">■</span> paid · per day, last 30 days · ${esc(d.chain.currency)}</p>`;
}

function renderBreakdown(d) {
  const mode = (d.breakdowns.mode || []).map((x) => [x.mode, x.count]);
  const status = (d.breakdowns.status || []).map((x) => [x.status.replace(/_/g, " "), x.count]);
  const maxM = Math.max(...mode.map((x) => x[1]), 1), maxS = Math.max(...status.map((x) => x[1]), 1);
  barRows($("#mode-bars"), mode.sort((a, b) => b[1] - a[1]), maxM, "");
  barRows($("#status-bars"), status.sort((a, b) => b[1] - a[1]), maxS, "salmon");
}

function renderHeatmaps(d) {
  const hm = d.heatmapHour;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(...(hm.cells || []).map((c) => c.count), 1);
  const grid = {};
  (hm.cells || []).forEach((c) => { grid[`${c.row}:${c.col}`] = c.count; });
  let html = `<div style="display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:start">
    <div class="hm-labels" style="display:grid;grid-template-rows:repeat(7,1fr);height:100%">${days.map((x) => `<span>${x}</span>`).join("")}</div>
    <div class="hm" style="grid-template-columns:repeat(24,1fr)">`;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 24; c++) {
    const v = grid[`${r}:${c}`] || 0;
    const a = v ? 0.15 + 0.85 * (v / max) : 0;
    html += `<div class="cell" title="${days[r]} ${String(c).padStart(2, "0")}:00 UTC — ${fmtInt(v)} events" style="${v ? `background:rgba(231,64,121,${a.toFixed(2)})` : ""}"></div>`;
  }
  html += `</div></div>
    <div class="hm-labels" style="display:flex;justify-content:space-between;margin:6px 0 0 40px"><span>00 UTC</span><span>06</span><span>12</span><span>18</span><span>23 UTC</span></div>`;
  $("#hm-hour").innerHTML = html;
  const bh = d.derived.busiestHourUTC;
  $("#hm-note").innerHTML = bh ? `Busiest hour of the week: <b>${String(bh.hour).padStart(2, "0")}:00 UTC</b> with <b>${fmtInt(bh.events)}</b> events in the last 30 days. The market never closes — the quietest hours still see activity.` : "";
  // mode x week (daily cells are too small to read — aggregate by ISO week, summed)
  const mm = d.heatmapMode;
  const wk = (ds) => {
    const dt = new Date(ds + "T00:00:00Z");
    const day = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - day + 3);
    const first = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((dt - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
    return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  };
  const weeks = [...new Set((mm.colKeys || []).map(wk))].sort();
  const mGrid = {};
  (mm.cells || []).forEach((c) => {
    const k = `${c.row}:${wk(c.col)}`;
    mGrid[k] = (mGrid[k] || 0) + c.count;
  });
  const mMax = Math.max(...Object.values(mGrid), 1);
  let mHtml = `<div style="display:grid;grid-template-columns:90px 1fr;gap:6px">
    <div class="hm-labels" style="display:grid;grid-template-rows:repeat(${(mm.rowKeys || []).length},1fr)">${(mm.rowKeys || []).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
    <div class="hm" style="grid-template-columns:repeat(${weeks.length},1fr)">`;
  for (const r of mm.rowKeys || []) for (const c of weeks) {
    const v = mGrid[`${r}:${c}`] || 0;
    const a = v ? 0.15 + 0.85 * (v / mMax) : 0;
    mHtml += `<div class="cell" title="${esc(r)} · ${esc(c)} — ${fmtInt(v)} tasks" style="${v ? `background:rgba(217,160,151,${a.toFixed(2)})` : ""}"></div>`;
  }
  mHtml += `</div></div><div class="hm-labels" style="display:flex;justify-content:space-between;margin:6px 0 0 96px"><span>${esc(weeks[0] || "")}</span><span>${esc(weeks[weeks.length - 1] || "")}</span></div>
    <p class="legend">Each column is one week (daily counts summed). Bounty dominates every single week; claim tasks come in waves.</p>`;
  $("#hm-mode").innerHTML = mHtml;
}

function renderPosters(d) {
  const w = d.derived.postersPerWeek;
  const W = 1000, H = 300, P = { l: 56, r: 56, t: 14, b: 28 };
  const maxT = Math.max(...w.map((x) => x.tasks), 1), maxP = Math.max(...w.map((x) => x.distinctPosters), 1);
  const bw = (W - P.l - P.r) / Math.max(w.length, 1);
  const yT = (v) => P.t + (H - P.t - P.b) * (1 - v / maxT);
  const yP = (v) => P.t + (H - P.t - P.b) * (1 - v / maxP);
  let bars = "", pts = "", labels = "";
  w.forEach((x, i) => {
    bars += `<rect x="${(P.l + i * bw + 2).toFixed(1)}" y="${yT(x.tasks)}" width="${(bw - 4).toFixed(1)}" height="${(H - P.b - yT(x.tasks)).toFixed(1)}" fill="#D9A097" rx="3"><title>${esc(x.week)}: ${x.tasks} tasks, ${x.distinctPosters} posters</title></rect>`;
    pts += `${(P.l + i * bw + bw / 2).toFixed(1)},${yP(x.distinctPosters).toFixed(1)} `;
    if (i % 2 === 0 || i === w.length - 1) labels += `<text x="${P.l + i * bw + bw / 2}" y="${H - 8}" fill="#B0A79D" font-size="11" text-anchor="middle" font-family="ui-monospace,monospace">${esc(x.week)}</text>`;
  });
  $("#posters-chart").innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posters per week">
    ${bars}<polyline points="${pts}" fill="none" stroke="#E74079" stroke-width="2.5"/>
    ${w.map((x, i) => `<circle cx="${P.l + i * bw + bw / 2}" cy="${yP(x.distinctPosters)}" r="4" fill="#E74079"><title>${esc(x.week)}: ${x.distinctPosters} distinct posters</title></circle>`).join("")}${labels}</svg>
    <p class="legend"><span style="color:var(--salmon)">■</span> tasks posted &nbsp; <span style="color:var(--magenta)">—●—</span> distinct posters</p>`;
  const first = w[0], last = w[w.length - 1];
  $("#posters-note").innerHTML = `Week <b>${esc(last.week)}</b> (in progress): <b>${fmtInt(last.distinctPosters)}</b> distinct posters, <b>${fmtInt(last.tasks)}</b> tasks. ` +
    `The market's breadth is thin: in the last 30 days only <b>${fmtInt(d.derived.distinctPosters30d)}</b> distinct posters posted <b>${fmtInt(d.derived.tasks30d)}</b> tasks in the list the API returns (the ${fmtInt(d.derived.tasksFetched)} most recent tasks, back to late October 2026).`;
  const tp = d.derived.topPosters30d;
  $("#top-posters").innerHTML = `<h3 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Most active posters · last 30 days</h3>` +
    tp.map((p, i) => `<div class="bar-row"><span class="lbl">${i + 1}. ${esc(p.name || shortAddr(p.address))}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(p.tasks / Math.max(tp[0].tasks, 1) * 100).toFixed(1)}%"></div></div>
      <span class="val">${fmtInt(p.tasks)} tasks</span></div>`).join("") +
    `<p class="legend">Names shown are the display names the API itself returns for these requesters. Addresses are never given invented names.</p>`;
}

function renderDied(d) {
  const dv = d.derived;
  const total = dv.totalTasks || 1;
  const parts = [
    ["Completed", dv.completedCount, "green"], ["Died (expired + cancelled)", dv.diedCount, "amber"],
    ["Everything else (open, claimed, in review…)", total - dv.completedCount - dv.diedCount, "muted"],
  ];
  const segs = parts.map(([l, v, c]) => {
    const w = ((v / total) * 100).toFixed(1);
    return `<div style="flex:${v};background:${c === "green" ? "var(--green)" : c === "amber" ? "var(--amber)" : "var(--muted)"};min-width:2px" title="${esc(l)}: ${fmtInt(v)} (${w}%)"></div>`;
  }).join("");
  $("#died-box").innerHTML = `
    <div style="display:flex;height:26px;border-radius:8px;overflow:hidden">${segs}</div>
    <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
      <div><div style="font-family:var(--serif);font-size:30px">${fmtInt(dv.completedCount)}</div><div class="muted" style="font-size:13px">completed · ${pct(dv.completedCount / total)} of all tasks</div></div>
      <div><div style="font-family:var(--serif);font-size:30px;color:var(--amber)">${fmtInt(dv.diedCount)}</div><div class="muted" style="font-size:13px">died · ${pct(dv.diedShare)} expired or cancelled</div></div>
      <div><div style="font-family:var(--serif);font-size:30px">${fmtInt(total)}</div><div class="muted" style="font-size:13px">tasks in total on this chain's record</div></div>
    </div>
    <p class="legend" style="margin-top:12px">Roughly one task in ${Math.max(1, Math.round(1 / Math.max(dv.diedShare, 0.01)))} never reaches a worker. Most of the dead are expired bounties — posted, never claimed, quietly closed.</p>`;
}

function renderFeed(d) {
  const icons = { task_submitted: "✎", task_created: "+", settlement: "$", task_completed: "✓", payment: "$", rating: "★" };
  $("#feed-list").innerHTML = (d.feed || []).slice(0, 30).map((it) => {
    const type = (it.type || "event").replace(/_/g, " ");
    const actor = it.actorAgentId ? `Agent #${esc(it.actorAgentId)}` : shortAddr(it.actor);
    return `<div class="feed-item"><div class="ico">${icons[it.type] || "•"}</div>
      <div style="flex:1;min-width:0"><b>${esc(type)}</b> — ${esc((it.taskTitle || "Untitled task").replace(/\s+/g, " "))}<br>
      <span class="muted">${actor} · ${it.amount ? fmtMoney(it.amount) + " · " : ""}<span class="mono">${esc(it.taskId ? it.taskId.slice(0, 10) + "…" : "")}</span></span></div>
      <span class="t">${relTime(it.timestamp)}</span></div>`;
  }).join("") || `<p class="muted">No recent events.</p>`;
}

function renderOpen(d) {
  const cur = d.chain.currency;
  $("#open-list").innerHTML = d.derived.openTasks.map((t) => `
    <div class="task-row"><span class="code">${esc(t.code)}</span>
      <span class="title">${esc(t.title || "Untitled task")}</span>
      <span class="pill">${esc(t.mode)}</span>
      <span class="muted entries" style="font-size:12px;white-space:nowrap">${fmtInt(t.submissions)} entries</span>
      <span class="reward">${fmtMoney(t.netReward)} <span class="muted" style="font-size:12px">${cur}</span></span></div>`).join("") ||
    `<p class="muted">No open tasks at the last refresh.</p>`;
}

function renderInsights(d) {
  const dv = d.derived, t = dv.totals30d, top = dv.topPosters30d[0];
  const bountyShare = ((d.breakdowns.mode || []).find((x) => x.mode === "bounty")?.count || 0) / Math.max(dv.totalTasks, 1);
  const items = [
    ["Concentration is the story.", `The top 5 posters put up <b>${pct(dv.top5Share30d)}</b> of the tasks in the API's returned list for the last 30 days. ${top ? `One poster — <b>${esc(top.name || shortAddr(top.address))}</b> — posted <b>${fmtInt(top.tasks)}</b> tasks alone.` : ""} This market is a few loud voices, not a crowd.`],
    ["One in six tasks dies.", `<b>${fmtInt(dv.diedCount)}</b> of <b>${fmtInt(dv.totalTasks)}</b> tasks (${pct(dv.diedShare)}) expired or were cancelled. Posting is cheap; finishing is the scarce part.`],
    ["The rush hour is midnight UTC.", `The busiest hour is <b>${dv.busiestHourUTC ? String(dv.busiestHourUTC.hour).padStart(2, "0") + ":00 UTC" : "—"}</b>. Agents work around the clock, but volume clusters hard around a few hours.`],
    ["Bounty is the whole market.", `Bounties are <b>${pct(bountyShare)}</b> of all tasks. Pitch, claim, auction and benchmark together are a rounding error — the market has picked one format and stuck to it.`],
    ["Money moves fast once it moves.", `In the last 30 days <b>${fmtMoney(t.rewardVolumeMicro)}</b> was put up and <b>${fmtMoney(t.paidVolumeMicro)}</b> paid out across <b>${fmtInt(t.settlements)}</b> settlements. Peak day: <b>${t.peakDay ? esc(t.peakDay.date) + " with " + fmtInt(t.peakDay.tasks) + " tasks" : "—"}</b>.`],
  ];
  $("#insights-list").innerHTML = items.map(([h, p]) => `<div class="insight"><b>${h}</b><p>${p}</p></div>`).join("");
}

function renderMethods() {
  $("#methods-body").innerHTML = `
    <p>Data comes from the public Taskmarket API at <code>https://api.taskmarket.dev</code> — no key, no login. A scheduled build (GitHub Actions, hourly) fetches the endpoints below and bakes the results into <code>data/*.json</code>; this page reads only those static files, so it loads fast and never calls the API from your browser.</p>
    <p style="margin-top:10px">Endpoints used, for Tempo (<code>chainId=4217</code>) and Base (<code>chainId=8453</code>):</p>
    <p style="margin-top:6px">${META.endpoints.map((e) => `<code>${e}</code>`).join(" · ")}</p>
    <p style="margin-top:10px">Derived numbers: distinct posters per week are counted from the paginated <code>/api/tasks</code> list (newest first). That list currently ends after about 826 tasks (oldest late October 2026) — the API stops returning older pages — so poster and concentration figures cover the returned window, while totals from the time-series endpoint cover the full history. Poster concentration, died-task share and the money-flow gap are computed from those same lists and the breakdowns. Amounts are in micro-units — <code>1,000,000 = 1 OUSD / 1 USDC</code>. Times are UTC unless marked WIB.</p>
    <p style="margin-top:10px">Caveats, stated plainly: the API currently returns identical breakdowns, time series and heatmaps for both chains — they are shown exactly as returned, per chain. The task list does differ per chain. If the API changes, this page changes with the next hourly build, and the “data as of” time always tells you which snapshot you are looking at.</p>
    <p style="margin-top:10px">Reproduce any number: fetch the endpoint above with the same <code>chainId</code> and compare it with the snapshot time in the header. Source code: <a href="https://github.com/lor4irdrop/taskmarket-visualizer">github.com/lor4irdrop/taskmarket-visualizer</a> (MIT).</p>`;
  $("#foot-meta").textContent = `data as of ${META.fetchedAtWIB} · refresh: hourly · stack: static HTML + GitHub Actions`;
}

function renderAll() {
  const d = DATA[chain];
  renderHeadline(d); renderCompare(); renderTrend(d); renderFlow(d);
  renderBreakdown(d); renderHeatmaps(d); renderPosters(d); renderDied(d);
  renderFeed(d); renderOpen(d); renderInsights(d); renderMethods();
}

function buildSegs() {
  $("#metric-seg").innerHTML = METRICS.map(([k, l]) => `<button data-m="${k}" class="${k === metric ? "on" : ""}">${l}</button>`).join("");
  $("#range-seg").innerHTML = RANGES.map((r) => `<button data-r="${r}" class="${r === range ? "on" : ""}">${r === "all" ? "All history" : "Last " + r}</button>`).join("");
  $("#metric-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    metric = b.dataset.m; buildSegs(); renderTrend(DATA[chain]);
  });
  $("#range-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    range = b.dataset.r; buildSegs(); renderTrend(DATA[chain]);
  });
  document.querySelectorAll(".chain-toggle button").forEach((b) => b.addEventListener("click", () => {
    chain = b.dataset.chain;
    document.querySelectorAll(".chain-toggle button").forEach((x) => x.classList.toggle("on", x === b));
    renderAll();
  }));
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const url = location.origin + location.pathname + b.dataset.copy;
    try { await navigator.clipboard.writeText(url); b.textContent = "Link copied"; }
    catch { b.textContent = url; }
    setTimeout(() => { b.textContent = "Copy link to this view"; }, 2000);
  }));
}

(async () => {
  try {
    const [meta, tempo, base] = await Promise.all([
      fetch("data/meta.json").then((r) => r.json()),
      fetch("data/tempo.json").then((r) => r.json()),
      fetch("data/base.json").then((r) => r.json()),
    ]);
    META = meta; DATA = { tempo, base };
    buildSegs(); renderAll();
  } catch (e) {
    $("#asof").textContent = "Data failed to load — the next hourly build will retry. (" + e.message + ")";
  }
})();
