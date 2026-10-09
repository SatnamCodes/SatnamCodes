// Findings: each project as the question it started from, the measured answer, and what it meant.
// Writes assets/findings-dark.svg and assets/findings-light.svg (transparent, one per GitHub theme).
// Every number here is from the project's own measurements; edit FINDINGS when they change.
//
//   node totem/findings.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FINDINGS = [
  {
    tag: "CUDA · Nsight Compute",
    question: "Does warp divergence slow down a memory-bound kernel?",
    answer:
      "Not here. At a third of the branch efficiency, the divergent kernel moved slightly more data. Both were memory bound; my working explanation is that uneven warps spread out their memory requests.",
    note: "Neighbour gather, 1,048,576 particles, RTX 4060",
    chart: {
      kind: "pairs",
      series: ["fixed 32 neighbours", "variable 4–60"],
      rows: [
        { label: "Branch efficiency", unit: "%", values: [100, 33.34], max: 100 },
        { label: "Active threads per warp", unit: "", values: [32, 18.14], max: 32 },
        { label: "Memory throughput", unit: " GB/s", values: [153.13, 158.87], max: 170, highlight: 1 },
      ],
    },
  },
  {
    tag: "CUDA · C++",
    question: "How far is a hand-written matrix multiply from cuBLAS?",
    answer:
      "Coalescing and shared-memory tiling made it 6.5× faster than the naive kernel. It is still 7.9× short of cuBLAS; register blocking, warp tiling and Tensor Cores are next.",
    note: "FP32 SGEMM, 1024 × 1024, RTX 4060, GFLOPS (log scale)",
    chart: {
      kind: "ladder",
      rows: [
        { label: "Naive", value: 169.6 },
        { label: "Coalesced", value: 763.1 },
        { label: "Shared-memory tiled", value: 1052.9, highlight: true },
        { label: "cuBLAS", value: 8322, target: true },
      ],
    },
  },
  {
    tag: "PyTorch Geometric",
    question: "Why did the best checkpoint of a fraud-ring detector learn nothing?",
    answer:
      "Under heavy class imbalance, saving the checkpoint with the best recall kept a model that had converged on a degenerate answer. Checkpointing on F1 instead made what got saved match what mattered.",
    note: "NodeGuard: a graph convolutional network on transaction structure",
    chart: { kind: "quote", text: "recall alone → degenerate", then: "checkpoint on F1" },
  },
  {
    tag: "Python · PostgreSQL",
    question: "Can an instruction-set specification be queried like data?",
    answer:
      "The official RISC-V specification, loaded into PostgreSQL: which extension defines an instruction, or which registers exist at which privilege level, became one query each.",
    note: "RISC-V Unified DB → PostgreSQL",
    chart: {
      kind: "numbers",
      items: [
        { value: "1,700+", label: "YAML files" },
        { value: "8", label: "tables" },
        { value: "1,351", label: "instructions" },
        { value: "396", label: "CSRs" },
      ],
    },
  },
];

const THEMES = {
  dark: { ink: "#e6edf3", mute: "#9198a1", faint: "#3d444d", bar: "#8b949e", accent: "#d9a35b", ghost: "#30363d" },
  light: { ink: "#1f2328", mute: "#59636e", faint: "#d1d9e0", bar: "#6e7781", accent: "#9a5f17", ghost: "#eaeef2" },
};

