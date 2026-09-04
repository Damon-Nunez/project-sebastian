import { NextResponse } from "next/server";
import { getAiClient } from "@/lib/ai/getAiClient";
import { isAnthropicConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function publicMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV !== "production" && err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export async function GET() {
  const result: {
    ok: boolean;
    db: "connected" | "error" | "skipped";
    ai: "configured" | "missing" | "error";
    teachersCount?: number;
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
      return NextResponse.json(result, { status: 500 });
    }

    result.db = "connected";
    result.teachersCount = count ?? 0;
  } catch (err) {
    result.db = "error";
    result.message = publicMessage(err, "Database check failed");
    return NextResponse.json(result, { status: 500 });
  }

  try {
    if (!isAnthropicConfigured()) {
      result.ai = "missing";
      result.ok = false;
      result.message = "ANTHROPIC_API_KEY not set";
      return NextResponse.json(result, { status: 200 });
    }

    // Initialize client only — do not call messages.create (avoids spend).
    getAiClient("smoke-check");
    result.ai = "configured";
    result.ok = true;
    return NextResponse.json(result);
  } catch (err) {
    result.ai = "error";
    result.message = publicMessage(err, "AI client check failed");
    return NextResponse.json(result, { status: 500 });
  }
}
