/**
 * Trial: extract a framework PDF/DOCX and sort buckets with Haiku.
 * Run: npx tsx scripts/trial-llm-framework-parse.ts [path]
 *
 * Default: lesssonPlanReferencesSchool/U1L3-Kiddom.pdf
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractFrameworkText } from "../src/lib/lessons/extract";
import { bucketsToLessonPlanContent } from "../src/lib/lessons/llmBuckets";
import { parseFrameworkWithLlm } from "../src/lib/lessons/parseFrameworkLlm";
import { parseFrameworkText } from "../src/lib/lessons/parseFramework";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** Load .env.local into process.env when running outside Next. */
function loadEnvLocal() {
  const envPath = path.join(repoRoot, ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Caller will fail later if ANTHROPIC_API_KEY missing.
  }
}

loadEnvLocal();

async function main() {
  const rel =
    process.argv[2] ??
    path.join("lesssonPlanReferencesSchool", "U1L3-Kiddom.pdf");
  const filePath = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
  const filename = path.basename(filePath);

  console.log(`Extracting ${filename}…`);
  const buffer = await readFile(filePath);
  const extracted = await extractFrameworkText({ buffer, filename });
  console.log(
    `Extracted ${extracted.text.length} chars (${extracted.format}). Calling LLM sorter…`,
  );

  const keywordContent = parseFrameworkText(extracted.text);
  const llm = await parseFrameworkWithLlm({
    text: extracted.text,
    filename,
  });
  const populaterContent = bucketsToLessonPlanContent(llm.buckets);

  const outDir = path.join(repoRoot, "tmp-parse");
  await mkdir(outDir, { recursive: true });
  const stem = filename.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-");
  const outPath = path.join(outDir, `${stem}-llm-buckets.json`);

  const payload = {
    sourceFilename: filename,
    model: llm.model,
    inputChars: llm.inputChars,
    buckets: llm.buckets,
    /** What today's form populater would receive after mapping. */
    populaterContent,
    /** Keyword parser baseline for comparison. */
    keywordBaseline: {
      agendaChars: keywordContent.agenda.length,
      standardsChars: keywordContent.standards.length,
      openingBodyChars: keywordContent.opening.body.length,
      closingBodyChars: keywordContent.closing.body.length,
      materialsChars: keywordContent.materials.length,
      workTimeCount: keywordContent.workTimes.length,
      extras: keywordContent.extras.map((e) => e.label),
      agendaStartsWith: keywordContent.agenda.slice(0, 200),
    },
  };

  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("\n=== LLM buckets (for populater) ===\n");
  console.log(JSON.stringify(llm.buckets, null, 2));
  console.log("\n=== Mapped populater content (summary) ===\n");
  console.log(
    JSON.stringify(
      {
        standards: populaterContent.standards,
        entranceTicketPreview: populaterContent.entranceTicket.slice(0, 240),
        vocabularyPreview: populaterContent.vocabulary.slice(0, 280),
        agendaPreview: populaterContent.agenda.slice(0, 400),
        agendaChars: populaterContent.agenda.length,
        openingLabel: populaterContent.opening.label,
        openingMinutes: populaterContent.opening.minutes,
        openingBodyChars: populaterContent.opening.body.length,
        openingPreview: populaterContent.opening.body.slice(0, 300),
        closingLabel: populaterContent.closing.label,
        closingMinutes: populaterContent.closing.minutes,
        closingBodyChars: populaterContent.closing.body.length,
        closingPreview: populaterContent.closing.body.slice(0, 300),
        materialsChars: populaterContent.materials.length,
        workTimes: populaterContent.workTimes.map((w) => ({
          key: w.key,
          label: w.label,
          minutes: w.minutes,
          bodyChars: w.body.length,
          bodyPreview: w.body.slice(0, 160),
        })),
        extras: populaterContent.extras.map((e) => ({
          label: e.label,
          bodyChars: e.body.length,
          preview: e.body.slice(0, 200),
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote full payload → ${path.relative(repoRoot, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
