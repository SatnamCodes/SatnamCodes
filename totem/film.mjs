// Shared by every picture on the profile: each one is a shot, not a card. A dark frame (film is
// dark on any page), a perspective camera, depth of field, a key light, and the things a real
// camera adds: grain, a little gate weave, a vignette, the odd flicker of exposure.

export const INK = {
  bg: "#0b0b0c",
  light: "#efebe3", // tungsten-balanced white
  mute: "#8d8a84",
  dim: "#4a4845",
  warm: "#e3b072", // the one warm light in every shot
  hot: "#ffe2b8",
  steel: "#c3c7cc",
};
export const SANS = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
export const MONO = `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`;
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const r1 = (n) => +n.toFixed(1);
export const r2 = (n) => +n.toFixed(2);

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// A pinhole camera orbiting a target: yaw about the vertical, pitch looking down.
// Returns project([x, y, z]) -> { x, y, d (depth), s (pixels per unit at that depth) }.
export function camera({ yaw = 0, pitch = 0.3, dist = 10, target = [0, 0, 0], focal = 600, cx, cy }) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return ([x, y, z]) => {
    x -= target[0]; y -= target[1]; z -= target[2];
    const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    const y1 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
    const d = dist + z2;
    const s = focal / d;
    return { x: cx + x1 * s, y: cy - y1 * s, d, s };
  };
}

// Depth of field: a handful of blurs; pick one by how far a thing sits from the focal plane.
export const DOF = [0, 0.5, 1.1, 1.9, 3];
export const dofDefs = (p) =>
  DOF.slice(1)
    .map((b, i) => `<filter id="${p}b${i + 1}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${b}"/></filter>`)
    .join("");
export const dof = (p, k) => {
  const i = Math.max(0, Math.min(DOF.length - 1, Math.round(k)));
  return i ? ` filter="url(#${p}b${i})"` : "";
};

// A body dropped from a height, under gravity, bouncing to rest: [offset 0..1, height 0..1].
export function bounce(restitution = 0.38, samples = 40) {
  const g = 2;
  let y = 1, v = 0, t = 0;
  const dt = 0.002, path = [];
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
  const T = path.at(-1)[0], out = [];
  for (let i = 0; i <= samples; i++) {
    const [ti, yi] = path[Math.min(path.length - 1, Math.round((i / samples) * (path.length - 1)))];
    out.push([ti / T, yi]);
  }
  out.push([1, 0]);
  return out;
}

// A damped spring released from 0 toward 1: [offset 0..1, value].
export function spring(zeta = 0.32, omega = 14, samples = 30, T = 1) {
  const out = [];
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * T;
    out.push([i / samples, 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))]);
  }
  out[out.length - 1][1] = 1;
  return out;
}

// SMIL through sampled values, looping.
export const anim = (attr, values, dur, extra = "") =>
  `<animate attributeName="${attr}" values="${values.map((v) => (typeof v === "number" ? r1(v) : v)).join(";")}" dur="${dur}s" repeatCount="indefinite"${extra}/>`;

// Capitals for Latin letters only: β stays β, subscripts stay subscripts.
const upper = (s) => s.replace(/[a-z]/g, (c) => c.toUpperCase());

// The frame. `body` is drawn under the camera's artefacts; `caption` is burned in at the foot.
export function frame({ w, h, p, title, desc, defs = "", body, caption, captionRight }) {
  const R = rng(w * 7 + h);
  const jumps = Array.from({ length: 12 }, () => `${Math.round(R() * 120)} ${Math.round(R() * 120)}`).join(";");
  const weave = Array.from({ length: 9 }, () => `${r2((R() - 0.5) * 0.7)} ${r2((R() - 0.5) * 0.7)}`).join(";");
  const flicker = Array.from({ length: 10 }, () => r2(R() * 0.05)).join(";");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${p}-t">
<title id="${p}-t">${esc(desc)}</title>
<defs>
  <filter id="${p}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.6 0 0 0 -.82"/></filter>
  <pattern id="${p}-gp" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" filter="url(#${p}-grain)"/>
    <animateTransform attributeName="patternTransform" type="translate" values="${jumps}" dur="1s" calcMode="discrete" repeatCount="indefinite"/></pattern>
  <radialGradient id="${p}-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
  <linearGradient id="${p}-foot" x1="0" x2="0" y1="0" y2="1"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
  ${dofDefs(p)}
  ${defs}
</defs>
<rect width="${w}" height="${h}" fill="${INK.bg}"/>
<g><animateTransform attributeName="transform" type="translate" values="${weave}" dur="1.5s" calcMode="discrete" repeatCount="indefinite"/>
${body}
</g>
<rect width="${w}" height="${h}" fill="url(#${p}-vig)"/>
${caption ? `<rect width="${w}" height="${h}" fill="url(#${p}-foot)"/>` : ""}
<rect width="${w}" height="${h}" fill="url(#${p}-gp)" opacity=".1"/>
<rect width="${w}" height="${h}" fill="#000" opacity="0">${anim("opacity", flicker.split(";").map(Number), 2.3, ' calcMode="discrete"')}</rect>
${caption ? `<text x="20" y="${h - 32}" font-family="${SANS}" font-size="10.5" letter-spacing="3.2" fill="${INK.light}" fill-opacity=".92">${esc(upper(caption[0]))}</text>
<text x="20" y="${h - 15}" font-family="${SANS}" font-size="11" fill="${INK.warm}">${esc(caption[1])}</text>` : ""}
${captionRight ? `<text x="${w - 20}" y="${h - 15}" text-anchor="end" font-family="${SANS}" font-size="9.5" letter-spacing="1.6" fill="${INK.mute}">${esc(captionRight.toUpperCase())}</text>` : ""}
</svg>
`;
}
