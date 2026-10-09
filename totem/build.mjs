// The totem: a steel spinning top that runs on the last two weeks of work, and that anyone on
// GitHub can spin.
//
// Reads the daily contribution calendar, measures how steadily things have been built lately,
// and writes:
//   assets/totem.svg     the top, on a transparent ground so it sits in light and dark mode alike
//   totem/state.json     the measurement and the last spin
//   README.md            the caption between <!-- totem --> and <!-- /totem -->
//
// Every number in the picture comes from the calendar or from a real spin. Nothing is tuned by hand.
//
//   node totem/build.mjs                     measure (GitHub GraphQL with GITHUB_TOKEN, else the public calendar page)
//   SPINNER=login node totem/build.mjs       a visitor spun it: record who and when, then redraw
//   node totem/build.mjs --from days.json    a saved {"YYYY-MM-DD": count} map, for working offline

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.TOTEM_USER ?? "SatnamCodes";
const STATE = path.join(ROOT, "totem", "state.json");
const SPIN_LASTS_HOURS = 24; // a visitor's spin keeps the top going this long

// ---------------------------------------------------------------------------------------------
// 1. The calendar

async function fromGraphQL(token) {
  const query = `query($login: String!) { user(login: $login) { contributionsCollection {
    contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const body = await res.json();
  const weeks = body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error(`GraphQL: ${JSON.stringify(body.errors ?? body).slice(0, 200)}`);
  const days = {};
  for (const w of weeks) for (const d of w.contributionDays) days[d.date] = d.contributionCount;
  return days;
}

// The public calendar page: each day cell has an id and a date; its count is in the matching tool-tip.
async function fromPage() {
  const res = await fetch(`https://github.com/users/${USER}/contributions`);
  if (!res.ok) throw new Error(`Calendar page ${res.status}`);
  const html = await res.text();
  const dates = new Map();
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"\s+id="([^"]+)"/g)) dates.set(m[2], m[1]);
  const days = {};
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)</g)) {
    const date = dates.get(m[1]);
    const n = m[2].match(/^(\d+) contribution/);
    if (date) days[date] = n ? Number(n[1]) : 0;
  }
  if (!Object.keys(days).length) throw new Error("Calendar page: no days found");
  return days;
}

async function calendar() {
  const i = process.argv.indexOf("--from");
  if (i > 0) return JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8"));
  if (process.env.GITHUB_TOKEN) {
    try {
      return await fromGraphQL(process.env.GITHUB_TOKEN);
    } catch (err) {
      console.warn(`[totem] ${err.message}; trying the public calendar page`);
    }
  }
  return fromPage();
}

// ---------------------------------------------------------------------------------------------
// 2. The measurement

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

export function measure(days) {
  const dates = Object.keys(days).sort();
  const counts = dates.map((d) => days[d]);
  const recent = counts.slice(-14);
  const last14 = recent.reduce((a, b) => a + b, 0);
  const active14 = recent.filter((n) => n > 0).length;

  // What a usual fortnight looks like: the median of the year's earlier fortnights that had any work.
  const windows = [];
  for (let end = counts.length - 14; end >= 14; end -= 14) {
    const sum = counts.slice(end - 14, end).reduce((a, b) => a + b, 0);
    if (sum > 0) windows.push(sum);
  }
  const usual = Math.max(1, median(windows));

  let idle = 0;
  for (let i = counts.length - 1; i >= 0 && counts[i] === 0; i--) idle++;

  // Momentum: this fortnight against a usual one. Rhythm: how many of its days had any work (half
  // of them counts as full rhythm). Steadiness weighs both.
  const momentum = clamp(last14 / usual / 1.2);
  const rhythm = clamp(active14 / 7);
  const steadiness = 0.6 * momentum + 0.4 * rhythm;

  return {
    measuredAt: dates.at(-1),
    last14,
    active14,
    usualFortnight: usual,
    idleDays: idle,
    yearTotal: counts.slice(-365).reduce((a, b) => a + b, 0),
    steadiness: Number(steadiness.toFixed(3)),
  };
}

