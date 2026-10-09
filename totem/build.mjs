// The totem: a steel spinning top that runs on the last two weeks of work. Click it on the profile
// and its blueprint opens beneath it, dimensioned with the same readings.
//
// Reads the daily contribution calendar, measures how steadily things have been built lately,
// and writes:
//   assets/totem-dark.svg, -light.svg             the top, on nothing, one per GitHub theme
//   assets/blueprint-dark.svg, -light.svg         its engineering drawing, one per GitHub theme
//   totem/state.json                              the measurement
//   assets/states/*, assets/city-*.svg            the other states' examples and buttons; the year as a city
//   README.md                                     the caption and the state buttons, between their markers
//
// Every number in the pictures comes from the calendar. Nothing is tuned by hand.
//
//   node totem/build.mjs                     measure (GitHub GraphQL with GITHUB_TOKEN, else the public calendar page)
//   node totem/build.mjs --from days.json    a saved {"YYYY-MM-DD": count} map, for working offline

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frame, anim, rng, r1, r2, TH, SANS, withFonts } from "./film.mjs";
import { city, heatmap } from "./shots.mjs";

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

// How the top moves, from the measurement. The top is a real body: the drawn profile, turned in
// steel, gives its mass, centre of mass and moments of inertia (physics() below). Steadiness sets
// how fast it spins, relative to the speed below which a heavy top cannot stand upright (it can
// no longer "sleep"): at 0.5 it spins exactly that fast. Above it the top stands nearly upright
// and precesses steadily; below it, it can only stay up by leaning far over, and it wobbles.
// Its motion is then integrated from the equations of a heavy symmetric top. Three weeks without
// work and it is lying on its side.
export function motion(m) {
  const s = m.steadiness;
  const fallen = m.idleDays >= 21;
  const state = fallen ? "at rest" : s >= 0.5 ? "spinning true" : "wobbling";
  const P = physics();
  const w = P.wc * (0.8 + 0.4 * s); // rad/s about the axis
  const ratio2 = (w / P.wc) ** 2;
  let theta;
  if (s >= 0.5) theta = (lerp(10, 2, (s - 0.5) / 0.5) * Math.PI) / 180;
  // Below the sleeping speed, steady precession needs cos θ < (ω/ωc)²: lean past that, short of
  // the angle where the rim would touch the table.
  else theta = Math.min(Math.acos(0.85 * ratio2), (52 * Math.PI) / 180);
  const disc = (P.I3 * w) ** 2 - 4 * P.I1 * P.mgl * Math.cos(theta);
  const steady = (P.I3 * w - Math.sqrt(Math.max(0, disc))) / (2 * P.I1 * Math.cos(theta));
  // Launched a little off steady precession, as a real top always is: the difference is the nutation.
  const phid0 = steady * (s >= 0.5 ? 0.96 : 0.85);
  const traj = fallen ? null : integrate(P, w, theta, phid0);
  return {
    state,
    fallen,
    spinHz: Number((w / (2 * Math.PI)).toFixed(1)),
    spinPeriod: Number(((2 * Math.PI) / w).toFixed(4)), // seconds per turn
    leanDeg: Number(((theta * 180) / Math.PI).toFixed(2)),
    precessionPeriod: traj ? Number(traj.period.toFixed(3)) : 0, // seconds per turn of the axis
    nutationDeg: traj ? Number(((traj.span * 180) / Math.PI).toFixed(2)) : 0,
    sleepHz: Number((P.wc / (2 * Math.PI)).toFixed(1)),
    launch: { w, theta, phid0 },
  };
}

// The top as a body of steel: the profile drawn below at 0.25 mm a unit, turned about its axis.
let PHYS;
export function physics() {
  if (PHYS) return PHYS;
  const U = 0.25e-3, rho = 7850, g = 9.81, dh = 0.5;
  let m = 0, mz = 0, I3 = 0, I1 = 0;
  for (let h = dh / 2; h < 163; h += dh) {
    const R = halfWidth(-h) * U, z = h * U, dm = rho * Math.PI * R * R * dh * U;
    m += dm; mz += dm * z;
    I3 += 0.5 * dm * R * R; // about the axis
    I1 += dm * (R * R / 4 + z * z); // about a line through the tip, across the axis
  }
  const l = mz / m, mgl = m * g * l;
  PHYS = { m, l, I1, I3, mgl, wc: Math.sqrt(4 * mgl * I1) / I3 };
  return PHYS;
}

