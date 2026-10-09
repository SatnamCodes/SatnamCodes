// The projects, the year and the toolkit, each as a shot: a small physical scene, lit, seen
// through a perspective camera with depth of field, simulated here once and baked into SVG
// animation (SMIL and CSS), so it plays on a GitHub profile where no script can run.
//
//   node totem/shots.mjs     writes assets/shots/*.svg, assets/kit.svg and assets/links/*.svg
//
// The year (assets/city.svg) is redrawn daily by build.mjs, which passes it the calendar.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { damBreak } from "./sph.mjs";
import { TH, BOOK, withFonts, SANS, MONO, esc, r1, r2, rng, camera, dof, bounce, spring, anim, frame } from "./film.mjs";

let SPH = null; // the dam break, simulated once for both themes
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 420, H = 220; // 1.9:1, the IMAX digital frame
const pts = (ps) => ps.map((q) => `${r1(q.x)},${r1(q.y)}`).join(" ");
const kt = (ks) => ` keyTimes="${ks.map((k) => +Math.min(1, Math.max(0, k)).toFixed(4)).join(";")}"`;

// A steel ball lit from the upper left, with a warm kick from the key light.
const sphere = (id, base = "#c3c7cc") =>
  `<radialGradient id="${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${base}"/><stop offset=".8" stop-color="#2b2c2e"/><stop offset="1" stop-color="#121213"/></radialGradient>`;

