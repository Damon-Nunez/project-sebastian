import { NextResponse } from "next/server";
import {
  getCurrentTeacher,
  TeacherAuthError,
} from "@/lib/auth/getCurrentTeacher";
import { parseLessonPlanContent } from "@/lib/lessons/content";
import { buildLessonPlanExport } from "@/lib/lessons/export";
import { getLessonPlanForTeacher } from "@/lib/lessons/plans";

type RouteContext = {
  params: Promise<{ lessonId: string }>;
};

/**
 * GET /lessons/[lessonId]/export
 * Auth-gated .docx download of the current Edited lesson plan.
 * Optional ?format=docx is accepted for older links; PDF export was removed.
 */
export async function GET(request: Request, context: RouteContext) {
  const { lessonId } = await context.params;
  const format = new URL(request.url).searchParams.get("format");
  if (format != null && format !== "docx") {
    return NextResponse.json(
      { error: "Only .docx export is supported. Convert to PDF from Word or Google Docs if needed." },
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
