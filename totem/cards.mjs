// Project cards: each project drawn as a small physical system, simulated here once and baked into
// SVG animation (SMIL), so it plays on a GitHub profile where no script can run.
// Writes assets/cards/<id>-dark.svg and assets/cards/<id>-light.svg (transparent, one per theme),
// and the same for the link pills in assets/links/.
//
//   node totem/cards.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const THEMES = {
  dark: { ink: "#e6edf3", mute: "#9198a1", faint: "#30363d", line: "#59616b", steel: "#aeb4bb", accent: "#d9a35b", glow: "#f2c48d" },
  light: { ink: "#1f2328", mute: "#59636e", faint: "#d8dee4", line: "#9aa3ad", steel: "#57606a", accent: "#9a5f17", glow: "#c98a3a" },
};

const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const SERIF = `Georgia, 'Iowan Old Style', 'Times New Roman', serif`;
const W = 420;
const H = 268;
const STAGE = { x: 22, y: 74, w: 376, h: 128 }; // where each simulation plays
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => +n.toFixed(1);
const r2 = (n) => +n.toFixed(2);

// A seeded generator, so every build draws the same systems.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// SMIL animation of one attribute through sampled values (looping).
const anim = (attr, values, dur, keyTimes) =>
  `<animate attributeName="${attr}" values="${values.map(r1).join(";")}" dur="${dur}s" repeatCount="indefinite"${
    keyTimes ? ` keyTimes="${keyTimes.map((k) => r2(Math.min(1, Math.max(0, k)))).join(";")}"` : ""
  }/>`;

function shell(t, { tag, title, metric, note }, stage) {
  return `
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${t.faint}"/>
<text x="22" y="32" font-family="${SANS}" font-size="10" letter-spacing="1.6" fill="${t.mute}">${esc(tag.toUpperCase())}</text>
<text x="22" y="58" font-family="${SERIF}" font-size="19" fill="${t.ink}">${esc(title)}</text>
${stage}
<text x="22" y="${H - 42}" font-family="${SANS}" font-size="12" fill="${t.accent}">${esc(metric)}</text>
<text x="22" y="${H - 22}" font-family="${SANS}" font-size="11.5" fill="${t.mute}">${esc(note)}</text>`;
}

// ---------------------------------------------------------------------------------------------
// 1. Exoplanet habitability: a planet on a Kepler orbit, seen tilted, crossing the habitable zone.
function exoplanet(t) {
  const cx = STAGE.x + STAGE.w / 2 + 50, cy = STAGE.y + STAGE.h / 2 + 2;
  const a = 130, e = 0.5, tilt = 0.4; // semi-major axis, eccentricity, foreshortening of the orbit plane
  const b = a * Math.sqrt(1 - e * e), c = a * e;
  const N = 120, T = 9;
  const xs = [], ys = [], rs = [];
  for (let i = 0; i <= N; i++) {
    // Kepler's equation M = E − e·sin E, solved by Newton's method: equal times, unequal arcs.
    const M = (2 * Math.PI * i) / N;
    let E = M;
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * Math.cos(E) - c, y = b * Math.sin(E);
    xs.push(cx + x);
    ys.push(cy + y * tilt);
    rs.push(3.2 + 1.6 * (Math.sin(E) * 0.5 + 0.5)); // nearer the viewer on the near side
  }
  // Habitable zone: an annulus around the star (it sits at a focus), foreshortened like the orbit.
  // Between 80 and 120 from the star: the orbit dips in and out of it twice a year.
  const hz = `<ellipse cx="${cx}" cy="${cy}" rx="100" ry="${100 * tilt}" fill="none" stroke="${t.accent}" stroke-opacity=".11" stroke-width="${40 * tilt}"/>`;
  return {
    stage: `
<defs><radialGradient id="star"><stop offset="0" stop-color="${t.glow}"/><stop offset=".35" stop-color="${t.accent}" stop-opacity=".85"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<clipPath id="stageclip"><rect x="${STAGE.x}" y="${STAGE.y - 6}" width="${STAGE.w}" height="${STAGE.h + 12}"/></clipPath></defs>
<g clip-path="url(#stageclip)">
${hz}
<ellipse cx="${cx - c}" cy="${cy}" rx="${a}" ry="${b * tilt}" fill="none" stroke="${t.line}" stroke-width=".8" stroke-dasharray="2 4"/>
<circle cx="${cx}" cy="${cy}" r="18" fill="url(#star)"/>
<circle cx="${cx}" cy="${cy}" r="4.5" fill="${t.glow}"/>
<circle r="4" fill="${t.steel}">${anim("cx", xs, T)}${anim("cy", ys, T)}${anim("r", rs, T)}</circle>
</g>
<text x="${STAGE.x + 2}" y="${STAGE.y + STAGE.h - 2}" font-family="${SANS}" font-size="10" fill="${t.mute}">habitable zone</text>
<line x1="${STAGE.x + 84}" y1="${STAGE.y + STAGE.h - 5}" x2="${STAGE.x + 104}" y2="${STAGE.y + STAGE.h - 5}" stroke="${t.accent}" stroke-opacity=".5" stroke-width="5"/>`,
  };
}