// ---------------------------------------------------------------------------------------------
// 1. Custom SGEMM, as a race. The same 8×8 block of C, the same few seconds, three kernels; how
//    far each gets is in proportion to its measured throughput (169.6, 763.1, 1,052.9 GFLOPS on
//    an RTX 4060). Naive: each output reads its operands from global memory one at a time.
//    Coalesced: a warp's reads are adjacent, so a row arrives in one transaction. Tiled: a tile
//    is lifted once into shared memory and reused by every output in its block.
const EASE = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
// SMIL through [time, value, eased?] keys; eased stretches are sampled densely so nothing jerks.
function eased(T, attr, keys, fmt = r1, n = 10) {
  const out = [];
  for (const [tt, v, ez] of keys) {
    if (ez && out.length) {
      const [t0, v0] = out.at(-1);
      for (let k = 1; k <= n; k++) {
        const w = (ez === true ? EASE : ez)(k / n);
        out.push([t0 + (tt - t0) * (k / n), typeof v === "function" ? v(w) : v0 + (v - v0) * w]);
      }
    } else out.push([tt, typeof v === "function" ? v(0) : v]);
  }
  if (out[0][0] > 0) out.unshift([0, out[0][1]]);
  if (out.at(-1)[0] < T) out.push([T, out.at(-1)[1]]);
  return `<animate attributeName="${attr}" values="${out.map(([, v]) => fmt(v)).join(";")}" keyTimes="${out.map(([tt]) => +(tt / T).toFixed(4)).join(";")}" dur="${T}s" repeatCount="indefinite"/>`;
}
function sgemm(theme) {
  const K = TH[theme];
  const p = "sg";
  const T = 19;
  const ACTS = [
    { name: "NAIVE", g: 169.6, t0: 0.6 },
    { name: "COALESCED", g: 763.1, t0: 6.6 },
    { name: "SHARED-MEMORY TILING", g: 1052.9, t0: 12.6 },
  ];
  const RUN = 4.4; // seconds each kernel gets
  const filled = ACTS.map((a) => Math.round((64 * a.g) / 1052.9)); // 10, 46, 64
  const C = { x: 268, y: 40, c: 15 }, G = { x: 26, y: 102, c: 12, cols: 8, rows: 5 }, SH = { x: 168, y: 108, c: 9 };
  const cell = (i) => [C.x + (i % 8) * C.c, C.y + Math.floor(i / 8) * C.c];
  const gcell = (i) => [G.x + (i % G.cols) * G.c, G.y + Math.floor(i / G.cols) * G.c];
  const R = rng(41);
  const fillAt = Array.from({ length: 64 }, () => [null, null, null]);
  const packets = [];
  const packet = (from, to, t0, dur, w = 5, h = 2.4, arcUp = 30) => {
    const [x0, y0] = from, [x1, y1] = to, top = Math.min(y0, y1) - arcUp;
    const bz = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * top + u * u * y1];
    packets.push(`<rect width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${K.hot}" opacity="0">${eased(T, "x", [[t0, (u) => bz(u)[0] - w / 2], [t0 + dur, (u) => bz(u)[0] - w / 2, true]])}${eased(T, "y", [[t0, (u) => bz(u)[1] - h / 2], [t0 + dur, (u) => bz(u)[1] - h / 2, true]])}${eased(T, "opacity", [[t0 - 0.01, 0], [t0, 1], [t0 + dur - 0.05, 1], [t0 + dur, 0]], r2)}</rect>`);
  };
  // Act 1: one output at a time, two scattered reads each
  ACTS[0].order = Array.from({ length: filled[0] }, (_, i) => i);
  ACTS[0].order.forEach((i, n) => {
    const t0 = ACTS[0].t0 + (n * RUN) / filled[0];
    const to = cell(i).map((v) => v + C.c / 2);
    packet(gcell(Math.floor(R() * 40)).map((v) => v + 6), to, t0, 0.42);
    packet(gcell(Math.floor(R() * 40)).map((v) => v + 6), to, t0 + 0.08, 0.42);
    fillAt[i][0] = t0 + 0.48;
  });
  // Act 2: a row at a time, its reads arriving together
  for (let r = 0; r * 8 < filled[1]; r++) {
    const t0 = ACTS[1].t0 + (r * 8 * RUN) / filled[1];
    const row = Math.floor(R() * 5);
    packet([G.x + 48, G.y + row * G.c + 6], [C.x + 60, C.y + r * C.c + C.c / 2], t0, 0.55, 96, 3);
    for (let k = 0; k < 8 && r * 8 + k < filled[1]; k++) fillAt[r * 8 + k][1] = t0 + 0.6 + k * 0.02;
  }
  // Act 3: a tile lifted once into shared memory, then fanned out to its 16 outputs
  for (let tile = 0; tile < 4; tile++) {
    const t0 = ACTS[2].t0 + (tile * RUN) / 4;
    const tr = Math.floor(tile / 2) * 4, tc = (tile % 2) * 4;
    packet([G.x + 24 + (tile % 2) * 48, G.y + 24], [SH.x + 18, SH.y + 18], t0, 0.4, 34, 34, 18);
    for (let k = 0; k < 16; k++) {
      const i = (tr + Math.floor(k / 4)) * 8 + tc + (k % 4);
      packet([SH.x + 4 + (k % 4) * SH.c, SH.y + 4 + Math.floor(k / 4) * SH.c], cell(i).map((v) => v + C.c / 2), t0 + 0.42 + k * 0.012, 0.38, 3, 3, 8);
      fillAt[i][2] = t0 + 0.82 + k * 0.012;
    }
  }
  const actEnd = (a) => ACTS[a].t0 + RUN + 0.9;
  const cells = Array.from({ length: 64 }, (_, i) => {
    const [x, y] = cell(i);
    const keys = [[0, 0]];
    fillAt[i].forEach((ft, a) => {
      if (ft == null) return;
      keys.push([ft, 0], [ft + 0.25, 0.85, true], [actEnd(a), 0.85], [actEnd(a) + 0.5, 0, true]);
    });
    return `<rect x="${x + 0.8}" y="${y + 0.8}" width="${C.c - 1.6}" height="${C.c - 1.6}" rx="1.5" fill="${K.warm}" opacity="0">${eased(T, "opacity", keys, r2, 6)}</rect>`;
  }).join("");
  const grid = (x, y, c, cols, rows, op) => Array.from({ length: cols * rows }, (_, i) => `<rect x="${x + (i % cols) * c + 0.6}" y="${y + Math.floor(i / cols) * c + 0.6}" width="${c - 1.2}" height="${c - 1.2}" rx="1" fill="none" stroke="${K.line}" stroke-opacity="${op}" stroke-width=".7"/>`).join("");
  const show = (a, b) => [[0, a <= 0 ? 1 : 0], [a - 0.5, a <= 0 ? 1 : 0], [a, 1, true], [b - 0.4, 1], [b, 0, true]];
  const counters = ACTS.map((a, n) => {
    const b = n < 2 ? ACTS[n + 1].t0 - 0.2 : T - 0.6;
    return `<g opacity="0">${eased(T, "opacity", show(a.t0, b), r2)}
<text x="24" y="38" font-family="${SANS}" font-weight="300" font-size="28" letter-spacing="1" fill="${K.light}">${a.g.toLocaleString("en-US", { minimumFractionDigits: 1 })}</text>
<text x="24" y="54" font-family="${SANS}" font-size="9" letter-spacing="2" fill="${K.mute}">GFLOPS · ${a.name}</text></g>`;
  }).join("");
  const bars = ACTS.map((a, n) => {
    const w = (a.g / 1052.9) * 120;
    return `<rect x="24" y="${62 + n * 6}" height="3" rx="1.5" width="0" fill="${n === 2 ? K.warm : K.line}">${eased(T, "width", [[a.t0, 0], [a.t0 + RUN, w, true], [T - 0.8, w], [T, 0, true]])}</rect>`;
  }).join("");
  const sharedOn = [[0, 0], [ACTS[2].t0 - 0.6, 0], [ACTS[2].t0, 1, true], [T - 0.8, 1], [T, 0, true]];
  const body = `
${counters}
<rect x="24" y="62" width="120" height="15" fill="none"/>${bars}
<text x="${G.x}" y="${G.y - 7}" font-family="${SANS}" font-size="8.5" letter-spacing="1.8" fill="${K.mute}">GLOBAL MEMORY</text>
<g${dof(p, 0.8)}>${grid(G.x, G.y, G.c, G.cols, G.rows, 0.55)}</g>
<g opacity="0">${eased(T, "opacity", sharedOn, r2)}
<text x="${SH.x}" y="${SH.y - 7}" font-family="${SANS}" font-size="8.5" letter-spacing="1.8" fill="${K.mute}">SHARED</text>
${grid(SH.x, SH.y, SH.c, 4, 4, 0.9)}</g>
<text x="${C.x}" y="${C.y - 7}" font-family="${SANS}" font-size="8.5" letter-spacing="1.8" fill="${K.mute}">C · SAME BLOCK, SAME TIME</text>
${grid(C.x, C.y, C.c, 8, 8, 0.7)}
${cells}
${packets.join("")}`;
  return frame({
    w: W, h: H, p, theme,
    desc: "Custom SGEMM as a race: three kernels fill the same 8 by 8 block of C in the same time, each getting as far as its measured throughput allows. Naive, 169.6 GFLOPS, reads its operands one at a time; coalesced, 763.1, takes a row per transaction; shared-memory tiling, 1,052.9, lifts a tile once into shared memory and reuses it. 6.5 times faster on an RTX 4060.",
    defs: "",
    body,
    caption: ["Custom SGEMM", "169.6 to 1,052.9 GFLOPS, one bottleneck at a time · 6.5× on an RTX 4060"],
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Warp divergence, from where it comes. An SPH dam break (simulated in sph.mjs) plays out; then one warp is taken from it: 32 particles that sit
//    together in memory, one GPU thread each, each gathering the neighbours inside its kernel
//    radius 2h. Their real neighbour counts become the work: the warp steps in lockstep, every
//    lane together, for as many steps as its busiest lane needs; lanes that finish early sit
//    masked off, dimmed, until the warp is done.
function warp(theme) {
  const K = TH[theme];
  const p = "wp";
  const sim = SPH ?? (SPH = damBreak());
  const { frames, counts, h, nF } = sim;
  const S = 168, X0 = 76, FLOOR = 172; // px per metre; tank origin on screen
  const sx = (x) => X0 + x * S, sy = (y) => FLOOR - y * S;
  const last = frames.at(-1);
  // the warp: 32 consecutive particles in cell order, as a GPU would sort them, with the most uneven work
  const cellOf = (i) => Math.floor(last[i][1] / (2 * h)) * 1000 + Math.floor(last[i][0] / (2 * h));
  const order = Array.from({ length: nF }, (_, i) => i).sort((a, b) => cellOf(a) - cellOf(b));
  let best = null;
  for (let s0 = 0; s0 + 32 <= nF; s0 += 4) {
    const lanes = order.slice(s0, s0 + 32);
    if (lanes.some((i) => last[i][1] > 0.9)) continue;
    const ns = lanes.map((i) => counts[i]);
    const score = Math.max(...ns) - ns.reduce((a, b) => a + b, 0) / 32;
    if (!best || score > best.score) best = { lanes, ns, score };
  }
  const { ns } = best;
  // lanes ordered left to right by where their particles sit, so the paths into them do not cross
  const lanes = [...best.lanes].sort((a, b) => last[a][0] - last[b][0]);
  const nsL = lanes.map((i) => counts[i]);
  const L = Math.max(...nsL), busy = nsL.reduce((a, b) => a + b, 0) / L;

  // The timeline, in seconds.
  const T = 20;
  const tFluid = 6.4, tKernel = 6.8, tMorph = 8.6, tLand = 11.4, tRun = 11.8, tDone = 17.4, tOut = 18.6;
  const laneX = (k) => 62 + k * 9.4, TOP = 40, BOT = 168, step = (BOT - TOP) / L;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  // A track: [time, value] keys, with eased stretches sampled densely so the motion never jerks.
  const track = (keys, n = 12) => {
    const out = [];
    for (const [tt, v, eased] of keys) {
      if (eased && out.length) {
        const [t0, v0] = out.at(-1);
        for (let k = 1; k <= n; k++) {
          const u = k / n;
          out.push([t0 + (tt - t0) * u, typeof v === "function" ? v(ease(u)) : v0 + (v - v0) * ease(u)]);
        }
      } else out.push([tt, v]);
    }
    return out;
  };
  const animT = (attr, keys, round = r1, n = 12) => {
    const kk = track(keys, n);
    if (kk.at(-1)[0] < T) kk.push([T, kk.at(-1)[1]]);
    return `<animate attributeName="${attr}" values="${kk.map(([, v]) => round(v)).join(";")}" keyTimes="${kk.map(([tt]) => +(tt / T).toFixed(4)).join(";")}" dur="${T}s" repeatCount="indefinite"/>`;
  };
  const fluidKeys = (i, axis) => frames.map((fr, f) => [(f / (frames.length - 1)) * tFluid, axis ? sy(fr[i][1]) : sx(fr[i][0])]);

  const inWarp = new Map(lanes.map((i, k) => [i, k]));
  const cx0 = lanes.reduce((s, i) => s + sx(last[i][0]), 0) / 32, cy0 = lanes.reduce((s, i) => s + sy(last[i][1]), 0) / 32;
  const far = Math.max(...last.map(([x, y]) => Math.hypot(sx(x) - cx0, sy(y) - cy0)));
  const parts = [];
  for (let i = 0; i < nF; i++) {
    const x1 = sx(last[i][0]), y1 = sy(last[i][1]);
    const k = inWarp.get(i);
    if (k === undefined) {
      // dissolve in a ripple spreading out from the warp, sinking a little as it goes. The water
      // runs on a shared clock (wp-clk), so each particle carries only its positions.
      const d = tMorph - 0.4 + (Math.hypot(x1 - cx0, y1 - cy0) / far) * 1.4;
      const at = (s) => `wp-clk.begin+${r2(s)}s`;
      const ez = ' calcMode="spline" keyTimes="0;1" keySplines=".65 0 .35 1" fill="freeze"';
      parts.push(`<circle r="2.1" fill="url(#${p}-ball)" cx="${Math.round(sx(frames[0][i][0]))}" cy="${Math.round(sy(frames[0][i][1]))}">\
<animate attributeName="cx" values="${frames.map((fr) => Math.round(sx(fr[i][0]))).join(";")}" dur="${tFluid}s" begin="${at(0)}" fill="freeze"/>\
<animate attributeName="cy" values="${frames.map((fr) => Math.round(sy(fr[i][1]))).join(";")}" dur="${tFluid}s" begin="${at(0)}" fill="freeze"/>\
<animate attributeName="cy" values="${Math.round(y1)};${Math.round(y1 + 10)}" dur="1.1s" begin="${at(d)}"${ez}/>\
<animate attributeName="opacity" values="1;0" dur="1.1s" begin="${at(d)}"${ez}/>\
<set attributeName="cx" to="${Math.round(sx(frames[0][i][0]))}" begin="${at(T - 0.9)}"/><set attributeName="cy" to="${Math.round(sy(frames[0][i][1]))}" begin="${at(T - 0.9)}"/>\
<animate attributeName="opacity" values="0;1" dur=".9s" begin="${at(T - 0.9)}"${ez}/></circle>`);
      continue;
    }
    // lift out of the water and arc into the lane, then step down it in lockstep
    const go = tMorph + 0.2 + k * 0.05, arrive = go + 1.7;
    const tx = laneX(k), lift = Math.min(y1, TOP) - 26;
    const bez = (u) => {
      const a = 1 - u;
      return [a ** 3 * x1 + 3 * a * a * u * x1 + 3 * a * u * u * tx + u ** 3 * tx, a ** 3 * y1 + 3 * a * a * u * lift + 3 * a * u * u * lift + u ** 3 * TOP];
    };
    const steps = (axis) => Array.from({ length: L }, (_, it) => [tRun + ((tDone - tRun) * (it + 1)) / L, axis ? TOP + Math.min(it + 1, nsL[k]) * step : tx]);
    const xs = [...fluidKeys(i, 0), [go, x1], [arrive, (u) => bez(u)[0], true], ...steps(0), [T - 0.9, tx], [T - 0.89, sx(frames[0][i][0])], [T, sx(frames[0][i][0])]];
    const ys = [...fluidKeys(i, 1), [go, y1], [arrive, (u) => bez(u)[1], true], ...steps(1), [T - 0.9, BOT], [T - 0.89, sy(frames[0][i][1])], [T, sy(frames[0][i][1])]];
    // idle lanes dim as they finish, then everything fades together
    const idleAt = tRun + ((tDone - tRun) * nsL[k]) / L;
    const op = [[0, 1], [idleAt, 1], [idleAt + 0.35, nsL[k] < L ? 0.3 : 1, true], [tDone + 0.2, nsL[k] < L ? 0.3 : 1], [tDone + 0.5, 1, true], [tOut, 1], [T - 0.9, 0, true], [T, 1, true]];
    parts.push(`<circle r="2.6" fill="url(#${p}-warm)">${animT("cx", xs)}${animT("cy", ys)}${animT("opacity", op, r2)}</circle>`);
  }
  // the kernel radius of the busiest particle, 2h, opening out and closing again
  const probe = lanes[nsL.indexOf(L)];
  const [px, py] = last[probe];
  const kernel = `<circle cx="${r1(sx(px))}" cy="${r1(sy(py))}" r="0" fill="${K.warm}" fill-opacity=".08" stroke="${K.warm}" stroke-width=".9">${animT("r", [[0, 0], [tKernel, 0], [tKernel + 1, 2 * h * S, true], [tMorph, 2 * h * S], [tMorph + 0.8, 0, true], [T, 0]])}</circle>`;
  const tank = `<g>${animT("opacity", [[0, 1], [tMorph, 1], [tMorph + 1.2, 0, true], [T - 0.9, 0], [T, 1, true]], r2)}
<path d="M ${sx(0) - 2} ${sy(0.95)} V ${FLOOR + 2} H ${sx(1.6) + 2} V ${sy(0.95)}" fill="none" stroke="${K.line}" stroke-width="1.2"/>
<rect x="${sx(0.9)}" y="${sy(0.12)}" width="${0.12 * S}" height="${0.12 * S}" fill="${K.line}" fill-opacity=".5"/></g>`;
  const len = BOT - TOP;
  const rods = lanes.map((_, k) => {
    const arrive = tMorph + 0.2 + k * 0.05 + 1.7;
    return `<line x1="${r1(laneX(k))}" y1="${TOP}" x2="${r1(laneX(k))}" y2="${BOT}" stroke="${K.line}" stroke-width=".7" stroke-opacity=".6" stroke-dasharray="${len}">${animT("stroke-dashoffset", [[0, len], [arrive - 0.3, len], [arrive + 0.6, 0, true], [tOut, 0], [T - 0.9, len, true], [T, len]])}</line>
<line x1="${r1(laneX(k) - 3)}" y1="${r1(TOP + nsL[k] * step)}" x2="${r1(laneX(k) + 3)}" y2="${r1(TOP + nsL[k] * step)}" stroke="${K.warm}" stroke-width="1">${animT("opacity", [[0, 0], [arrive, 0], [arrive + 0.6, 1, true], [tOut, 1], [T - 0.9, 0, true], [T, 0]], r2)}</line>`;
  }).join("");
  const say = (a, b, s, first = false) => `<text x="20" y="22" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85">${animT("opacity", first ? [[0, 1], [b - 0.5, 1], [b + 0.3, 0, true], [T - 0.7, 0], [T, 1, true]] : [[0, 0], [a - 0.3, 0], [a + 0.5, 1, true], [b - 0.5, 1], [b + 0.3, 0, true], [T, 0]], r2)}${s}</text>`;
  const body = `<rect width="0" height="0"><animate id="wp-clk" attributeName="x" values="0;0" dur="${T}s" begin="0s;wp-clk.end"/></rect>
${tank}${rods}${kernel}${parts.join("")}
${say(0, tKernel, "SPH DAM BREAK · 5× SLOWER", true)}
${say(tKernel, tMorph + 1.4, "ONE WARP: 32 PARTICLES, 32 THREADS")}
${say(tMorph + 1.4, tOut, `LOCKSTEP · ${L} STEPS · ${busy.toFixed(1)} OF 32 LANES BUSY`)}`;
  return frame({
    w: W, h: H, p, theme,
    desc: `Warp divergence, from where it comes: an SPH dam break of ${nF} particles plays out; one warp of 32 neighbouring particles lifts out of the water into 32 lanes, each a GPU thread gathering the neighbours inside its kernel radius; their real neighbour counts (${Math.min(...nsL)} to ${L}) become the work, and the warp steps in lockstep for ${L} steps with ${busy.toFixed(1)} of 32 lanes busy on average, the rest masked off. Measured on a million particles: 33.34% branch efficiency, and still faster, 158.87 against 153.13 GB/s.`,
    defs: `${sphere(`${p}-ball`)}<radialGradient id="${p}-warm" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${K.hot}"/><stop offset="1" stop-color="#7a4f24"/></radialGradient>`,
    body,
    caption: ["Warp divergence", "A third of the efficiency, and still faster · 158.87 vs 153.13 GB/s, 1M particles"],
  });
}

// ---------------------------------------------------------------------------------------------
// 3. p-type dopants in β-Ga₂O₃: the real crystal. Monoclinic C2/m, a = 12.214, b = 3.037,
//    c = 5.798 Å, β = 103.83° (Åhman et al. 1996), two unit cells deep along b, seen nearly down
//    b. Ga(I) sits in oxygen tetrahedra (4 bonds, 1.80–1.84 Å), Ga(II) in octahedra (6 bonds,
//    1.94–2.08 Å). The dopant is tried on one site of each kind in turn, as the study does. The
//    atoms move with room-temperature thermal motion to scale (about 0.1 Å), slowed ~10¹² times.
const GA2O3 = {
  a: 12.214, b: 3.0371, c: 5.7981, beta: (103.83 * Math.PI) / 180,
  sites: { Ga1: [0.0905, 0.7946], Ga2: [0.3414, 0.6857], O1: [0.1674, 0.1011], O2: [0.4957, 0.2553], O3: [0.8286, 0.4363] },
};
function dopants(theme) {
  const K = TH[theme];
  const p = "dp";
  const { a, b, c, beta, sites } = GA2O3;
  const cart = ([fx, fy, fz]) => [fx * a + fz * c * Math.cos(beta), fz * c * Math.sin(beta), fy * b]; // x, up, depth
  // Every gallium inside the box, then every oxygen bonded to one, so each polyhedron is whole.
  const pool = [];
  for (const [kind, [x, z]] of Object.entries(sites))
    for (const [fx, fy, fz] of [[x, 0, z], [-x, 0, -z], [x + 0.5, 0.5, z], [-x + 0.5, 0.5, -z]])
      for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) for (let k = -1; k <= 2; k++) {
        const f = [((fx % 1) + 1) % 1 + i, fy + j, ((fz % 1) + 1) % 1 + k];
        pool.push({ kind, ga: kind.startsWith("Ga"), f, pos: cart(f) });
      }
  const inBox = ({ f }) => f[0] > -0.04 && f[0] < 1.3 && f[1] > -0.01 && f[1] < 1.01 && f[2] > -0.04 && f[2] < 1.04;
  const gas = pool.filter((A) => A.ga && inBox(A));
  const atoms = [...gas, ...pool.filter((A) => !A.ga && gas.some((G) => Math.hypot(...G.pos.map((v, q) => v - A.pos[q])) < 2.15))];
  const dist = (A, B) => Math.hypot(...A.pos.map((v, q) => v - B.pos[q]));
  const bonds = [];
  atoms.forEach((A, i) => atoms.forEach((B, j) => { if (A.ga && !B.ga && dist(A, B) < 2.15) bonds.push([i, j]); }));
  const center = [0, 1, 2].map((q) => atoms.reduce((s, A) => s + A.pos[q], 0) / atoms.length);
  // the two sites, each fully coordinated, nearest the middle
  const cn = (i) => bonds.filter(([g]) => g === i).length;
  const pick = (kind, n) => atoms.map((A, i) => [A, i]).filter(([A, i]) => A.kind === kind && cn(i) === Math.min(n, Math.max(...atoms.map((B, j) => (B.kind === kind ? cn(j) : 0)))))
    .sort((x, y) => Math.hypot(x[0].pos[0] - center[0], x[0].pos[1] - center[1]) - Math.hypot(y[0].pos[0] - center[0], y[0].pos[1] - center[1]))[0][1];
  const siteI = pick("Ga1", 4), siteII = pick("Ga2", 6);
  const cam = camera({ yaw: 0.42, pitch: 0.3, dist: 34, target: center, focal: 520, cx: 210, cy: 96 });
  const P = atoms.map((A) => cam(A.pos));
  const focusD = (P[siteI].d + P[siteII].d) / 2;
  const blurOf = (d) => Math.abs(d - focusD) * 0.45;

  // The choreography, in seconds.
  const T = 22;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  const springy = (u) => 1 - Math.exp(-6 * u) * Math.cos(9 * u); // settles with one small overshoot
  const track = (keys, n = 14) => {
    const out = [];
    for (const [tt, v, fn] of keys) {
      if (fn && out.length) {
        const [t0, v0] = out.at(-1);
        for (let k = 1; k <= n; k++) {
          const u = k / n, w = (fn === true ? ease : fn)(u);
          out.push([t0 + (tt - t0) * u, Array.isArray(v) ? v.map((x, q) => v0[q] + (x - v0[q]) * w) : v0 + (v - v0) * w]);
        }
      } else out.push([tt, v]);
    }
    if (out.at(-1)[0] < T) out.push([T, out.at(-1)[1]]);
    return out;
  };
  const sm = (attr, keys, fmt = r1, n) => {
    const kk = track(keys, n);
    return `<animate attributeName="${attr}" values="${kk.map(([, v]) => (Array.isArray(v) ? v.map(fmt).join(" ") : fmt(v))).join(";")}" keyTimes="${kk.map(([tt]) => +(tt / T).toFixed(4)).join(";")}" dur="${T}s" repeatCount="indefinite"/>`;
  };
  const tIn = 1.6, tSet = 3.2, tMove = 9.6, tSet2 = 11.8, tOutS = 19, tOut = 21;
  const up = (i, h = 1.6) => cam(atoms[i].pos.map((v, q) => (q === 1 ? v + h : v)));
  // the dopant: down into site I, an arc across to site II, up and away
  const A0 = up(siteI, 3), AI = P[siteI], AII = P[siteII];
  const arc = (u) => {
    const m = cam(atoms[siteI].pos.map((v, q) => (atoms[siteI].pos[q] + atoms[siteII].pos[q]) / 2 + (q === 1 ? 2.2 : 0)));
    const x = (1 - u) ** 2 * AI.x + 2 * (1 - u) * u * m.x + u * u * AII.x, y = (1 - u) ** 2 * AI.y + 2 * (1 - u) * u * m.y + u * u * AII.y;
    return [x, y];
  };
  const arcKeys = Array.from({ length: 16 }, (_, k) => {
    const u = ease((k + 1) / 16);
    return [tMove + ((tSet2 - 0.6 - tMove) * (k + 1)) / 16, arc(u)];
  });
  const dop = [[0, [A0.x, A0.y]], [tIn, [A0.x, A0.y]], [tSet, [AI.x, AI.y], springy], [tMove, [AI.x, AI.y]], ...arcKeys, [tSet2, [AII.x, AII.y], springy], [tOutS, [AII.x, AII.y]], [tOut, [up(siteII, 3).x, up(siteII, 3).y], true]];
  const dopX = dop.map(([tt, v, f]) => [tt, typeof v[0] === "number" ? v[0] : v, f]);
  const dopSvg = `<g>${sm("opacity", [[0, 0], [tIn, 0], [tIn + 0.8, 1, true], [tOutS + 0.4, 1], [tOut, 0, true]], r2)}
<circle r="${r1(P[siteI].s * 1.3)}" fill="${K.hot}" opacity=".4" filter="url(#${p}b4)">${sm("cx", dop.map(([tt, v, f]) => [tt, v[0], f]))}${sm("cy", dop.map(([tt, v, f]) => [tt, v[1], f]))}</circle>
<circle r="${r1(P[siteI].s * 0.58)}" fill="url(#${p}-dop)">${sm("cx", dop.map(([tt, v, f]) => [tt, v[0], f]))}${sm("cy", dop.map(([tt, v, f]) => [tt, v[1], f]))}</circle></g>`;

  // a Ga lifting out of its site and returning
  const lift = (i, t0, t1, t2, t3) => {
    const U = up(i);
    return `${sm("cx", [[0, P[i].x], [t0, P[i].x], [t1, U.x, true], [t2, U.x], [t3, P[i].x, true]])}${sm("cy", [[0, P[i].y], [t0, P[i].y], [t1, U.y, true], [t2, U.y], [t3, P[i].y, true]])}${sm("opacity", [[0, 1], [t0, 1], [t1, 0, true], [t2, 0], [t3, 1, true]], r2)}`;
  };
  // neighbours of a site, relaxing outward a little (≈0.08 Å) while the dopant sits there
  const nb = (site) => bonds.filter(([g]) => g === site).map(([, o]) => o);
  const relaxed = (o, site) => cam(atoms[o].pos.map((v, q) => v + ((v - atoms[site].pos[q]) / dist(atoms[o], atoms[site])) * 0.08));
  const moves = new Map();
  for (const [site, t0, t1] of [[siteI, tSet - 0.6, tMove + 0.4], [siteII, tSet2 - 0.6, tOutS + 0.6]]) for (const o of nb(site)) moves.set(o, [site, t0, t1]);
  const posAnim = (o) => {
    if (!moves.has(o)) return "";
    const [site, t0, t1] = moves.get(o), R0 = P[o], R1 = relaxed(o, site);
    return `${sm("cx", [[0, R0.x], [t0, R0.x], [t0 + 1, R1.x, true], [t1, R1.x], [t1 + 0.8, R0.x, true]], r2)}${sm("cy", [[0, R0.y], [t0, R0.y], [t0 + 1, R1.y, true], [t1, R1.y], [t1 + 0.8, R0.y, true]], r2)}`;
  };

  // thermal motion: each atom on its own small, slow loop (CSS), to scale (≈0.1 Å)
  const R = rng(29);
  const shake = Array.from({ length: 6 }, (_, k) => `@keyframes j${k} { ${Array.from({ length: 5 }, (_, q) => `${q * 25}% { transform: translate(${q % 4 ? r2((R() - 0.5) * 3) : 0}px, ${q % 4 ? r2((R() - 0.5) * 3) : 0}px) }`).join(" ")} } .j${k} { animation: j${k} ${(2.6 + k * 0.4).toFixed(1)}s ease-in-out infinite; }`).join("\n");
  const order = atoms.map((_, i) => i).sort((x, y) => P[y].d - P[x].d);
  const atomSvg = order.map((i) => {
    const A = atoms[i];
    const fill = A.kind === "Ga1" ? `${p}-ga1` : A.kind === "Ga2" ? `${p}-ga2` : `${p}-o`;
    const extra = i === siteI ? lift(i, tIn - 0.4, tSet - 0.6, tMove, tMove + 1.2) : i === siteII ? lift(i, tMove + 0.6, tSet2 - 0.6, tOutS, tOut) : posAnim(i);
    return `<g class="j${i % 6}"><circle cx="${r1(P[i].x)}" cy="${r1(P[i].y)}" r="${r1(P[i].s * (A.ga ? 0.5 : 0.36))}" fill="url(#${fill})"${dof(p, blurOf(P[i].d))}>${extra}</circle></g>`;
  }).join("");
  const bondSvg = bonds.filter(([g]) => g !== siteI && g !== siteII).map(([i, j]) => `<line x1="${r1(P[i].x)}" y1="${r1(P[i].y)}" x2="${r1(P[j].x)}" y2="${r1(P[j].y)}" stroke="${K.steel}" stroke-width=".9" stroke-opacity=".5"${dof(p, blurOf((P[i].d + P[j].d) / 2))}/>`).join("");
  // the site's own bonds: steel while Ga holds it; warm, drawn in, while the dopant does
  const siteBonds = (site, tA, tB, tC, tD) => nb(site).map((o) => {
    const L = Math.hypot(P[o].x - P[site].x, P[o].y - P[site].y);
    return `<line x1="${r1(P[site].x)}" y1="${r1(P[site].y)}" x2="${r1(P[o].x)}" y2="${r1(P[o].y)}" stroke="${K.steel}" stroke-width=".9" stroke-opacity=".5">${sm("opacity", [[0, 1], [tA - 0.6, 1], [tA, 0, true], [tD, 0], [tD + 0.8, 1, true]], r2)}</line>
<line x1="${r1(P[site].x)}" y1="${r1(P[site].y)}" x2="${r1(P[o].x)}" y2="${r1(P[o].y)}" stroke="${K.warm}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="${r1(L)}">${sm("stroke-dashoffset", [[0, L], [tB, L], [tB + 0.9, 0, true], [tC, 0], [tC + 0.7, L, true]])}</line>`;
  }).join("");
  // the coordination polyhedron: the faces of the hull of the site's oxygens
  const hull = (site) => {
    const v = nb(site), faces = [];
    for (let x = 0; x < v.length; x++) for (let y = x + 1; y < v.length; y++) for (let z = y + 1; z < v.length; z++) {
      const [A, B, C] = [v[x], v[y], v[z]].map((i) => atoms[i].pos);
      const n = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])];
      const sides = v.filter((i) => ![v[x], v[y], v[z]].includes(i)).map((i) => Math.sign(n.reduce((s, q, k) => s + q * (atoms[i].pos[k] - A[k]), 0)));
      if (sides.every((s) => s >= 0) || sides.every((s) => s <= 0)) faces.push([v[x], v[y], v[z]]);
    }
    return faces;
  };
  const poly = (site, tA, tB) => `<g opacity="0">${sm("opacity", [[0, 0], [tA, 0], [tA + 1, 1, true], [tB, 1], [tB + 0.8, 0, true]], r2)}
${hull(site).map((f) => `<polygon points="${f.map((i) => `${r1(P[i].x)},${r1(P[i].y)}`).join(" ")}" fill="${K.warm}" fill-opacity=".09" stroke="${K.warm}" stroke-opacity=".45" stroke-width=".7" stroke-linejoin="round"/>`).join("")}</g>`;
  const label = (tA, tB, s) => `<text x="${W - 20}" y="26" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85" opacity="0">${sm("opacity", [[0, 0], [tA, 0], [tA + 0.8, 1, true], [tB, 1], [tB + 0.6, 0, true]], r2)}${s}</text>`;
  const body = `<g><animateTransform attributeName="transform" type="scale" values="1;1.07;1" dur="${T}s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" additive="sum"/><animateTransform attributeName="transform" type="translate" values="0 0;-14 -6;0 0" dur="${T}s" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" additive="sum"/>
${bondSvg}
${siteBonds(siteI, tSet - 0.8, tSet, tMove, tMove + 1)}
${siteBonds(siteII, tSet2 - 0.8, tSet2, tOutS, tOut)}
${poly(siteI, tSet + 0.4, tMove - 0.2)}
${poly(siteII, tSet2 + 0.4, tOutS)}
${atomSvg}
${dopSvg}
</g>
${label(tSet, tMove, "DOPANT ON Ga(I) · TETRAHEDRAL · 4 O")}
${label(tSet2, tOutS, "DOPANT ON Ga(II) · OCTAHEDRAL · 6 O")}`;
  return frame({
    w: W, h: H, p, theme,
    desc: "p-type dopants in beta-Ga2O3: the real monoclinic crystal in thermal motion. A gallium lifts out of a tetrahedral Ga(I) site and a dopant settles into it, its four bonds drawing in and the oxygen tetrahedron lighting up as the neighbours relax; then the dopant arcs across to an octahedral Ga(II) site and does the same with six. Graph neural networks over the defect's real structure; abstract under review at IIM ATM 2026.",
    defs: `<style>${shake} @media (prefers-reduced-motion: reduce) { ${Array.from({ length: 6 }, (_, k) => `.j${k}`).join(", ")} { animation: none } }</style>${sphere(`${p}-ga1`)}${sphere(`${p}-ga2`, "#9aa1a9")}${sphere(`${p}-o`, "#c98f7a")}<radialGradient id="${p}-dop" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${K.hot}"/><stop offset=".85" stop-color="${K.warm}"/><stop offset="1" stop-color="#6a4520"/></radialGradient>`,
    body,
    caption: ["p-type dopants in β-Ga₂O₃", "Teaching a network the shape of a defect · under review, IIM ATM 2026"],
  });
}

