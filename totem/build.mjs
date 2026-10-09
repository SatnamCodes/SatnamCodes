// The totem: a spinning top that runs on the last two weeks of work.
//
// Reads the daily contribution calendar, measures how steadily things have been built lately,
// and writes three files:
//   assets/totem-dark.svg, assets/totem-light.svg   the README's top, for each GitHub theme
//   docs/totem.json                                 the same measurement, for the interactive page
//
// Every number in the picture comes from the calendar. Nothing is tuned by hand afterwards.
//
//   node totem/build.mjs                     GitHub GraphQL (GITHUB_TOKEN), else the public calendar page
//   node totem/build.mjs --from days.json    a saved {"YYYY-MM-DD": count} map, for working offline

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.TOTEM_USER ?? "SatnamCodes";
const PAGE = process.env.TOTEM_PAGE ?? "https://satnamcodes.github.io/SatnamCodes/";

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
  const today = dates.at(-1);
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
  const lastActive = idle < counts.length ? dates[counts.length - 1 - idle] : null;

  // Momentum: this fortnight against a usual one. Rhythm: how many of its days had any work
  // (half of them counts as full rhythm). Steadiness weighs both.
  const momentum = clamp(last14 / usual / 1.2);
  const rhythm = clamp(active14 / 7);
  const steadiness = 0.6 * momentum + 0.4 * rhythm;
  const fallen = idle >= 21;

  const state = fallen
    ? "at rest"
    : steadiness >= 0.66
      ? "spinning true"
      : steadiness >= 0.33
        ? "spinning"
        : "wobbling";

  return {
    user: USER,
    measuredAt: today,
    last14,
    active14,
    usualFortnight: usual,
    idleDays: idle,
    lastActive,
    yearTotal: counts.slice(-365).reduce((a, b) => a + b, 0),
    steadiness: Number(steadiness.toFixed(3)),
    state,
    // How the top moves. Faster spin means slower precession and a smaller lean, as in a real top.
    spinPeriod: Number(lerp(1.5, 0.3, steadiness).toFixed(3)), // seconds per turn of the body
    leanDeg: Number(lerp(17, 2.5, steadiness).toFixed(2)), // precession lean
    precessionPeriod: Number(lerp(1.7, 6.5, steadiness).toFixed(3)), // seconds per sway
    fallen,
    recent,
  };
}

// ---------------------------------------------------------------------------------------------
// 3. The picture

const W = 840;
const H = 352; // 2.39:1, the widescreen frame
const TIP = { x: 420, y: 268 };

// The top in profile, tip at the origin, y up the axis (negative is up on screen).
// A squat brass-banded body, an ogive underneath to the point, a slim stem with a knob.
const BODY = [
  "M 0 0",
  "C 6 -4, 16 -22, 30 -44",
  "C 40 -58, 52 -70, 54 -80",
  "C 55 -86, 50 -94, 40 -99",
  "C 30 -103, 14 -105, 6 -106",
  "L 6 -138",
  "C 6 -144, 10 -146, 10 -150",
  "C 10 -156, 4 -158, 0 -158",
  "C -4 -158, -10 -156, -10 -150",
  "C -10 -146, -6 -144, -6 -138",
  "L -6 -106",
  "C -14 -105, -30 -103, -40 -99",
  "C -50 -94, -55 -86, -54 -80",
  "C -52 -70, -40 -58, -30 -44",
  "C -16 -22, -6 -4, 0 0 Z",
].join(" ");

