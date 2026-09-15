import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  EXPORT_COLORS,
  EXPORT_THEME_DOCX,
  isRoutineHeadingLine,
  splitBodyLines,
} from "./exportTheme";
import type { LessonPlanExportHeader } from "./documentModel";
import type { ExportGroupingsTable } from "./groupingsModel";
import type { HydratedLessonPlanExportDocument } from "./hydrateAssets";
import {
  fitImageSize,
  mimeToDocxImageType,
  readPngSize,
  sniffImageKind,
} from "./imageSizing";

/** ~6.5" content width for US Letter with ~1" margins (DXA / twips). */
const TABLE_WIDTH_DXA = 9360;

function headerCellParagraphs(lines: { bold?: string; text?: string }[]): Paragraph[] {
  if (lines.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: " ", size: EXPORT_THEME_DOCX.bodySize })],
      }),
    ];
  }
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 40 },
        children: [
          ...(line.bold
            ? [
                new TextRun({
                  text: line.bold,
                  bold: true,
                  size: EXPORT_THEME_DOCX.bodySize,
                  color: EXPORT_COLORS.textHex,
                }),
                new TextRun({
                  text: line.text ? ` ${line.text}` : "",
                  size: EXPORT_THEME_DOCX.bodySize,
                  color: EXPORT_COLORS.textHex,
                }),
              ]
            : [
                new TextRun({
                  text: line.text ?? " ",
                  size: EXPORT_THEME_DOCX.bodySize,
                  color: EXPORT_COLORS.textHex,
                }),
              ]),
        ],
      }),
  );
}

function headerTable(header: LessonPlanExportHeader): Table {
  // docx percentage widths often collapse in Word/Google Docs — use DXA (twips).
  const CELL_WIDTH_DXA = TABLE_WIDTH_DXA / 2;

  const border = {
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000",
  };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
  };
  const cell = (lines: { bold?: string; text?: string }[]) =>
    new TableCell({
      borders,
      width: { size: CELL_WIDTH_DXA, type: WidthType.DXA },
      children: headerCellParagraphs(lines),
    });

  const topLeft: { bold?: string; text?: string }[] = [];
  if (header.subject) {
    topLeft.push({ bold: "SUBJECT:", text: header.subject });
  }
  if (header.moduleUnitLine) {
    topLeft.push({ text: header.moduleUnitLine });
  }
  if (header.lessonLine) {
    topLeft.push({ bold: header.lessonLine });
  }

  const topRight: { bold?: string; text?: string }[] = [];
  if (header.gradeLabel) {
    topRight.push({ bold: "Grade:", text: header.gradeLabel });
  }
  if (header.textTitle) {
    topRight.push({ bold: "Text:", text: header.textTitle });
  }

  const bottomLeft: { bold?: string; text?: string }[] = [];
  if (header.teacherLine) {
    bottomLeft.push({ bold: "Teacher:", text: header.teacherLine });
  }

  const bottomRight: { bold?: string; text?: string }[] = [];
  if (header.timeFrame) {
    bottomRight.push({ bold: "Time Frame to Complete Lesson:" });
    bottomRight.push({ text: header.timeFrame });
  }

  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [CELL_WIDTH_DXA, CELL_WIDTH_DXA],
    rows: [
      new TableRow({
        children: [cell(topLeft), cell(topRight)],
      }),
      new TableRow({
        children: [cell(bottomLeft), cell(bottomRight)],
      }),
    ],
  });
}

function groupingsTable(groupings: ExportGroupingsTable): Table {
  const colCount = 1 + groupings.columnKeys.length;
  const colWidth = Math.floor(TABLE_WIDTH_DXA / colCount);
  const columnWidths = Array.from({ length: colCount }, () => colWidth);
  const tableWidth = colWidth * colCount;

  const border = {
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000",
  };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
  };

  const textCell = (text: string, opts?: { bold?: boolean; header?: boolean }) =>
    new TableCell({
      borders,
      width: { size: colWidth, type: WidthType.DXA },
      children: text.split("\n").map(
        (line, index, lines) =>
          new Paragraph({
            spacing: { after: index === lines.length - 1 ? 0 : 40 },
            children: [
              new TextRun({
                text: line.length > 0 ? line : " ",
                bold: opts?.bold ?? false,
                size: opts?.header
                  ? EXPORT_THEME_DOCX.captionSize
                  : EXPORT_THEME_DOCX.bodySize,
                color: EXPORT_COLORS.textHex,
              }),
            ],
          }),
      ),
    });

  const headerRow = new TableRow({
    children: [
      textCell("Class", { bold: true, header: true }),
      ...groupings.columnKeys.map((key) =>
        textCell(`Group ${key}`, { bold: true, header: true }),
      ),
    ],
  });

  const bodyRows = groupings.rows.map(
    (row) =>
      new TableRow({
        children: [
          textCell(row.periodName, { bold: true }),
          ...row.cells.map((cell) => textCell(cell)),
        ],
      }),
  );

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths,
    rows: [headerRow, ...bodyRows],
  });
}
function paragraphsFromBody(body: string): Paragraph[] {
  if (!body) return [];
  return splitBodyLines(body).map((line) => {
    const isBlank = line.length === 0;
    const isHeading = !isBlank && isRoutineHeadingLine(line);
    return new Paragraph({
      spacing: {
        after: isBlank
          ? EXPORT_THEME_DOCX.afterBlankLine
          : isHeading
            ? EXPORT_THEME_DOCX.afterRoutineHeading
            : EXPORT_THEME_DOCX.afterBodyLine,
      },
      children: [
        new TextRun({
          text: isBlank ? " " : line,
          bold: isHeading,
          size: EXPORT_THEME_DOCX.bodySize,
          color: EXPORT_COLORS.textHex,
        }),
      ],
    });
  });
}

