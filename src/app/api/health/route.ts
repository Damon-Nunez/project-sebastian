import { NextResponse } from "next/server";
import { getAiClient } from "@/lib/ai/getAiClient";
import { DOMAIN_TABLES } from "@/lib/db/types";
import { isAnthropicConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function publicMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV !== "production" && err instanceof Error) {
    return err.message;
  }
  return fallback;
}

function healthJson(
  result: Record<string, unknown>,
  status = 200,
): NextResponse {
  console.log("[api/health]", result);
  return NextResponse.json(result, { status });
}

export async function GET() {
  const result: {
    ok: boolean;
    db: "connected" | "error" | "skipped";
    ai: "configured" | "missing" | "error";
    teachersCount?: number;
    schemaOk?: boolean;
    missingTables?: string[];
    message?: string;
  } = {
    ok: false,
    db: "skipped",
    ai: "missing",
  };

  try {
    const supabase = createAdminSupabaseClient();
    const { error, count } = await supabase
      .from("teachers")
      .select("*", { count: "exact", head: true });

    if (error) {
      result.db = "error";
      result.message = publicMessage(error, "Database check failed");
      return healthJson(result, 500);
    }

    result.db = "connected";
    result.teachersCount = count ?? 0;

    const missingTables: string[] = [];
    for (const table of DOMAIN_TABLES) {
      const { error: tableError } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (tableError) {
        missingTables.push(table);
      }
    }

    result.missingTables = missingTables;
    result.schemaOk = missingTables.length === 0;
    if (!result.schemaOk) {
      result.message = publicMessage(
        new Error(`Missing or inaccessible tables: ${missingTables.join(", ")}`),
        "Domain schema incomplete — apply migrations 003–007",
      );
    }
  } catch (err) {
    result.db = "error";
    result.message = publicMessage(err, "Database check failed");
    return healthJson(result, 500);
  }

  try {
    if (!isAnthropicConfigured()) {
      result.ai = "missing";
      result.ok = false;
      result.message = "ANTHROPIC_API_KEY not set";
      return healthJson(result, 200);
    }

    // Initialize client only — do not call messages.create (avoids spend).
    getAiClient("smoke-check");
    result.ai = "configured";
    result.ok = result.schemaOk !== false;
    return healthJson(result);
  } catch (err) {
    result.ai = "error";
    result.message = publicMessage(err, "AI client check failed");
    return healthJson(result, 500);
  }
}