// ---------------------------------------------------------------------------------------------
// 4. NodeGuard: a transaction graph relaxed in 3D under springs and repulsion, the camera
//    circling it. The fraud ring is the knot that holds together, warm.
function graph(theme) {
  const K = TH[theme];
  const p = "ng";
  const R = rng(17);
  const n = 26;
  const ring = [0, 1, 2, 3, 4];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3], [2, 4]];
  for (let i = 5; i < n; i++) edges.push([i, 5 + Math.floor(R() * (i - 5 || 1))]);
  edges.push([0, 9], [3, 14], [12, 20], [7, 22], [16, 25]);
  const P = Array.from({ length: n }, () => [R() * 4 - 2, R() * 4 - 2, R() * 4 - 2]);
  for (let it = 0; it < 900; it++) {
    const Fz = P.map(() => [0, 0, 0]);
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const d = P[a].map((v, k) => v - P[b][k]);
        const r = Math.max(0.2, Math.hypot(...d));
        const f = 0.9 / (r * r);
        for (let k = 0; k < 3; k++) (Fz[a][k] += (d[k] / r) * f), (Fz[b][k] -= (d[k] / r) * f);
      }
    for (const [a, b] of edges) {
      const inRing = ring.includes(a) && ring.includes(b);
      const rest = inRing ? 0.75 : 1.5;
      const d = P[b].map((v, k) => v - P[a][k]);
      const r = Math.hypot(...d) || 1e-6;
      const f = (inRing ? 1.4 : 0.5) * (r - rest);
      for (let k = 0; k < 3; k++) (Fz[a][k] += (d[k] / r) * f), (Fz[b][k] -= (d[k] / r) * f);
    }
    for (let a = 0; a < n; a++) for (let k = 0; k < 3; k++) P[a][k] += 0.02 * (Fz[a][k] - 0.05 * P[a][k]);
  }
  const wt = (a) => (ring.includes(a) ? 4 : 1);
  const c = [0, 1, 2].map((k) => P.reduce((s, q, a) => s + q[k] * wt(a), 0) / P.reduce((s, _, a) => s + wt(a), 0));
  const F = 36, T = 30;
  const frames = [];
  for (let f = 0; f <= F; f++) {
    const cam = camera({ yaw: (2 * Math.PI * f) / F, pitch: 0.35, dist: 17, target: c, focal: 240, cx: 210, cy: 96 });
    frames.push(P.map((q) => cam(q)));
  }
  const dAll = frames.flat().map((q) => q.d);
  const dMin = Math.min(...dAll), dMax = Math.max(...dAll);
  const fog = (d) => r2(1 - 0.75 * ((d - dMin) / (dMax - dMin)));
  const edgeSvg = edges
    .map(([a, b]) => {
      const warm = ring.includes(a) && ring.includes(b);
      return `<line stroke="${warm ? K.warm : K.steel}" stroke-width="${warm ? 1.1 : 0.7}">${anim("x1", frames.map((fr) => fr[a].x), T)}${anim("y1", frames.map((fr) => fr[a].y), T)}${anim("x2", frames.map((fr) => fr[b].x), T)}${anim("y2", frames.map((fr) => fr[b].y), T)}${anim("stroke-opacity", frames.map((fr) => (warm ? 0.8 : 0.4) * fog((fr[a].d + fr[b].d) / 2)), T)}</line>`;
    })
    .join("");
  const nodeSvg = P.map((_, a) => {
    const warm = ring.includes(a);
    return `<circle fill="url(#${p}-${warm ? "warm" : "ball"})">${anim("cx", frames.map((fr) => fr[a].x), T)}${anim("cy", frames.map((fr) => fr[a].y), T)}${anim("r", frames.map((fr) => fr[a].s * (warm ? 0.17 : 0.13)), T)}${anim("opacity", frames.map((fr) => fog(fr[a].d)), T)}</circle>`;
  }).join("");
  const rc = frames.map((fr) => [ring.reduce((s, a) => s + fr[a].x, 0) / 5, ring.reduce((s, a) => s + fr[a].y, 0) / 5]);
  const glow = `<circle r="34" fill="${K.warm}" opacity=".16" filter="url(#${p}b4)">${anim("cx", rc.map((q) => q[0]), T)}${anim("cy", rc.map((q) => q[1]), T)}</circle>`;
  const dust = Array.from({ length: 40 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * (H - 40))}" r="${r1(0.4 + R() * 0.9)}" fill="${K.light}" opacity="${r2(0.05 + R() * 0.15)}"/>`).join("");
  return frame({
    w: W, h: H, p, theme,
    desc: "NodeGuard: a transaction graph relaxed in three dimensions under springs and repulsion, the camera circling it; the fraud ring is the warm knot that holds together. A graph convolutional network that finds fraud rings from network structure.",
    defs: `${sphere(`${p}-ball`)}<radialGradient id="${p}-warm" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${K.hot}"/><stop offset="1" stop-color="#7a4f24"/></radialGradient>`,
    body: `${dust}${glow}${edgeSvg}${nodeSvg}`,
    caption: ["NodeGuard", "Fraud hides in who pays whom · a GCN, checkpointed on F1"],
  });
}