// ---------------------------------------------------------------------------------------------
// 2. β-Ga₂O₃: a lattice of atoms joined by springs, carrying two phonons, with a dopant at its
//    centre sending out messages the way a graph network passes them.
function lattice(t) {
  const cols = 12, rows = 4, d = 29;
  const ox = STAGE.x + (STAGE.w - (cols - 1) * d) / 2 - d / 4, oy = STAGE.y + 16;
  const T = 6, N = 16; // the browser interpolates between samples
  const atoms = [];
  // Rows sit a little apart vertically so four rows fill the stage.
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) atoms.push({ i, j, x: ox + i * d + (j % 2 ? d / 2 : 0), y: oy + j * d * 1.05 });
  const mid = { x: STAGE.x + STAGE.w / 2, y: oy + 1.5 * d * 1.05 };
  const center = atoms.reduce((best, a) => (Math.hypot(a.x - mid.x, a.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y) ? a : best));
  // Two plane-wave phonons whose frequencies loop exactly in T seconds.
  const waves = [
    { kx: 0.11, ky: 0.04, w: (2 * Math.PI * 2) / T, ax: 2.4, ay: 0.6, ph: 0 },
    { kx: -0.05, ky: 0.13, w: (2 * Math.PI * 3) / T, ax: 0.5, ay: 2.0, ph: 1.3 },
  ];
  const at = (a, s) => {
    let dx = 0, dy = 0;
    for (const v of waves) {
      const p = Math.sin(v.kx * a.x + v.ky * a.y - v.w * s + v.ph);
      dx += v.ax * p;
      dy += v.ay * p;
    }
    return [a.x + dx, a.y + dy];
  };
  const track = atoms.map((a) => {
    const xs = [], ys = [];
    for (let f = 0; f <= N; f++) {
      const [x, y] = at(a, (f / N) * T);
      xs.push(x);
      ys.push(y);
    }
    return { xs, ys };
  });
  const idx = (i, j) => (i >= 0 && i < cols && j >= 0 && j < rows ? j * cols + i : -1);
  const bonds = [];
  atoms.forEach((a, k) => {
    const nbrs = [idx(a.i + 1, a.j), a.j % 2 ? idx(a.i + 1, a.j + 1) : idx(a.i, a.j + 1), a.j % 2 ? idx(a.i, a.j + 1) : idx(a.i - 1, a.j + 1)];
    for (const n of nbrs) if (n >= 0) bonds.push([k, n]);
  });
  const bondSvg = bonds
    .map(([p, q]) => `<line stroke="${t.line}" stroke-width=".8">${anim("x1", track[p].xs, T)}${anim("y1", track[p].ys, T)}${anim("x2", track[q].xs, T)}${anim("y2", track[q].ys, T)}</line>`)
    .join("");
  const ci = atoms.indexOf(center);
  const atomSvg = atoms
    .map((a, k) =>
      k === ci
        ? ""
        : `<circle r="${(a.i + a.j) % 2 ? 2.6 : 3.6}" fill="${(a.i + a.j) % 2 ? t.mute : t.steel}">${anim("cx", track[k].xs, T)}${anim("cy", track[k].ys, T)}</circle>`,
    )
    .join("");
  // Messages: rings leaving the dopant, one every two seconds.
  const pulses = [0, 2, 4]
    .map(
      (delay) =>
        `<circle r="5" fill="none" stroke="${t.accent}" stroke-width="1"><animate attributeName="r" values="5;62" dur="6s" begin="${delay}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="6s" begin="${delay}s" repeatCount="indefinite"/>${anim("cx", track[ci].xs, T)}${anim("cy", track[ci].ys, T)}</circle>`,
    )
    .join("");
  return {
    stage: `${bondSvg}${pulses}${atomSvg}<circle r="6" fill="${t.accent}">${anim("cx", track[ci].xs, T)}${anim("cy", track[ci].ys, T)}</circle>`,
  };
}

