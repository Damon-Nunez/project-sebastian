import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  EXPORT_COLORS,
  EXPORT_THEME_DOCX,
  isRoutineHeadingLine,
  splitBodyLines,
} from "./exportTheme";
import type { HydratedLessonPlanExportDocument } from "./hydrateAssets";
import {
  fitImageSize,
  mimeToDocxImageType,
  readPngSize,
  sniffImageKind,
} from "./imageSizing";

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
  const children: Paragraph[] = [
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