// Lagrange's equations for a heavy symmetric top on a fixed tip. θ is the lean, φ the direction
// of lean (precession), ω₃ the spin; p_φ and p_ψ are conserved. Integrated over two turns of φ
// and sampled at 60 frames a second.
function integrate(P, w, theta0, phid0) {
  const pPsi = P.I3 * w;
  const pPhi = P.I1 * phid0 * Math.sin(theta0) ** 2 + pPsi * Math.cos(theta0);
  const acc = (th) => {
    const phid = (pPhi - pPsi * Math.cos(th)) / (P.I1 * Math.sin(th) ** 2);
    return [phid, (Math.sin(th) * (P.I1 * phid * phid * Math.cos(th) - pPsi * phid + P.mgl)) / P.I1];
  };
  let th = theta0, thd = 0, phi = 0, t = 0, next = 0;
  const dt = 2e-6, fps = 60, samples = [];
  let lo = th, hi = th;
  while (phi < 4 * Math.PI && t < 20) {
    if (t >= next) samples.push([th, phi]), (next += 1 / fps);
    // semi-implicit Euler at 2 µs is plenty for a few seconds of motion
    const [phid, a] = acc(th);
    thd += a * dt;
    th += thd * dt;
    phi += phid * dt;
    t += dt;
    lo = Math.min(lo, th); hi = Math.max(hi, th);
  }
  samples.push([th, phi]);
  return { samples, duration: t, period: t / 2, span: hi - lo };
}

