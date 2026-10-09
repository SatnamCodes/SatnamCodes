// The totem: a steel spinning top that runs on the last two weeks of work. Click it on the profile
// and its blueprint opens beneath it, dimensioned with the same readings.
//
// Reads the daily contribution calendar, measures how steadily things have been built lately,
// and writes:
//   assets/totem.svg                              the top, on a transparent ground (light and dark alike)
//   assets/blueprint-dark.svg, -light.svg         its engineering drawing, one per GitHub theme
//   totem/state.json                              the measurement
//   assets/states/*, assets/city.svg              the other states' examples and buttons; the year as a city
//   README.md                                     the caption and the state buttons, between their markers
//
// Every number in the pictures comes from the calendar. Nothing is tuned by hand.
//
//   node totem/build.mjs                     measure (GitHub GraphQL with GITHUB_TOKEN, else the public calendar page)
//   node totem/build.mjs --from days.json    a saved {"YYYY-MM-DD": count} map, for working offline

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frame, anim, rng, r1, r2, INK as FILM } from "./film.mjs";
import { city } from "./shots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.TOTEM_USER ?? "SatnamCodes";
const STATE = path.join(ROOT, "totem", "state.json");

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

// How the top moves, from the measurement. Faster spin means slower precession and a smaller lean,
// as in a real top; three weeks without work and it is lying on its side.
export function motion(m) {
  const s = m.steadiness;
  const fallen = m.idleDays >= 21;
  const state = fallen ? "at rest" : s >= 0.5 ? "spinning true" : "wobbling";
  return {
    state,
    fallen,
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
function restingPose(tip = TIP, scale = SCALE) {
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
  return `translate(${(tip.x - mid[0] * scale).toFixed(1)} ${(tip.y - low * scale).toFixed(1)}) rotate(${best})`;
}

// Studio reflections across a polished cylinder: two soft boxes, a dark gap, a kicker on the far edge.
const STEEL = [
  [0, "#141517"], [0.07, "#2f3134"], [0.18, "#7d8085"], [0.27, "#cfd2d5"], [0.33, "#f3f4f5"],
  [0.4, "#b4b7bb"], [0.5, "#55585c"], [0.6, "#3b3d40"], [0.7, "#74777b"], [0.79, "#c7c9cc"],
  [0.85, "#8d9094"], [0.93, "#3a3c3f"], [1, "#151618"],
];

// The shot: the top on a polished walnut table at night, one lamp behind it to the left. Its
// shadow falls toward us, the table reflects it, dust hangs in the lamp's light. The axis
// precesses around the vertical (seen from the side, the lean swings left and right) with a
// small fast nod on top of it, and the tip wanders, as a real top's does.
const HW = 840, HH = 352; // 2.39:1
const HTIP = { x: 420, y: 298 };
const HSCALE = 1.22;
const HORIZON = 176;

export function svg(m, mo) {
  const lean = mo.fallen ? 0 : mo.leanDeg;
  const desc = mo.fallen
    ? `A machined steel spinning top lying still on its side on a dark table: no contributions for ${m.idleDays} days.`
    : `A machined steel spinning top on a dark table, ${mo.state}: ${m.last14} contributions on ${m.active14} of the last 14 days. It turns once every ${mo.spinPeriod} seconds and leans ${lean} degrees as it precesses.`;
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
      <path d="${BODY}" fill="url(#tt-warm)"/>
      <!-- The key light's hotspot on the crown. -->
      <ellipse cx="-17" cy="-93" rx="12" ry="9" fill="url(#tt-hot)"/>
      ${lathe.join("\n      ")}
      <g filter="url(#tt-blur)">${marks}</g>
    </g>
    <!-- The machined edge at the widest point, and a fine rim light on the crown. -->
    <path d="M -50 -79 Q 0 -75.2 50 -79" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".7" clip-path="url(#tt-clip)"/>
    <path d="M -49.6 -77.6 Q 0 -73.8 49.6 -77.6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5" clip-path="url(#tt-clip)"/>
    <path d="M -38 -102 C -29 -108 -15 -111 -6.5 -112" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".6"/>`;


  // Precession and nutation, sampled over one precession period; the tip's wander over three.
  const N = 60, T = mo.precessionPeriod;
  const tilt = [], wander = [];
  for (let i = 0; i <= N; i++) {
    const ph = (2 * Math.PI * i) / N;
    tilt.push(r2(lean * Math.cos(ph) + lean * 0.16 * Math.cos(7 * ph)));
    wander.push(`${r1(lean * 0.9 * Math.sin(ph))} ${r1(lean * 0.15 * Math.sin(2 * ph))}`);
  }
  const moving = (inner) =>
    mo.fallen
      ? inner
      : `<g><animateTransform attributeName="transform" type="translate" values="${wander.join(";")}" dur="${r2(3 * T)}s" repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="rotate" values="${tilt.join(";")}" dur="${T}s" repeatCount="indefinite"/>${inner}</g></g>`;
  const pose = mo.fallen ? `${restingPose(HTIP, HSCALE)} scale(${HSCALE})` : `translate(${HTIP.x} ${HTIP.y}) scale(${HSCALE})`;

  // The shadow: the silhouette projected onto the table along the lamp's direction.
  const kx = 0.62, ky = 0.14;
  const shadow = mo.fallen
    ? `<ellipse cx="${HTIP.x + 10}" cy="${HTIP.y + 4}" rx="118" ry="9" fill="#000" opacity=".7" filter="url(#tt-sh)"/>`
    : `<g transform="matrix(1 0 ${-kx * HSCALE} ${-ky * HSCALE} ${HTIP.x} ${HTIP.y})" opacity=".62" filter="url(#tt-sh)">${moving(`<path d="${BODY}" fill="#000"/>`)}</g>
<ellipse cx="${HTIP.x}" cy="${HTIP.y + 0.5}" rx="7" ry="1.8" fill="#000" opacity=".8" filter="url(#tt-soft)"/>`;

  // The room: a dark wall with the lamp and two far lights out of focus, the table, its grain
  // running away from us to the horizon.
  const R = rng(11);
  const grain = Array.from({ length: 46 }, (_, i) => {
    const x0 = -900 + (i / 45) * 2640 + (R() - 0.5) * 30;
    const dark = R() < 0.7;
    return `<line x1="${r1(x0)}" y1="${HH}" x2="${HW / 2}" y2="${HORIZON - 60}" stroke="${dark ? "#000" : "#6b4a33"}" stroke-opacity="${r2(dark ? 0.12 + R() * 0.22 : 0.05 + R() * 0.06)}" stroke-width="${r1(0.5 + R() * 1.6)}"/>`;
  }).join("");
  const bokeh = [
    [96, 64, 26, 0.12], [150, 112, 12, 0.08], [688, 58, 34, 0.07], [758, 118, 15, 0.1], [600, 30, 18, 0.05], [262, 40, 9, 0.06],
  ]
    .map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${FILM.hot}" opacity="${o}"/>`)
    .join("");
  const dust = Array.from({ length: 18 }, (_, i) => {
    const x = 150 + R() * 360, y = 20 + R() * 230, rad = r1(0.5 + R() * 1.3), o = r2(0.15 + R() * 0.45);
    const xs = [], ys = [];
    for (let k = 0; k <= 8; k++) {
      xs.push(x + Math.sin(k * 0.9 + i) * 9 + k * 1.6);
      ys.push(y + Math.cos(k * 0.7 + i * 2) * 6 - k * 0.8);
    }
    xs.push(xs[0]); ys.push(ys[0]);
    return `<circle r="${rad}" fill="${FILM.hot}" opacity="${o}"${rad > 1.2 ? ' filter="url(#tt-b1)"' : ""}>${anim("cx", xs, 18 + (i % 5) * 3)}${anim("cy", ys, 18 + (i % 5) * 3)}</circle>`;
  }).join("");

  const body = `
<rect width="${HW}" height="${HORIZON}" fill="url(#tt-wall)"/>
<g filter="url(#tt-bokeh)">${bokeh}</g>
<rect y="${HORIZON}" width="${HW}" height="${HH - HORIZON}" fill="url(#tt-table)"/>
<g clip-path="url(#tt-tableclip)">${grain}</g>
<line x1="0" y1="${HORIZON + 0.5}" x2="${HW}" y2="${HORIZON + 0.5}" stroke="#3b2b20" stroke-opacity=".7"/>
<ellipse cx="${HTIP.x - 40}" cy="${HTIP.y - 6}" rx="330" ry="78" fill="url(#tt-pool)"/>
<g mask="url(#tt-refmask)"><g transform="translate(0 ${2 * HTIP.y}) scale(1 -1)" opacity=".26" filter="url(#tt-b2)"><use href="#tt-top"/></g></g>
${shadow}
<g id="tt-top" transform="${pose}">${moving(top)}</g>
<path d="M 120 0 H 236 L 560 ${HTIP.y + 30} H 300 Z" fill="url(#tt-beam)" filter="url(#tt-wide)"/>
${dust}`;

  const defs = `<style>
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
  @media (prefers-reduced-motion: reduce) { .mark { animation: none } }
</style>

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

  <linearGradient id="tt-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#060606"/><stop offset="1" stop-color="#15110e"/></linearGradient>
  <linearGradient id="tt-table" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1c140e"/><stop offset=".5" stop-color="#140e0a"/><stop offset="1" stop-color="#0c0907"/></linearGradient>
  <clipPath id="tt-tableclip"><rect y="${HORIZON}" width="${HW}" height="${HH - HORIZON}"/></clipPath>
  <radialGradient id="tt-pool"><stop offset="0" stop-color="${FILM.hot}" stop-opacity=".2"/><stop offset=".45" stop-color="${FILM.warm}" stop-opacity=".07"/><stop offset="1" stop-color="${FILM.warm}" stop-opacity="0"/></radialGradient>
  <linearGradient id="tt-beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${FILM.hot}" stop-opacity=".16"/><stop offset="1" stop-color="${FILM.hot}" stop-opacity="0"/></linearGradient>
  <linearGradient id="tt-rf" x1="0" x2="0" y1="${HTIP.y}" y2="${HTIP.y + 62}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="tt-refmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${HW}" height="${HH}"><rect y="${HTIP.y}" width="${HW}" height="${HH - HTIP.y}" fill="url(#tt-rf)"/></mask>
  <linearGradient id="tt-warm" x1="-51" x2="51" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${FILM.warm}" stop-opacity=".28"/><stop offset=".45" stop-color="${FILM.warm}" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <filter id="tt-bokeh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="tt-wide" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="tt-sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>`;

  return frame({ w: HW, h: HH, p: "tt", desc, defs, body });
}

