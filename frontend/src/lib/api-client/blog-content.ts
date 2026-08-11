import type { BlogResult } from "@/lib/api-client/types";

function normalizeHashtag(value: string): string {
  return `#${value.replace(/^#+/, "")}`;
}

export function buildBlogPlainText(result: BlogResult): string {
  return [
    result.title,
    "",
    result.intro,
    "",
    ...result.sections.flatMap((section) => [`■ ${section.heading}`, section.body, ""]),
    result.closing,
    "",
    result.hashtags.map(normalizeHashtag).join(" "),
  ].join("\n");
}

export function buildBlogHtml(result: BlogResult): string {
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const sectionBlocks = result.sections
    .map((section) => `<h2>${escape(section.heading)}</h2><p>${escape(section.body).replaceAll("\n", "<br>")}</p>`)
  const spacer = "<p><br></p>";
  const hashtags = result.hashtags.map((tag) => escape(normalizeHashtag(tag))).join(" ");
  return [
    `<h1>${escape(result.title)}</h1>`,
    `<p>${escape(result.intro)}</p>`,
    ...sectionBlocks,
    `<p>${escape(result.closing)}</p>`,
    `<p>${hashtags}</p>`,
  ].join(spacer);
}

export async function copyBlogResult(result: BlogResult): Promise<void> {
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
