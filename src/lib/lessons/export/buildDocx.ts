import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { HydratedLessonPlanExportDocument } from "./hydrateAssets";
import {
  fitImageSize,
  mimeToDocxImageType,
  sniffImageKind,
} from "./imageSizing";

function paragraphsFromBody(body: string): Paragraph[] {
  if (!body.trim()) return [];
  return body.split(/\r?\n/).map(
    (line) =>
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: line.length > 0 ? line : " ",
            size: 22,
          }),
        ],
      }),
  );
}

function imageParagraph(
  bytes: Uint8Array,
  kind: "jpg" | "png" | "gif" | "bmp",
  alt: string,
  maxWidth: number,
  maxHeight: number,
): Paragraph {
  const size = fitImageSize(null, null, maxWidth, maxHeight);
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
    const label = image.caption || image.originalFilename || "Image";
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
      out.push(imageParagraph(image.bytes, kind, label, 480, 360));
      out.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({ text: label, italics: true, size: 18 }),
          ],
        }),
      );
    } else {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `Image (could not embed): ${label}`,
              italics: true,
              size: 20,
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
      // Clickable thumbnail → opens the video/resource URL.
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
                color: "0563C1",
                underline: {},
                size: 20,
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
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: doc.title,
          bold: true,
          size: 32,
        }),
      ],
    }),
  ];

  if (doc.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: doc.subtitle,
            italics: true,
            size: 20,
          }),
        ],
      }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            size: 26,
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