// ---------------------------------------------------------------------------------------------
// 4. The blueprint: the same top as an engineering drawing, dimensioned with the readings.
//    Elevation with its lean, a plan view that actually turns, notes and a title block.

const INK = {
  dark: { ink: "#e6edf3", mute: "#9198a1", faint: "#30363d", accent: "#d9a35b" },
  light: { ink: "#1f2328", mute: "#59636e", faint: "#d8dee4", accent: "#9a5f17" },
};
const MONO = `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`;

export function blueprint(m, mo, theme, example = null) {
  const t = INK[theme];
  const BW = 840, BH = 330;
  const S = 1.15; // drawing scale
  const tip = { x: 150, y: 268 };
  const txt = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${o.size ?? 10}" fill="${o.fill ?? t.mute}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${s}</text>`;
  const arrow = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const head = (x, y, dir) =>
      `M ${x} ${y} l ${(6 * Math.cos(dir + 2.7)).toFixed(1)} ${(6 * Math.sin(dir + 2.7)).toFixed(1)} M ${x} ${y} l ${(6 * Math.cos(dir - 2.7)).toFixed(1)} ${(6 * Math.sin(dir - 2.7)).toFixed(1)}`;
    return `<path class="draw" d="M ${x1} ${y1} L ${x2} ${y2} ${head(x2, y2, a)} ${head(x1, y1, a + Math.PI)}" fill="none" stroke="${t.mute}" stroke-width=".8"/>`;
  };
  const lean = mo.fallen ? 0 : mo.leanDeg;
  const L = 175 * S; // axis length drawn
  const rad = (lean * Math.PI) / 180;
  const top = { x: tip.x + Math.sin(rad) * L, y: tip.y - Math.cos(rad) * L };
  const live = (s) => `<tspan fill="${t.accent}">${s}</tspan>`;
  const dimY = tip.y - 163 * S - 16; // the width dimension runs above the cap
  // A point on the upright body (local units) where it sits once leaned.
  const at = (x, y) => ({
    x: tip.x + (x * Math.cos(rad) - y * Math.sin(rad)) * S,
    y: tip.y + (x * Math.sin(rad) + y * Math.cos(rad)) * S,
  });
  const rimL = at(-50, -79), rimR = at(50, -79), stem = at(5, -136);
  const date = example ? "EXAMPLE" : fmtDate(`${m.measuredAt}T00:00:00Z`).toUpperCase();

  // Plan view: the body seen from above, turned rings and an index mark that turns at the measured rate.
  const plan = { x: 400, y: 160, r: 50 * S };
  const rings = [0.25, 0.45, 0.62, 0.78, 0.9]
    .map((k) => `<circle cx="0" cy="0" r="${(plan.r * k).toFixed(1)}" fill="none" stroke="${t.faint}" stroke-width=".7"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BW}" height="${BH}" viewBox="0 0 ${BW} ${BH}" role="img" aria-labelledby="bp-title">