// ---------------------------------------------------------------------------------------------
// 3. NodeGuard: a transaction graph relaxing under springs and repulsion until a mule ring
//    pulls itself together, then scattering and settling again.
function graph(t) {
  const rand = rng(7);
  const n = 26, ring = [0, 1, 2, 3, 4];
  const nodes = Array.from({ length: n }, () => ({
    x: STAGE.x + 20 + rand() * (STAGE.w - 40),
    y: STAGE.y + 8 + rand() * (STAGE.h - 16),
    vx: 0,
    vy: 0,
  }));
  const edges = [];
  ring.forEach((a, k) => edges.push([a, ring[(k + 1) % ring.length]], [a, ring[(k + 2) % ring.length]]));
  for (let k = 5; k < n; k++) {
    edges.push([k, 5 + Math.floor(rand() * (k - 5 || 1))]);
    if (rand() < 0.35) edges.push([k, 5 + Math.floor(rand() * (n - 5))]);
  }
  edges.push([0, 9], [3, 14]); // the ring's few links to everyone else
  const start = nodes.map((p) => ({ x: p.x, y: p.y }));
  const frames = [];
  const SETTLE = 28; // samples of the simulation kept (each is several steps)
  for (let f = 0; f < SETTLE; f++) {
    for (let s = 0; s < 15; s++) {
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const d2 = Math.max(60, dx * dx + dy * dy);
          const fr = 260 / d2;
          nodes[i].vx -= (dx * fr) / Math.sqrt(d2); nodes[i].vy -= (dy * fr) / Math.sqrt(d2);
          nodes[j].vx += (dx * fr) / Math.sqrt(d2); nodes[j].vy += (dy * fr) / Math.sqrt(d2);
        }
      for (const [a, b] of edges) {
        const tight = ring.includes(a) && ring.includes(b);
        const L = tight ? 16 : 34, k = tight ? 0.05 : 0.02;
        const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y, d = Math.hypot(dx, dy) || 1;
        const fs = k * (d - L);
        nodes[a].vx += (fs * dx) / d; nodes[a].vy += (fs * dy) / d;
        nodes[b].vx -= (fs * dx) / d; nodes[b].vy -= (fs * dy) / d;
      }
      for (const p of nodes) {
        p.vx += (STAGE.x + STAGE.w / 2 - p.x) * 0.002;
        p.vy += (STAGE.y + STAGE.h / 2 - p.y) * 0.004;
        p.vx *= 0.82; p.vy *= 0.82;
        p.x = Math.min(STAGE.x + STAGE.w - 8, Math.max(STAGE.x + 8, p.x + p.vx));
        p.y = Math.min(STAGE.y + STAGE.h - 6, Math.max(STAGE.y + 6, p.y + p.vy));
      }
    }
    frames.push(nodes.map((p) => ({ x: p.x, y: p.y })));
  }
  // Timeline: settle (0–55%), hold (to 85%), scatter back to the start (to 100%), loop.
  const T = 10;
  const times = frames.map((_, f) => (f / (SETTLE - 1)) * 0.55).concat([0.85, 1]);
  const series = (i, key) => [start[i][key], ...frames.slice(1).map((fr) => fr[i][key]), frames.at(-1)[i][key], start[i][key]];
  const kt = [0, ...times.slice(1)];
  const edgeSvg = edges
    .map(([a, b]) => {
      const tight = ring.includes(a) && ring.includes(b);
      return `<line stroke="${tight ? t.accent : t.line}" stroke-width="${tight ? 1.1 : 0.7}" stroke-opacity="${tight ? 0.9 : 0.8}">${anim("x1", series(a, "x"), T, kt)}${anim("y1", series(a, "y"), T, kt)}${anim("x2", series(b, "x"), T, kt)}${anim("y2", series(b, "y"), T, kt)}</line>`;
    })
    .join("");
  const nodeSvg = nodes
    .map((_, i) => `<circle r="${ring.includes(i) ? 3.8 : 2.8}" fill="${ring.includes(i) ? t.accent : t.steel}">${anim("cx", series(i, "x"), T, kt)}${anim("cy", series(i, "y"), T, kt)}</circle>`)
    .join("");
  return { stage: edgeSvg + nodeSvg };
}

