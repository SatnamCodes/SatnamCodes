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
import { INK, SANS, MONO, esc, r1, r2, rng, camera, dof, bounce, spring, anim, frame } from "./film.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 420, H = 220; // 1.9:1, the IMAX digital frame
const pts = (ps) => ps.map((q) => `${r1(q.x)},${r1(q.y)}`).join(" ");
const kt = (ks) => ` keyTimes="${ks.map((k) => +Math.min(1, Math.max(0, k)).toFixed(4)).join(";")}"`;

// A steel ball lit from the upper left, with a warm kick from the key light.
const sphere = (id, base = INK.steel) =>
  `<radialGradient id="${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${base}"/><stop offset=".8" stop-color="#2b2c2e"/><stop offset="1" stop-color="#121213"/></radialGradient>`;

// ---------------------------------------------------------------------------------------------
// 1. Custom SGEMM: C = A·B as a room of three walls. A is on the left wall, B on the back wall,
//    C on the floor. Tile by tile, a strip of A and a strip of B light up and C's tile fills.
function sgemm() {
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
    .map((w) => `<g${dof(p, w === 2 ? 1.4 : w === 1 ? 0.6 : 0)} stroke="${INK.steel}" stroke-width=".6" stroke-opacity="${[0.32, 0.24, 0.18][w]}">${lines
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
    parts.push(`<polygon points="${poly}" fill="${INK.warm}" opacity="0"><animate attributeName="opacity" values="${vs.join(";")}"${kt(ks)} dur="${T}s" repeatCount="indefinite"/></polygon>`);
    parts.push(`<polygon points="${poly}" fill="${INK.hot}" opacity="0" filter="url(#${p}b4)"><animate attributeName="opacity" values="0;0;.9;0;0"${kt([0, on(t0), on(t0 + 0.06), on(t0 + 0.42), 1])} dur="${T}s" repeatCount="indefinite"/></polygon>`);
  }
  const pulse = (times) => {
    const ks = [0], vs = [0];
    for (const t0 of times) ks.push(on(t0), on(t0 + 0.05), on(t0 + step)), vs.push(0, 0.55, 0);
    ks.push(1), vs.push(0);
    return `<animate attributeName="opacity" values="${vs.join(";")}"${kt(ks)} dur="${T}s" repeatCount="indefinite"/>`;
  };
  const strips = [
    ...aStrips.map((ts, i) => `<polygon points="${quad(F(0, 0, 2 * i), F(0, 8, 2 * i), F(0, 8, 2 * i + 2), F(0, 0, 2 * i + 2))}" fill="${INK.warm}" opacity="0">${pulse(ts)}</polygon>`),
    ...bStrips.map((ts, j) => `<polygon points="${quad(F(2 * j, 0, 8), F(2 * j, 8, 8), F(2 * j + 2, 8, 8), F(2 * j + 2, 0, 8))}" fill="${INK.warm}" opacity="0"${dof(p, 1)}>${pulse(ts)}</polygon>`),
  ];
  const label = (q, s) => `<text x="${r1(q.x)}" y="${r1(q.y)}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="${INK.mute}">${s}</text>`;
  const body = `
<rect width="${W}" height="${H}" fill="url(#${p}-room)"/>
${strips.join("")}
${grid}
${parts.join("")}
${label(F(0, 8.9, 4), "A")}${label(F(4, 8.9, 8), "B")}${label(F(9, 0, 8.8), "C")}`;
  return frame({
    w: W, h: H, p,
    desc: "Custom SGEMM: matrix multiplication drawn as a room, A on the left wall, B on the back wall, C on the floor; tile by tile, a strip of A and a strip of B light up and a tile of C fills. 169.6 to 1,052.9 GFLOPS on an RTX 4060, 6.5 times faster.",
    defs: `<radialGradient id="${p}-room" cx=".45" cy=".55" r=".7"><stop offset="0" stop-color="#1a1714"/><stop offset="1" stop-color="${INK.bg}"/></radialGradient>`,
    body,
    caption: ["Custom SGEMM", "169.6 → 1,052.9 GFLOPS on an RTX 4060 · 6.5×"],
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Warp divergence: 32 lanes as rods receding from us, each lane's work a bead sliding down.
//    With 32 neighbours each, they land together. With 4 to 60, most land early and wait,
//    dimmed, for the slowest: a third of the branch efficiency.
function warp() {
  const p = "wp";
  const cam = camera({ yaw: 0.55, pitch: 0.22, dist: 13, target: [4.6, 1.5, 0], focal: 400, cx: 214, cy: 100 });
  const R = rng(5);
  const loads = Array.from({ length: 32 }, () => 4 + Math.floor(R() * 57));
  const T = 9, dt = 0.1, N = Math.round(T / dt);
  const v = 1.4 / 32; // seconds per neighbour, scaled for the eye
  const top = 3, A0 = 0.2, B0 = 3.4;
  const rods = [], beads = [];
  for (let i = 0; i < 32; i++) {
    const x = i * 0.3;
    const a = cam([x, 0, 0]), b = cam([x, top, 0]);
    const blur = Math.abs(a.d - cam([4.6, 0, 0]).d) / 2.2;
    rods.push(`<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b.x)}" y2="${r1(b.y)}" stroke="${INK.steel}" stroke-opacity=".35" stroke-width="${r2(0.4 + a.s * 0.012)}"${dof(p, blur)}/>`);
    const ys = [], op = [];
    const d1 = 32 * v, d2 = loads[i] * v, dmax = Math.max(...loads) * v;
    for (let k = 0; k <= N; k++) {
      const t = k * dt;
      let h, idle = false;
      if (t < A0) h = top;
      else if (t < A0 + d1) h = top * (1 - (t - A0) / d1);
      else if (t < 2.6) h = 0;
      else if (t < 3.2) h = top * Math.min(1, (t - 2.6) / 0.6) ** 0.5;
      else if (t < B0) h = top;
      else if (t < B0 + d2) h = top * (1 - (t - B0) / d2);
      else if (t < B0 + dmax + 0.6) (h = 0), (idle = t < B0 + dmax);
      else h = top * Math.min(1, (t - (B0 + dmax + 0.6)) / 0.6) ** 0.5;
      const q = cam([x, h, 0]);
      ys.push(q.y);
      op.push(idle ? 0.28 : 1);
    }
    beads.push(`<circle cx="${r1(a.x)}" r="${r1(Math.max(2, a.s * 0.15))}" fill="url(#${p}-ball)"${dof(p, blur)}>${anim("cy", ys, T)}${anim("opacity", op, T)}</circle>`);
  }
  const floorA = cam([-0.6, 0, -0.5]), floorB = cam([9.9, 0, -0.5]), floorC = cam([9.9, 0, 0.5]), floorD = cam([-0.6, 0, 0.5]);
  const fade = (on) => `<animate attributeName="opacity" values="${on ? "1;1;0;0;1" : "0;0;1;1;0"}"${kt([0, 3.1 / T, 3.4 / T, 0.97, 1])} dur="${T}s" repeatCount="indefinite"/>`;
  const body = `
<rect width="${W}" height="${H}" fill="url(#${p}-room)"/>
<polygon points="${pts([floorA, floorB, floorC, floorD])}" fill="${INK.warm}" opacity=".06"/>
${rods.join("")}
${beads.join("")}
<text x="20" y="28" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${INK.light}" fill-opacity=".8">${fade(true)}FIXED · 32 NEIGHBOURS · 100% BRANCH EFFICIENCY</text>
<text x="20" y="28" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${INK.light}" fill-opacity=".8" opacity="0">${fade(false)}VARIABLE · 4 TO 60 · 33.34% BRANCH EFFICIENCY</text>`;
  return frame({
    w: W, h: H, p,
    desc: "Warp divergence: 32 lanes as rods, each lane's work a bead sliding down. With a fixed 32 neighbours they land together; with 4 to 60, most land early and wait for the slowest, at 33.34% branch efficiency, yet the kernel moved slightly more data, 158.87 against 153.13 GB/s.",
    defs: `${sphere(`${p}-ball`)}<radialGradient id="${p}-room" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#171513"/><stop offset="1" stop-color="${INK.bg}"/></radialGradient>`,
    body,
    caption: ["Warp divergence", "A third of the branch efficiency, and still faster: 158.87 vs 153.13 GB/s"],
  });
}

// ---------------------------------------------------------------------------------------------
// 3. p-type dopants in β-Ga₂O₃: a crystal turning slowly under a lamp, its atoms vibrating with
//    a travelling phonon; one dopant, warm, in focus, lighting its neighbours.
function dopants() {
  const p = "dp";
  const NX = 7, NY = 3, NZ = 2, F = 20, T = 14;
  const atoms = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) atoms.push({ i, j, k, o: (i + j + k) % 2 === 1 });
  const dop = atoms.findIndex((a) => a.i === 3 && a.j === 1 && a.k === 0);
  const frames = [];
  for (let f = 0; f <= F; f++) {
    const ph = (2 * Math.PI * f) / F;
    const cam = camera({ yaw: 0.35 * Math.sin(ph) - 0.15, pitch: 0.32, dist: 9.5, target: [3, 1, 0.5], focal: 380, cx: 210, cy: 88 });
    frames.push(atoms.map((a) => {
      const u = 0.07 * Math.sin(1.6 * a.i - 3 * ph) , w = 0.04 * Math.cos(1.1 * a.j + 1.6 * a.i - 3 * ph);
      return cam([a.i + w, a.j + u, a.k]);
    }));
  }
  const focusD = frames[0][dop].d;
  const bonds = [];
  atoms.forEach((a, x) => atoms.forEach((b, y) => {
    if (y <= x) return;
    if (Math.abs(a.i - b.i) + Math.abs(a.j - b.j) + Math.abs(a.k - b.k) === 1) bonds.push([x, y]);
  }));
  const meanD = (x) => frames.reduce((s, fr) => s + fr[x].d, 0) / frames.length;
  const blurOf = (d) => Math.abs(d - focusD) * 1.5;
  const near = (x) => {
    const a = atoms[x], b = atoms[dop];
    return Math.hypot(a.i - b.i, a.j - b.j, a.k - b.k);
  };
  const bondSvg = bonds
    .map(([x, y]) => {
      const warmth = Math.max(0, 1 - Math.min(near(x), near(y)) / 1.5);
      return `<line stroke="${warmth > 0 ? INK.warm : INK.steel}" stroke-opacity="${r2(0.16 + warmth * 0.4)}" stroke-width=".8"${dof(p, blurOf((meanD(x) + meanD(y)) / 2))}>${anim("x1", frames.map((fr) => fr[x].x), T)}${anim("y1", frames.map((fr) => fr[x].y), T)}${anim("x2", frames.map((fr) => fr[y].x), T)}${anim("y2", frames.map((fr) => fr[y].y), T)}</line>`;
    })
    .join("");
  const order = atoms.map((_, x) => x).sort((x, y) => meanD(y) - meanD(x));
  const atomSvg = order
    .map((x) => {
      const a = atoms[x], isDop = x === dop;
      const k = isDop ? 0.2 : a.o ? 0.1 : 0.15;
      const warm = !isDop && near(x) <= 1.01;
      return `<circle fill="url(#${isDop ? `${p}-dop` : warm ? `${p}-warm` : a.o ? `${p}-o` : `${p}-ga`})"${dof(p, blurOf(meanD(x)))}>${anim("cx", frames.map((fr) => fr[x].x), T)}${anim("cy", frames.map((fr) => fr[x].y), T)}${anim("r", frames.map((fr) => fr[x].s * k), T)}</circle>`;
    })
    .join("");
  const glow = `<circle fill="${INK.hot}" opacity=".35" filter="url(#${p}b4)">${anim("cx", frames.map((fr) => fr[dop].x), T)}${anim("cy", frames.map((fr) => fr[dop].y), T)}${anim("r", frames.map((fr, f) => fr[dop].s * (0.42 + 0.08 * Math.sin(f))), T)}</circle>`;
  return frame({
    w: W, h: H, p,
    desc: "p-type dopants in beta-Ga2O3: a crystal lattice turning slowly, its atoms vibrating with a travelling phonon, one dopant atom glowing warm and lighting its neighbours. Graph neural networks over the defect's real structure; abstract under review at IIM ATM 2026.",
    defs: `${sphere(`${p}-ga`)}${sphere(`${p}-o`, "#7d8187")}${sphere(`${p}-warm`, "#d7b48a")}<radialGradient id="${p}-dop" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${INK.hot}"/><stop offset=".85" stop-color="${INK.warm}"/><stop offset="1" stop-color="#6a4520"/></radialGradient>`,
    body: `${glow}${bondSvg}${atomSvg}`,
    caption: ["p-type dopants in β-Ga₂O₃", "GNNs on the defect's real structure · abstract under review, IIM ATM 2026"],
  });
}

// ---------------------------------------------------------------------------------------------
// 4. NodeGuard: a transaction graph relaxed in 3D under springs and repulsion, the camera
//    circling it. The fraud ring is the knot that holds together, warm.
function graph() {
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
      return `<line stroke="${warm ? INK.warm : INK.steel}" stroke-width="${warm ? 1.1 : 0.7}">${anim("x1", frames.map((fr) => fr[a].x), T)}${anim("y1", frames.map((fr) => fr[a].y), T)}${anim("x2", frames.map((fr) => fr[b].x), T)}${anim("y2", frames.map((fr) => fr[b].y), T)}${anim("stroke-opacity", frames.map((fr) => (warm ? 0.8 : 0.4) * fog((fr[a].d + fr[b].d) / 2)), T)}</line>`;
    })
    .join("");
  const nodeSvg = P.map((_, a) => {
    const warm = ring.includes(a);
    return `<circle fill="url(#${p}-${warm ? "warm" : "ball"})">${anim("cx", frames.map((fr) => fr[a].x), T)}${anim("cy", frames.map((fr) => fr[a].y), T)}${anim("r", frames.map((fr) => fr[a].s * (warm ? 0.17 : 0.13)), T)}${anim("opacity", frames.map((fr) => fog(fr[a].d)), T)}</circle>`;
  }).join("");
  const rc = frames.map((fr) => [ring.reduce((s, a) => s + fr[a].x, 0) / 5, ring.reduce((s, a) => s + fr[a].y, 0) / 5]);
  const glow = `<circle r="34" fill="${INK.warm}" opacity=".16" filter="url(#${p}b4)">${anim("cx", rc.map((q) => q[0]), T)}${anim("cy", rc.map((q) => q[1]), T)}</circle>`;
  const dust = Array.from({ length: 40 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * (H - 40))}" r="${r1(0.4 + R() * 0.9)}" fill="${INK.light}" opacity="${r2(0.05 + R() * 0.15)}"/>`).join("");
  return frame({
    w: W, h: H, p,
    desc: "NodeGuard: a transaction graph relaxed in three dimensions under springs and repulsion, the camera circling it; the fraud ring is the warm knot that holds together. A graph convolutional network that finds fraud rings from network structure.",
    defs: `${sphere(`${p}-ball`)}<radialGradient id="${p}-warm" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${INK.hot}"/><stop offset="1" stop-color="#7a4f24"/></radialGradient>`,
    body: `${dust}${glow}${edgeSvg}${nodeSvg}`,
    caption: ["NodeGuard", "A GCN that finds fraud rings in who pays whom · F1-based checkpointing"],
  });
}

// ---------------------------------------------------------------------------------------------
// 5. Exoplanet habitability: a star through an anamorphic lens, a planet on an eccentric Kepler
//    orbit seen almost edge-on, so it transits; its lit side always faces the star. Top right,
//    the star's light curve, dipping as the planet crosses it.
function exoplanet() {
  const p = "ex";
  const cam = camera({ yaw: 0.25, pitch: 0.075, dist: 9, target: [0, 0, 0], focal: 330, cx: 196, cy: 100 });
  const a = 3.1, e = 0.32, F = 90, T = 12;
  const star = cam([0, 0, 0]);
  const fr = [];
  for (let f = 0; f <= F; f++) {
    const M = (2 * Math.PI * f) / F;
    let E = M;
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const q = cam([x, 0, z]);
    // Phase: how much of the lit half faces us (1 behind the star, 0 in front).
    const view = q.d - star.d; // positive: planet beyond the star
    const phase = 0.5 + 0.5 * Math.tanh(view * 1.2);
    const rr = q.s * 0.17;
    const transit = view < 0 && Math.hypot(q.x - star.x, q.y - star.y) < 8 + rr ? 1 : 0;
    fr.push({ ...q, rr, phase, behind: view > 0, transit });
  }
  const R = rng(3);
  const stars = Array.from({ length: 70 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * (H - 30))}" r="${r1(0.3 + R() * 0.8)}" fill="${INK.light}" opacity="${r2(0.1 + R() * 0.4)}"/>`).join("");
  const hz = Array.from({ length: 220 }, () => {
    const th = R() * 2 * Math.PI, rad = 2.3 + R() * 1.4;
    const q = cam([rad * Math.cos(th), (R() - 0.5) * 0.3, rad * Math.sin(th)]);
    return `<circle cx="${r1(q.x)}" cy="${r1(q.y)}" r="${r2(0.4 + R() * 0.6)}" fill="${INK.warm}" opacity="${r2(0.08 + R() * 0.2)}"/>`;
  }).join("");
  const orbit = Array.from({ length: 73 }, (_, i) => {
    const E = (2 * Math.PI * i) / 72;
    return cam([a * (Math.cos(E) - e), 0, a * Math.sqrt(1 - e * e) * Math.sin(E)]);
  });
  const planet = (behind) => {
    const vis = fr.map((q) => (q.behind === behind ? 1 : 0));
    return `<g opacity="0">${anim("opacity", vis, T, ' calcMode="discrete"')}
  <circle fill="#15171a">${anim("cx", fr.map((q) => q.x), T)}${anim("cy", fr.map((q) => q.y), T)}${anim("r", fr.map((q) => q.rr), T)}</circle>
  <circle fill="url(#${p}-lit)">${anim("cx", fr.map((q) => q.x), T)}${anim("cy", fr.map((q) => q.y), T)}${anim("r", fr.map((q) => q.rr), T)}${anim("opacity", fr.map((q) => 0.25 + 0.75 * q.phase), T)}</circle>
</g>`;
  };
  // The light curve: flux against time, with a cursor riding it.
  const lc = { x: 290, y: 22, w: 110, h: 34 };
  const flux = fr.map((q) => 1 - 0.5 * q.transit);
  const curve = flux.map((v, i) => `${r1(lc.x + (i / F) * lc.w)},${r1(lc.y + lc.h * (1 - v) * 1.4 + 6)}`).join(" ");
  const body = `
${stars}
<polyline points="${pts(orbit)}" fill="none" stroke="${INK.steel}" stroke-opacity=".16" stroke-dasharray="1.5 3"/>
${hz}
${planet(true)}
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="44" fill="url(#${p}-glow)"/>
<ellipse cx="${r1(star.x)}" cy="${r1(star.y)}" rx="190" ry="1.3" fill="url(#${p}-flare)">${anim("opacity", [0.75, 0.6, 0.8, 0.7, 0.75], 3.1)}</ellipse>
<circle cx="${r1(star.x)}" cy="${r1(star.y)}" r="7.5" fill="#fff8ee"/>
${planet(false)}
<g font-family="${SANS}" font-size="8.5" letter-spacing="1.6" fill="${INK.mute}">
  <text x="${lc.x}" y="${lc.y - 6}">STELLAR FLUX</text>
  <polyline points="${curve}" fill="none" stroke="${INK.light}" stroke-opacity=".7" stroke-width=".8"/>
  <circle r="1.8" fill="${INK.warm}">${anim("cx", flux.map((_, i) => lc.x + (i / F) * lc.w), T)}${anim("cy", flux.map((v) => lc.y + lc.h * (1 - v) * 1.4 + 6), T)}</circle>
</g>`;
  return frame({
    w: W, h: H, p,
    desc: "Exoplanet habitability: a star seen through an anamorphic lens and a planet on an eccentric Kepler orbit, nearly edge-on, transiting the star; a dust ring marks the habitable zone, and the star's light curve dips during the transit. Do habitability indices reduce to a few physical quantities?",
    defs: `<radialGradient id="${p}-glow"><stop offset="0" stop-color="${INK.hot}" stop-opacity=".9"/><stop offset=".2" stop-color="${INK.warm}" stop-opacity=".45"/><stop offset="1" stop-color="${INK.warm}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-flare" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2df"/><stop offset=".4" stop-color="#cfe0ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-lit" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9c3a5"/><stop offset=".7" stop-color="#7d6a55"/><stop offset="1" stop-color="#2a241e"/></radialGradient>`,
    body,
    caption: ["Exoplanet habitability", "Do the habitability indices reduce to a few physical quantities?"],
  });
}

// ---------------------------------------------------------------------------------------------
// 6. RISC-V specification database: a split-flap board spelling out instruction words bit by
//    bit, each flap falling under gravity, the fields bracketed beneath; reflected in the desk.
function riscv() {
  const p = "rv";
  const words = [
    { asm: "add  x5, x6, x7", bits: "0000000" + "00111" + "00110" + "000" + "00101" + "0110011", fields: [["funct7", 7], ["rs2", 5], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
    { asm: "lw   x10, 8(x2)", bits: "000000001000" + "00010" + "010" + "01010" + "0000011", fields: [["imm[11:0]", 12], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
    { asm: "addi x1, x0, 42", bits: "000000101010" + "00000" + "000" + "00001" + "0010011", fields: [["imm[11:0]", 12], ["rs1", 5], ["f3", 3], ["rd", 5], ["opcode", 7]] },
  ];
  const T = 9, per = T / words.length, CW = 9.6, CH = 24, X0 = 34, Y0 = 70;
  const cells = [];
  for (let b = 0; b < 32; b++) {
    const x = X0 + b * (CW + 1.3);
    const ks = [0], sy = [1];
    const zero = [], one = [], dk = [0];
    words.forEach((w, n) => {
      const t0 = n * per + b * 0.025;
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
    <text x="0" y="5" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="${INK.light}"><animate attributeName="opacity" values="${dv(zero)}"${kt(dk)} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>0</text>
    <text x="0" y="5" text-anchor="middle" font-family="${MONO}" font-size="12.5" fill="${INK.warm}"><animate attributeName="opacity" values="${dv(one)}"${kt(dk)} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>1</text>
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
        return `<path d="M ${r1(x1)} ${Y0 + CH + 6} v 4 H ${r1(x2)} v -4" fill="none" stroke="${INK.mute}" stroke-width=".7"/><text x="${r1((x1 + x2) / 2)}" y="${Y0 + CH + 22}" text-anchor="middle" font-family="${MONO}" font-size="8.5" fill="${INK.mute}">${esc(name)}</text>`;
      })
      .join("");
    const vis = words.map((_, k) => (k === n ? 1 : 0));
    const ks = words.map((_, k) => (k * per + 0.3) / T);
    return `<g opacity="0"><animate attributeName="opacity" values="${[vis.at(-1), ...vis].join(";")}"${kt([0, ...ks])} dur="${T}s" calcMode="discrete" repeatCount="indefinite"/>
${brackets}
<text x="${X0}" y="${Y0 - 14}" font-family="${MONO}" font-size="12" fill="${INK.warm}">${esc(w.asm)}</text></g>`;
  });
  const board = `${cells.join("")}${fieldSets.join("")}`;
  return frame({
    w: W, h: H, p,
    desc: "RISC-V specification database: a split-flap board spelling out add, lw and addi as 32-bit instruction words, flap by flap, with the fields of each bracketed beneath and the board reflected in the desk. A pipeline that loads 1,700+ YAML specification files into PostgreSQL.",
    defs: `<linearGradient id="${p}-flap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b3b3e"/><stop offset=".49" stop-color="#28282b"/><stop offset=".51" stop-color="#1c1c1e"/><stop offset="1" stop-color="#2c2c2f"/></linearGradient>
<linearGradient id="${p}-rf" x1="0" x2="0" y1="${Y0 + CH}" y2="${Y0 + CH + 30}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="${p}-rm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect y="${Y0 + CH}" width="${W}" height="40" fill="url(#${p}-rf)"/></mask>
<radialGradient id="${p}-lamp" cx=".45" cy=".35" r=".6"><stop offset="0" stop-color="#1d1915"/><stop offset="1" stop-color="${INK.bg}"/></radialGradient>`,
    body: `<rect width="${W}" height="${H}" fill="url(#${p}-lamp)"/>
<g id="${p}-board">${cells.join("")}</g>
<g mask="url(#${p}-rm)"><g transform="translate(0 ${2 * (Y0 + CH) + 2}) scale(1 -1)" opacity=".35" filter="url(#${p}b2)"><use href="#${p}-board"/></g></g>
${fieldSets.join("")}`,
    caption: ["RISC-V specification database", "1,700+ YAML files → PostgreSQL · 1,351 instructions, 396 CSRs"],
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

export function city(days) {
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
    const haze = 1 - far * 0.6;
    const lit = q.c.recent && q.c.n > 0;
    const topC = q.c.n ? (lit ? INK.hot : shade("#c9c2b6", 0.35 + 0.65 * Math.min(1, Math.sqrt(q.c.n) / 4))) : "#2a2724";
    const sideC = q.c.n ? (lit ? INK.warm : "#4b4640") : "#1c1a18";
    const frontC = q.c.n ? (lit ? "#b07a3c" : "#2d2a27") : "#141312";
    // visible faces from this camera: the top, the +z side and the -x side
    const [b0, b1, b2, b3] = q.b, [t0, t1, t2, t3] = q.tp;
    const delay = (q.c.w * 0.045 + q.c.r * 0.02).toFixed(2);
    const g = `<g class="rise" style="animation-delay:${delay}s;transform-origin:${r1(q.base.x)}px ${r1(q.base.y)}px" opacity="${r2(haze)}">
<polygon points="${pts([b3, b2, t2, t3])}" fill="${frontC}"/><polygon points="${pts([b0, b3, t3, t0])}" fill="${sideC}"/><polygon points="${pts(q.tp)}" fill="${topC}"/>${lit ? `<polygon points="${pts(q.tp)}" fill="${INK.hot}" filter="url(#${p}b4)" opacity=".8"/>` : ""}
</g>`;
    groups[Math.min(3, Math.floor(far * 4))].push(g);
  }
  const body = `
<rect width="${CWd}" height="${CHt}" fill="url(#${p}-sky)"/>
${groups.map((gs, i) => `<g${dof(p, [0, 0.4, 1.2, 2.2][3 - i] ?? 0)}>${gs.join("")}</g>`).reverse().join("")}
<rect width="${CWd}" height="${CHt}" fill="url(#${p}-haze)"/>
<text x="20" y="28" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${INK.light}" fill-opacity=".8">A BLOCK A DAY, AS TALL AS THAT DAY'S WORK</text>
<text x="${CWd - 20}" y="28" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${INK.warm}">LIT: THE FORTNIGHT THE TOP IS MEASURED ON</text>`;
  return frame({
    w: CWd, h: CHt, p,
    desc: `The last year of contributions as a city, a block a day, its height that day's contributions; the past recedes into haze, and the last fourteen days are lit. ${sum} contributions on ${active} days, the longest run ${best} days.`,
    defs: `<style>.rise { transform-box: view-box; animation: rise 1.4s linear both; } @keyframes rise { 0% { transform: scaleY(0) } ${kf} } @media (prefers-reduced-motion: reduce) { .rise { animation: none } }</style>
<linearGradient id="${p}-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0a0a0b"/><stop offset=".55" stop-color="#14120f"/><stop offset="1" stop-color="#0b0a09"/></linearGradient>
<linearGradient id="${p}-haze" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="${INK.bg}" stop-opacity="0"/><stop offset=".55" stop-color="${INK.bg}" stop-opacity="0"/><stop offset="1" stop-color="#16130f" stop-opacity=".55"/></linearGradient>`,
    body,
    caption: ["The year", `${sum.toLocaleString("en-US")} contributions · ${active} days · longest run ${best}`],
  });
}

// ---------------------------------------------------------------------------------------------
// 8. The kit: machined plates, each engraved with a tool, dropped onto the table one after
//    another; they fall, bounce and settle, their shadows tightening as they land.

const SHELVES = [
  { label: "Languages", items: ["Python", "C++", "C", "CUDA", "SQL"] },
  { label: "Infrastructure", items: ["Nsight Systems", "Nsight Compute", "Docker", "Linux", "Git", "PostgreSQL", "FastAPI"] },
  { label: "Machine learning", items: ["PyTorch", "PyTorch Geometric", "scikit-learn", "XGBoost", "LangGraph", "FAISS"] },
  { label: "Speaks", items: ["ਪੰਜਾਬੀ", "हिन्दी", "English"] },
];

function kit() {
  const p = "kt";
  const KW = 840, KH = 300, X = 176, ROW = 56, TOP = 46;
  const drop = bounce(0.36, 36);
  const kf = drop.map(([k, y]) => `${+(k * 100).toFixed(1)}% { transform: translateY(${r1(-y * 150)}px) }`).join(" ");
  const kfs = drop.map(([k, y]) => `${+(k * 100).toFixed(1)}% { transform: scale(${r2(1 + y * 0.9)}, ${r2(1 + y * 0.5)}); opacity: ${r2(0.75 - y * 0.6)} }`).join(" ");
  let n = 0;
  const rows = SHELVES.map((s, i) => {
    const y = TOP + i * ROW, depth = (SHELVES.length - 1 - i) / (SHELVES.length - 1); // back rows are farther
    const scale = 0.9 + 0.1 * (1 - depth);
    let x = X;
    const plates = s.items.map((it) => {
      const w = Math.round((s.label === "Speaks" ? 10 : 7.2) * [...it].length + 22);
      const delay = (0.3 + n++ * 0.11).toFixed(2);
      const cx = x + w / 2;
      const out = `<ellipse class="sh" style="animation-delay:${delay}s;transform-origin:${r1(cx)}px ${y + 30}px" cx="${r1(cx + 4)}" cy="${y + 31}" rx="${r1(w / 2 + 2)}" ry="4" fill="#000" filter="url(#${p}b3)"/>
<g class="drop" style="animation-delay:${delay}s">
  <rect x="${x}" y="${y}" width="${w}" height="28" rx="3" fill="url(#${p}-metal)"/>
  <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="27" rx="2.6" fill="none" stroke="#fff" stroke-opacity=".28"/>
  <text x="${r1(cx)}" y="${y + 19.2}" text-anchor="middle" font-family="${s.label === "Speaks" ? SANS : MONO}" font-size="12" fill="#fff" fill-opacity=".35">${esc(it)}</text>
  <text x="${r1(cx)}" y="${y + 18.5}" text-anchor="middle" font-family="${s.label === "Speaks" ? SANS : MONO}" font-size="12" fill="#17181a">${esc(it)}</text>
</g>`;
      x += w + 8;
      return out;
    });
    return `<g transform="translate(${r1(X * (1 - scale))} 0)"${dof(p, depth * 1.2)}>
<text x="${X - 18}" y="${y + 18.5}" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="2" fill="${INK.light}" fill-opacity=".75">${esc(s.label.toUpperCase())}</text>
${plates.join("\n")}</g>`;
  });
  return frame({
    w: KW, h: KH, p,
    desc: `The kit: machined plates dropped onto a table. ${SHELVES.map((s) => `${s.label}: ${s.items.join(", ")}`).join(". ")}.`,
    defs: `<style>.drop { animation: drop 1.4s linear both; } @keyframes drop { ${kf} } .sh { transform-box: view-box; animation: sh 1.4s linear both; } @keyframes sh { ${kfs} } @media (prefers-reduced-motion: reduce) { .drop, .sh { animation: none } }</style>
<linearGradient id="${p}-metal" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9dcdf"/><stop offset=".45" stop-color="#a9adb2"/><stop offset=".55" stop-color="#9a9ea3"/><stop offset="1" stop-color="#6d7175"/></linearGradient>
<linearGradient id="${p}-table" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0d0b09"/><stop offset="1" stop-color="#1a130d"/></linearGradient>
<radialGradient id="${p}-pool" cx=".3" cy=".1" r=".9"><stop offset="0" stop-color="${INK.hot}" stop-opacity=".12"/><stop offset="1" stop-color="${INK.hot}" stop-opacity="0"/></radialGradient>`,
    body: `<rect width="${KW}" height="${KH}" fill="url(#${p}-table)"/><rect width="${KW}" height="${KH}" fill="url(#${p}-pool)"/>
${rows.join("\n")}`,
    caption: ["The kit", "Python · C++ · CUDA · PyTorch · Nsight · PostgreSQL · Docker"],
  });
}

// ---------------------------------------------------------------------------------------------
// Link pills: a line icon and a label, for the page itself, so in GitHub's two themes.

const THEMES = { dark: { ink: "#e6edf3", faint: "#30363d" }, light: { ink: "#1f2328", faint: "#d8dee4" } };
const ICONS = {
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
<g transform="translate(10 8)">${ICONS[l.id](t.ink)}</g>
<text x="40" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif" font-size="12.5" fill="${t.ink}">${esc(l.label)}</text>
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const dir of ["shots", "links"]) fs.mkdirSync(path.join(ROOT, "assets", dir), { recursive: true });
  for (const s of SHOTS) fs.writeFileSync(path.join(ROOT, "assets", "shots", `${s.id}.svg`), s.draw());
  fs.writeFileSync(path.join(ROOT, "assets", "kit.svg"), kit());
  for (const theme of ["dark", "light"]) for (const l of LINKS) fs.writeFileSync(path.join(ROOT, "assets", "links", `${l.id}-${theme}.svg`), pill(l, theme));
  console.log(`[shots] ${SHOTS.length} shots, the kit and ${LINKS.length} links written`);
}