// The lean as the camera sees it: the axis (sin θ cos φ, cos θ, sin θ sin φ), seen from a little
// above, gives a screen angle and a foreshortened height.
const PITCH = 0.1;
function projected(th, phi) {
  const x = Math.sin(th) * Math.cos(phi), y = Math.cos(th), z = Math.sin(th) * Math.sin(phi);
  const up = y * Math.cos(PITCH) + z * Math.sin(PITCH);
  return { angle: (Math.atan2(x, up) * 180) / Math.PI, k: Math.hypot(x, up) };
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
const HW = 840, HH = 300;
const HTIP = { x: 420, y: 262 };
const HSCALE = 1.22;

export function svg(m, mo, theme = "dark") {
  const FILM = TH[theme];
  const lean = mo.fallen ? 0 : mo.leanDeg;
  const desc = mo.fallen
    ? `A machined steel spinning top lying still on its side: no contributions for ${m.idleDays} days.`
    : `A machined steel spinning top, ${mo.state}: ${m.last14} contributions on ${m.active14} of the last 14 days. It turns once every ${mo.spinPeriod} seconds and leans ${lean} degrees as it precesses.`;
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
  // Two engraved marks on the crown. At forty-odd turns a second no camera can follow them:
  // in every frame they are smeared all the way round, a faint band, as in film of a real top.
  const marks = mo.fallen
    ? `<rect x="-10" y="-95" width="5" height="1.6" rx=".8" fill="#0e0f10" opacity=".55"/>`
    : `<rect x="-46" y="-96.2" width="92" height="2.2" fill="#0e0f10" opacity=".22"/>`;
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


  // The axis's path, integrated in motion(): its angle on screen and its foreshortened height.
  const traj = mo.fallen ? null : integrate(physics(), mo.launch.w, mo.launch.theta, mo.launch.phid0);
  const moving = (inner) => {
    if (!traj) return inner;
    const pr = traj.samples.map(([th, phi]) => projected(th, phi));
    const dur = r2(traj.duration);
    return `<g><animateTransform attributeName="transform" type="rotate" values="${pr.map((q) => r2(q.angle)).join(";")}" dur="${dur}s" repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="scale" values="${pr.map((q) => `1 ${q.k.toFixed(4)}`).join(";")}" dur="${dur}s" repeatCount="indefinite"/>${inner}</g></g>`;
  };
  const pose = mo.fallen ? `${restingPose(HTIP, HSCALE)} scale(${HSCALE})` : `translate(${HTIP.x} ${HTIP.y}) scale(${HSCALE})`;

  // The shadow: the silhouette projected onto the table along the lamp's direction.
  const kx = 0.62, ky = 0.14;
  const shadow = mo.fallen
    ? `<ellipse cx="${HTIP.x + 10}" cy="${HTIP.y + 4}" rx="118" ry="9" fill="${FILM.shadow}" opacity="${FILM.shadowOp + 0.1}" filter="url(#tt-sh)"/>`
    : `<g transform="matrix(1 0 ${-kx * HSCALE} ${-ky * HSCALE} ${HTIP.x} ${HTIP.y})" opacity="${FILM.shadowOp}" filter="url(#tt-sh)">${moving(`<path d="${BODY}" fill="${FILM.shadow}"/>`)}</g>
<ellipse cx="${HTIP.x}" cy="${HTIP.y + 0.5}" rx="7" ry="1.8" fill="${FILM.shadow}" opacity="${FILM.shadowOp + 0.2}" filter="url(#tt-soft)"/>`;

  const body = `
<ellipse cx="${HTIP.x}" cy="${HTIP.y + 2}" rx="210" ry="14" fill="url(#tt-floor)"/>
<g mask="url(#tt-refmask)"><g transform="translate(0 ${2 * HTIP.y}) scale(1 -1)" opacity=".16" filter="url(#tt-b2)"><use href="#tt-top"/></g></g>
${shadow}
<g id="tt-top" transform="${pose}">${moving(top)}</g>`;

  const defs = `
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
  <filter id="tt-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${mo.fallen ? 0.3 : 6} 0.4"/></filter>
  <filter id="tt-soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="6 2.2"/></filter>

  <radialGradient id="tt-floor"><stop offset="0" stop-color="${FILM.shadow}" stop-opacity="${theme === "dark" ? 0.35 : 0.07}"/><stop offset="1" stop-color="${FILM.shadow}" stop-opacity="0"/></radialGradient>
  <linearGradient id="tt-rf" x1="0" x2="0" y1="${HTIP.y}" y2="${HTIP.y + 62}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="tt-refmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${HW}" height="${HH}"><rect y="${HTIP.y}" width="${HW}" height="${HH - HTIP.y}" fill="url(#tt-rf)"/></mask>
  <linearGradient id="tt-warm" x1="-51" x2="51" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${FILM.warm}" stop-opacity=".28"/><stop offset=".45" stop-color="${FILM.warm}" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <filter id="tt-sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>`;

  return frame({ w: HW, h: HH, p: "tt", theme, desc, defs, body });
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
  const slow = mo.fallen ? 1 : Math.round(1.5 / mo.spinPeriod); // the plan view's slow motion
  // A steep lean leaves no room for leaders around the body: the readings go into a list instead.
  const listed = mo.fallen || lean > 20;
  const leanText = mo.fallen ? `LEAN ${live("90°")}: ON ITS SIDE` : `LEAN ${live(`${lean.toFixed(1)}°`)}`;
  const list = [
    `${live(m.last14)} CONTRIBUTIONS / 14 DAYS`,
    `STEADINESS ${live(m.steadiness)}`,
    `USUAL FORTNIGHT ${live(m.usualFortnight)}`,
    `${live(m.idleDays)} ${m.idleDays === 1 ? "DAY" : "DAYS"} SINCE THE LAST COMMIT`,
    leanText,
  ].map((s, i) => txt(40, 58 + i * 18, s)).join("\n");
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
  .turn { transform-box: view-box; transform-origin: ${plan.x}px ${plan.y}px; animation: turn ${mo.fallen ? 0 : r2(mo.spinPeriod * slow)}s linear infinite; }
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
${mo.fallen ? "" : `<line x1="${tip.x}" y1="${tip.y + 14}" x2="${tip.x}" y2="${listed ? 150 : dimY - 22}" stroke="${t.faint}" stroke-dasharray="10 3 2 3" mask="url(#bp-gap)"/>`}
<g transform="${mo.fallen ? restingPose(tip, S) : `translate(${tip.x} ${tip.y}) rotate(${lean})`} scale(${S})">
  <path class="draw" d="${BODY}" fill="none" stroke="${t.ink}" stroke-width="${(1 / S).toFixed(2)}"/>
  <path class="draw" d="M -50 -79 Q 0 -75 50 -79" fill="none" stroke="${t.mute}" stroke-width="${(0.7 / S).toFixed(2)}"/>
</g>
${
  mo.fallen
    ? `<line x1="${tip.x - 120}" y1="${tip.y + 0.5}" x2="${tip.x + 120}" y2="${tip.y + 0.5}" stroke="${t.mute}" stroke-width=".7"/>
${list}`
    : `<line x1="${tip.x}" y1="${tip.y}" x2="${top.x.toFixed(1)}" y2="${top.y.toFixed(1)}" stroke="${t.accent}" stroke-width=".9" stroke-dasharray="4 3" mask="url(#bp-gap)"/>
<path d="M ${tip.x} ${tip.y - 60} A 60 60 0 0 1 ${(tip.x + Math.sin(rad) * 60).toFixed(1)} ${(tip.y - Math.cos(rad) * 60).toFixed(1)}" fill="none" stroke="${t.accent}" stroke-width=".9"/>
${
  listed
    ? list
    : `<path d="M ${(tip.x + Math.sin(rad) * 60 + 3).toFixed(1)} ${tip.y - 58} L ${tip.x + 50} ${tip.y - 46}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
${txt(tip.x + 54, tip.y - 43, leanText)}`
}`
}

<!-- Dimensions: the body's width carries the fortnight; the height, the steadiness. -->
${
  listed
    ? ""
    : `<path d="M ${rimL.x.toFixed(1)} ${(rimL.y - 4).toFixed(1)} V ${dimY - 4} M ${rimR.x.toFixed(1)} ${(rimR.y - 4).toFixed(1)} V ${dimY - 4}" stroke="${t.faint}" stroke-width=".7"/>
${arrow(rimL.x, dimY, rimR.x, dimY)}`
}
${
  listed
    ? ""
    : `${txt(tip.x, dimY - 8, `${live(m.last14)} CONTRIBUTIONS / 14 DAYS`, { anchor: "middle" })}
${arrow(tip.x - 104, tip.y, tip.x - 104, tip.y - 163 * S)}
<g transform="translate(${tip.x - 110} ${tip.y - 82 * S}) rotate(-90)">${txt(0, 0, `STEADINESS ${live(m.steadiness)}`, { anchor: "middle" })}</g>
<path d="M ${(stem.x + 3).toFixed(1)} ${stem.y.toFixed(1)} H ${Math.max(tip.x + 60, stem.x + 20).toFixed(1)}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
${txt(Math.max(tip.x + 64, stem.x + 24), stem.y + 3, `USUAL FORTNIGHT ${live(m.usualFortnight)}`)}`
}
${
  listed
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
${txt(plan.x, plan.y + plan.r + 34, mo.fallen ? `NOT TURNING` : `${live(mo.spinHz)} TURNS A SECOND`, { anchor: "middle" })}
${mo.fallen ? "" : txt(plan.x, plan.y + plan.r + 48, `SHOWN ${slow}× SLOWER · AXIS ROUND EVERY ${mo.precessionPeriod} S`, { anchor: "middle", size: 9 })}

<!-- Notes. -->
${[
  "1. MEASURED DAILY FROM THE CALENDAR.",
  "2. STEADINESS = 0.6 × MOMENTUM + 0.4 × RHYTHM.",
  `3. STEEL, ${(physics().m * 1000).toFixed(0)} G, CENTRE OF MASS ${(physics().l * 1000).toFixed(1)} MM UP.`,
  `   BELOW ${(physics().wc / (2 * Math.PI)).toFixed(0)} TURNS/S IT CANNOT STAND UPRIGHT;`,
  "   STEADINESS 0.5 SPINS IT AT EXACTLY THAT.",
  "4. MOTION INTEGRATED FROM LAGRANGE'S",
  "   EQUATIONS FOR A HEAVY SYMMETRIC TOP.",
  "5. AT REST AFTER 21 DAYS WITHOUT WORK.",
]
  .map((line, i) => txt(560, 46 + i * 17, line, { size: 9.5 }).replace("<text ", '<text style="white-space:pre" '))
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
<text x="42" y="25" font-family="${SANS}" font-size="13" letter-spacing=".4" fill="${t.ink}">${label}</text>
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
<a name="${s.id}-top">${pic(`assets/states/${s.id}-top`, `The top ${s.name}, from an example fortnight.`, 'width="560"')}</a>
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
    for (const theme of ["dark", "light"]) {
      fs.writeFileSync(path.join(dir, `${s.id}-top-${theme}.svg`), svg(m, mo, theme));
      fs.writeFileSync(path.join(dir, `${s.id}-blueprint-${theme}.svg`), blueprint(m, mo, theme, s));
      fs.writeFileSync(path.join(dir, `${s.id}-button-${theme}.svg`), withFonts(stateButton(s, theme)));
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
  for (const theme of ["dark", "light"]) fs.writeFileSync(path.join(ROOT, "assets", `totem-${theme}.svg`), svg(m, mo, theme));
  for (const theme of ["dark", "light"])
    fs.writeFileSync(path.join(ROOT, "assets", `blueprint-${theme}.svg`), blueprint(m, mo, theme));
  fs.writeFileSync(STATE, `${JSON.stringify({ measurement: m, motion: mo }, null, 2)}\n`);
  for (const theme of ["dark", "light"]) {
    fs.writeFileSync(path.join(ROOT, "assets", `city-${theme}.svg`), withFonts(city(days, theme)));
    fs.writeFileSync(path.join(ROOT, "assets", `heatmap-${theme}.svg`), withFonts(heatmap(days, theme)));
  }
  writeStates();
  writeBlock("totem", caption(m, mo));
  writeBlock("states", statesBlock(mo));
  console.log(`[totem] ${m.measuredAt}: ${mo.state}, ${m.last14} in 14 days (usual ${m.usualFortnight}), steadiness ${m.steadiness}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
