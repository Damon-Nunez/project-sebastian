import { NextResponse } from "next/server";
import { getAiClient } from "@/lib/ai/getAiClient";
import { isAnthropicConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    const supabase = createServerSupabaseClient();
    const { error, count } = await supabase
      .from("teachers")
      .select("*", { count: "exact", head: true });

    if (error) {
      result.db = "error";
      result.message = error.message;
      return NextResponse.json(result, { status: 500 });
    }

    result.db = "connected";
    result.teachersCount = count ?? 0;
  } catch (err) {
    result.db = "error";
    result.message = err instanceof Error ? err.message : "Unknown DB error";
    return NextResponse.json(result, { status: 500 });
  }

  try {
    if (!isAnthropicConfigured()) {
      result.ai = "missing";
      result.ok = false;
      result.message =
        "ANTHROPIC_API_KEY not set - add it to .env.local (no paid API call yet)";
      return NextResponse.json(result, { status: 200 });
    }

    // Initialize client only — do not call messages.create (avoids spend).
    getAiClient("smoke-check");
    result.ai = "configured";
    result.ok = true;
    return NextResponse.json(result);
  } catch (err) {
    result.ai = "error";
    result.message = err instanceof Error ? err.message : "Unknown AI error";
    return NextResponse.json(result, { status: 500 });
  }
}
