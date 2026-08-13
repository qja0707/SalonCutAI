import { BlogWireResult, BLOG_SECTION_ORDER, BlogSection } from "./types";

function normalizeHashtag(value: string): string {
  return `#${value.replace(/^#+/, "")}`;
}

function getOrderedSections(result: BlogWireResult): BlogSection[] {
  return BLOG_SECTION_ORDER.map((key) => result.sections[key]).filter(Boolean);
}

export function buildBlogPlainText(result: BlogWireResult): string {
  const sections = getOrderedSections(result);

  return [
    result.title,
    "",
    result.intro,
    "",
    ...sections.flatMap((section) => [
      `■ ${section.heading}`,
      section.body,
      "",
    ]),
    result.closing,
    "",
    result.hashtags.map(normalizeHashtag).join(" "),
  ].join("\n");
}

export function buildBlogHtml(result: BlogWireResult): string {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const sections = getOrderedSections(result);
  const sectionBlocks = sections.map(
    (section) =>
      `<h2>${escape(section.heading)}</h2><p>${escape(section.body).replaceAll("\n", "<br>")}</p>`,
  );

  const spacer = "<p><br></p>";
  const hashtags = result.hashtags
    .map((tag) => escape(normalizeHashtag(tag)))
    .join(" ");
  return [
    `<h1>${escape(result.title)}</h1>`,
    `<p>${escape(result.intro)}</p>`,
    ...sectionBlocks,
    `<p>${escape(result.closing)}</p>`,
    `<p>${hashtags}</p>`,
  ].join(spacer);
}

export async function copyBlogResult(result: BlogWireResult): Promise<void> {
  const plain = buildBlogPlainText(result);
  const html = buildBlogHtml(result);

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(plain);
}
