/**
 * Sanitizer playground.
 *
 * Interactive:
 *   npm run sanitize:demo
 *
 * Instant defaults (no prompts):
 *   npm run sanitize:demo -- --defaults
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  matchStudentFromDocument,
  prepareTextForAi,
  rehydratePreparedAiText,
  type RosterStudent,
} from "../src/lib/sanitizer/index";

const DEMO_ROSTER: RosterStudent[] = [
  { id: "s01", name: "Aaliyah Thompson" },
  { id: "s02", name: "Noah Kim" },
  { id: "s03", name: "Sofia Reyes" },
  { id: "s04", name: "Liam O'Brien" },
  { id: "s05", name: "Emma Nguyen" },
];

const DEMO_TEXT = [
  "Grade this short response.",
  "Aaliyah Thompson has a clear claim.",
  "Noah Kim needs stronger evidence.",
  "Nice peer note from Sofia Reyes.",
].join("\n");

const DEMO_FILENAME = "Reyes_Sofia_essay.pdf";

function parseRoster(line: string): RosterStudent[] {
  const names = line
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  return names.map((name, i) => ({
    id: `demo-${String(i + 1).padStart(2, "0")}`,
    name,
  }));
}

function printDivider(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 40 - title.length))}`);
}

function runDemo(opts: {
  roster: RosterStudent[];
  text: string;
  filename: string | null;
}) {
  const { roster, text, filename } = opts;

  printDivider("Roster");
  for (const s of roster) {
    console.log(`  ${s.id}  ${s.name}`);
  }

  printDivider("Original (as stored locally)");
  console.log(text);

  const prepared = prepareTextForAi(text, roster);

  printDivider("Redacted (what would go to AI)");
  console.log(prepared.sanitizedText);

  printDivider("Rehydrated (what teacher would see)");
  console.log(rehydratePreparedAiText(prepared.sanitizedText, prepared.map));

  printDivider("Token map");
  for (const entry of prepared.map.entries) {
    console.log(
      `  ${entry.token}  ←  ${entry.name}  (aliases: ${entry.aliases.join(", ")})`,
    );
  }

  if (filename) {
    printDivider("Filename match");
    const match = matchStudentFromDocument(roster, { filename });
    if (match.status === "matched") {
      console.log(`  matched → ${match.student.name} (${match.student.id})`);
    } else if (match.status === "ambiguous") {
      console.log(
        `  ambiguous → ${match.candidates.map((c) => c.name).join(", ")}`,
      );
    } else {
      console.log("  none → no roster name found in filename");
    }
  }

  console.log("\nDone. Run again: npm run sanitize:demo\n");
}

async function promptInputs() {
  const rl = readline.createInterface({ input, output });

  console.log("Project Sebastian — sanitizer demo");
  console.log("Press Enter to keep defaults.\n");

  const rosterLine = await rl.question(
    `Roster names (comma-separated)\n[default: ${DEMO_ROSTER.map((s) => s.name).join(", ")}]\n> `,
  );
  const roster =
    rosterLine.trim().length > 0 ? parseRoster(rosterLine) : DEMO_ROSTER;

  console.log("\nText to sanitize (one line):");
  console.log("[default: multi-line demo with several student names]");
  const textLine = await rl.question("> ");
  const text = textLine.trim().length > 0 ? textLine : DEMO_TEXT;

  const filenameLine = await rl.question(
    `\nOptional filename to match\n[default: ${DEMO_FILENAME}]\n> `,
  );
  const filename =
    filenameLine.trim().length > 0 ? filenameLine.trim() : DEMO_FILENAME;

  rl.close();
  return { roster, text, filename };
}

async function main() {
  const useDefaults = process.argv.includes("--defaults");

  if (useDefaults) {
    console.log("Project Sebastian — sanitizer demo (--defaults)\n");
    runDemo({
      roster: DEMO_ROSTER,
      text: DEMO_TEXT,
      filename: DEMO_FILENAME,
    });
    return;
  }

  const inputs = await promptInputs();
  runDemo(inputs);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