// How the top moves, from the measurement and the last spin. A spin from a visitor sets it going
// fast for a day; otherwise it runs on the work alone. Faster spin means slower precession and a
// smaller lean, as in a real top.
export function motion(m, spin, now = new Date()) {
  const spunHoursAgo = spin ? (now - new Date(spin.at)) / 36e5 : Infinity;
  const fresh = spunHoursAgo < SPIN_LASTS_HOURS;
  const s = fresh ? Math.max(m.steadiness, lerp(1, 0.75, spunHoursAgo / SPIN_LASTS_HOURS)) : m.steadiness;
  const fallen = !fresh && m.idleDays >= 21;
  const state = fallen ? "at rest" : s >= 0.66 ? "spinning true" : s >= 0.33 ? "spinning" : "wobbling";
  return {
    state,
    fallen,
    fresh,
    spinPeriod: Number(lerp(1.6, 0.34, s).toFixed(3)), // seconds per turn
    leanDeg: Number(lerp(15, 1.8, s).toFixed(2)),
    precessionPeriod: Number(lerp(1.8, 7, s).toFixed(3)), // seconds per sway
  };
}

// ---------------------------------------------------------------------------------------------
// 3. The picture: machined steel, lit like a studio product shot, on nothing.

const W = 720;
const H = 300;
const TIP = { x: 360, y: 266 };
const SCALE = 1.25;

// The right half of the profile, tip at the origin, up the axis (negative y). Mirrored for the left.
// A pointed underside, a rounded crown, a slim stem and a domed cap.
const HALF = [
  ["M", 0, 0],
  ["C", 6, -6, 18, -26, 30, -44],
  ["C", 40, -58, 48, -70, 50, -79],
  ["C", 51, -86, 47, -95, 38, -102],
  ["C", 29, -108, 15, -111, 6.5, -112],
  ["C", 5.4, -114, 5, -116, 5, -119],
  ["L", 5, -149],
  ["C", 5, -151, 7.6, -152, 7.6, -156],
  ["C", 7.6, -161, 4, -163, 0, -163],
];

function profilePath() {
  const fmt = (n) => +n.toFixed(2);
  const right = HALF.map(([c, ...p]) => `${c} ${p.map(fmt).join(" ")}`).join(" ");
  // Walk back down the left side: reverse each curve, mirroring x.
  const pts = [];
  for (let i = HALF.length - 1; i >= 1; i--) {
    const [c, ...p] = HALF[i];
    const start = HALF[i - 1].slice(-2);
    if (c === "L") pts.push(`L ${fmt(-start[0])} ${fmt(start[1])}`);
    else pts.push(`C ${fmt(-p[2])} ${fmt(p[3])}, ${fmt(-p[0])} ${fmt(p[1])}, ${fmt(-start[0])} ${fmt(start[1])}`);
  }
  return `${right} ${pts.join(" ")} Z`;
}
const BODY = profilePath();

// Half-width of the body at height y (for lathe lines), sampled from the curves.
function halfWidth(y) {
  let best = 0;
  let x0 = 0, y0 = 0;
  for (const [c, ...p] of HALF.slice(1)) {
    const seg = c === "L" ? [[x0, y0], [x0, y0], [p[0], p[1]], [p[0], p[1]]] : [[x0, y0], [p[0], p[1]], [p[2], p[3]], [p[4], p[5]]];
    for (let t = 0; t <= 1; t += 0.01) {
      const u = 1 - t;
      const px = u ** 3 * seg[0][0] + 3 * u * u * t * seg[1][0] + 3 * u * t * t * seg[2][0] + t ** 3 * seg[3][0];
      const py = u ** 3 * seg[0][1] + 3 * u * u * t * seg[1][1] + 3 * u * t * t * seg[2][1] + t ** 3 * seg[3][1];
      if (Math.abs(py - y) < 0.8) best = Math.max(best, px);
    }
    [x0, y0] = seg[3];
  }
  return best;
}

// Where a stopped top comes to rest: on its side, on the body's widest edge and the cap, tip raised.
function restingPose() {
  const rim = [-50, -79];
  const cap = [-7.6, -156];
  const outline = [rim, cap, [-51, -86], [-47, -95], [-38, -102], [-7.6, -152], [-4, -163], [-30, -44], [0, 0]];
  const turn = (p, deg) => {
    const a = (deg * Math.PI) / 180;
    return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  };
  const gap = (deg) => Math.abs(turn(rim, deg)[1] - turn(cap, deg)[1]);
  let best = -90;
  for (let deg = -60; deg >= -140; deg -= 0.25) if (gap(deg) < gap(best)) best = deg;
  const low = Math.max(...outline.map((p) => turn(p, best)[1]));
  const mid = turn([0, -80], best);
  return `translate(${(TIP.x - mid[0] * SCALE).toFixed(1)} ${(TIP.y - low * SCALE).toFixed(1)}) rotate(${best})`;
}