// ---------------------------------------------------------------------------------------------
// 4. Warp divergence: two warps of 32 lanes. Each lane's work drops a bead under gravity; in the
//    fixed warp every lane does the same work, in the variable warp the lanes finish at different
//    depths and wait, greyed, for the slowest.
function warp(t) {
  const rand = rng(11);
  const lanes = 32, gap = 5.2, T = 6;
  const left = STAGE.x + 6, right = STAGE.x + STAGE.w / 2 + 14;
  const top = STAGE.y + 12, floor = STAGE.y + STAGE.h - 16;
  const g = 900; // px/s²
  const out = [];
  const drop = (x0, depth, idle) => {
    // Fall from the top to the depth, bounce twice (restitution 0.35), wait, lift back.
    const ys = [], kt = [];
    const tFall = Math.sqrt((2 * depth) / g);
    const v = g * tFall;
    const samples = 24;
    let time = 0;
    for (let s = 0; s <= samples; s++) {
      const tt = (s / samples) * tFall;
      ys.push(top + 0.5 * g * tt * tt);
      kt.push((time + tt) / T);
    }
    time += tFall;
    for (const e of [0.35, 0.12]) {
      const vb = v * e, tb = (2 * vb) / g;
      for (let s = 1; s <= 10; s++) {
        const tt = (s / 10) * tb;
        ys.push(top + depth - (vb * tt - 0.5 * g * tt * tt));
        kt.push((time + tt) / T);
      }
      time += tb;
    }
    ys.push(top + depth, top + depth, top);
    kt.push(Math.max(time / T, 0.86), 0.92, 1);
    const fills = idle ? `<animate attributeName="fill-opacity" values="1;1;.35;.35;1" keyTimes="0;${r2(time / T)};${r2(Math.min(0.9, time / T + 0.05))};.92;1" dur="${T}s" repeatCount="indefinite"/>` : "";
    return `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${floor}" stroke="${t.faint}" stroke-width="1"/><circle cx="${x0}" r="1.9" fill="${idle ? t.accent : t.steel}">${anim("cy", ys, T, kt)}${fills}</circle>`;
  };
  for (let k = 0; k < lanes; k++) out.push(drop(left + k * gap, (floor - top) * 0.62, false));
  for (let k = 0; k < lanes; k++) {
    const work = 4 + Math.floor(rand() * 57); // 4–60 neighbours
    out.push(drop(right + k * gap, ((floor - top) * work) / 60, true));
  }
  out.push(
    `<text x="${left}" y="${floor + 13}" font-family="${SANS}" font-size="10" fill="${t.mute}">fixed 32 · 100% branch efficiency</text>`,
    `<text x="${right}" y="${floor + 13}" font-family="${SANS}" font-size="10" fill="${t.mute}">variable 4–60 · 33.34%</text>`,
  );
  return { stage: out.join("") };
}