<title id="bp-title">Blueprint of the totem, ${example ? "an example reading" : `measured ${date}`}: ${mo.state}, ${m.last14} contributions in the last 14 days against a usual fortnight of ${m.usualFortnight}, steadiness ${m.steadiness}. It turns once every ${mo.spinPeriod} seconds and leans ${lean} degrees.</title>
<style>
  .draw { stroke-dasharray: 900; stroke-dashoffset: 900; animation: draw 2.2s ease-out .2s forwards; }
  @keyframes draw { to { stroke-dashoffset: 0 } }
  .turn { transform-box: view-box; transform-origin: ${plan.x}px ${plan.y}px; animation: turn ${mo.fallen ? 0 : mo.spinPeriod * 6}s linear infinite; }
  @keyframes turn { to { transform: rotate(360deg) } }
  @media (prefers-reduced-motion: reduce) { .draw { animation: none; stroke-dashoffset: 0 } .turn { animation: none } }
</style>

<!-- Sheet border, as on a drawing. -->
<rect x="1" y="1" width="${BW - 2}" height="${BH - 2}" fill="none" stroke="${t.faint}"/>
${txt(16, 22, "ELEVATION", { ls: 2 })}
${txt(plan.x - plan.r, 22, "PLAN", { ls: 2 })}
${txt(560, 22, "NOTES", { ls: 2 })}