// ---------------------------------------------------------------------------------------------
// 5. Exoplanet habitability: a star through an anamorphic lens, a planet on an eccentric Kepler
//    orbit seen almost edge-on, so it transits; its lit side always faces the star. Top right,
//    the star's light curve, computed: a planet a tenth of the star's radius (k = 0.1) over a
//    limb-darkened star (quadratic, u₁ = 0.40, u₂ = 0.26), a dip of under 1% with a rounded
//    floor. The two are drawn at the sizes that let them be seen, not to scale.
const LD = [0.4, 0.26];
const KR = 0.1;
function blocked(z) {
  // fraction of the star's light hidden by the planet at centre separation z (in stellar radii)
  if (z >= 1 + KR) return 0;
  const I = (r) => 1 - LD[0] * (1 - Math.sqrt(1 - r * r)) - LD[1] * (1 - Math.sqrt(1 - r * r)) ** 2;
  let total = 0, hid = 0;
  const n = 120;
  for (let i = 0; i < n; i++) {
    const r = (i + 0.5) / n, w = I(r) * 2 * Math.PI * r / n;
    total += w;
    // arc of the annulus at radius r that lies inside the planet's disc
    if (z === 0) { if (r < KR) hid += w; continue; }
    const cosA = (r * r + z * z - KR * KR) / (2 * r * z);
    if (cosA <= -1) hid += w;
    else if (cosA < 1) hid += (w * Math.acos(cosA)) / Math.PI;
  }
  return hid / total;
}
function exoplanet(theme) {
  const K = TH[theme];
  const p = "ex";
  const cam = camera({ yaw: 0.25, pitch: 0.075, dist: 9, target: [0, 0, 0], focal: 330, cx: 196, cy: 100 });
  const a = 3.1, e = 0.32, F = 160, T = 12;
  const tilt = -Math.tan(0.075) * 0.8;
  const star = cam([0, 0, 0]);
  const fr = [];
  for (let f = 0; f <= F; f++) {
    const M = (2 * Math.PI * f) / F;
    let E = M;
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    // the orbit tipped so the line of sight passes close to the star's centre: a central transit
    const q = cam([x, tilt * z, z]);
    // Phase: the lit fraction of the disc we see, (1 + cos α)/2, α the star–planet–observer angle.
    const view = q.d - star.d; // positive: planet beyond the star
    const phase = (1 + view / Math.hypot(x, z)) / 2;
    const rr = q.s * 0.17;
    // The light curve is computed for a planet a tenth of the star's radius over a limb-darkened
    // star, whatever size they are drawn: a dip of under 1%.
    const flux = view < 0 ? 1 - blocked(Math.hypot(q.x - star.x, q.y - star.y) / 7.5) : 1;
    fr.push({ ...q, rr, phase, behind: view > 0, flux });
  }
  const R = rng(3);
  const stars = Array.from({ length: 70 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * (H - 30))}" r="${r1(0.3 + R() * 0.8)}" fill="${K.light}" opacity="${r2(0.1 + R() * 0.4)}"/>`).join("");
  const hz = Array.from({ length: 220 }, () => {
    const th = R() * 2 * Math.PI, rad = 2.3 + R() * 1.4;
    const q = cam([rad * Math.cos(th), (R() - 0.5) * 0.3, rad * Math.sin(th)]);
    return `<circle cx="${r1(q.x)}" cy="${r1(q.y)}" r="${r2(0.4 + R() * 0.6)}" fill="${K.warm}" opacity="${r2(0.08 + R() * 0.2)}"/>`;
  }).join("");
  const orbit = Array.from({ length: 73 }, (_, i) => {
    const E = (2 * Math.PI * i) / 72;
    const z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    return cam([a * (Math.cos(E) - e), tilt * z, z]);
  });
  const planet = (behind) => {
    const vis = fr.map((q) => (q.behind === behind ? 1 : 0));
    return `<g opacity="0">${anim("opacity", vis, T, ' calcMode="discrete"')}
  <circle fill="#15171a">${anim("cx", fr.map((q) => q.x), T)}${anim("cy", fr.map((q) => q.y), T)}${anim("r", fr.map((q) => q.rr), T)}</circle>
  <circle fill="url(#${p}-lit)">${anim("cx", fr.map((q) => q.x), T)}${anim("cy", fr.map((q) => q.y), T)}${anim("r", fr.map((q) => q.rr), T)}${anim("opacity", fr.map((q) => 0.25 + 0.75 * q.phase), T)}</circle>
</g>`;
  };
  // The light curve: flux against time, with a cursor riding it.
  const lc = { x: 274, y: 22, w: 126, h: 30 };
  const flux = fr.map((q) => q.flux);
  const depth = 1 - Math.min(...flux);
  const fy = (v) => lc.y + 6 + ((1 - v) / 0.0125) * lc.h; // full height = a 1.25% dip
  const curve = flux.map((v, i) => `${r1(lc.x + (i / F) * lc.w)},${r1(fy(v))}`).join(" ");
  const body = `
${stars}
<polyline points="${pts(orbit)}" fill="none" stroke="${K.steel}" stroke-opacity=".16" stroke-dasharray="1.5 3"/>
${hz}
${planet(true)}
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="44" fill="url(#${p}-glow)"/>
<ellipse cx="${r1(star.x)}" cy="${r1(star.y)}" rx="190" ry="1.3" fill="url(#${p}-flare)">${anim("opacity", [0.75, 0.6, 0.8, 0.7, 0.75], 3.1)}</ellipse>
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="7.5" fill="#fff8ee"/>
${planet(false)}
<g font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${K.mute}">
  <text x="${lc.x}" y="${lc.y - 6}">STELLAR FLUX · ${(depth * 100).toFixed(2)}% DIP</text>
  <polyline points="${curve}" fill="none" stroke="${K.light}" stroke-opacity=".7" stroke-width=".8"/>
  <circle r="1.8" fill="${K.warm}">${anim("cx", flux.map((_, i) => lc.x + (i / F) * lc.w), T)}${anim("cy", flux.map(fy), T)}</circle>
</g>`;
  return frame({
    w: W, h: H, p, theme,
    desc: "Exoplanet habitability: a star seen through an anamorphic lens and a planet on an eccentric Kepler orbit, nearly edge-on, transiting the star; a dust ring marks the habitable zone, and the star's light curve dips during the transit. Do habitability indices reduce to a few physical quantities?",
    defs: `<radialGradient id="${p}-glow"><stop offset="0" stop-color="${K.hot}" stop-opacity=".9"/><stop offset=".2" stop-color="${K.warm}" stop-opacity=".45"/><stop offset="1" stop-color="${K.warm}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-flare" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2df"/><stop offset=".4" stop-color="#cfe0ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-lit" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9c3a5"/><stop offset=".7" stop-color="#7d6a55"/><stop offset="1" stop-color="#2a241e"/></radialGradient>`,
    body,
    caption: ["Exoplanet habitability", "Is a habitable world a few numbers, or many? · independent study"],
  });
}