// ---------------------------------------------------------------------------------------------
// 5. SGEMM: throughput per kernel generation, each bar driven by a damped spring
//    (x'' = −k(x − target) − c·x'), on a log scale toward the cuBLAS line.
function sgemm(t) {
  const rows = [
    { label: "naive", v: 169.6 },
    { label: "coalesced", v: 763.1 },
    { label: "shared-memory tiled", v: 1052.9, accent: true },
  ];
  const lo = Math.log10(100), hi = Math.log10(10000), span = STAGE.w - 150;
  const at = (v) => ((Math.log10(v) - lo) / (hi - lo)) * span;
  const T = 7, N = 80, x0 = STAGE.x + 120;
  const out = [];
  const cub = at(8322);
  out.push(
    `<line x1="${x0 + cub}" y1="${STAGE.y + 6}" x2="${x0 + cub}" y2="${STAGE.y + STAGE.h - 22}" stroke="${t.line}" stroke-dasharray="3 3"/>`,
    `<text x="${x0 + cub}" y="${STAGE.y + STAGE.h - 8}" font-family="${SANS}" font-size="10" fill="${t.mute}" text-anchor="middle">cuBLAS 8,322</text>`,
  );
  rows.forEach((r, i) => {
    const y = STAGE.y + 14 + i * 30;
    // Integrate the spring from 0 to the bar's length, starting a beat after the previous bar.
    const target = at(r.v), k = 60, c = 7, dt = T / N;
    let x = 0, v = 0;
    const ws = [];
    for (let f = 0; f <= N; f++) {
      const s = f * dt;
      if (s > 0.5 + i * 0.7 && s < T - 1) {
        const a = -k * (x - target) - c * v;
        v += a * dt;
        x += v * dt;
      } else if (s >= T - 1) {
        x *= 0.6;
      }
      ws.push(Math.max(0.5, x));
    }
    out.push(
      `<text x="${STAGE.x}" y="${y + 8}" font-family="${SANS}" font-size="11" fill="${t.ink}">${r.label}</text>`,
      `<rect x="${x0}" y="${y}" width="${span}" height="8" rx="4" fill="${t.faint}" fill-opacity=".6"/>`,
      `<rect x="${x0}" y="${y}" height="8" rx="4" fill="${r.accent ? t.accent : t.steel}">${anim("width", ws, T)}</rect>`,
      `<text x="${x0 + target + 6}" y="${y + 8}" font-family="${SANS}" font-size="10.5" fill="${r.accent ? t.accent : t.mute}">${r.v.toLocaleString("en-US")}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${r2((0.9 + i * 0.7) / T)};${r2((1.3 + i * 0.7) / T)};${r2((T - 1) / T)};1" dur="${T}s" repeatCount="indefinite"/></text>`,
    );
  });
  return { stage: out.join("") };
}