<!-- Elevation: the top's outline, its true axis (vertical) and its axis as it leans. -->
<!-- The axes break where labels cross them, as on a drawing. -->
<mask id="bp-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="${BW}" height="${BH}">
  <rect width="${BW}" height="${BH}" fill="#fff"/>
  <rect x="${tip.x - 86}" y="${dimY - 19}" width="172" height="15" fill="#000"/>
</mask>
${mo.fallen ? "" : `<line x1="${tip.x}" y1="${tip.y + 14}" x2="${tip.x}" y2="${dimY - 22}" stroke="${t.faint}" stroke-dasharray="10 3 2 3" mask="url(#bp-gap)"/>`}
<g transform="${mo.fallen ? restingPose(tip, S) : `translate(${tip.x} ${tip.y}) rotate(${lean})`} scale(${S})">
  <path class="draw" d="${BODY}" fill="none" stroke="${t.ink}" stroke-width="${(1 / S).toFixed(2)}"/>
  <path class="draw" d="M -50 -79 Q 0 -75 50 -79" fill="none" stroke="${t.mute}" stroke-width="${(0.7 / S).toFixed(2)}"/>
</g>
${
  mo.fallen
    ? `<line x1="${tip.x - 120}" y1="${tip.y + 0.5}" x2="${tip.x + 120}" y2="${tip.y + 0.5}" stroke="${t.mute}" stroke-width=".7"/>
${[
  `${live(m.last14)} CONTRIBUTIONS / 14 DAYS`,
  `STEADINESS ${live(m.steadiness)}`,
  `USUAL FORTNIGHT ${live(m.usualFortnight)}`,
  `${live(m.idleDays)} DAYS SINCE THE LAST COMMIT`,
  `LEAN ${live("90°")}: ON ITS SIDE`,
]
  .map((s, i) => txt(40, 58 + i * 18, s))
  .join("\n")}`
    : `<line x1="${tip.x}" y1="${tip.y}" x2="${top.x.toFixed(1)}" y2="${top.y.toFixed(1)}" stroke="${t.accent}" stroke-width=".9" stroke-dasharray="4 3" mask="url(#bp-gap)"/>
<path d="M ${tip.x} ${tip.y - 60} A 60 60 0 0 1 ${(tip.x + Math.sin(rad) * 60).toFixed(1)} ${(tip.y - Math.cos(rad) * 60).toFixed(1)}" fill="none" stroke="${t.accent}" stroke-width=".9"/>
<path d="M ${(tip.x + Math.sin(rad) * 60 + 3).toFixed(1)} ${tip.y - 58} L ${tip.x + 50} ${tip.y - 46}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
${txt(tip.x + 54, tip.y - 43, `LEAN ${live(`${lean}°`)}`)}`
}