// ---------------------------------------------------------------------------------------------
// 6. RISC-V specification database: a split-flap board spelling out instruction words bit by
//    bit, each flap falling under gravity, the fields bracketed beneath; reflected in the desk.
function riscv(theme) {
  const K = TH[theme];
  const p = "rv";
  const words = [
    { asm: "add  x5, x6, x7", bits: "0000000" + "00111" + "00110" + "000" + "00101" + "0110011", fields: [["funct7", 7], ["rs2", 5], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
    { asm: "lw   x10, 8(x2)", bits: "000000001000" + "00010" + "010" + "01010" + "0000011", fields: [["imm[11:0]", 12], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
    { asm: "addi x1, x0, 42", bits: "000000101010" + "00000" + "000" + "00001" + "0010011", fields: [["imm[11:0]", 12], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
  ];
  // first the fetch (0–O s), then the decoder spells out the three words, 3 s each
  const O = 5.6, per = 3, T = O + per * words.length, CW = 9.6, CH = 24, X0 = 34, Y0 = 70;
  const cells = [];
  for (let b = 0; b < 32; b++) {
    const x = X0 + b * (CW + 1.3);
    const ks = [0], sy = [1];
    const zero = [], one = [], dk = [0];
    // the board takes over showing the first word, as the register held it; then it flips
    words.forEach((w, n) => {
      if (n === 0) return;
      const t0 = O + n * per + b * 0.025;
      // the flap falls, accelerating, then slaps down and settles
      const seq = [[0, 1], [0.06, 0.82], [0.1, 0.45], [0.13, 0], [0.16, -0.0], [0.19, 0.92], [0.22, 1.04], [0.26, 1]];
      for (const [dt, v] of seq) ks.push((t0 + dt) / T), sy.push(v);
      dk.push((t0 + 0.13) / T);
      zero.push(w.bits[b] === "0" ? 1 : 0);
      one.push(w.bits[b] === "1" ? 1 : 0);
    });
    ks.push(1), sy.push(1);
    const firstBit = words[0].bits[b];
    const dv = (arr) => [firstBit === (arr === zero ? "0" : "1") ? 1 : 0, ...arr].join(";");
    const cx = x + CW / 2, cy = Y0 + CH / 2;
    cells.push(`<g>
  <rect x="${r1(x)}" y="${Y0}" width="${CW}" height="${CH}" rx="1.4" fill="url(#${p}-flap)"/>
  <g transform="translate(${r1(cx)} ${cy})"><g><animateTransform attributeName="transform" type="scale" values="${sy.map((v) => `1 ${r2(v)}`).join(";")}"${kt(ks)} dur="${T}s" repeatCount="indefinite"/>
    <text x="0" y="5" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="#efebe3"><animate attributeName="opacity" values="${dv(zero)}"${kt(dk)} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>0</text>
    <text x="0" y="5" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="#e3b072"><animate attributeName="opacity" values="${dv(one)}"${kt(dk)} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>1</text>
  </g></g>
  <line x1="${r1(x)}" y1="${cy}" x2="${r1(x + CW)}" y2="${cy}" stroke="#000" stroke-opacity=".8" stroke-width=".7"/>
</g>`);
  }
  const fieldSets = words.map((w, n) => {
    let b = 0;
    const brackets = w.fields
      .map(([name, len]) => {
        const x1 = X0 + b * (CW + 1.3) + 1, x2 = X0 + (b + len) * (CW + 1.3) - 2.3;
        b += len;
        return `<path d="M ${r1(x1)} ${Y0 + CH + 6} v 4 H ${r1(x2)} v -4" fill="none" stroke="${K.mute}" stroke-width=".7"/><text x="${r1((x1 + x2) / 2)}" y="${Y0 + CH + 22}" text-anchor="middle" font-family="${MONO}" font-size="8.5" fill="${K.mute}">${esc(name)}</text>`;
      })
      .join("");
    const vis = words.map((_, k) => (k === n ? 1 : 0));
    const ks = words.map((_, k) => (O + k * per + (k ? 0.13 : 0)) / T);
    return `<g opacity="0"><animate attributeName="opacity" values="${[n === 0 ? 1 : 0, ...vis].join(";")}"${kt([0, ...ks])} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>
${brackets}
<text x="${X0}" y="${Y0 - 14}" font-family="${MONO}" font-size="12" fill="${K.warm}">${esc(w.asm)}</text>
<text x="${X0 + 32 * (CW + 1.3) - 1.3}" y="${Y0 - 14}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${K.mute}">0x${parseInt(w.bits, 2).toString(16).toUpperCase().padStart(8, "0")}</text></g>`;
  });
  // The fetch: instruction memory sends 32 bits down 32 parallel wires into the core's
  // instruction register, all arriving together; ones as current, zeros as none.
  const first = words[0].bits;
  const k = (x) => (x / T).toFixed(4);
  const cellX = (b) => X0 + b * (CW + 1.3);
  const MEM = { x: 120, y: 8, w: 180, h: 22 };
  const wires = Array.from({ length: 32 }, (_, b) => {
    const x = cellX(b) + CW / 2, mx = MEM.x + 8 + (b / 31) * (MEM.w - 16);
    const path = `M ${r1(mx)} ${MEM.y + MEM.h} C ${r1(mx)} ${MEM.y + MEM.h + 14}, ${r1(x)} ${Y0 - 26}, ${r1(x)} ${Y0 - 2}`;
    const one = first[b] === "1";
    // after the bits arrive, the wire itself drains down into the register
    return `<path d="${path}" fill="none" stroke="${K.line}" stroke-width=".6" stroke-opacity=".7" stroke-dasharray="140 140"><animate attributeName="stroke-dashoffset" values="0;0;-140;-140" keyTimes="0;${k(3.1 + b * 0.012)};${k(4.4 + b * 0.012)};1" calcMode="spline" keySplines="0 0 1 1;.65 0 .35 1;0 0 1 1" dur="${T}s" repeatCount="indefinite"/></path>
<circle r="${one ? 1.9 : 1.1}" fill="${one ? K.warm : K.line}" opacity="0"><animateMotion path="${path}" dur="${T}s" keyPoints="0;0;1;1" keyTimes="0;${k(1.2 + b * 0.004)};${k(2.4 + b * 0.004)};1" calcMode="linear" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${k(1.15)};${k(1.25)};${k(2.4)};${k(2.5)};1" dur="${T}s" repeatCount="indefinite"/></circle>`;
  }).join("");
  const latched = Array.from({ length: 32 }, (_, b) => `<rect x="${r1(cellX(b))}" y="${Y0}" width="${CW}" height="${CH}" rx="1.4" fill="url(#${p}-flap)"/><text x="${r1(cellX(b) + CW / 2)}" y="${Y0 + CH / 2 + 5}" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="${first[b] === "1" ? "#e3b072" : "#efebe3"}" opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${k(2.5)};${k(2.55)};1" dur="${T}s" repeatCount="indefinite"/>${first[b]}</text>`).join("");
  // eased fades: in from the loop's end, out as the decoder takes over
  const ez = (vals, times) => `values="${vals}" keyTimes="${times.map(k).join(";")}" calcMode="spline" keySplines="${times.slice(1).map(() => ".65 0 .35 1").join(";")}" dur="${T}s" repeatCount="indefinite"`;
  const BW = 32 * (CW + 1.3) + 14;
  const fetch = `<g>
<g><animate attributeName="opacity" ${ez("1;1;0;0;1", [0, 3.6, 4.6, T - 0.8, T])}/><animateTransform attributeName="transform" type="translate" ${ez("0 0;0 0;0 -8;0 -8;0 0", [0, 3.6, 4.6, T - 0.8, T])}/>
<rect x="${MEM.x}" y="${MEM.y}" width="${MEM.w}" height="${MEM.h}" rx="2" fill="url(#${p}-flap)" stroke="${K.line}" stroke-width=".6"/>
${Array.from({ length: 14 }, (_, i) => `<line x1="${MEM.x + 8 + i * 12.6}" y1="${MEM.y - 3}" x2="${MEM.x + 8 + i * 12.6}" y2="${MEM.y}" stroke="${K.line}"/>`).join("")}
<text x="${MEM.x + MEM.w / 2}" y="${MEM.y + 14.5}" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="1" fill="#c9c4bb">INSTRUCTION MEMORY · PC 0x0</text></g>
<g><animate attributeName="opacity" ${ez("1;1;0;0;1", [0, 4.4, 4.9, T - 0.8, T])}/>${wires}</g>
<rect x="${X0 - 8}" y="${Y0 - 8}" width="${BW}" height="${CH + 16}" rx="3" fill="none" stroke="${K.line}" stroke-width=".8">
  <animate attributeName="x" ${ez(`${X0 - 8};${X0 - 8};${X0 - 1.5};${X0 - 1.5};${X0 - 8}`, [0, 4.2, O, T - 0.8, T])}/><animate attributeName="width" ${ez(`${BW};${BW};${BW - 13};${BW - 13};${BW}`, [0, 4.2, O, T - 0.8, T])}/>
  <animate attributeName="y" ${ez(`${Y0 - 8};${Y0 - 8};${Y0 - 1.5};${Y0 - 1.5};${Y0 - 8}`, [0, 4.2, O, T - 0.8, T])}/><animate attributeName="height" ${ez(`${CH + 16};${CH + 16};${CH + 3};${CH + 3};${CH + 16}`, [0, 4.2, O, T - 0.8, T])}/>
  <animate attributeName="opacity" ${ez("1;1;0;0;1", [0, O - 0.3, O + 0.3, T - 0.8, T])}/></rect>
<g><animate attributeName="opacity" ${ez("1;1;0;0;1", [0, 3.8, 4.6, T - 0.8, T])}/>
${Array.from({ length: 24 }, (_, i) => `<line x1="${X0 - 2 + i * 15}" y1="${Y0 + CH + 8}" x2="${X0 - 2 + i * 15}" y2="${Y0 + CH + 12}" stroke="${K.line}"/>`).join("")}
<text x="${X0 - 8}" y="${Y0 + CH + 26}" font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${K.mute}">RV32I CORE · INSTRUCTION REGISTER</text>
<text x="20" y="${H - 58}" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85">FETCH: 32 BITS OVER 32 WIRES, ALL AT ONCE</text></g>
<g><animate attributeName="opacity" ${ez("1;1;0;0;1", [0, O, O + 0.05, T - 0.8, T])}/>${latched}</g>
</g>`;
  return frame({
    w: W, h: H, p, theme,
    desc: "RISC-V specification database: a split-flap board spelling out add, lw and addi as 32-bit instruction words, flap by flap, with the fields of each bracketed beneath and the board reflected in the desk. A pipeline that loads 1,700+ YAML specification files into PostgreSQL.",
    defs: `<linearGradient id="${p}-flap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b3b3e"/><stop offset=".49" stop-color="#28282b"/><stop offset=".51" stop-color="#1c1c1e"/><stop offset="1" stop-color="#2c2c2f"/></linearGradient>
<linearGradient id="${p}-rf" x1="0" x2="0" y1="${Y0 + CH}" y2="${Y0 + CH + 30}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="${p}-rm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect y="${Y0 + CH}" width="${W}" height="40" fill="url(#${p}-rf)"/></mask>`,
    body: `${fetch}<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${((O - 0.05) / T).toFixed(4)};${(O / T).toFixed(4)};${((T - 0.8) / T).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/>
<g id="${p}-board">${cells.join("")}</g>
<g mask="url(#${p}-rm)"><g transform="translate(0 ${2 * (Y0 + CH) + 2}) scale(1 -1)" opacity=".35" filter="url(#${p}b2)"><use href="#${p}-board"/></g></g>
${fieldSets.join("")}</g>`,
    caption: ["RISC-V specification database", "A specification made queryable · 1,700+ files, 1,351 instructions, 396 CSRs"],
  });
}

export const SHOTS = [
  { id: "sgemm", href: "https://github.com/SatnamCodes/matmul", draw: sgemm },
  { id: "dopants", href: "https://satnamwanders.dev/research/p-type-dopants-in-beta-ga2o3", draw: dopants },
  { id: "warp", href: "https://github.com/SatnamCodes/gpu-neighbor-gather-divergence", draw: warp },
  { id: "nodeguard", href: "https://satnamwanders.dev/projects/nodeguard", draw: graph },
  { id: "riscv", href: "https://satnamwanders.dev/projects/risc-v-knowledge-db", draw: riscv },
  { id: "exoplanets", href: "https://satnamwanders.dev", draw: exoplanet },
];

// ---------------------------------------------------------------------------------------------
// 7. The year: a city, a block a day, its height the day's contributions. Seen from the near
//    end, today, the past recedes into haze and out of focus. The blocks rise on springs, the
//    oldest first; the fortnight the top is measured on is lit from inside.

export function city(days, theme) {
  const K = TH[theme];
  const p = "cy";
  const CWd = 840, CHt = 300;
  const dates = Object.keys(days).sort();
  const last = new Date(`${dates.at(-1)}T00:00:00Z`);
  const end = last.getUTCDay();
  const total = 52 * 7 + end + 1;
  const cells = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - (total - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    cells.push({ n: days[iso] ?? 0, w: Math.floor(i / 7), r: i % 7, recent: i >= total - 14 });
  }
  const sum = cells.reduce((s, c) => s + c.n, 0);
  const active = cells.filter((c) => c.n > 0).length;
  let run = 0, best = 0;
  for (const c of cells) best = Math.max(best, (run = c.n > 0 ? run + 1 : 0));

  const cam = camera({ yaw: -0.5, pitch: 0.48, dist: 60, target: [30, 2, 3.5], focal: 820, cx: 372, cy: 146 });
  const S = 0.78;
  const hOf = (n) => (n ? 0.4 + Math.sqrt(n) * 1.15 : 0.06);
  const blocks = cells.map((c) => {
    const x = c.w, z = c.r, h = hOf(c.n);
    const P = (dx, y, dz) => cam([x + dx, y, z + dz]);
    const b = [P(0, 0, 0), P(S, 0, 0), P(S, 0, S), P(0, 0, S)];
    const tp = [P(0, h, 0), P(S, h, 0), P(S, h, S), P(0, h, S)];
    return { c, b, tp, d: cam([x + S / 2, 0, z + S / 2]).d, base: cam([x + S / 2, 0, z + S / 2]) };
  });
  const dMin = Math.min(...blocks.map((q) => q.d)), dMax = Math.max(...blocks.map((q) => q.d));
  const sp = spring(0.3, 13, 26, 1);
  const kf = sp.map(([k, v]) => `${+(k * 100).toFixed(1)}% { transform: scaleY(${r2(v)}) }`).join(" ");
  blocks.sort((a, b) => b.d - a.d);
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const groups = [[], [], [], []];
  for (const q of blocks) {
    const far = (q.d - dMin) / (dMax - dMin); // 0 near, 1 far
    const haze = 1 - far * 0.55;
    const lit = q.c.recent && q.c.n > 0;
    const [tf, sf, ff] = q.c.n ? K.face : K.empty;
    const topC = q.c.n && lit ? K.hot : tf;
    const sideC = q.c.n && lit ? K.warm : sf;
    const frontC = q.c.n && lit ? shade(K.warm.length === 7 ? K.warm : "#b07a3c", 0.75) : ff;
    // visible faces from this camera: the top, the +z side and the -x side
    const [b0, b1, b2, b3] = q.b, [t0, t1, t2, t3] = q.tp;
    const delay = (q.c.w * 0.045 + q.c.r * 0.02).toFixed(2);
    const g = `<g class="rise" style="animation-delay:${delay}s;transform-origin:${r1(q.base.x)}px ${r1(q.base.y)}px" opacity="${r2(haze)}">
<polygon points="${pts([b3, b2, t2, t3])}" fill="${frontC}"/><polygon points="${pts([b0, b3, t3, t0])}" fill="${sideC}"/><polygon points="${pts(q.tp)}" fill="${topC}"/>${lit ? `<polygon points="${pts(q.tp)}" fill="${K.hot}" filter="url(#${p}b4)" opacity=".8"/>` : ""}
</g>`;
    groups[Math.min(3, Math.floor(far * 4))].push(g);
  }
  const body = `
${groups.map((gs, i) => `<g${dof(p, [0, 0.4, 1.2, 2.2][i])}>${gs.join("")}</g>`).reverse().join("")}
<text x="20" y="28" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".8">A BLOCK A DAY, AS TALL AS THAT DAY'S WORK</text>
<text x="${CWd - 20}" y="28" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.warm}">LIT: THE FORTNIGHT THE TOP IS MEASURED ON</text>`;
  return frame({
    w: CWd, h: CHt, p, theme,
    desc: `The last year of contributions as a city, a block a day, its height that day's contributions; the past recedes into haze, and the last fourteen days are lit. ${sum} contributions on ${active} days, the longest run ${best} days.`,
    defs: `<style>.rise { transform-box: view-box; animation: rise 1.4s linear both; } @keyframes rise { 0% { transform: scaleY(0) } ${kf} } @media (prefers-reduced-motion: reduce) { .rise { animation: none } }</style>`,
    body,
    caption: ["The year", `${sum.toLocaleString("en-US")} contributions across ${active} days · the longest unbroken run, ${best}`],
  });
}

// The year, flat: the same calendar as a square a day, for those who read it faster that way.
export function heatmap(days, theme) {
  const K = TH[theme];
  const t = { accent: K.warm, faint: K.dim, glow: K.hot, mute: K.mute };
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
  const kf = drop.map(([k, y]) => `${+(k * 100).toFixed(2)}% { transform: translateY(${r1(-y * 70)}px); opacity: ${k < 0.05 ? r1(k * 20) : 1} }`).join(" ");

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
// 8. The kit: what I work with, as a spec sheet in four columns. Each tool has a small line
//    drawing of the work it does, moving: a GPU's warps lighting up, a loss curve with a ball
//    rolling to its minimum, a query sweeping a table. The rows come in on springs.

const L = (K, d, o = "", inner = "") => `<path d="${d}" fill="none" stroke="${K.light}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"${o}>${inner}</path>`;
const A = (K, d, o = "", inner = "") => `<path d="${d}" fill="none" stroke="${K.warm}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${o}>${inner}</path>`;
const loop = (attr, values, dur, ks) => `<animate attributeName="${attr}" values="${values}" dur="${dur}s" repeatCount="indefinite"${ks ? ` keyTimes="${ks}"` : ""}/>`;
const dot = (K, x, y, r = 1.6, warm = false, inner = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${warm ? K.warm : K.light}">${inner}</circle>`;

const ICONS = {
  // two interlocking halves, trading the light
  python: (K) => `${L(K, "M12 3.5h-2.5a3 3 0 0 0-3 3V9h6M6.5 9H5a2.5 2.5 0 0 0-2.5 2.5v2A2.5 2.5 0 0 0 5 16h1.5", ' opacity=".9"')}
${A(K, "M12 20.5h2.5a3 3 0 0 0 3-3V15h-6M17.5 15H19a2.5 2.5 0 0 0 2.5-2.5v-2A2.5 2.5 0 0 0 19 8h-1.5", ``, loop("opacity", "1;.35;1", 3))}
${dot(K, 9.5, 6.2, 0.9)}${dot(K, 14.5, 17.8, 0.9, true)}`,
  cpp: (K) => `${L(K, "M12.5 7.2A5.8 5.8 0 1 0 12.5 16.8")}${A(K, "M14.5 12h4M16.5 10v4M19 12h4M21 10v4", ``, loop("opacity", "1;.3;1", 2.2))}`,
  c: (K) => `${L(K, "M17 6.8A7 7 0 1 0 17 17.2", ` stroke-dasharray="32" stroke-dashoffset="32"`, loop("stroke-dashoffset", "32;0;0;32", 4, "0;.35;.85;1"))}`,
  // a chip whose 4x4 warps light in a wave
  cuda: (K) => `${L(K, "M5 5h14v14H5zM8 2.5V5M12 2.5V5M16 2.5V5M8 19v2.5M12 19v2.5M16 19v2.5M2.5 8H5M2.5 12H5M2.5 16H5M19 8h2.5M19 12h2.5M19 16h2.5")}
${[0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].map((j) => `<rect x="${6.6 + j * 2.8}" y="${6.6 + i * 2.8}" width="2" height="2" fill="${K.warm}" opacity=".15">${loop("opacity", ".15;1;.15;.15", 1.6, `0;${((i + j) * 0.06).toFixed(2)};${((i + j) * 0.06 + 0.2).toFixed(2)};1`)}</rect>`)).join("")}`,
  // a database filling
  sql: (K) => `${L(K, "M5 6.5c0-1.6 3.1-2.8 7-2.8s7 1.2 7 2.8v11c0 1.6-3.1 2.8-7 2.8s-7-1.2-7-2.8z")}${L(K, "M5 6.5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8")}
${A(K, "M5 13c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8", ``, loop("d", "M5 17.5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8;M5 10c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8;M5 17.5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8", 3.4))}`,
  // three timeline lanes scrolling past
  nsys: (K) => `${L(K, "M3 4v16")}<clipPath id="kt-ns"><rect x="4" y="3" width="17" height="18"/></clipPath><g clip-path="url(#kt-ns)"><g><animateTransform attributeName="transform" type="translate" values="0 0;-12 0" dur="2.4s" repeatCount="indefinite"/>
${[[6, 0, 5], [6, 8, 3], [6, 14, 6], [11, 2, 7], [11, 12, 4], [11, 19, 6], [16, 1, 3], [16, 6, 6], [16, 15, 5]].map(([y, x, w], i) => `<rect x="${5 + x}" y="${y}" width="${w}" height="2.6" rx="1" fill="${i % 4 === 1 ? K.warm : K.light}" opacity="${i % 4 === 1 ? 1 : 0.75}"/><rect x="${17 + x}" y="${y}" width="${w}" height="2.6" rx="1" fill="${i % 4 === 1 ? K.warm : K.light}" opacity="${i % 4 === 1 ? 1 : 0.75}"/>`).join("")}</g></g>`,
  // a gauge whose needle swings up and settles, damped
  ncu: (K) => {
    const sp = spring(0.25, 12, 20, 1).map(([, v]) => (-150 + v * 115).toFixed(1));
    return `${L(K, "M4 17a8 8 0 0 1 16 0")}${L(K, "M6.3 11.3l1 .7M12 9v1.2M17.7 11.3l-1 .7")}
<g transform="translate(12 17)"><line x1="0" y1="0" x2="7" y2="0" stroke="${K.warm}" stroke-width="1.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="${[...sp, ...sp.slice(-1).fill(sp.at(-1)), "-150"].join(";")}" dur="3.2s" repeatCount="indefinite"/></line></g>${dot(K, 12, 17, 1.4)}`;
  },
  // containers stacking, each dropped with a bounce
  docker: (K) => {
    const b = bounce(0.3, 14).map(([, y]) => (-y * 10).toFixed(1));
    const drop = (x, y, d) => `<g><animateTransform attributeName="transform" type="translate" values="${["0 -10", ...b.map((v) => `0 ${v}`), "0 0", "0 0"].join(";")}" keyTimes="${["0", ...b.map((_, i) => (d + (i / (b.length - 1)) * 0.25).toFixed(3)), "0.9", "1"].join(";")}" dur="3.6s" repeatCount="indefinite"/><rect x="${x}" y="${y}" width="6" height="4.5" rx=".6" fill="none" stroke="${K.light}" stroke-width="1.2"/></g>`;
    return `${L(K, "M2.5 19.5h19")}${drop(4, 14.5, 0.0)}${drop(10.5, 14.5, 0.08)}${drop(7.2, 9.5, 0.18)}${A(K, "M14.5 12.5l2-3h3", ' opacity=".9"')}`;
  },
  linux: (K) => `${L(K, "M3 5h18v14H3z")}${L(K, "M6.5 10l2.5 2-2.5 2")}<rect x="11" y="13.2" width="5" height="1.6" fill="${K.warm}">${loop("opacity", "1;1;0;0", 1, "0;.5;.5;1")}</rect>`,
  // a branch leaving main and merging back, a commit travelling along it
  git: (K) => `${L(K, "M6 3v18")}${L(K, "M6 7c0 4 10 2 10 6v1c0 2-4 3-10 4")}${dot(K, 6, 7)}${dot(K, 6, 18)}
<circle r="1.9" fill="${K.warm}"><animateMotion dur="2.6s" repeatCount="indefinite" path="M6 7c0 4 10 2 10 6v1c0 2-4 3-10 4"/></circle>`,
  // a table scanned row by row
  postgres: (K) => `${L(K, "M3.5 5h17v14h-17zM3.5 9h17M9 5v14")}${[0, 1, 2].map((i) => `<rect x="4" y="${9.6 + i * 3.1}" width="16" height="2.6" fill="${K.warm}" opacity="0">${loop("opacity", "0;.75;0;0", 2.4, `0;${(0.1 + i * 0.22).toFixed(2)};${(0.3 + i * 0.22).toFixed(2)};1`)}</rect>`).join("")}`,
  fastapi: (K) => `${L(K, "M12 2.8a9.2 9.2 0 1 0 0 18.4a9.2 9.2 0 1 0 0-18.4")}<path d="M13.2 5.5L8 13h3.6l-1 5.5 5.4-7.6h-3.7z" fill="${K.warm}">${loop("opacity", ".35;1;.35;.35", 2, "0;.1;.3;1")}</path>`,
  // a loss curve, a ball rolling down it and settling in the minimum
  pytorch: (K) => {
    const curve = (x) => 5 + 13 * (1 - Math.exp(-(((x - 15) / 6) ** 2)));
    const xs = spring(0.35, 11, 24, 1).map(([, v]) => 4 + v * 11);
    return `${L(K, Array.from({ length: 19 }, (_, i) => `${i ? "L" : "M"}${3 + i} ${curve(3 + i).toFixed(2)}`).join(" "))}
<circle r="2.2" fill="${K.warm}"><animate attributeName="cx" values="${[...xs, 15, 4].map((v) => v.toFixed(2)).join(";")}" dur="3s" repeatCount="indefinite"/><animate attributeName="cy" values="${[...xs, 15, 4].map((x) => (curve(x) - 2.4).toFixed(2)).join(";")}" dur="3s" repeatCount="indefinite"/></circle>`;
  },
  // a graph passing a message from node to node
  pyg: (K) => {
    const N = [[5, 6], [18, 5], [12, 12], [5, 18], [19, 18]];
    const E = [[0, 2], [1, 2], [2, 3], [2, 4], [0, 3], [1, 4]];
    return `${E.map(([a, b]) => `<line x1="${N[a][0]}" y1="${N[a][1]}" x2="${N[b][0]}" y2="${N[b][1]}" stroke="${K.light}" stroke-width="1" opacity=".7"/>`).join("")}
${N.map(([x, y], i) => dot(K, x, y, 2.1, i === 2, i === 2 ? "" : loop("fill", `${K.light};${K.warm};${K.light};${K.light}`, 2.4, `0;${(0.15 + i * 0.12).toFixed(2)};${(0.3 + i * 0.12).toFixed(2)};1`))).join("")}`;
  },
  // two classes and a decision boundary swinging into place
  sklearn: (K) => {
    const sp = spring(0.3, 10, 16, 1).map(([, v]) => (-60 + v * 60 + 32).toFixed(1));
    return `${[[5, 7], [8, 4.5], [6.5, 11], [9.5, 8.5]].map(([x, y]) => dot(K, x, y, 1.5)).join("")}${[[15, 15], [18, 12], [17, 19], [20, 16]].map(([x, y]) => dot(K, x, y, 1.5, true)).join("")}
<g transform="translate(12 12)"><line x1="-11" y1="0" x2="11" y2="0" stroke="${K.light}" stroke-width="1.2" stroke-dasharray="2 2"><animateTransform attributeName="transform" type="rotate" values="${[...sp, sp.at(-1), "-28"].join(";")}" dur="3.4s" repeatCount="indefinite"/></line></g>`;
  },
  // a tree grown stage by stage, as boosting adds trees
  xgboost: (K) => `${dot(K, 12, 4, 1.8, true)}${[["M12 4L6.5 12", 0], ["M12 4L17.5 12", 0.1], ["M6.5 12L3.5 20", 0.25], ["M6.5 12L9.5 20", 0.32], ["M17.5 12L14.5 20", 0.42], ["M17.5 12L20.5 20", 0.5]].map(([d, k]) => L(K, d, ' stroke-dasharray="10" stroke-dashoffset="10"', loop("stroke-dashoffset", "10;10;0;0;10", 3.2, `0;${k};${k + 0.12};.92;1`))).join("")}`,
  // agents in a cycle, a token going round
  langgraph: (K) => `${L(K, "M12 4.5L19 16.5H5Z", ' stroke-opacity=".7"')}${dot(K, 12, 4.5, 2.4)}${dot(K, 19, 16.5, 2.4)}${dot(K, 5, 16.5, 2.4)}
<circle r="1.6" fill="${K.warm}"><animateMotion dur="2.4s" repeatCount="indefinite" path="M12 4.5L19 16.5H5Z"/></circle>`,
  // a query reaching out for its nearest neighbours
  faiss: (K) => {
    const near = [[14.5, 9], [9.5, 15], [15, 15.5]];
    const far = [[4, 5], [20, 4.5], [21, 19], [3.5, 19]];
    return `${far.map(([x, y]) => dot(K, x, y, 1.4)).join("")}${near.map(([x, y]) => dot(K, x, y, 1.6, false, loop("fill", `${K.light};${K.light};${K.warm};${K.warm};${K.light}`, 2.8, "0;.3;.42;.9;1"))).join("")}
<circle cx="12" cy="12" r="0" fill="none" stroke="${K.warm}" stroke-width="1"><animate attributeName="r" values="0;6.5;6.5;0" keyTimes="0;.4;.9;1" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.8;.3;0" keyTimes="0;.4;.9;1" dur="2.8s" repeatCount="indefinite"/></circle>${dot(K, 12, 12, 2, true)}`;
  },
  script: (ch, font) => (K) => `<text x="12" y="18" text-anchor="middle" font-family="${font}" font-size="17" fill="${K.light}">${ch}</text>${A(K, "M5 21.5h14", ` stroke-dasharray="14" stroke-dashoffset="14"`, loop("stroke-dashoffset", "14;0;0;14", 4, "0;.3;.85;1"))}`,
};

const SHELVES = [
  { label: "Languages", items: [["Python", "research and ML code", "python"], ["C++", "kernels and their hosts", "cpp"], ["C", "systems", "c"], ["CUDA", "SGEMM, warp divergence", "cuda"], ["SQL", "the RISC-V database", "sql"]] },
  { label: "Infrastructure", items: [["Nsight Systems", "timelines", "nsys"], ["Nsight Compute", "kernel profiles", "ncu"], ["Docker", "containers", "docker"], ["Linux", "development", "linux"], ["Git", "version control", "git"], ["PostgreSQL", "1,351 instructions, 8 tables", "postgres"], ["FastAPI", "services", "fastapi"]] },
  { label: "Machine learning", items: [["PyTorch", "training", "pytorch"], ["PyTorch Geometric", "NodeGuard, dopant GNNs", "pyg"], ["scikit-learn", "baselines", "sklearn"], ["XGBoost", "gradient boosting", "xgboost"], ["LangGraph", "multi-agent retrieval", "langgraph"], ["FAISS", "vector search", "faiss"]] },
  { label: "Speaks", items: [["Punjabi", "native", ICONS.script("ਪ", SANS)], ["Hindi", "fluent", ICONS.script("ह", SANS)], ["English", "fluent", ICONS.script("A", "Georgia, serif")]] },
];

function kit(theme) {
  const K = TH[theme];
  const p = "kt";
  const KW = 840, COL = 210, ROW = 42, TOP = 58;
  const KH = TOP + 7 * ROW + 6;
  const sp = spring(0.38, 13, 22, 1);
  const kf = sp.map(([k, v]) => `${+(k * 100).toFixed(1)}% { transform: translateY(${r1((1 - v) * 16)}px); opacity: ${r2(Math.min(1, k * 4))} }`).join(" ");
  let n = 0;
  const cols = SHELVES.map((s, c) => {
    const x = 16 + c * COL;
    const rows = s.items.map(([name, note, icon], i) => {
      const y = TOP + i * ROW;
      const draw = typeof icon === "string" ? ICONS[icon] : icon;
      return `<g class="in" style="animation-delay:${(0.15 + c * 0.12 + i * 0.07).toFixed(2)}s">
  <g transform="translate(${x} ${y})">${draw(K)}</g>
  <text x="${x + 36}" y="${y + 10}" font-family="${SANS}" font-size="13.5" letter-spacing=".3" fill="${K.light}">${esc(name)}</text>
  <text x="${x + 36}" y="${y + 26}" font-family="${BOOK}" font-style="italic" font-weight="500" font-size="13" fill="${K.mute}">${esc(note)}</text>
</g>`;
    });
    n += s.items.length;
    return `<text x="${x}" y="24" font-family="${SANS}" font-size="9.5" letter-spacing="2.4" fill="${K.mute}">${esc(s.label.toUpperCase())}</text>
<line class="rule" x1="${x}" y1="36" x2="${x + COL - 26}" y2="36" stroke="${K.dim}"/>
${rows.join("\n")}`;
  });
  return frame({
    w: KW, h: KH, p, theme,
    desc: `The kit. ${SHELVES.map((s) => `${s.label}: ${s.items.map((it) => `${it[0]} (${it[1]})`).join(", ")}`).join(". ")}.`,
    defs: `<style>.in { animation: in .9s linear both; } @keyframes in { ${kf} } .rule { stroke-dasharray: 190; stroke-dashoffset: 190; animation: rule 1.2s cubic-bezier(.6,0,.2,1) forwards; } @keyframes rule { to { stroke-dashoffset: 0 } } @media (prefers-reduced-motion: reduce) { .in, .rule { animation: none; stroke-dashoffset: 0 } }</style>`,
    body: cols.join("\n"),
  });
}

// ---------------------------------------------------------------------------------------------
// 9. The title card: the name, tracked out, the letters drawing in as the spacing closes, as a
//    film's title does; under it one line to be read slowly, and the four roles.

function title(theme) {
  const K = TH[theme];
  const TW = 840, TH_ = 176;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH_}" viewBox="0 0 ${TW} ${TH_}" role="img" aria-labelledby="tc-t">
<title id="tc-t">Satnam Singh. I build models of physical systems, and the GPU code they run on. Machine learning engineering, AI infrastructure, AI research, software engineering.</title>
<style>
  .name { animation: name 2.6s cubic-bezier(.2,.7,.1,1) both; }
  @keyframes name { from { letter-spacing: 30px; opacity: 0 } to { letter-spacing: 14px; opacity: 1 } }
  .line { animation: fade 1.6s ease-out 1.2s both; } .roles { animation: fade 1.6s ease-out 2s both; }
  .rule { stroke-dasharray: 220; stroke-dashoffset: 220; animation: draw 1.8s cubic-bezier(.6,0,.2,1) .8s forwards; }
  @keyframes fade { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
  @keyframes draw { to { stroke-dashoffset: 0 } }
  @media (prefers-reduced-motion: reduce) { .name, .line, .roles, .rule { animation: none; stroke-dashoffset: 0 } }
</style>
<text class="name" x="${TW / 2 + 7}" y="58" text-anchor="middle" font-family="${SANS}" font-weight="300" font-size="34" letter-spacing="14" fill="${K.light}">SATNAM SINGH</text>
<line class="rule" x1="${TW / 2 - 110}" y1="82" x2="${TW / 2 + 110}" y2="82" stroke="${K.warm}" stroke-width=".8"/>
<text class="line" x="${TW / 2}" y="116" text-anchor="middle" font-family="${BOOK}" font-style="italic" font-weight="500" font-size="21" fill="${K.light}">I build models of physical systems, and the GPU code they run on.</text>
<text class="roles" x="${TW / 2 + 1.5}" y="152" text-anchor="middle" font-family="${SANS}" font-size="10.5" letter-spacing="3" fill="${K.mute}">MACHINE LEARNING  ·  AI INFRASTRUCTURE  ·  AI RESEARCH  ·  SOFTWARE ENGINEERING</text>
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// Link pills: a line icon and a label, for the page itself, so in GitHub's two themes.

const THEMES = { dark: { ink: "#e6edf3", faint: "#30363d" }, light: { ink: "#1f2328", faint: "#d8dee4" } };
const LINK_ICONS = {
  site: (c) => `<circle cx="12" cy="12" r="8.5" fill="none" stroke="${c}" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M3.8 9.2h16.4M3.8 14.8h16.4" stroke="${c}" stroke-width="1.1"/>`,
  linkedin: (c) => `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="${c}" stroke-width="1.3"/><path d="M8 10.5v6M8 7.4v.2M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6 1.4 0 2.1 1 2.1 2.6v3.5" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  x: (c) => `<path d="M5 5l14 14M19 5L5 19" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><path d="M5 5h3.6L19 19h-3.6z" fill="none" stroke="${c}" stroke-width="1.1" stroke-linejoin="round"/>`,
  instagram: (c) => `<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="12" cy="12" r="4" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="16.8" cy="7.2" r=".9" fill="${c}"/>`,
};
export const LINKS = [
  { id: "site", label: "satnamwanders.dev", href: "https://satnamwanders.dev" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/satnamcodes" },
  { id: "x", label: "@gitblamesatnam", href: "https://twitter.com/gitblamesatnam" },
  { id: "instagram", label: "@dontblamesatnam", href: "https://www.instagram.com/dontblamesatnam" },
];
function pill(l, theme) {
  const t = THEMES[theme];
  const w = Math.round(44 + l.label.length * 7.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40" role="img" aria-label="${esc(l.label)}">
<rect x=".5" y=".5" width="${w - 1}" height="39" rx="20" fill="none" stroke="${t.faint}"/>
<g transform="translate(10 8)">${LINK_ICONS[l.id](t.ink)}</g>
<text x="40" y="25" font-family="${SANS}" font-size="13" letter-spacing=".4" fill="${t.ink}">${esc(l.label)}</text>
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const dir of ["shots", "links"]) fs.mkdirSync(path.join(ROOT, "assets", dir), { recursive: true });
  for (const theme of ["dark", "light"]) {
    for (const s of SHOTS) fs.writeFileSync(path.join(ROOT, "assets", "shots", `${s.id}-${theme}.svg`), withFonts(s.draw(theme)));
    fs.writeFileSync(path.join(ROOT, "assets", `kit-${theme}.svg`), withFonts(kit(theme)));
    fs.writeFileSync(path.join(ROOT, "assets", `title-${theme}.svg`), withFonts(title(theme)));
  }
  for (const theme of ["dark", "light"]) for (const l of LINKS) fs.writeFileSync(path.join(ROOT, "assets", "links", `${l.id}-${theme}.svg`), withFonts(pill(l, theme)));
  console.log(`[shots] ${SHOTS.length} shots, the kit and ${LINKS.length} links written`);
}