// Where a top that has stopped comes to rest: on its side, touching the table at the body's widest
// edge and the knob. Found by turning it until those two points sit at the same height, then setting
// it down on the floor line with its middle near the centre of the frame.
function restingPose() {
  const rim = [-54, -80];
  const knob = [-10, -152];
  // Points round the near side of the outline, to find the lowest one once it is turned.
  const outline = [rim, knob, [-55, -86], [-50, -94], [-40, -99], [-10, -146], [-10, -156], [-30, -44], [0, 0]];
  const turn = (p, deg) => {
    const a = (deg * Math.PI) / 180;
    return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  };
  const gap = (deg) => Math.abs(turn(rim, deg)[1] - turn(knob, deg)[1]);
  let best = -90;
  for (let deg = -60; deg >= -140; deg -= 0.25) if (gap(deg) < gap(best)) best = deg;
  const low = Math.max(...outline.map((p) => turn(p, best)[1]));
  const mid = turn([0, -80], best);
  return `translate(${(TIP.x - mid[0]).toFixed(1)} ${(TIP.y - low).toFixed(1)}) rotate(${best})`;
}

const THEMES = {
  dark: {
    bg: "#000000",
    ink: "#e8e6e1",
    mute: "#8a8780",
    faint: "#3a3936",
    accent: "#d9a35b",
    metal: ["#2b2b2b", "#9a9a96", "#efefe9", "#8c8c88", "#1f1f1f"],
    shadow: "#000000",
    floor: "#151513",
  },
  light: {
    bg: "#f4f2ec",
    ink: "#141412",
    mute: "#6c6a64",
    faint: "#d6d3ca",
    accent: "#9a5f17",
    metal: ["#4a4a48", "#a9a9a4", "#fbfbf8", "#9b9b96", "#3c3c3a"],
    shadow: "#3a3530",
    floor: "#e8e5dc",
  },
};

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();

