// The rest of the profile, drawn in the cards' hand: an about panel, the languages and tools
// (dropped into place under gravity), and a year of the contribution calendar.
//
// The heatmap is redrawn each day by build.mjs, which passes it the calendar. The about and
// languages panels only change when this file does:
//   node totem/profile.mjs        writes assets/about-*.svg and assets/stack-*.svg

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES } from "./cards.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const SERIF = `Georgia, 'Iowan Old Style', 'Times New Roman', serif`;
const MONO = `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => +n.toFixed(1);

// A body dropped from a height, falling under gravity and bouncing to rest on the floor, sampled
// as CSS keyframes: { offset 0..1 of the fall, height above the floor as a fraction of the drop }.
function bounce(restitution = 0.38, samples = 40) {
  const g = 2; // any units: only the shape of the fall matters
  let y = 1, v = 0, t = 0;
  const dt = 0.002;
  const path = [];
  while (t < 4) {
    v -= g * dt;
    y += v * dt;
    if (y < 0) {
      y = 0;
      v = -v * restitution;
      if (v < 0.02) break;
    }
    path.push([t, y]);
    t += dt;
  }
  const T = path.at(-1)[0];
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const [ti, yi] = path[Math.min(path.length - 1, Math.round((i / samples) * (path.length - 1)))];
    out.push([ti / T, yi]);
  }
  out.push([1, 0]);
  return out;
}
const pct = (k) => `${+(k * 100).toFixed(2)}%`;

// ---------------------------------------------------------------------------------------------
// 1. The calendar: a year, a square a day, falling into place week by week; then a slow light
//    passes over it. The last fortnight, the one the top is measured on, is marked.

export function heatmap(days, theme) {
  const t = THEMES[theme];
  const dates = Object.keys(days).sort();
  const last = new Date(`${dates.at(-1)}T00:00:00Z`);
  // 53 columns ending with the week of the last day, Sunday at the top, as on GitHub.
  const end = last.getUTCDay();
  const cells = [];
  const total = 52 * 7 + end + 1;
  for (let i = 0; i < total; i++) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - (total - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    cells.push({ iso, n: days[iso] ?? 0, col: Math.floor(i / 7), row: i % 7, month: d.getUTCMonth(), date: d.getUTCDate() });
  }
  const sum = cells.reduce((a, c) => a + c.n, 0);
  const nonzero = cells.map((c) => c.n).filter((n) => n > 0).sort((a, b) => a - b);
  const q = (k) => nonzero[Math.floor(k * (nonzero.length - 1))] ?? 1;
  const level = (n) => (n === 0 ? 0 : n <= q(0.25) ? 1 : n <= q(0.5) ? 2 : n <= q(0.75) ? 3 : 4);
  let run = 0, best = 0;
  for (const c of cells) best = Math.max(best, (run = c.n > 0 ? run + 1 : 0));
  const activeDays = cells.filter((c) => c.n > 0).length;

  const W = 840, H = 210;
  const X = 64, Y = 58, C = 11, G = 3, P = C + G;
  const drop = bounce(0.32);
  const kf = drop.map(([k, y]) => `${pct(k)} { transform: translateY(${r1(-y * 70)}px); opacity: ${k < 0.05 ? r1(k * 20) : 1} }`).join(" ");

  const fill = (lv) => (lv === 0 ? "none" : t.accent);
  const op = [0, 0.28, 0.5, 0.74, 1];
  const rects = cells
    .map((c) => {
      const lv = level(c.n);
      const delay = (c.col * 0.028 + c.row * 0.03).toFixed(2);
      const x = X + c.col * P, y = Y + c.row * P;
      return lv === 0
        ? `<rect class="c" style="animation-delay:${delay}s" x="${x + 0.5}" y="${y + 0.5}" width="${C - 1}" height="${C - 1}" rx="2.5" fill="none" stroke="${t.faint}"/>`
        : `<rect class="c" style="animation-delay:${delay}s" x="${x}" y="${y}" width="${C}" height="${C}" rx="2.5" fill="${fill(lv)}" fill-opacity="${op[lv]}"/>`;
    })
    .join("\n");
  const lit = cells
    .filter((c) => c.n > 0)
    .map((c) => `<rect x="${X + c.col * P}" y="${Y + c.row * P}" width="${C}" height="${C}" rx="2.5"/>`)
    .join("");

  const months = [];
  for (const c of cells) if (c.row === 0 && c.date <= 7) months.push(c);
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const gridW = 53 * P - G;
  const fortnight = cells.slice(-14);
  const f0 = fortnight[0], f1 = fortnight.at(-1);
  const fx0 = X + f0.col * P, fx1 = X + f1.col * P + C;
  const baseY = Y + 7 * P + 4;
  const sweep = 5 + 53 * 0.028 + 7 * 0.03;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="hm-t">
<title id="hm-t">${sum} contributions in the last year, on ${activeDays} days; the longest run was ${best} days. The last fourteen days are the ones the top is measured on.</title>
<style>
  .c { animation: fall 1.1s linear both; transform-box: view-box; }
  @keyframes fall { ${kf} }
  @media (prefers-reduced-motion: reduce) { .c { animation: none } .glint { display: none } }
</style>
<defs>
  <clipPath id="hm-lit">${lit}</clipPath>
  <linearGradient id="hm-band" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${t.glow}" stop-opacity="0"/><stop offset=".5" stop-color="${t.glow}" stop-opacity=".85"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/>
  </linearGradient>
</defs>
<text x="${X}" y="22" font-family="${SANS}" font-size="10" letter-spacing="1.6" fill="${t.mute}">THE LAST YEAR, A SQUARE A DAY</text>
<text x="${X + gridW}" y="22" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.accent}">${sum.toLocaleString("en-US")} contributions · ${activeDays} days · longest run ${best}</text>
${months.map((c) => `<text x="${X + c.col * P}" y="${Y - 9}" font-family="${MONO}" font-size="8.5" fill="${t.mute}">${MON[c.month]}</text>`).join("")}
${["MON", "WED", "FRI"].map((d, i) => `<text x="${X - 10}" y="${Y + (1 + 2 * i) * P + 8.5}" text-anchor="end" font-family="${MONO}" font-size="8.5" fill="${t.mute}">${d}</text>`).join("")}
${rects}
<g clip-path="url(#hm-lit)" class="glint"><rect x="${X - 120}" y="${Y}" width="120" height="${7 * P}" fill="url(#hm-band)" opacity="0">
  <animate attributeName="x" values="${X - 120};${X + gridW}" dur="7s" begin="${sweep.toFixed(1)}s;glint.end+4s" id="glint" fill="freeze"/>
  <animate attributeName="opacity" values="0;.7;.7;0" keyTimes="0;.1;.9;1" dur="7s" begin="${sweep.toFixed(1)}s;glint.end+4s" fill="freeze"/>
</rect></g>
<path d="M ${fx0} ${baseY} v 5 H ${fx1} v -5" fill="none" stroke="${t.accent}" stroke-width=".9"/>
<path d="M ${(fx0 + fx1) / 2} ${baseY + 5} V ${baseY + 22} H ${fx0 - 8}" fill="none" stroke="${t.mute}" stroke-width=".7"/>
<text x="${fx0 - 12}" y="${baseY + 25}" text-anchor="end" font-family="${MONO}" font-size="9.5" fill="${t.mute}">THE FORTNIGHT THE TOP IS MEASURED ON</text>
<g transform="translate(${X} ${baseY + 22})" font-family="${MONO}" font-size="8.5" fill="${t.mute}">
  <text x="0" y="3">LESS</text>
  ${[0, 1, 2, 3, 4].map((lv, i) => (lv === 0 ? `<rect x="${30 + i * 14 + 0.5}" y="-6.5" width="${C - 1}" height="${C - 1}" rx="2.5" fill="none" stroke="${t.faint}"/>` : `<rect x="${30 + i * 14}" y="-7" width="${C}" height="${C}" rx="2.5" fill="${t.accent}" fill-opacity="${op[lv]}"/>`)).join("")}
  <text x="${30 + 5 * 14 + 4}" y="3">MORE</text>
</g>
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// 2. About: the three questions I work on, each beside a small system that moves like it.

function about(theme) {
  const t = THEMES[theme];
  const W = 840, H = 236;
  const rise = (i) => `class="rise" style="animation-delay:${(0.25 + i * 0.22).toFixed(2)}s"`;

  // A 4x3 lattice whose atoms vibrate about their sites, one of them a dopant.
  const lattice = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      const x = c * 9 + (r % 2) * 4.5, y = r * 8;
      const dop = r === 1 && c === 1;
      const ph = (c * 0.7 + r * 1.3).toFixed(2);
      lattice.push(`<circle cx="${x}" cy="${y}" r="${dop ? 2.6 : 1.8}" fill="${dop ? t.accent : t.steel}"><animateTransform attributeName="transform" type="translate" values="0 0;${r1(Math.cos(c + r) * 1.2)} ${r1(Math.sin(c * 2 + r) * 1.2)};0 0" dur="${(1.1 + ((c + r) % 3) * 0.17).toFixed(2)}s" begin="-${ph}s" repeatCount="indefinite"/></circle>`);
    }
  // Eight lanes of a warp: most finish together, two diverge.
  const lanes = Array.from({ length: 8 }, (_, i) => {
    const slow = i === 2 || i === 5;
    return `<rect x="${i * 4.6}" y="0" width="2.4" height="20" rx="1.2" fill="${t.faint}"/><rect x="${i * 4.6}" y="0" width="2.4" height="20" rx="1.2" fill="${slow ? t.accent : t.steel}"><animate attributeName="height" values="0;20;20;0" keyTimes="0;${slow ? 0.75 : 0.35};.9;1" dur="2.6s" repeatCount="indefinite"/></rect>`;
  }).join("");
  // A planet on an eccentric orbit, slowed near the star's far side as Kepler says.
  const orbit = [];
  const e = 0.45, a = 17, b = a * Math.sqrt(1 - e * e);
  for (let i = 0; i <= 48; i++) {
    const M = (2 * Math.PI * i) / 48;
    let E = M;
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    orbit.push([r1(a * Math.cos(E) - a * e), r1(b * Math.sin(E) * 0.5)]);
  }
  const planet = `<ellipse cx="${r1(-a * e)}" cy="0" rx="${a}" ry="${r1(b * 0.5)}" fill="none" stroke="${t.line}" stroke-width=".7" stroke-dasharray="1.5 2.5"/><circle r="3.2" fill="${t.accent}"/><circle r="2" fill="${t.steel}"><animate attributeName="cx" values="${orbit.map((p) => p[0]).join(";")}" dur="5s" repeatCount="indefinite"/><animate attributeName="cy" values="${orbit.map((p) => p[1]).join(";")}" dur="5s" repeatCount="indefinite"/></circle>`;

  const rows = [
    { g: `<g transform="translate(6 -9)">${lattice.join("")}</g>`, a: "Machine learning for physical and materials systems", b: "graph networks that read a crystal's structure, to find a p-type dopant for β-Ga₂O₃" },
    { g: `<g transform="translate(5 -10)">${lanes}</g>`, a: "GPU performance in scientific computing", b: "kernels written from scratch and read in Nsight until they stop surprising me" },
    { g: `<g transform="translate(26 0)">${planet}</g>`, a: "Exoplanet habitability", b: "whether the habitability indices reduce to a few quantities that matter" },
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ab-t">
<title id="ab-t">Satnam Singh. Machine learning for physical and materials systems, GPU performance in scientific computing, and exoplanet habitability. B.Tech in Computer Science (AI and ML) at Christ University, Bengaluru, and a B.S. in Data Science at IIT Madras.</title>
<style>
  .rise { animation: rise .9s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .rule { stroke-dasharray: 760; stroke-dashoffset: 760; animation: draw 1.6s cubic-bezier(.6,0,.2,1) .15s forwards; }
  @keyframes draw { to { stroke-dashoffset: 0 } }
  @media (prefers-reduced-motion: reduce) { .rise, .rule { animation: none; stroke-dashoffset: 0 } }
</style>
<g ${rise(0)}>
  <text x="40" y="44" font-family="${SERIF}" font-size="30" fill="${t.ink}">Satnam Singh</text>
  <text x="${W - 40}" y="30" text-anchor="end" font-family="${SANS}" font-size="11.5" fill="${t.mute}">B.Tech CSE (AI and ML), Christ University, Bengaluru</text>
  <text x="${W - 40}" y="47" text-anchor="end" font-family="${SANS}" font-size="11.5" fill="${t.mute}">B.S. Data Science, IIT Madras</text>
</g>
<line class="rule" x1="40" y1="64" x2="${W - 40}" y2="64" stroke="${t.faint}"/>
${rows
  .map(
    (r, i) => `<g ${rise(i + 1)}><g transform="translate(40 ${102 + i * 46})">
  ${r.g}
  <text x="70" y="-2" font-family="${SERIF}" font-size="16.5" fill="${t.ink}">${esc(r.a)}</text>
  <text x="70" y="16" font-family="${SANS}" font-size="12" fill="${t.mute}">${esc(r.b)}</text>
