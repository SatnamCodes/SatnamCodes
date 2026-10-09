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
// 1. Custom SGEMM: C = A·B as a room of three walls. A is on the left wall, B on the back wall,
//    C on the floor. Tile by tile, a strip of A and a strip of B light up and C's tile fills.
function sgemm(theme) {
  const K = TH[theme];
  const p = "sg";
  const cam = camera({ yaw: -0.72, pitch: 0.4, dist: 24, target: [4, 3.4, 4], focal: 320, cx: 214, cy: 96 });
  const F = (x, y, z) => cam([x, y, z]);
  const quad = (a, b, c, d) => pts([a, b, c, d]);
  const lines = [];
  for (let i = 0; i <= 8; i++) {
    lines.push([F(i, 0, 0), F(i, 0, 8), 0], [F(0, 0, i), F(8, 0, i), 0]); // floor
    lines.push([F(0, i, 0), F(0, i, 8), 1], [F(0, 0, i), F(0, 8, i), 1]); // left wall
    lines.push([F(i, 0, 8), F(i, 8, 8), 2], [F(0, i, 8), F(8, i, 8), 2]); // back wall
  }
  const grid = [0, 1, 2]
    .map((w) => `<g${dof(p, w === 2 ? 1.4 : w === 1 ? 0.6 : 0)} stroke="${K.steel}" stroke-width=".6" stroke-opacity="${[0.32, 0.24, 0.18][w]}">${lines
      .filter((l) => l[2] === w)
      .map(([a, b]) => `<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b.x)}" y2="${r1(b.y)}"/>`)
      .join("")}</g>`)
    .join("");

  const T = 8, tiles = 16, step = 0.36, end = tiles * step;
  const on = (k) => k / T;
  const parts = [];
  const aStrips = [0, 1, 2, 3].map(() => []), bStrips = [0, 1, 2, 3].map(() => []);
  for (let n = 0; n < tiles; n++) {
    const i = Math.floor(n / 4), j = n % 4, t0 = n * step;
    aStrips[i].push(t0); bStrips[j].push(t0);
    const poly = quad(F(2 * j, 0, 2 * i), F(2 * j + 2, 0, 2 * i), F(2 * j + 2, 0, 2 * i + 2), F(2 * j, 0, 2 * i + 2));
    const ks = [0, on(t0), on(t0 + 0.08), on(t0 + 0.4), on(T - 0.5), 1];
    const vs = [0, 0, 0.95, 0.2, 0.2, 0];
    parts.push(`<polygon points="${poly}" fill="${K.warm}" opacity="0"><animate attributeName="opacity" values="${vs.join(";")}"${kt(ks)} dur="${T}s" repeatCount="indefinite"/></polygon>`);
    parts.push(`<polygon points="${poly}" fill="${K.hot}" opacity="0" filter="url(#${p}b4)"><animate attributeName="opacity" values="0;0;.9;0;0"${kt([0, on(t0), on(t0 + 0.06), on(t0 + 0.42), 1])} dur="${T}s" repeatCount="indefinite"/></polygon>`);
  }
  const pulse = (times) => {
    const ks = [0], vs = [0];
    for (const t0 of times) ks.push(on(t0), on(t0 + 0.05), on(t0 + step)), vs.push(0, 0.55, 0);
    ks.push(1), vs.push(0);
    return `<animate attributeName="opacity" values="${vs.join(";")}"${kt(ks)} dur="${T}s" repeatCount="indefinite"/>`;
  };
  const strips = [
    ...aStrips.map((ts, i) => `<polygon points="${quad(F(0, 0, 2 * i), F(0, 8, 2 * i), F(0, 8, 2 * i + 2), F(0, 0, 2 * i + 2))}" fill="${K.warm}" opacity="0">${pulse(ts)}</polygon>`),
    ...bStrips.map((ts, j) => `<polygon points="${quad(F(2 * j, 0, 8), F(2 * j, 8, 8), F(2 * j + 2, 8, 8), F(2 * j + 2, 0, 8))}" fill="${K.warm}" opacity="0"${dof(p, 1)}>${pulse(ts)}</polygon>`),
  ];
  const label = (q, s) => `<text x="${r1(q.x)}" y="${r1(q.y)}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="${K.mute}">${s}</text>`;
  const body = `
${strips.join("")}
${grid}
${parts.join("")}
${label(F(0, 8.9, 4), "A")}${label(F(4, 8.9, 8), "B")}${label(F(9, 0, 8.8), "C")}`;
  return frame({
    w: W, h: H, p, theme,
    desc: "Custom SGEMM: matrix multiplication drawn as a room, A on the left wall, B on the back wall, C on the floor; tile by tile, a strip of A and a strip of B light up and a tile of C fills. 169.6 to 1,052.9 GFLOPS on an RTX 4060, 6.5 times faster.",
    body,
    caption: ["Custom SGEMM", "169.6 to 1,052.9 GFLOPS, one bottleneck at a time · 6.5× on an RTX 4060"],
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Warp divergence, from where it comes. An SPH dam break (the case OpenFPM's SPH example runs,
//    simulated in sph.mjs) plays out; then one warp is taken from it: 32 particles that sit
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
  const { lanes, ns } = best;
  const L = Math.max(...ns), busy = ns.reduce((a, b) => a + b, 0) / L;
  const T = 18, tFluid = 6, tPick = 9, tMove = 10.4, tRun = 16.6, tFade = 17.4;
  const kt_ = (x) => +(x / T).toFixed(4);
  const laneX = (k) => 62 + k * 9.4, TOP = 40, BOT = 168, step = (BOT - TOP) / L;
  const nf = frames.length - 1;
  const inWarp = new Map(lanes.map((i, k) => [i, k]));
  const parts = [];
  for (let i = 0; i < nF; i++) {
    const ks = frames.map((_, f) => +((f / nf) * (tFluid / T)).toFixed(3));
    const xs = frames.map((fr) => sx(fr[i][0])), ys = frames.map((fr) => sy(fr[i][1]));
    const k = inWarp.get(i);
    if (k === undefined) {
      ks.push(kt_(tPick), 1); xs.push(xs.at(-1), xs[0]); ys.push(ys.at(-1), ys[0]);
      parts.push(`<circle r="2.1" fill="url(#${p}-ball)"><animate attributeName="cx" values="${xs.map(Math.round).join(";")}" keyTimes="${ks.join(";")}" dur="${T}s" repeatCount="indefinite"/><animate attributeName="cy" values="${ys.map(Math.round).join(";")}" keyTimes="${ks.join(";")}" dur="${T}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${kt_(tPick - 0.4)};${kt_(tPick + 0.4)};.99;1" dur="${T}s" repeatCount="indefinite"/></circle>`);
      continue;
    }
    // into the lane, then down it in lockstep
    ks.push(kt_(tPick), kt_(tMove)); xs.push(xs.at(-1), laneX(k)); ys.push(ys.at(-1), TOP);
    const op = [1, 1];
    for (let it = 1; it <= L; it++) {
      ks.push(kt_(tMove + ((tRun - tMove) * it) / L));
      xs.push(laneX(k));
      ys.push(TOP + Math.min(it, ns[k]) * step);
    }
    ks.push(kt_(tFade), 1); xs.push(xs.at(-1), xs[0]); ys.push(ys.at(-1), ys[0]);
    const opK = [0, kt_(tMove)], opV = [1, 1];
    for (let it = 1; it <= L; it++) opK.push(kt_(tMove + ((tRun - tMove) * it) / L)), opV.push(it > ns[k] ? 0.3 : 1);
    opK.push(kt_(tRun + 0.2), kt_(tFade), 1); opV.push(1, 0, 0);
    parts.push(`<circle r="2.6" fill="url(#${p}-warm)"><animate attributeName="cx" values="${xs.map(r1).join(";")}" keyTimes="${ks.join(";")}" dur="${T}s" repeatCount="indefinite"/><animate attributeName="cy" values="${ys.map(r1).join(";")}" keyTimes="${ks.join(";")}" dur="${T}s" repeatCount="indefinite"/><animate attributeName="opacity" values="${opV.join(";")}" keyTimes="${opK.join(";")}" dur="${T}s" calcMode="discrete" repeatCount="indefinite"/></circle>`);
  }
  // the kernel radius of one particle in the warp, 2h, with its neighbour count
  const probe = lanes[ns.indexOf(Math.max(...ns))];
  const [px, py] = last[probe];
  const kernel = `<circle cx="${r1(sx(px))}" cy="${r1(sy(py))}" r="${r1(2 * h * S)}" fill="${K.warm}" fill-opacity=".08" stroke="${K.warm}" stroke-width=".9" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${kt_(tFluid + 0.4)};${kt_(tFluid + 0.8)};${kt_(tPick)};${kt_(tPick + 0.3)};1" dur="${T}s" repeatCount="indefinite"/></circle>`;
  const tank = `<g opacity="1"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${kt_(tPick - 0.3)};${kt_(tPick + 0.4)};.97;1" dur="${T}s" repeatCount="indefinite"/>
<path d="M ${sx(0) - 2} ${sy(0.95)} V ${FLOOR + 2} H ${sx(1.6) + 2} V ${sy(0.95)}" fill="none" stroke="${K.line}" stroke-width="1.2"/>
<rect x="${sx(0.9)}" y="${sy(0.12)}" width="${0.12 * S}" height="${0.12 * S}" fill="${K.line}" fill-opacity=".5"/></g>`;
  const rods = `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${kt_(tMove - 0.6)};${kt_(tMove)};${kt_(tRun + 0.3)};${kt_(tFade)};1" dur="${T}s" repeatCount="indefinite"/>
${lanes.map((_, k) => `<line x1="${r1(laneX(k))}" y1="${TOP}" x2="${r1(laneX(k))}" y2="${BOT}" stroke="${K.line}" stroke-width=".7" stroke-opacity=".6"/><line x1="${r1(laneX(k) - 3)}" y1="${r1(TOP + ns[k] * step)}" x2="${r1(laneX(k) + 3)}" y2="${r1(TOP + ns[k] * step)}" stroke="${K.warm}" stroke-width="1"/>`).join("")}
<line x1="${laneX(0) - 8}" y1="${BOT}" x2="${laneX(31) + 8}" y2="${BOT}" stroke="${K.line}" stroke-width=".7"/></g>`;
  const say = (a, b, s) => `<text x="20" y="22" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${Math.max(0, kt_(a)) || 0};${kt_(a + 0.3)};${kt_(b - 0.3)};${kt_(b)};1" dur="${T}s" repeatCount="indefinite"/>${s}</text>`;
  const body = `${tank}${rods}${kernel}${parts.join("")}
${`<text x="20" y="22" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${kt_(tFluid - 0.3)};${kt_(tFluid)};.98;1" dur="${T}s" repeatCount="indefinite"/>SPH DAM BREAK, AS IN OPENFPM · 5× SLOWER</text>`}
${say(tFluid, tMove, `ONE WARP: 32 PARTICLES, 32 THREADS`)}
${say(tMove, tFade, `LOCKSTEP · ${L} STEPS · ${busy.toFixed(1)} OF 32 LANES BUSY`)}`;
  return frame({
    w: W, h: H, p, theme,
    desc: `Warp divergence, from where it comes: an SPH dam break of ${nF} particles plays out; one warp of 32 neighbouring particles is taken from it, each a GPU thread gathering the neighbours inside its kernel radius; their real neighbour counts (${Math.min(...ns)} to ${L}) become the work, and the warp steps in lockstep for ${L} steps with ${busy.toFixed(1)} of 32 lanes busy on average, the rest masked off. Measured on a million particles: 33.34% branch efficiency, and still faster, 158.87 against 153.13 GB/s.`,
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
  const atoms = [];
  const seen = new Set();
  for (const [kind, [x, z]] of Object.entries(sites))
    for (const [fx, fy, fz] of [[x, 0, z], [-x, 0, -z], [x + 0.5, 0.5, z], [-x + 0.5, 0.5, -z]])
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 2; j++) for (let k = -1; k <= 1; k++) {
        const f = [((fx % 1) + 1) % 1 + i, fy + j, ((fz % 1) + 1) % 1 + k];
        if (f[0] < -0.04 || f[0] > 1.54 || f[1] < -0.01 || f[1] > 1.01 || f[2] < -0.04 || f[2] > 1.04) continue;
        const key = f.map((v) => v.toFixed(3)).join();
        if (seen.has(key)) continue;
        seen.add(key);
        atoms.push({ kind, ga: kind.startsWith("Ga"), pos: cart(f) });
      }
  const bonds = [];
  atoms.forEach((A, i) => atoms.forEach((B, j) => {
    if (!A.ga || B.ga) return;
    if (Math.hypot(...A.pos.map((v, q) => v - B.pos[q])) < 2.15) bonds.push([i, j]);
  }));
  const center = [0, 1, 2].map((q) => atoms.reduce((s, A) => s + A.pos[q], 0) / atoms.length);
  // the two dopant sites: the Ga(I) and the Ga(II) nearest the middle of the front layer
  const front = (A) => A.pos[2] < 1;
  const nearest = (kind) => atoms.map((A, i) => [A, i]).filter(([A]) => A.kind === kind && front(A)).sort((x, y) => Math.hypot(x[0].pos[0] - center[0], x[0].pos[1] - center[1]) - Math.hypot(y[0].pos[0] - center[0], y[0].pos[1] - center[1]))[0][1];
  const sitesD = [nearest("Ga1"), nearest("Ga2")];
  const R = rng(29);
  const vib = atoms.map(() => [0, 1, 2].map(() => [1 + Math.floor(R() * 2), R() * 2 * Math.PI]));
  const F = 24, T = 16;
  const frames = [];
  for (let f = 0; f <= F; f++) {
    const ph = (2 * Math.PI * f) / F;
    const cam = camera({ yaw: 0.3 * Math.sin(ph) + 0.25, pitch: 0.22, dist: 34, target: center, focal: 520, cx: 210, cy: 96 });
    frames.push(atoms.map((A, i) => cam(A.pos.map((v, q) => v + 0.1 * Math.sin(vib[i][q][0] * ph + vib[i][q][1])))));
  }
  const meanD = (i) => frames.reduce((s, fr) => s + fr[i].d, 0) / frames.length;
  const focusD = meanD(sitesD[0]);
  const blurOf = (d) => Math.abs(d - focusD) * 0.45;
  const half = (which) => `<animate attributeName="opacity" values="${which ? "0;1;1;0;0" : "1;0;0;1;1"}" keyTimes="0;.5;.5;1;1" dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>`;
  const line = (i, j, stroke, w, op, extra = "") => `<line stroke="${stroke}" stroke-width="${w}" stroke-opacity="${op}"${extra}>${anim("x1", frames.map((fr) => fr[i].x), T)}${anim("y1", frames.map((fr) => fr[i].y), T)}${anim("x2", frames.map((fr) => fr[j].x), T)}${anim("y2", frames.map((fr) => fr[j].y), T)}</line>`;
  const bondSvg = bonds.map(([i, j]) => line(i, j, K.steel, 0.9, 0.55, dof(p, blurOf((meanD(i) + meanD(j)) / 2)))).join("");
  const warmBonds = sitesD.map((site, w) => `<g opacity="${w ? 0 : 1}">${half(w)}${bonds.filter(([i]) => i === site).map(([i, j]) => line(i, j, K.warm, 1.6, 0.95)).join("")}</g>`).join("");
  const order = atoms.map((_, i) => i).sort((x, y) => meanD(y) - meanD(x));
  const atomSvg = order.map((i) => {
    const A = atoms[i];
    const k = A.ga ? 0.5 : 0.36;
    const fill = A.kind === "Ga1" ? `${p}-ga1` : A.kind === "Ga2" ? `${p}-ga2` : `${p}-o`;
    return `<circle fill="url(#${fill})"${dof(p, blurOf(meanD(i)))}>${anim("cx", frames.map((fr) => fr[i].x), T)}${anim("cy", frames.map((fr) => fr[i].y), T)}${anim("r", frames.map((fr) => fr[i].s * k), T)}</circle>`;
  }).join("");
  const dopantSvg = sitesD.map((site, w) => `<g opacity="${w ? 0 : 1}">${half(w)}
<circle fill="${K.hot}" opacity=".4" filter="url(#${p}b4)">${anim("cx", frames.map((fr) => fr[site].x), T)}${anim("cy", frames.map((fr) => fr[site].y), T)}${anim("r", frames.map((fr) => fr[site].s * 1.3), T)}</circle>
<circle fill="url(#${p}-dop)">${anim("cx", frames.map((fr) => fr[site].x), T)}${anim("cy", frames.map((fr) => fr[site].y), T)}${anim("r", frames.map((fr) => fr[site].s * 0.6), T)}</circle></g>`).join("");
  const label = (w, s) => `<text x="${W - 20}" y="26" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".8" opacity="${w ? 0 : 1}">${half(w)}${s}</text>`;
  return frame({
    w: W, h: H, p, theme,
    desc: "p-type dopants in beta-Ga2O3: the real monoclinic crystal, two unit cells deep, its atoms in room-temperature thermal motion to scale; a dopant sits first on a tetrahedral Ga(I) site with four oxygen bonds, then on an octahedral Ga(II) site with six. Graph neural networks over the defect's real structure; abstract under review at IIM ATM 2026.",
    defs: `${sphere(`${p}-ga1`)}${sphere(`${p}-ga2`, "#9aa1a9")}${sphere(`${p}-o`, "#c98f7a")}<radialGradient id="${p}-dop" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${K.hot}"/><stop offset=".85" stop-color="${K.warm}"/><stop offset="1" stop-color="#6a4520"/></radialGradient>`,
    body: `${bondSvg}${atomSvg}${warmBonds}${dopantSvg}${label(0, "DOPANT ON Ga(I) · TETRAHEDRAL · 4 O")}${label(1, "DOPANT ON Ga(II) · OCTAHEDRAL · 6 O")}`,
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
// 5. Exoplanet habitability, in three movements. A survey satellite stares at a star and its
//    camera collects the light; the light becomes numbers, flux readings that dip; the numbers
//    become the system, a planet on a Kepler orbit crossing its star.
//    The transit is computed, not drawn: a planet a tenth of the star's radius (k = 0.1, a
//    Jupiter round a Sun) over a limb-darkened star (quadratic, u₁ = 0.40, u₂ = 0.26), so the dip
//    is about 1% with a rounded floor and sloped ingress and egress. The star is drawn far too
//    large for its orbit, as it must be to be seen; the light curve is not affected.
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
  const T = 21, P1 = [0, 6], P2 = [6, 12], P3 = [12, 21];
  const phase = ([a, b]) => {
    const k = (x) => (x / T).toFixed(4);
    const ks = a === 0 ? `0;${k(b - 0.5)};${k(b)};${k(T - 0.5)};1` : `0;${k(a - 0.5)};${k(a)};${k(b - 0.5)};${k(b)};1`;
    const vs = a === 0 ? "1;1;0;0;1" : "0;0;1;1;0;0";
    return `<animate attributeName="opacity" values="${b === T ? "0;0;1;1" : vs}" keyTimes="${b === T ? `0;${k(a - 0.5)};${k(a)};1` : ks}" dur="${T}s" repeatCount="indefinite"/>`;
  };

  // --- the system: Kepler orbit, seen nearly edge-on so the planet transits
  const cam = camera({ yaw: 0.25, pitch: 0.075, dist: 9, target: [0, 0, 0], focal: 330, cx: 196, cy: 100 });
  const a = 3.1, e = 0.32, F = 120, TO = 9; // one orbit fills the third movement
  const star = cam([0, 0, 0]);
  const RS = 14; // the star's drawn radius
  const fr = [];
  for (let f = 0; f <= F; f++) {
    const M = (2 * Math.PI * f) / F;
    let E = M;
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const q = cam([x, 0, z]);
    const dist = Math.hypot(x, z);
    const cosAlpha = (q.d - star.d) / dist; // planet beyond the star: we see its day side
    const lit = (1 + cosAlpha) / 2;
    const zSep = Math.hypot(q.x - star.x, q.y - star.y) / RS;
    const flux = q.d < star.d ? 1 - blocked(zSep) : 1;
    fr.push({ ...q, lit, flux, behind: q.d > star.d });
  }
  const orbit = Array.from({ length: 73 }, (_, i) => {
    const E = (2 * Math.PI * i) / 72;
    return cam([a * (Math.cos(E) - e), 0, a * Math.sqrt(1 - e * e) * Math.sin(E)]);
  });
  const planet = (behind) => `<g opacity="0">${anim("opacity", fr.map((q) => (q.behind === behind ? 1 : 0)), TO, ' calcMode="discrete"')}
  <circle r="2.4" fill="#141618">${anim("cx", fr.map((q) => q.x), TO)}${anim("cy", fr.map((q) => q.y), TO)}</circle>
  <circle r="2.4" fill="#d9c3a5">${anim("cx", fr.map((q) => q.x), TO)}${anim("cy", fr.map((q) => q.y), TO)}${anim("opacity", fr.map((q) => q.lit), TO)}</circle></g>`;
  const minF = Math.min(...fr.map((q) => q.flux));
  const lc = { x: 250, y: 24, w: 150, h: 30 };
  const fy = (v) => lc.y + 6 + ((1 - v) / 0.012) * lc.h;
  const curve = fr.map((q, i) => `${r1(lc.x + (i / F) * lc.w)},${r1(fy(q.flux))}`).join(" ");
  const R = rng(3);
  const stars = Array.from({ length: 60 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * (H - 40))}" r="${r1(0.3 + R() * 0.7)}" fill="${K.light}" opacity="${r2(0.08 + R() * 0.3)}"/>`).join("");
  const system = `<g opacity="0">${phase(P3)}
<polyline points="${pts(orbit)}" fill="none" stroke="${K.steel}" stroke-opacity=".25" stroke-dasharray="1.5 3"/>
${planet(true)}
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="${RS * 3}" fill="url(#${p}-glow)"/>
<ellipse cx="${r1(star.x)}" cy="${r1(star.y)}" rx="170" ry="1.1" fill="url(#${p}-flare)" opacity=".7"/>
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="${RS}" fill="url(#${p}-limb)"/>
${planet(false)}
<g font-family="${SANS}" font-size="8.5" letter-spacing="1.4" fill="${K.mute}">
  <text x="${lc.x}" y="${lc.y - 6}">FLUX · DEPTH ${((1 - minF) * 100).toFixed(2)}%</text>
  <line x1="${lc.x}" y1="${fy(1)}" x2="${lc.x + lc.w}" y2="${fy(1)}" stroke="${K.dim}" stroke-width=".6"/>
  <polyline points="${curve}" fill="none" stroke="${K.light}" stroke-opacity=".8" stroke-width=".9"/>
  <circle r="2" fill="${K.warm}">${anim("cx", fr.map((_, i) => lc.x + (i / F) * lc.w), TO)}${anim("cy", fr.map((q) => fy(q.flux)), TO)}</circle>
  <text x="${lc.x}" y="${fy(1) + lc.h + 16}" font-size="7.5" letter-spacing=".6">k = 0.1 · limb-darkened · not to scale</text>
</g></g>`;

  // --- the satellite: a survey telescope staring at a star; photons arrive, the CCD fills
  const sat = (x, y) => `<g transform="translate(${x} ${y}) rotate(-8)">
  <rect x="-40" y="-26" width="26" height="52" fill="none" stroke="${K.line}" stroke-width=".8"/>${[1, 2, 3, 4, 5].map((i) => `<line x1="-40" y1="${-26 + i * 8.7}" x2="-14" y2="${-26 + i * 8.7}" stroke="${K.line}" stroke-width=".5"/>`).join("")}<line x1="-27" y1="-26" x2="-27" y2="26" stroke="${K.line}" stroke-width=".5"/>
  <line x1="-14" y1="0" x2="-8" y2="0" stroke="${K.line}"/>
  <rect x="-8" y="-11" width="20" height="22" rx="1.5" fill="url(#${p}-foil)"/>
  <path d="M 12 -9 L 40 -12 L 40 12 L 12 9 Z" fill="url(#${p}-barrel)"/>
  <ellipse cx="40" cy="0" rx="2.4" ry="12" fill="#0d0f12" stroke="${K.steel}" stroke-width=".8"/>
</g>`;
  const sx = 120, sy = 96, tx = 360, ty = 70;
  const photons = Array.from({ length: 14 }, (_, i) => {
    const d0 = ((i / 14) * 1.6).toFixed(2);
    return `<circle r="1.1" fill="${K.warm}"><animate attributeName="cx" values="${tx};${sx + 44}" dur="1.6s" begin="-${d0}s" repeatCount="indefinite"/><animate attributeName="cy" values="${ty + (R() - 0.5) * 4};${sy - 6 + (R() - 0.5) * 6}" dur="1.6s" begin="-${d0}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="1.6s" begin="-${d0}s" repeatCount="indefinite"/></circle>`;
  }).join("");
  const ccd = { x: 206, y: 122, n: 7, c: 7 };
  const pixels = [];
  for (let i = 0; i < ccd.n; i++) for (let j = 0; j < ccd.n; j++) {
    const r2_ = (i - 3) ** 2 + (j - 3) ** 2, g = Math.exp(-r2_ / 2.2);
    const noise = Array.from({ length: 6 }, () => r2(Math.min(1, g * (0.9 + R() * 0.2) + R() * 0.06))).join(";");
    pixels.push(`<rect x="${ccd.x + j * ccd.c}" y="${ccd.y + i * ccd.c}" width="${ccd.c - 0.8}" height="${ccd.c - 0.8}" fill="${K.warm}">${anim("opacity", noise.split(";").map(Number), 1.2, ' calcMode="discrete"')}</rect>`);
  }
  const satellite = `<g opacity="1">${phase(P1)}
${sat(sx, sy)}
<circle cx="${tx}" cy="${ty}" r="2.6" fill="#fff8ee"/><circle cx="${tx}" cy="${ty}" r="12" fill="url(#${p}-glow)"/>
${photons}
<rect x="${ccd.x - 3}" y="${ccd.y - 3}" width="${ccd.n * ccd.c + 5}" height="${ccd.n * ccd.c + 5}" fill="none" stroke="${K.line}" stroke-width=".7"/>
${pixels.join("")}
<text x="${ccd.x + ccd.n * ccd.c + 10}" y="${ccd.y + 14}" font-family="${SANS}" font-size="8.5" letter-spacing="1.4" fill="${K.mute}">THE STAR ON THE CCD</text>
<text x="${ccd.x + ccd.n * ccd.c + 10}" y="${ccd.y + 27}" font-family="${SANS}" font-size="8.5" letter-spacing="1.4" fill="${K.mute}">A FEW PIXELS OF LIGHT</text>
</g>`;

  // --- the numbers: readings across a transit, with 150 ppm of photometric noise
  const N = 9;
  const iMin = fr.findIndex((q) => q.flux === minF);
  const picks = Array.from({ length: N }, (_, i) => Math.max(0, Math.min(F, iMin + Math.round((i - 4) * 0.55))));
  const readings = picks.map((i, n) => {
    const v = fr[i].flux + (R() - 0.5) * 0.0003;
    return { t: (1325.0412 + n * 0.0208).toFixed(4), v: v.toFixed(5), y: v };
  });
  const rowT = (n) => (P2[0] + 0.3 + n * 0.45) / T;
  const numbers = `<g opacity="0">${phase(P2)}
<text x="40" y="34" font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${K.mute}">TIME (BTJD)</text><text x="128" y="34" font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${K.mute}">FLUX</text>
${readings.map((r, n) => `<text x="40" y="${52 + n * 13}" font-family="${MONO}" font-size="10.5" fill="${r.y < 0.997 ? K.warm : K.light}" opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${rowT(n).toFixed(4)};${(rowT(n) + 0.01).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/><tspan>${r.t}</tspan><tspan x="128">${r.v}</tspan></text>`).join("")}
${readings.map((r, n) => `<circle cx="${240 + n * 15}" cy="${r1(80 + ((1 - r.y) / 0.012) * 50)}" r="2.2" fill="${r.y < 0.997 ? K.warm : K.light}" opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${(rowT(n) + 0.02).toFixed(4)};${(rowT(n) + 0.03).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/></circle>`).join("")}
<line x1="232" y1="80" x2="${240 + N * 15}" y2="80" stroke="${K.dim}" stroke-width=".6"/>
<text x="232" y="66" font-family="${SANS}" font-size="8.5" letter-spacing="1.4" fill="${K.mute}">SOMETHING PASSES IN FRONT</text>
</g>`;

  return frame({
    w: W, h: H, p, theme,
    desc: "Exoplanet habitability in three movements: a survey satellite staring at a star while its camera collects the light; the light becoming flux readings that dip by about one percent; and the system itself, a planet on an eccentric Kepler orbit transiting a limb-darkened star, its light curve computed for a planet a tenth of the star's radius. Do habitability indices reduce to a few physical quantities?",
    defs: `<radialGradient id="${p}-glow"><stop offset="0" stop-color="${K.hot}" stop-opacity=".9"/><stop offset=".25" stop-color="${K.warm}" stop-opacity=".4"/><stop offset="1" stop-color="${K.warm}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-flare" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2df"/><stop offset=".4" stop-color="#cfe0ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-limb" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffaf0"/><stop offset=".6" stop-color="#fff1d8"/><stop offset=".9" stop-color="#ffd9a0"/><stop offset="1" stop-color="#f0b46a"/></radialGradient>
<linearGradient id="${p}-foil" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8c27a"/><stop offset=".5" stop-color="#b8862f"/><stop offset="1" stop-color="#7a5418"/></linearGradient>
<linearGradient id="${p}-barrel" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9dcdf"/><stop offset=".5" stop-color="#8d9196"/><stop offset="1" stop-color="#4c4f53"/></linearGradient>`,
    body: `${stars}${satellite}${numbers}${system}`,
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
  const O = 5, per = 3, T = O + per * words.length, CW = 9.6, CH = 24, X0 = 34, Y0 = 70;
  const cells = [];
  for (let b = 0; b < 32; b++) {
    const x = X0 + b * (CW + 1.3);
    const ks = [0], sy = [1];
    const zero = [], one = [], dk = [0];
    words.forEach((w, n) => {
      const t0 = O + n * per + b * 0.025;
      // the flap falls, accelerating, then slaps down and settles
      const seq = [[0, 1], [0.06, 0.82], [0.1, 0.45], [0.13, 0], [0.16, -0.0], [0.19, 0.92], [0.22, 1.04], [0.26, 1]];
      for (const [dt, v] of seq) ks.push((t0 + dt) / T), sy.push(v);
      dk.push((t0 + 0.13) / T);
      zero.push(w.bits[b] === "0" ? 1 : 0);
      one.push(w.bits[b] === "1" ? 1 : 0);
    });
    ks.push(1), sy.push(1);
    const last = words.at(-1).bits[b];
    const dv = (arr) => [last === (arr === zero ? "0" : "1") ? 1 : 0, ...arr].join(";");
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
    const ks = words.map((_, k) => (O + k * per + 0.3) / T);
    return `<g opacity="0"><animate attributeName="opacity" values="${[vis.at(-1), ...vis].join(";")}"${kt([0, ...ks])} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>
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
    return `<path d="${path}" fill="none" stroke="${K.line}" stroke-width=".6" stroke-opacity=".7"/>
<circle r="${one ? 1.9 : 1.1}" fill="${one ? K.warm : K.line}" opacity="0"><animateMotion path="${path}" dur="${T}s" keyPoints="0;0;1;1" keyTimes="0;${k(1.2 + b * 0.004)};${k(2.4 + b * 0.004)};1" calcMode="linear" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${k(1.15)};${k(1.25)};${k(2.4)};${k(2.5)};1" dur="${T}s" repeatCount="indefinite"/></circle>`;
  }).join("");
  const latched = Array.from({ length: 32 }, (_, b) => `<rect x="${r1(cellX(b))}" y="${Y0}" width="${CW}" height="${CH}" rx="1.4" fill="url(#${p}-flap)"/><text x="${r1(cellX(b) + CW / 2)}" y="${Y0 + CH / 2 + 5}" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="${first[b] === "1" ? "#e3b072" : "#efebe3"}" opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${k(2.5)};${k(2.55)};1" dur="${T}s" repeatCount="indefinite"/>${first[b]}</text>`).join("");
  const fetch = `<g><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${k(O - 0.5)};${k(O)};.97;1" dur="${T}s" repeatCount="indefinite"/>
<rect x="${MEM.x}" y="${MEM.y}" width="${MEM.w}" height="${MEM.h}" rx="2" fill="url(#${p}-flap)" stroke="${K.line}" stroke-width=".6"/>
${Array.from({ length: 14 }, (_, i) => `<line x1="${MEM.x + 8 + i * 12.6}" y1="${MEM.y - 3}" x2="${MEM.x + 8 + i * 12.6}" y2="${MEM.y}" stroke="${K.line}"/>`).join("")}
<text x="${MEM.x + MEM.w / 2}" y="${MEM.y + 14.5}" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="1" fill="#c9c4bb">INSTRUCTION MEMORY · PC 0x0</text>
${wires}
<rect x="${X0 - 8}" y="${Y0 - 8}" width="${32 * (CW + 1.3) + 14}" height="${CH + 16}" rx="3" fill="none" stroke="${K.line}" stroke-width=".8"/>
${Array.from({ length: 24 }, (_, i) => `<line x1="${X0 - 2 + i * 15}" y1="${Y0 + CH + 8}" x2="${X0 - 2 + i * 15}" y2="${Y0 + CH + 12}" stroke="${K.line}"/>`).join("")}
<text x="${X0 - 8}" y="${Y0 + CH + 26}" font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${K.mute}">RV32I CORE · INSTRUCTION REGISTER</text>
${latched}
<text x="20" y="${H - 58}" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${K.light}" fill-opacity=".85">FETCH: 32 BITS OVER 32 WIRES, ALL AT ONCE</text>
</g>`;
  return frame({
    w: W, h: H, p, theme,
    desc: "RISC-V specification database: a split-flap board spelling out add, lw and addi as 32-bit instruction words, flap by flap, with the fields of each bracketed beneath and the board reflected in the desk. A pipeline that loads 1,700+ YAML specification files into PostgreSQL.",
    defs: `<linearGradient id="${p}-flap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b3b3e"/><stop offset=".49" stop-color="#28282b"/><stop offset=".51" stop-color="#1c1c1e"/><stop offset="1" stop-color="#2c2c2f"/></linearGradient>
<linearGradient id="${p}-rf" x1="0" x2="0" y1="${Y0 + CH}" y2="${Y0 + CH + 30}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="${p}-rm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect y="${Y0 + CH}" width="${W}" height="40" fill="url(#${p}-rf)"/></mask>`,
    body: `${fetch}<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${((O - 0.5) / T).toFixed(4)};${(O / T).toFixed(4)};.97;1" dur="${T}s" repeatCount="indefinite"/>
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