<!-- Dimensions: the body's width carries the fortnight; the height, the steadiness. -->
${
  mo.fallen
    ? ""
    : `<path d="M ${rimL.x.toFixed(1)} ${(rimL.y - 4).toFixed(1)} V ${dimY - 4} M ${rimR.x.toFixed(1)} ${(rimR.y - 4).toFixed(1)} V ${dimY - 4}" stroke="${t.faint}" stroke-width=".7"/>
${arrow(rimL.x, dimY, rimR.x, dimY)}`
}
${
  mo.fallen
    ? ""
    : `${txt(tip.x, dimY - 8, `${live(m.last14)} CONTRIBUTIONS / 14 DAYS`, { anchor: "middle" })}
${arrow(tip.x - 104, tip.y, tip.x - 104, tip.y - 163 * S)}
<g transform="translate(${tip.x - 110} ${tip.y - 82 * S}) rotate(-90)">${txt(0, 0, `STEADINESS ${live(m.steadiness)}`, { anchor: "middle" })}</g>
<path d="M ${(stem.x + 3).toFixed(1)} ${stem.y.toFixed(1)} H ${Math.max(tip.x + 60, stem.x + 20).toFixed(1)}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
${txt(Math.max(tip.x + 64, stem.x + 24), stem.y + 3, `USUAL FORTNIGHT ${live(m.usualFortnight)}`)}`
}
${
  mo.fallen
    ? ""
    : `<path d="M ${tip.x + 3} ${tip.y - 4} L ${tip.x + 40} ${tip.y + 16} H ${tip.x + 58}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
${txt(tip.x + 62, tip.y + 19, `${live(m.idleDays)} ${m.idleDays === 1 ? "DAY" : "DAYS"} SINCE THE LAST COMMIT`)}`
}

<!-- Plan view, turning at the measured rate (slowed six times so the eye can follow it). -->
<g transform="translate(${plan.x} ${plan.y})">
  <circle class="draw" cx="0" cy="0" r="${plan.r}" fill="none" stroke="${t.ink}"/>
  ${rings}
  <circle cx="0" cy="0" r="${(7.6 * S).toFixed(1)}" fill="none" stroke="${t.ink}"/>
  <line x1="${-plan.r - 12}" y1="0" x2="${plan.r + 12}" y2="0" stroke="${t.faint}" stroke-dasharray="10 3 2 3"/>
  <line x1="0" y1="${-plan.r - 12}" x2="0" y2="${plan.r + 12}" stroke="${t.faint}" stroke-dasharray="10 3 2 3"/>