function imageParagraph(
  bytes: Uint8Array,
  kind: "jpg" | "png" | "gif" | "bmp",
  alt: string,
  maxWidth: number,
  maxHeight: number,
): Paragraph {
  const png = kind === "png" ? readPngSize(bytes) : null;
  const size = fitImageSize(
    png?.width ?? null,
    png?.height ?? null,
    maxWidth,
    maxHeight,
  );
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: kind,
        data: bytes,
        transformation: size,
        altText: {
          title: alt,
          description: alt,
          name: alt.slice(0, 64) || "image",
        },
      }),
    ],
  });
}

function attachmentParagraphs(
  section: HydratedLessonPlanExportDocument["sections"][number],
): Paragraph[] {
  const out: Paragraph[] = [];

  for (const image of section.images) {
    const caption = image.caption.trim();
    const alt = caption || "Image";
    const kindFromEmbed =
      image.embedMimeType === "image/png"
        ? ("png" as const)
        : image.embedMimeType === "image/jpeg"
          ? ("jpg" as const)
          : null;
    const kind =
      kindFromEmbed ??
      (image.bytes ? sniffImageKind(image.bytes) : null) ??
      mimeToDocxImageType(image.mimeType);

    if (image.bytes && kind && (kind === "jpg" || kind === "png" || kind === "gif" || kind === "bmp")) {
      // Full content width (~6.5"); height follows aspect (do not cap short).
      const maxW = image.publicPath ? 624 : 480;
      const maxH = image.publicPath ? 400 : 360;
      out.push(imageParagraph(image.bytes, kind, alt, maxW, maxH));
      if (caption) {
        out.push(
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: caption,
                italics: true,
                size: EXPORT_THEME_DOCX.captionSize,
                color: EXPORT_COLORS.textHex,
              }),
            ],
          }),
        );
      }
    } else {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: "Image (could not embed)",
              italics: true,
              size: 20,
              color: EXPORT_COLORS.textHex,
            }),
          ],
        }),
      );
    }
  }

  for (const link of section.links) {
    const title = link.title || "Video / link";
    const thumbKind = link.thumbnailBytes
      ? sniffImageKind(link.thumbnailBytes)
      : null;

    if (link.thumbnailBytes && thumbKind) {
      out.push(
        new Paragraph({
          spacing: { before: 120, after: 80 },
          children: [
            new ExternalHyperlink({
              link: link.url,
              children: [
                new ImageRun({
                  type: thumbKind,
                  data: link.thumbnailBytes,
                  transformation: fitImageSize(null, null, 420, 236),
                  altText: {
                    title,
                    description: title,
                    name: title.slice(0, 64) || "video",
                  },
                }),
              ],
            }),
          ],
        }),
      );
    }

    out.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new ExternalHyperlink({
            link: link.url,
            children: [
              new TextRun({
                text: `${title} — ${link.url}`,
                style: "Hyperlink",
                color: EXPORT_COLORS.linkHex,
                underline: {},
                size: EXPORT_THEME_DOCX.linkSize,
              }),
            ],
          }),
        ],
      }),
    );
  }

  return out;
}

/** Build a .docx buffer with embedded images + clickable video links. */
export async function buildLessonPlanDocx(
  doc: HydratedLessonPlanExportDocument,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: EXPORT_THEME_DOCX.afterTitle },
      children: [
        new TextRun({
          text: doc.title,
          bold: true,
          size: EXPORT_THEME_DOCX.titleSize,
          color: EXPORT_COLORS.headingHex,
        }),
      ],
    }),
  ];

  if (doc.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: EXPORT_THEME_DOCX.afterSubtitle },
        children: [
          new TextRun({
            text: doc.subtitle,
            italics: true,
            size: EXPORT_THEME_DOCX.subtitleSize,
            color: EXPORT_COLORS.textHex,
          }),
        ],
      }),
    );
  }

  if (doc.header) {
    children.push(headerTable(doc.header));
    children.push(
      new Paragraph({
        spacing: { after: EXPORT_THEME_DOCX.afterSubtitle },
        children: [],
      }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: EXPORT_THEME_DOCX.beforeSection,
          after: EXPORT_THEME_DOCX.afterSection,
        },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            size: EXPORT_THEME_DOCX.sectionHeadingSize,
            color: EXPORT_COLORS.headingHex,
          }),
        ],
      }),
      ...paragraphsFromBody(section.body),
      ...attachmentParagraphs(section),
    );
  }

  if (doc.groupings) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: EXPORT_THEME_DOCX.beforeSection,
          after: EXPORT_THEME_DOCX.afterSection,
        },
        children: [
          new TextRun({
            text: "Groupings",
            bold: true,
            size: EXPORT_THEME_DOCX.sectionHeadingSize,
            color: EXPORT_COLORS.headingHex,
          }),
        ],
      }),
    );
    children.push(groupingsTable(doc.groupings));
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
