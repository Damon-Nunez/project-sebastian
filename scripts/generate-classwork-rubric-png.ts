/**
 * One-shot: render the district classwork/homework rubric to a PNG for UI + export.
 * Run: npx tsx scripts/generate-classwork-rubric-png.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { STANDARD_CLASSWORK_RUBRIC } from "../src/lib/lessons/standardRubric";

const OUT = path.join(
  process.cwd(),
  "public",
  "lessons",
  "rubric",
  "classwork-homework-rubric.png",
);

const COLORS = [
  { headerBg: "#059669", headerFg: "#ffffff", border: "#A7F3D0" }, // emerald
  { headerBg: "#0284C7", headerFg: "#ffffff", border: "#BAE6FD" }, // sky
  { headerBg: "#D97706", headerFg: "#ffffff", border: "#FDE68A" }, // amber
  { headerBg: "#E11D48", headerFg: "#ffffff", border: "#FECDD3" }, // rose
] as const;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Naive wrap for SVG tspans (approx char widths for 12px sans). */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function buildSvg(): string {
  // High-res canvas; fonts sized so they stay readable when scaled to ~full page width.
  const width = 1600;
  const pad = 12;
  const gap = 14;
  const cols = 4;
  const colW = (width - pad * 2 - gap * (cols - 1)) / cols;
  const headerH = 78;
  const bodyPad = 18;
  const lineH = 26;
  const maxChars = 26;

  const levelBodies = STANDARD_CLASSWORK_RUBRIC.levels.map((level) => {
    const blocks: { lines: string[] }[] = level.criteria.map((criterion) => ({
      lines: wrapText(criterion, maxChars),
    }));
    return blocks;
  });

  const bodyHeights = levelBodies.map((blocks) => {
    let h = bodyPad;
    for (const block of blocks) {
      h += 6;
      h += block.lines.length * lineH;
      h += 14;
    }
    return h + bodyPad;
  });
  const bodyH = Math.max(...bodyHeights);
  // No baked-in title — section heading already names the rubric.
  const height = pad + headerH + bodyH + pad;

  const columns = STANDARD_CLASSWORK_RUBRIC.levels
    .map((level, i) => {
      const x = pad + i * (colW + gap);
      const y = pad;
      const color = COLORS[i]!;
      const blocks = levelBodies[i]!;

      let cy = y + headerH + bodyPad;
      const criteriaSvg = blocks
        .map((block) => {
          const boxY = cy + 3;
          const textX = x + bodyPad + 24;
          const linesSvg = block.lines
            .map((line, li) => {
              const ty = cy + 18 + li * lineH;
              return `<text x="${textX}" y="${ty}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#334155">${escapeXml(line)}</text>`;
            })
            .join("\n");
          const checkbox = `<rect x="${x + bodyPad}" y="${boxY}" width="16" height="16" rx="2" fill="none" stroke="#94A3B8" stroke-width="1.75"/>`;
          cy += 6 + block.lines.length * lineH + 14;
          return `${checkbox}\n${linesSvg}`;
        })
        .join("\n");

      return `
        <rect x="${x}" y="${y}" width="${colW}" height="${headerH + bodyH}" rx="10" fill="#F8FAFC" stroke="${color.border}" stroke-width="2"/>
        <path d="M ${x} ${y + 12} Q ${x} ${y} ${x + 12} ${y} L ${x + colW - 12} ${y} Q ${x + colW} ${y} ${x + colW} ${y + 12} L ${x + colW} ${y + headerH} L ${x} ${y + headerH} Z" fill="${color.headerBg}"/>
        <text x="${x + colW / 2}" y="${y + 32}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${color.headerFg}">${level.score}</text>
        <text x="${x + colW / 2}" y="${y + 60}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="${color.headerFg}">${escapeXml(level.label)}</text>
        ${criteriaSvg}
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  ${columns}
</svg>`;
}

async function main() {
  const svg = buildSvg();
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(OUT);
  console.log("Wrote", OUT);
}

void main();