// ---------------------------------------------------------------------------------------------
// 6. RISC-V: an instruction word decoded into its fields; records drop out of it under gravity
//    and stack into eight tables.
function riscv(t) {
  const rand = rng(23);
  const fields = [["funct7", 7], ["rs2", 5], ["rs1", 5], ["funct3", 3], ["rd", 5], ["opcode", 7]];
  const cell = 9.6, x0 = STAGE.x + (STAGE.w - 32 * cell) / 2, y0 = STAGE.y + 4;
  const out = [];
  let b = 0;
  for (const [name, len] of fields) {
    const fx = x0 + b * cell;
    out.push(
      `<path d="M ${fx + 1} ${y0 + 20} v 3 H ${fx + len * cell - 1} v -3" fill="none" stroke="${t.line}" stroke-width=".7"/>`,
      `<text x="${fx + (len * cell) / 2}" y="${y0 + 33}" font-family="${SANS}" font-size="8.5" fill="${t.mute}" text-anchor="middle">${name}</text>`,
    );
    b += len;
  }
  for (let i = 0; i < 32; i++) {
    const on = rand() < 0.5;
    const flip = (rand() * 4).toFixed(2);
    out.push(
      `<rect x="${x0 + i * cell + 1}" y="${y0}" width="${cell - 2}" height="16" rx="2" fill="${t.steel}" fill-opacity="${on ? 0.85 : 0.15}"><animate attributeName="fill-opacity" values="${on ? ".85;.15;.85" : ".15;.85;.15"}" dur="4s" begin="${flip}s" repeatCount="indefinite" calcMode="discrete"/></rect>`,
    );
  }
  // Eight tables; records fall from the word with gravity and land on their table's stack.
  const tables = 8, tw = (STAGE.w - 40) / tables, ty = STAGE.y + STAGE.h - 2, T = 8, g = 700;
  const stacks = new Array(tables).fill(0);
  for (let k = 0; k < tables; k++)
    out.push(`<line x1="${STAGE.x + 20 + k * tw + 4}" y1="${ty}" x2="${STAGE.x + 20 + (k + 1) * tw - 4}" y2="${ty}" stroke="${t.line}"/>`);
  for (let r = 0; r < 18; r++) {
    const k = Math.floor(rand() * tables);
    const h = 5, landY = ty - (stacks[k] + 1) * (h + 1.5);
    stacks[k]++;
    const start = 0.3 + r * 0.32; // seconds
    const fall = Math.sqrt((2 * (landY - (y0 + 38))) / g);
    const ys = [y0 + 38, y0 + 38], kt = [0, start / T];
    for (let s = 1; s <= 10; s++) {
      const tt = (s / 10) * fall;
      ys.push(y0 + 38 + 0.5 * g * tt * tt);
      kt.push((start + tt) / T);
    }
    ys.push(landY - 3, landY, landY, y0 + 38);
    kt.push((start + fall + 0.08) / T, (start + fall + 0.16) / T, 0.94, 1);
    const xs = STAGE.x + 20 + k * tw + tw * 0.2;
    out.push(
      `<rect x="${xs}" width="${tw * 0.6}" height="${h}" rx="1.5" fill="${r % 5 === 0 ? t.accent : t.steel}" fill-opacity=".9">${anim("y", ys, T, kt)}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${r2(start / T)};${r2((start + 0.05) / T)};.93;1" dur="${T}s" repeatCount="indefinite"/></rect>`,
    );
  }
  return { stage: out.join("") };
}

// ---------------------------------------------------------------------------------------------

