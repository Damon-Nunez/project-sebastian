import { NextResponse } from "next/server";
import {
  getCurrentTeacher,
  TeacherAuthError,
} from "@/lib/auth/getCurrentTeacher";
import { parseLessonPlanContent } from "@/lib/lessons/content";
import {
  buildLessonPlanExport,
  type LessonExportFormat,
} from "@/lib/lessons/export";
import { getLessonPlanForTeacher } from "@/lib/lessons/plans";

type RouteContext = {
  params: Promise<{ lessonId: string }>;
};

function parseFormat(raw: string | null): LessonExportFormat | null {
  if (raw === "docx" || raw === "pdf") return raw;
  return null;
}

/**
 * GET /lessons/[lessonId]/export?format=docx|pdf
 * Auth-gated download of the current Edited lesson plan.
 */
export async function GET(request: Request, context: RouteContext) {
  const { lessonId } = await context.params;
  const format = parseFormat(new URL(request.url).searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "Use format=docx or format=pdf" },
      { status: 400 },
    );
  }

  let teacher;
  try {
    teacher = await getCurrentTeacher();
  } catch (error) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const plan = await getLessonPlanForTeacher(teacher.id, lessonId);
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = parseLessonPlanContent(plan.content);
  const file = await buildLessonPlanExport({
    content,
    format,
    labels: {
      moduleLabel: plan.module_label,
      unitLabel: plan.unit_label,
      lessonLabel: plan.lesson_label,
    },
  });

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
