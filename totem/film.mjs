// Shared by every picture on the profile: each one is a shot, not a card. Nothing behind it
// (the page is the ground, light or dark), a perspective camera, depth of field, one warm light,
// soft shadows, and the faint gate weave of a film camera.

// One palette per GitHub theme. `light` is the brightest ink on that page, `warm` the one warm
// light in every shot, `steel` the metal.
export const TH = {
  dark: { light: "#e6edf3", mute: "#9198a1", dim: "#3d444d", line: "#59616b", warm: "#e3b072", hot: "#ffe2b8", steel: "#c3c7cc", shadow: "#000", shadowOp: 0.55, face: ["#c9c2b6", "#4b4640", "#2d2a27"], empty: ["#2a2724", "#1c1a18", "#141312"] },
  light: { light: "#1f2328", mute: "#59636e", dim: "#d1d9e0", line: "#9aa3ad", warm: "#b8741f", hot: "#e09a3e", steel: "#8c939b", shadow: "#1f2328", shadowOp: 0.22, face: ["#dcd6ce", "#a9a299", "#8a847b"], empty: ["#ece9e4", "#dcd8d1", "#cfcac2"] },
};
export const INK = TH.dark;
export const SANS = `Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif`;
export const BOOK = `'Cormorant Garamond', Georgia, 'Times New Roman', serif`;
export const MONO = `ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`;
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const r1 = (n) => +n.toFixed(1);
export const r2 = (n) => +n.toFixed(2);

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Type. An image on GitHub cannot fetch fonts, so each SVG carries the faces it uses, subset
// to Latin text (totem/fonts, SIL Open Font License): Jost for titles and labels, tracked out
// like a title card; Cormorant Garamond for the lines meant to be read slowly.
import fs from "node:fs";
const FONT_DIR = new URL("./fonts/", import.meta.url);
const FACES = [
  ["Jost", "normal", 300, "jost-300"],
  ["Jost", "normal", 400, "jost-400"],
  ["Cormorant Garamond", "normal", 400, "cormorant-400"],
  ["Cormorant Garamond", "italic", 500, "cormorant-500-italic"],
];
const fontCache = {};
export function withFonts(svg) {
  const used = FACES.filter(([fam, style, weight]) => {
    if (!svg.includes(fam)) return false;
    if (fam === "Jost") return weight === 400 || svg.includes('font-weight="300"');
    return style === "italic" ? svg.includes('font-style="italic"') : /font-family="'Cormorant Garamond'[^"]*"(?![^>]*font-style="italic")/.test(svg);
  });
  if (!used.length) return svg;
  const css = used
    .map(([fam, style, weight, file]) => {
      fontCache[file] ??= fs.readFileSync(new URL(`${file}.woff2`, FONT_DIR)).toString("base64");
      return `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${fontCache[file]}) format('woff2')}`;
    })
    .join("");
  return svg.replace(/(<svg[^>]*>)/, `$1\n<style>${css}text{font-variant-numeric:lining-nums}</style>`);
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

// The frame. `body` is drawn under the camera's weave; `caption` is set at the foot.
export function frame({ w, h, p, theme = "dark", desc, defs = "", body, caption }) {
  const c = TH[theme];
  const R = rng(w * 7 + h);
  const weave = Array.from({ length: 9 }, () => `${r2((R() - 0.5) * 0.6)} ${r2((R() - 0.5) * 0.6)}`).join(";");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${p}-t">
<title id="${p}-t">${esc(desc)}</title>
<defs>
  ${dofDefs(p)}
  ${defs}
</defs>
<g><animateTransform attributeName="transform" type="translate" values="${weave}" dur="1.5s" calcMode="discrete" repeatCount="indefinite"/>
${body}
</g>
${caption ? `<text x="20" y="${h - 33}" font-family="${SANS}" font-size="10.5" letter-spacing="3.6" fill="${c.light}" fill-opacity=".92">${esc(upper(caption[0]))}</text>
<text x="20" y="${h - 13}" font-family="${BOOK}" font-style="italic" font-weight="500" font-size="14" fill="${c.warm}">${esc(caption[1])}</text>` : ""}
</svg>
`;
}