export const CARDS = [
  {
    id: "sgemm",
    href: "https://github.com/SatnamCodes/matmul",
    tag: "CUDA · C++ · Nsight",
    title: "Custom SGEMM",
    metric: "169.6 → 1,052.9 GFLOPS on an RTX 4060 · 6.5×",
    note: "Coalescing, then shared-memory tiling. Tensor Cores next.",
    draw: sgemm,
  },
  {
    id: "warp",
    href: "https://github.com/SatnamCodes/gpu-neighbor-gather-divergence",
    tag: "CUDA · Nsight Compute",
    title: "Warp divergence",
    metric: "A third of the branch efficiency, and still faster",
    note: "158.87 vs 153.13 GB/s: both kernels memory bound.",
    draw: warp,
  },
  {
    id: "dopants",
    href: "https://satnamwanders.dev/research/p-type-dopants-in-beta-ga2o3",
    tag: "Graph networks · DFT",
    title: "p-type dopants in β-Ga₂O₃",
    metric: "Abstract under review at IIM ATM 2026",
    note: "Five acceptors, both Ga sites, ~15,000 defect structures.",
    draw: lattice,
  },
  {
    id: "nodeguard",
    href: "https://satnamwanders.dev/projects/nodeguard",
    tag: "PyTorch Geometric",
    title: "NodeGuard",
    metric: "Fraud rings found from who connects to whom",
    note: "Recall-only checkpoints went degenerate; F1 fixed it.",
    draw: graph,
  },
  {
    id: "exoplanets",
    href: "https://satnamwanders.dev",
    tag: "Independent study",
    title: "Exoplanet habitability",
    metric: "Do habitability indices reduce to a few quantities?",
    note: "Supervised by Dr. Shilpashree S P. In data analysis.",
    draw: exoplanet,
  },
  {
    id: "riscv",
    href: "https://satnamwanders.dev/projects/risc-v-knowledge-db",
    tag: "Python · PostgreSQL",
    title: "RISC-V specification DB",
    metric: "1,700+ YAML files → 8 tables",
    note: "1,351 instructions and 396 CSRs, one query away.",
    draw: riscv,
  },
];

function card(c, theme) {
  const t = THEMES[theme];
  const { stage } = c.draw(t);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${esc(`${c.title}. ${c.metric}. ${c.note}`)}</title>
${shell(t, c, stage)}
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// Link pills: a hand-drawn line icon and a label, in the cards' line weight.

const ICONS = {
  site: (c) =>
    `<circle cx="12" cy="12" r="8.5" fill="none" stroke="${c}" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M3.8 9.2h16.4M3.8 14.8h16.4" stroke="${c}" stroke-width="1.1"/>`,
  linkedin: (c) =>
    `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="${c}" stroke-width="1.3"/><path d="M8 10.5v6M8 7.4v.2M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6 1.4 0 2.1 1 2.1 2.6v3.5" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  x: (c) => `<path d="M5 5l14 14M19 5L5 19" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><path d="M5 5h3.6L19 19h-3.6z" fill="none" stroke="${c}" stroke-width="1.1" stroke-linejoin="round"/>`,
  instagram: (c) =>
    `<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="12" cy="12" r="4" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="16.8" cy="7.2" r=".9" fill="${c}"/>`,
};

export const LINKS = [
  { id: "site", label: "satnamwanders.dev", href: "https://satnamwanders.dev" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/satnamcodes" },
  { id: "x", label: "@gitblamesatnam", href: "https://twitter.com/gitblamesatnam" },
  { id: "instagram", label: "@dontblamesatnam", href: "https://www.instagram.com/dontblamesatnam" },
];

function pill(l, theme) {
  const t = THEMES[theme];
  const w = 44 + l.label.length * 7.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="40" viewBox="0 0 ${Math.round(w)} 40" role="img" aria-label="${esc(l.label)}">
<rect x=".5" y=".5" width="${Math.round(w) - 1}" height="39" rx="20" fill="none" stroke="${t.faint}"/>
<g transform="translate(10 8)">${ICONS[l.id](t.ink)}</g>
<text x="40" y="25" font-family="${SANS}" font-size="12.5" fill="${t.ink}">${esc(l.label)}</text>
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const dir of ["cards", "links"]) fs.mkdirSync(path.join(ROOT, "assets", dir), { recursive: true });
  for (const theme of ["dark", "light"]) {
    for (const c of CARDS) fs.writeFileSync(path.join(ROOT, "assets", "cards", `${c.id}-${theme}.svg`), card(c, theme));
    for (const l of LINKS) fs.writeFileSync(path.join(ROOT, "assets", "links", `${l.id}-${theme}.svg`), pill(l, theme));
  }
  console.log(`[cards] ${CARDS.length} cards and ${LINKS.length} links written`);
}