</g>
<g class="turn"><path d="M ${plan.x} ${plan.y - plan.r * 0.78} L ${plan.x} ${plan.y - plan.r + 1}" stroke="${t.accent}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${plan.x + plan.r * 0.55}" cy="${plan.y + plan.r * 0.55}" r="2" fill="${t.accent}"/></g>
${txt(plan.x, plan.y + plan.r + 34, mo.fallen ? `NOT TURNING` : `ONE TURN EVERY ${live(`${mo.spinPeriod} s`)}`, { anchor: "middle" })}
${mo.fallen ? "" : txt(plan.x, plan.y + plan.r + 48, "SHOWN SIX TIMES SLOWER", { anchor: "middle", size: 9 })}

<!-- Notes. -->
${[
  "1. EVERY DIMENSION IS MEASURED DAILY FROM",
  "   THE GITHUB CONTRIBUTION CALENDAR.",
  "2. STEADINESS = 0.6 × MOMENTUM + 0.4 × RHYTHM:",
  "   THIS FORTNIGHT AGAINST A USUAL ONE, AND",
  "   HOW MANY OF ITS DAYS HAD ANY WORK.",
  "3. FASTER SPIN, SLOWER PRECESSION, LESS LEAN,",
  "   AS IN A REAL TOP (Ω ≈ mgl / Iω).",
  "4. AT REST AFTER 21 DAYS WITHOUT WORK.",
]
  .map((line, i) => txt(560, 46 + i * 17, line, { size: 9.5 }))
  .join("\n")}

<!-- Title block. -->
<g transform="translate(560 214)">
  <rect width="264" height="100" fill="none" stroke="${t.mute}" stroke-width=".8"/>
  <line x1="0" y1="34" x2="264" y2="34" stroke="${t.mute}" stroke-width=".6"/>
  <line x1="0" y1="67" x2="264" y2="67" stroke="${t.mute}" stroke-width=".6"/>
  <line x1="132" y1="34" x2="132" y2="100" stroke="${t.mute}" stroke-width=".6"/>
  ${txt(10, 22, "TOTEM", { size: 15, fill: t.ink, ls: 4 })}
  ${txt(254, 22, example ? `DWG ${example.dwg}` : "DWG 001", { anchor: "end" })}
  ${txt(10, 49, "STATE", { size: 8 })}${txt(10, 61, live(mo.state.toUpperCase()), { size: 10 })}
  ${txt(142, 49, example ? "READINGS" : "MEASURED", { size: 8 })}${txt(142, 61, date, { size: 10, fill: t.ink })}
  ${txt(10, 82, "OWNER", { size: 8 })}${txt(10, 94, "SATNAMCODES", { size: 10, fill: t.ink })}
  ${txt(142, 82, "DRAWN BY", { size: 8 })}${txt(142, 94, "GITHUB ACTIONS", { size: 10, fill: t.ink })}
</g>
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// 5. The other states. Below the live blueprint, a button for each state the top is not in today
//    opens an example of it: the top and its drawing, from a made-up but typical fortnight.

const STATES = [
  { id: "spinning-true", name: "spinning true", dwg: "002", m: { last14: 40, active14: 10, usualFortnight: 8, idleDays: 0, steadiness: 0.9 } },
  { id: "wobbling", name: "wobbling", dwg: "003", m: { last14: 3, active14: 2, usualFortnight: 8, idleDays: 5, steadiness: 0.3 } },
  { id: "at-rest", name: "at rest", dwg: "004", m: { last14: 0, active14: 0, usualFortnight: 8, idleDays: 24, steadiness: 0 } },
];