// Studio reflections across a polished cylinder: two soft boxes, a dark gap, a kicker on the far edge.
const STEEL = [
  [0, "#141517"], [0.07, "#2f3134"], [0.18, "#7d8085"], [0.27, "#cfd2d5"], [0.33, "#f3f4f5"],
  [0.4, "#b4b7bb"], [0.5, "#55585c"], [0.6, "#3b3d40"], [0.7, "#74777b"], [0.79, "#c7c9cc"],
  [0.85, "#8d9094"], [0.93, "#3a3c3f"], [1, "#151618"],
];

export function svg(m, mo) {
  const lean = mo.fallen ? 0 : mo.leanDeg;
  const desc = mo.fallen
    ? `A machined steel spinning top lying still on its side: no contributions for ${m.idleDays} days.`
    : `A machined steel spinning top, ${mo.state}: ${m.last14} contributions on ${m.active14} of the last 14 days. It turns once every ${mo.spinPeriod} seconds and leans ${lean} degrees as it precesses.`;
  const pose = `${mo.fallen ? restingPose() : `translate(${TIP.x} ${TIP.y})`} scale(${SCALE})`;

  // Lathe lines: fine turned rings across the body, alternately catching and losing the light.
  const lathe = [];
  for (let y = -110.5, i = 0; y < -3; y += 1.7, i++) {
    const r = halfWidth(y);
    if (r < 6) continue;
    const light = i % 3 === 0;
    // Turned rings are never perfectly even: vary their strength a little, seeded by position.
    const vary = 0.6 + 0.4 * Math.abs(Math.sin(i * 12.9898));
    lathe.push(
      `<ellipse cx="0" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.035 + 0.6).toFixed(2)}" fill="none" stroke="${light ? "#fff" : "#000"}" stroke-opacity="${((light ? 0.06 : 0.07) * vary).toFixed(3)}" stroke-width=".4"/>`,
    );
  }
  // Two engraved marks on the crown: the only way to see a symmetric top turning. They sweep
  // across the near face and blur with speed.
  const blur = Math.min(9, 3.2 / mo.spinPeriod);
  const marks = mo.fallen
    ? `<rect x="-10" y="-95" width="5" height="1.6" rx=".8" fill="#0e0f10" opacity=".55"/>`
    : [0, 0.5]
        .map(
          (k) =>
            `<rect class="mark" x="-2.5" y="-96" width="5" height="1.8" rx=".9" fill="#0e0f10" style="animation-delay:-${(mo.spinPeriod * k).toFixed(3)}s"/>`,
        )
        .join("");
  const top = `
    <g clip-path="url(#tt-clip)">
      <path d="${BODY}" fill="url(#tt-steel)"/>
      <!-- The stem is a narrower cylinder, so it carries the same reflections at its own scale. -->
      <rect x="-8" y="-164" width="16" height="52" fill="url(#tt-stem)"/>
      <path d="${BODY}" fill="url(#tt-shade)"/>
      <!-- The key light's hotspot on the crown. -->
      <ellipse cx="-17" cy="-93" rx="12" ry="9" fill="url(#tt-hot)"/>
      ${lathe.join("\n      ")}
      <g filter="url(#tt-blur)">${marks}</g>
    </g>
    <!-- The machined edge at the widest point, and a fine rim light on the crown. -->
    <path d="M -50 -79 Q 0 -75.2 50 -79" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".7" clip-path="url(#tt-clip)"/>
    <path d="M -49.6 -77.6 Q 0 -73.8 49.6 -77.6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5" clip-path="url(#tt-clip)"/>
    <path d="M -38 -102 C -29 -108 -15 -111 -6.5 -112" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".6"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tt-title">
<title id="tt-title">${desc}</title>
<style>
  .sway { transform-box: view-box; transform-origin: ${TIP.x}px ${TIP.y}px;
          animation: sway ${mo.precessionPeriod}s ease-in-out infinite alternate; }
  @keyframes sway { from { transform: rotate(-${lean}deg) } to { transform: rotate(${lean}deg) } }
  .shadow { transform-box: view-box; transform-origin: ${TIP.x}px ${TIP.y}px;
            animation: drift ${mo.precessionPeriod}s ease-in-out infinite alternate; }
  @keyframes drift { from { transform: translateX(${(-lean * 2.4).toFixed(1)}px) } to { transform: translateX(${(lean * 2.4).toFixed(1)}px) } }
  .mark { opacity: 0; animation: turn ${mo.spinPeriod}s linear infinite; }
  @keyframes turn {
    0%   { transform: translateX(-46px) scaleX(.2); opacity: 0 }
    10%  { opacity: .55 }
    25%  { transform: translateX(-33px) scaleX(.7) }
    50%  { transform: translateX(0) scaleX(1); opacity: .75 }
    75%  { transform: translateX(33px) scaleX(.7) }
    90%  { opacity: .55 }
    100% { transform: translateX(46px) scaleX(.2); opacity: 0 }
  }
  @media (prefers-reduced-motion: reduce) { .sway, .shadow, .mark { animation: none } }
</style>
<defs>
  <linearGradient id="tt-steel" x1="-51" x2="51" y1="0" y2="0" gradientUnits="userSpaceOnUse">
    ${STEEL.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}
  </linearGradient>
  <linearGradient id="tt-stem" x1="-5.2" x2="5.2" y1="0" y2="0" gradientUnits="userSpaceOnUse">
    ${STEEL.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}
  </linearGradient>
  <radialGradient id="tt-hot"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <!-- Key light from above: the crown catches it, the underside falls into shade. -->
  <linearGradient id="tt-shade" x1="0" x2="0" y1="-163" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
    <stop offset=".3" stop-color="#fff" stop-opacity=".1"/>
    <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".55" stop-color="#000" stop-opacity=".05"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="tt-clip"><path d="${BODY}"/></clipPath>
  <filter id="tt-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur.toFixed(1)} 0.2"/></filter>
  <filter id="tt-soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="6 2.2"/></filter>
</defs>

<!-- Contact shadow only: no floor, no frame. It reads on a light page and fades into a dark one. -->
<ellipse class="shadow" cx="${mo.fallen ? TIP.x - 30 : TIP.x}" cy="${TIP.y + 1}" rx="${mo.fallen ? 115 : 58}" ry="5.5" fill="#000" opacity=".38" filter="url(#tt-soft)"/>
<ellipse class="shadow" cx="${mo.fallen ? TIP.x - 30 : TIP.x}" cy="${TIP.y + 0.5}" rx="${mo.fallen ? 50 : 9}" ry="1.6" fill="#000" opacity=".45" filter="url(#tt-soft)"/>

<g class="sway"><g transform="${pose}">${top}</g></g>
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// 4. The caption in the README

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function caption(m, mo, state) {
  const parts = [
    `<b>${mo.state[0].toUpperCase()}${mo.state.slice(1)}</b>`,
    `${m.last14} contributions in the last 14 days`,
    `measured ${fmtDate(`${m.measuredAt}T00:00:00Z`)}`,
  ];
  const spin = state.lastSpin
    ? `Last spun by <a href="https://github.com/${state.lastSpin.by}">@${state.lastSpin.by}</a> on ${fmtDate(state.lastSpin.at)} · spun ${state.spins} ${state.spins === 1 ? "time" : "times"} so far`
    : "Nobody has spun it yet.";
  return `<sub>${parts.join(" · ")}<br>${spin}</sub>`;
}

function writeCaption(text) {
  const file = path.join(ROOT, "README.md");
  const readme = fs.readFileSync(file, "utf8");
  const next = readme.replace(/<!-- totem -->[\s\S]*?<!-- \/totem -->/, `<!-- totem -->\n${text}\n<!-- /totem -->`);
  if (next === readme && !readme.includes("<!-- totem -->")) throw new Error("README has no <!-- totem --> block");
  fs.writeFileSync(file, next);
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { spins: 0 };
  const spinner = process.env.SPINNER;
  if (spinner) {
    // GitHub logins are letters, digits and single hyphens; anything else is not a real spin.
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(spinner)) throw new Error(`Not a GitHub login: ${spinner}`);
    state.lastSpin = { by: spinner, at: new Date().toISOString() };
    state.spins = (state.spins ?? 0) + 1;
  }

  // A spin redraws with the last measurement, so a visitor never waits on the calendar.
  let m = state.measurement;
  if (!spinner || !m) m = measure(await calendar());
  const mo = motion(m, state.lastSpin);

  fs.writeFileSync(path.join(ROOT, "assets", "totem.svg"), svg(m, mo));
  fs.writeFileSync(STATE, `${JSON.stringify({ ...state, measurement: m, motion: mo }, null, 2)}\n`);
  writeCaption(caption(m, mo, state));
  console.log(
    `[totem] ${m.measuredAt}: ${mo.state}, ${m.last14} in 14 days (usual ${m.usualFortnight}), steadiness ${m.steadiness}` +
      (spinner ? `; spun by @${spinner}` : ""),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
