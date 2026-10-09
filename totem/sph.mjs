// A weakly compressible SPH dam break, the test case OpenFPM's SPH example runs: a column of
// water released in a tank, striking an obstacle. 2D, cubic-spline kernel, Tait equation of
// state, Monaghan artificial viscosity, fixed boundary particles that take part in the density
// and pressure sums (dynamic boundaries, as in DualSPHysics and OpenFPM). Units are SI.
export function damBreak({ dx = 0.03, tEnd = 1.2, fps = 25 } = {}) {
  const g = -9.81, rho0 = 1000, H = 0.6, h = 1.3 * dx;
  const c0 = 10 * Math.sqrt(-g * H), B = (c0 * c0 * rho0) / 7, alpha = 0.1;
  const m = rho0 * dx * dx;
  const P = []; // { x, y, vx, vy, rho, fluid }
  const W = 1.6, Ht = 0.8, wallTop = 1.3;
  for (let x = dx / 2; x < 0.4; x += dx) for (let y = dx / 2; y < H; y += dx) P.push({ x, y, vx: 0, vy: 0, rho: rho0, fluid: true });
  const wall = (x, y) => P.push({ x, y, vx: 0, vy: 0, rho: rho0, fluid: false });
  for (let l = 0; l < 3; l++) {
    for (let x = -l * dx - dx / 2; x < W + (l + 1) * dx; x += dx) wall(x, -dx / 2 - l * dx);
    for (let y = dx / 2; y < wallTop; y += dx) wall(-dx / 2 - l * dx, y), wall(W + dx / 2 + l * dx, y);
  }
  // the obstacle, 0.12 m square, 0.9 m from the left wall
  for (let x = 0.9 + dx / 2; x < 1.02; x += dx) for (let y = dx / 2; y < 0.12; y += dx) wall(x, y);
  const nF = P.filter((q) => q.fluid).length;
  const sigma = 10 / (7 * Math.PI * h * h);
  const gradW = (r) => {
    const q = r / h;
    if (q >= 2 || r < 1e-12) return 0;
    return (q < 1 ? sigma * (-3 * q + 2.25 * q * q) : -sigma * 0.75 * (2 - q) ** 2) / h; // dW/dr
  };
  const cell = 2 * h;
  const neigh = () => {
    const grid = new Map();
    P.forEach((q, i) => {
      const k = `${Math.floor(q.x / cell)},${Math.floor(q.y / cell)}`;
      (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
    });
    return (i) => {
      const q = P[i], cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell), out = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grid.get(`${cx + a},${cy + b}`) ?? []) if (j !== i) out.push(j);
      return out;
    };
  };
  const dt = (0.2 * h) / c0;
  const frames = [];
  let t = 0, next = 0, lastNb;
  while (t <= tEnd + 1e-9) {
    const nb = neigh();
    lastNb = nb;
    const pr = P.map((q) => B * ((q.rho / rho0) ** 7 - 1));
    const drho = new Float64Array(P.length), ax = new Float64Array(P.length), ay = new Float64Array(P.length);
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      for (const j of nb(i)) {
        const b = P[j];
        const rx = a.x - b.x, ry = a.y - b.y, r = Math.hypot(rx, ry);
        const dw = gradW(r);
        if (!dw) continue;
        const ex = rx / r, ey = ry / r;
        const vx = a.vx - b.vx, vy = a.vy - b.vy;
        drho[i] += m * (vx * ex + vy * ey) * dw;
        if (!a.fluid) continue;
        const vr = vx * rx + vy * ry;
        let pi = 0;
        if (vr < 0) {
          const mu = (h * vr) / (r * r + 0.01 * h * h);
          pi = (-alpha * c0 * mu) / ((a.rho + b.rho) / 2);
        }
        const f = -m * (pr[i] / (a.rho * a.rho) + pr[j] / (b.rho * b.rho) + pi) * dw;
        ax[i] += f * ex;
        ay[i] += f * ey;
      }
    }
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.rho = Math.max(rho0 * 0.98, q.rho + dt * drho[i]);
      if (!q.fluid) continue;
      q.vx += dt * ax[i];
      q.vy += dt * (ay[i] + g);
      q.x += dt * q.vx;
      q.y += dt * q.vy;
    }
    if (t >= next - 1e-9) {
      frames.push(P.slice(0, nF).map((q) => [q.x, q.y]));
      next += 1 / fps;
    }
    t += dt;
  }
  // neighbours within 2h of each fluid particle at the last frame (fluid and boundary alike)
  const counts = P.slice(0, nF).map((_, i) => lastNb(i).filter((j) => Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) < 2 * h).length);
  return { frames, counts, h, W, Ht, nF, obstacle: [0.9, 0, 0.12, 0.12] };
}