// A small glyph of the top in each state, for its button: upright, leaning, lying down.
function glyph(id, c) {
  const body = `<path d="M0 0 L-7 -10 Q-8 -14 -4 -15 L-1 -15.5 V-20 H1 V-15.5 L4 -15 Q8 -14 7 -10 Z" fill="none" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const pose = { "spinning-true": "translate(14 30)", wobbling: "translate(14 30) rotate(16)", "at-rest": "translate(23 28.5) rotate(-98)" }[id];
  return `<g transform="${pose}">${body}</g><path d="M4 31.5 H28" stroke="${c}" stroke-opacity=".45" stroke-width="1"/>`;
}

function stateButton(s, theme) {
  const t = { dark: { ink: "#e6edf3", faint: "#30363d", accent: "#d9a35b" }, light: { ink: "#1f2328", faint: "#d8dee4", accent: "#9a5f17" } }[theme];
  const label = `See it ${s.name}`;
  const w = Math.round(52 + label.length * 7.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40" role="img" aria-label="${label}">
<rect x=".5" y=".5" width="${w - 1}" height="39" rx="20" fill="none" stroke="${t.faint}"/>
<g transform="translate(6 0)">${glyph(s.id, t.accent)}</g>
<text x="42" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif" font-size="12.5" fill="${t.ink}">${label}</text>
</svg>
`;
}

const pic = (base, alt, attrs) =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg"><source media="(prefers-color-scheme: light)" srcset="${base}-light.svg"><img src="${base}-light.svg" ${attrs} alt="${alt}"></picture>`;

function statesBlock(mo) {
  return STATES.filter((s) => s.name !== mo.state)
    .map(
      (s) => `<details>
<summary><a name="${s.id}">${pic(`assets/states/${s.id}-button`, `See it ${s.name}`, 'height="40"')}</a></summary>
<br>
<a name="${s.id}-top"><img src="assets/states/${s.id}-top.svg" width="420" alt="The top ${s.name}, from an example fortnight."></a>
<br>
${pic(`assets/states/${s.id}-blueprint`, `Its blueprint, ${s.name}: ${s.m.last14} contributions in 14 days, steadiness ${s.m.steadiness}.`, 'width="840"')}
</details>`,
    )
    .join("\n");
}

function writeStates() {
  const dir = path.join(ROOT, "assets", "states");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of STATES) {
    const m = { measuredAt: "2026-01-01", yearTotal: 0, ...s.m };
    const mo = motion(m);
    if (mo.state !== s.name) throw new Error(`example for ${s.name} measures as ${mo.state}`);
    fs.writeFileSync(path.join(dir, `${s.id}-top.svg`), svg(m, mo));
    for (const theme of ["dark", "light"]) {
      fs.writeFileSync(path.join(dir, `${s.id}-blueprint-${theme}.svg`), blueprint(m, mo, theme, s));
      fs.writeFileSync(path.join(dir, `${s.id}-button-${theme}.svg`), stateButton(s, theme));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 6. The README: the caption and the state buttons

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function caption(m, mo) {
  const parts = [
    `<b>${mo.state[0].toUpperCase()}${mo.state.slice(1)}</b>`,
    `${m.last14} contributions in the last 14 days`,
    `measured ${fmtDate(`${m.measuredAt}T00:00:00Z`)}`,
  ];
  return `<sub>${parts.join(" · ")}</sub>`;
}

function writeBlock(name, text) {
  const file = path.join(ROOT, "README.md");
  const readme = fs.readFileSync(file, "utf8");
  if (!readme.includes(`<!-- ${name} -->`)) throw new Error(`README has no <!-- ${name} --> block`);
  const re = new RegExp(`<!-- ${name} -->[\\s\\S]*?<!-- /${name} -->`);
  fs.writeFileSync(file, readme.replace(re, () => `<!-- ${name} -->\n${text}\n<!-- /${name} -->`));
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const days = await calendar();
  const m = measure(days);
  const mo = motion(m);
  fs.writeFileSync(path.join(ROOT, "assets", "totem.svg"), svg(m, mo));
  for (const theme of ["dark", "light"])
    fs.writeFileSync(path.join(ROOT, "assets", `blueprint-${theme}.svg`), blueprint(m, mo, theme));
  fs.writeFileSync(STATE, `${JSON.stringify({ measurement: m, motion: mo }, null, 2)}\n`);
  fs.writeFileSync(path.join(ROOT, "assets", "city.svg"), city(days));
  writeStates();
  writeBlock("totem", caption(m, mo));
  writeBlock("states", statesBlock(mo));
  console.log(`[totem] ${m.measuredAt}: ${mo.state}, ${m.last14} in 14 days (usual ${m.usualFortnight}), steadiness ${m.steadiness}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