function topMarkup(m, t, id) {
  // Grooves turned into the body, and the brass band at its widest.
  const grooves = [-62, -72, -90]
    .map((y) => {
      const r = y === -90 ? 46 : y === -72 ? 52 : 47;
      return `<ellipse cx="0" cy="${y}" rx="${r}" ry="2.2" fill="none" stroke="${t.metal[0]}" stroke-opacity=".55" stroke-width=".8"/>`;
    })
    .join("");
  // Highlights that sweep across the turning body: x = R·cos(ψ), seen only on the near side.
  const streaks = m.fallen
    ? ""
    : [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect class="streak" x="-3" y="-108" width="6" height="110" fill="${t.metal[2]}" style="animation-delay:-${((m.spinPeriod / 4) * i).toFixed(3)}s"/>`,
        )
        .join("");
  return `
    <g clip-path="url(#${id}-clip)">
      <path d="${BODY}" fill="url(#${id}-metal)"/>
      ${grooves}
      <rect x="-56" y="-83" width="112" height="7" fill="${t.accent}" opacity=".9"/>
      <g class="streaks" opacity=".5">${streaks}</g>
    </g>
    <path d="${BODY}" fill="none" stroke="${t.ink}" stroke-opacity=".7" stroke-width="1.1"/>`;
}

export function svg(m, theme) {
  const t = THEMES[theme];
  const id = `totem-${theme}`;
  const lean = m.fallen ? 0 : m.leanDeg;
  const label = `${m.state.toUpperCase()}   ·   ${m.last14} CONTRIBUTIONS IN 14 DAYS   ·   MEASURED ${fmtDate(m.measuredAt)}`;
  const desc = m.fallen
    ? `A spinning top lying still on its side: no contributions for ${m.idleDays} days.`
    : `A spinning top, ${m.state}: ${m.last14} contributions on ${m.active14} of the last 14 days. It turns once every ${m.spinPeriod} seconds and leans ${lean} degrees as it precesses.`;
  // Fallen: the top lies on its side, resting on the knob and the body's widest edge.
  const rest = m.fallen ? `transform="${restingPose()}"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">${desc}</title>
<style>
  .sway { transform-box: view-box; transform-origin: ${TIP.x}px ${TIP.y}px;
          animation: sway ${m.precessionPeriod}s ease-in-out infinite alternate; }
  @keyframes sway { from { transform: rotate(-${lean}deg) } to { transform: rotate(${lean}deg) } }
  .shadow { transform-box: view-box; transform-origin: ${TIP.x}px ${TIP.y}px;
            animation: drift ${m.precessionPeriod}s ease-in-out infinite alternate; }
  @keyframes drift { from { transform: translateX(${(-lean * 2.2).toFixed(1)}px) scaleX(${(1 + lean / 60).toFixed(3)}) }
                     to   { transform: translateX(${(lean * 2.2).toFixed(1)}px) scaleX(${(1 + lean / 60).toFixed(3)}) } }
  .streak { opacity: 0; animation: turn ${m.spinPeriod}s linear infinite; }
  @keyframes turn {
    0%   { transform: translateX(-52px) scaleX(.3); opacity: 0 }
    12%  { opacity: .9 }
    25%  { transform: translateX(-37px) scaleX(.75) }
    50%  { transform: translateX(0) scaleX(1); opacity: 1 }
    75%  { transform: translateX(37px) scaleX(.75) }
    88%  { opacity: .9 }
    100% { transform: translateX(52px) scaleX(.3); opacity: 0 }
  }
  .caption { font: 500 10.5px "Helvetica Neue", Helvetica, Arial, sans-serif; letter-spacing: 3.2px; fill: ${t.mute}; }
  .rise { opacity: 0; animation: rise 1.6s ease-out .3s forwards; }
  @keyframes rise { to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) {
    .sway, .shadow, .streak, .rise { animation: none; opacity: 1; }
    .streak { opacity: 0; }
  }
</style>
<defs>
  <linearGradient id="${id}-metal" x1="-56" x2="56" y1="0" y2="0" gradientUnits="userSpaceOnUse">
    ${t.metal.map((c, i) => `<stop offset="${[0, 0.28, 0.42, 0.68, 1][i]}" stop-color="${c}"/>`).join("")}
  </linearGradient>
  <clipPath id="${id}-clip"><path d="${BODY}"/></clipPath>
  <radialGradient id="${id}-shadow"><stop offset="0" stop-color="${t.shadow}" stop-opacity=".55"/><stop offset="1" stop-color="${t.shadow}" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-fade" x1="0" x2="0" y1="${TIP.y}" y2="${TIP.y + 90}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="${id}-reflect"><rect x="0" y="${TIP.y}" width="${W}" height="${H - TIP.y}" fill="url(#${id}-fade)"/></mask>
</defs>

<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect x="0" y="${TIP.y}" width="${W}" height="${H - TIP.y}" fill="${t.floor}"/>
<line x1="0" y1="${TIP.y + 0.5}" x2="${W}" y2="${TIP.y + 0.5}" stroke="${t.faint}"/>

<ellipse class="shadow" cx="${m.fallen ? TIP.x - 40 : TIP.x}" cy="${TIP.y + 2}" rx="${m.fallen ? 120 : 64}" ry="7" fill="url(#${id}-shadow)"/>

<!-- The polished table's reflection: the same top, mirrored across the floor line. -->
<g class="mirror" mask="url(#${id}-reflect)">
  <g transform="translate(0 ${2 * TIP.y}) scale(1 -1)">
    <g class="sway"><g ${rest || `transform="translate(${TIP.x} ${TIP.y})"`}>${topMarkup(m, t, `${id}-r`)}</g></g>
  </g>
</g>

<g class="sway"><g ${rest || `transform="translate(${TIP.x} ${TIP.y})"`}>${topMarkup(m, t, id)}</g></g>

<text class="caption rise" x="36" y="${H - 22}">${label}</text>
<text class="caption rise" x="${W - 36}" y="${H - 22}" text-anchor="end">FLICK IT  ↗</text>
</svg>
`.replace(/^\s*\n/gm, "");
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const days = await calendar();
  const m = measure(days);
  fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
  for (const theme of ["dark", "light"])
    fs.writeFileSync(path.join(ROOT, "assets", `totem-${theme}.svg`), svg(m, theme));
  fs.writeFileSync(path.join(ROOT, "docs", "totem.json"), `${JSON.stringify({ ...m, page: PAGE }, null, 2)}\n`);
  console.log(`[totem] ${m.measuredAt}: ${m.state}, ${m.last14} in 14 days (usual ${m.usualFortnight}), steadiness ${m.steadiness}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
