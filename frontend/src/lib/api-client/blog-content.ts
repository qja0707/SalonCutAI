import type { BlogResult } from "@/lib/api-client/types";

function normalizeHashtag(value: string): string {
  return `#${value.replace(/^#+/, "")}`;
}

export function buildBlogPlainText(result: BlogResult): string {
  return [result.title, "", result.body, "", result.hashtags.map(normalizeHashtag).join(" ")].join("\n");
}

export function buildBlogHtml(result: BlogResult): string {
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const body = escape(result.body).replaceAll("\n", "<br>");
  const hashtags = result.hashtags.map((tag) => escape(normalizeHashtag(tag))).join(" ");
  return `<h1>${escape(result.title)}</h1><p>${body}</p><p>${hashtags}</p>`;
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