</g></g>`,
  )
  .join("\n")}
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// 3. Languages and tools: tiles dropped one after another, falling under gravity, bouncing and
//    rocking to rest on their shelves.

const SHELVES = [
  { label: "LANGUAGES", items: ["Python", "C++", "C", "CUDA", "SQL"] },
  { label: "TOOLS", items: ["Nsight Systems", "Nsight Compute", "Git", "Linux", "Docker", "PostgreSQL", "FastAPI"] },
  { label: "MACHINE LEARNING", items: ["PyTorch", "PyTorch Geometric", "scikit-learn", "XGBoost", "LangGraph", "FAISS"] },
  { label: "SPEAKS", items: ["ਪੰਜਾਬੀ Punjabi", "हिन्दी Hindi", "English"], serif: true },
];

function stack(theme) {
  const t = THEMES[theme];
  const W = 840, X = 184, ROW = 50, TOP = 40;
  const H = TOP + SHELVES.length * ROW + 6;
  const drop = bounce(0.42);
  // Three tilts a tile can fall with; each rocks back level as it lands (a damped rotation).
  const tilts = [-7, 5, 10];
  const kfs = tilts
    .map(
      (a, j) =>
        `@keyframes drop${j} { ${drop
          .map(([k, y]) => `${pct(k)} { transform: translateY(${r1(-y * 140)}px) rotate(${r1(a * (1 - k) * Math.exp(-4 * k) * Math.cos(9 * k))}deg); opacity: ${k < 0.04 ? r1(k * 25) : 1} }`)
          .join(" ")} }`,
    )
    .join("\n  ");
  let n = 0;
  const shelves = SHELVES.map((s, i) => {
    const y = TOP + i * ROW;
    let x = X;
    const tiles = s.items.map((it) => {
      const w = Math.round((s.serif ? 7.4 : 7.25) * [...it].length + 20);
      const j = n % 3;
      const g = `<g class="tile" style="animation-name:drop${j};animation-delay:${(0.2 + n * 0.09).toFixed(2)}s;transform-origin:${x + w / 2}px ${y + 14}px">
  <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="27" rx="7" fill="none" stroke="${i === 0 ? t.accent : t.line}" stroke-opacity="${i === 0 ? 0.8 : 1}"/>
  <text x="${x + w / 2}" y="${y + 18.5}" text-anchor="middle" font-family="${s.serif ? SERIF : MONO}" font-size="${s.serif ? 13 : 12}" fill="${t.ink}">${esc(it)}</text>
</g>`;
      x += w + 8;
      n++;
      return g;
    });
    return `<text x="40" y="${y + 18}" font-family="${SANS}" font-size="10" letter-spacing="1.6" fill="${t.mute}">${s.label}</text>
<line x1="${X - 6}" y1="${y + 31.5}" x2="${W - 16}" y2="${y + 31.5}" stroke="${t.faint}"/>
${tiles.join("\n")}`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="st-t">
<title id="st-t">${SHELVES.map((s) => `${s.label[0]}${s.label.slice(1).toLowerCase()}: ${s.items.join(", ")}`).join(". ")}.</title>
<style>
  .tile { animation-duration: 1.3s; animation-timing-function: linear; animation-fill-mode: both; transform-box: view-box; }
  ${kfs}
  @media (prefers-reduced-motion: reduce) { .tile { animation: none } }
</style>
${shelves}
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const theme of ["dark", "light"]) {
    fs.writeFileSync(path.join(ROOT, "assets", `about-${theme}.svg`), about(theme));
    fs.writeFileSync(path.join(ROOT, "assets", `stack-${theme}.svg`), stack(theme));
  }
  console.log("[profile] about and stack written");
}