const W = 840;
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const SERIF = `Georgia, 'Iowan Old Style', 'Times New Roman', serif`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rough line-breaking for SVG text: average glyph width as a fraction of the font size.
function wrap(text, size, width, avg = 0.5) {
  const max = Math.floor(width / (size * avg));
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

const fmt = (v) => (v >= 1000 ? v.toLocaleString("en-US") : String(v));

function chart(c, t, x, y, w) {
  const out = [];
  const label = (lx, ly, s, fill = t.mute, anchor = "start", size = 11) =>
    `<text x="${lx}" y="${ly}" font-family="${SANS}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
  if (c.kind === "pairs") {
    // Legend, then each metric as two thin bars: fixed (muted) and variable (accent).
    out.push(`<rect x="${x}" y="${y - 8}" width="10" height="3" fill="${t.bar}"/>`, label(x + 15, y - 4, c.series[0]));
    out.push(
      `<rect x="${x + 140}" y="${y - 8}" width="10" height="3" fill="${t.accent}"/>`,
      label(x + 155, y - 4, c.series[1]),
    );
    c.rows.forEach((r, i) => {
      const ry = y + 22 + i * 48;
      out.push(label(x, ry, r.label, t.ink, "start", 11.5));
      r.values.forEach((v, j) => {
        const by = ry + 7 + j * 13;
        const bw = Math.max(2, (v / r.max) * (w - 80));
        out.push(`<rect x="${x}" y="${by}" width="${w - 80}" height="5" fill="${t.ghost}"/>`);
        out.push(`<rect x="${x}" y="${by}" width="${bw.toFixed(1)}" height="5" fill="${j ? t.accent : t.bar}"/>`);
        out.push(
          `<text x="${x + w}" y="${by + 5.5}" font-family="${SANS}" font-size="10.5" fill="${j && r.highlight ? t.accent : t.mute}" text-anchor="end">${v}${r.unit}</text>`,
        );
      });
    });
    return { svg: out.join(""), h: 22 + c.rows.length * 48 };
  }
  if (c.kind === "ladder") {
    // Log scale from 100 to 10,000 GFLOPS, so the steps and the remaining gap are both visible.
    const lo = Math.log10(100), hi = Math.log10(10000);
    const at = (v) => ((Math.log10(v) - lo) / (hi - lo)) * (w - 70);
    c.rows.forEach((r, i) => {
      const ry = y + i * 30;
      out.push(label(x, ry, r.label, r.target ? t.mute : t.ink, "start", 11.5));
      out.push(`<rect x="${x}" y="${ry + 6}" width="${w - 70}" height="5" fill="${t.ghost}"/>`);
      if (r.target)
        out.push(
          `<rect x="${x + 0.5}" y="${ry + 6.5}" width="${at(r.value).toFixed(1)}" height="4" fill="none" stroke="${t.bar}" stroke-dasharray="3 2"/>`,
        );
      else out.push(`<rect x="${x}" y="${ry + 6}" width="${at(r.value).toFixed(1)}" height="5" fill="${r.highlight ? t.accent : t.bar}"/>`);
      out.push(
        `<text x="${x + w}" y="${ry + 10.5}" font-family="${SANS}" font-size="10.5" fill="${r.highlight ? t.accent : t.mute}" text-anchor="end">${fmt(r.value)}</text>`,
      );
    });
    // The gap still to close, bracketed.
    const gy = y + c.rows.length * 30 - 4;
    const a = at(1052.9), b = at(8322);
    out.push(
      `<path d="M ${x + a} ${gy} v 4 H ${x + b} v -4" fill="none" stroke="${t.accent}" stroke-width=".8"/>`,
      label(x + (a + b) / 2, gy + 15, "7.9× to go", t.accent, "middle", 10.5),
    );
    return { svg: out.join(""), h: c.rows.length * 30 + 16 };
  }
  if (c.kind === "quote") {
    out.push(`<line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 40}" stroke="${t.faint}"/>`);
    out.push(
      `<text x="${x + 14}" y="${y + 10}" font-family="${SERIF}" font-size="15" font-style="italic" fill="${t.mute}"><tspan text-decoration="line-through">${esc(c.text)}</tspan></text>`,
    );
    out.push(`<text x="${x + 14}" y="${y + 34}" font-family="${SERIF}" font-size="15" font-style="italic" fill="${t.accent}">${esc(c.then)}</text>`);
    return { svg: out.join(""), h: 44 };
  }
  // numbers: a pipeline of counts. The source count, an arrow, then what it became.
  const cols = [0, 0.36, 0.56, 0.78].map((f) => x + f * w);
  c.items.forEach((it, i) => {
    out.push(
      `<text x="${cols[i]}" y="${y + 16}" font-family="${SERIF}" font-size="24" fill="${i === 0 ? t.mute : t.ink}">${esc(it.value)}</text>`,
      label(cols[i], y + 34, it.label),
    );
  });
  out.push(label((cols[0] + cols[1]) / 2 + 22, y + 12, "→", t.accent, "middle", 16));
  return { svg: out.join(""), h: 40 };
}

function svg(theme) {
  const t = THEMES[theme];
  const parts = [];
  let y = 24;
  parts.push(
    `<text x="0" y="${y}" font-family="${SANS}" font-size="11" letter-spacing="3" fill="${t.mute}">FINDINGS</text>`,
    `<text x="${W}" y="${y}" font-family="${SANS}" font-size="11" fill="${t.mute}" text-anchor="end">Each project started as a question. These are the measured answers.</text>`,
  );
  y += 14;
  const LEFT = 400; // text column width
  const CX = 450; // chart column start
  const CW = W - CX;
  FINDINGS.forEach((f, i) => {
    parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${t.faint}"/>`);
    const top = y + 28;
    const num = String(i + 1).padStart(2, "0");
    parts.push(
      `<text x="0" y="${top}" font-family="${SANS}" font-size="11" letter-spacing="2" fill="${t.accent}">${num}</text>`,
      `<text x="28" y="${top}" font-family="${SANS}" font-size="11" letter-spacing="1" fill="${t.mute}">${esc(f.tag.toUpperCase())}</text>`,
    );
    let ty = top + 26;
    for (const line of wrap(f.question, 19, LEFT, 0.47)) {
      parts.push(`<text x="0" y="${ty}" font-family="${SERIF}" font-size="19" fill="${t.ink}">${esc(line)}</text>`);
      ty += 25;
    }
    ty += 4;
    for (const line of wrap(f.answer, 13, LEFT, 0.5)) {
      parts.push(`<text x="0" y="${ty}" font-family="${SANS}" font-size="13" fill="${t.mute}">${esc(line)}</text>`);
      ty += 19;
    }
    const c = chart(f.chart, t, CX, top + 22, CW);
    parts.push(c.svg);
    const cy = top + 22 + c.h + 14;
    parts.push(`<text x="${CX}" y="${cy}" font-family="${SANS}" font-size="10.5" fill="${t.mute}" opacity=".85">${esc(f.note)}</text>`);
    y = Math.max(ty, cy) + 20;
  });
  parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${t.faint}"/>`);
  const H = y + 2;
  const title = FINDINGS.map((f) => `${f.question} ${f.answer}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="f-title">
<title id="f-title">Findings. ${esc(title)}</title>
${parts.join("\n")}
</svg>
`;
}

for (const theme of ["dark", "light"]) fs.writeFileSync(path.join(ROOT, "assets", `findings-${theme}.svg`), svg(theme));
console.log("[findings] written");
