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

function copyBlogResultWithSelection(plain: string, html: string): void {
  const selection = window.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const previousActiveElement = document.activeElement;
  const copyTarget = document.createElement("div");
  let clipboardDataWritten = false;

  copyTarget.contentEditable = "true";
  copyTarget.setAttribute("aria-hidden", "true");
  copyTarget.style.position = "fixed";
  copyTarget.style.left = "-9999px";
  copyTarget.style.top = "0";
  copyTarget.style.opacity = "0";
  copyTarget.style.pointerEvents = "none";
  copyTarget.innerHTML = html;

  const handleCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", plain);
    event.clipboardData.setData("text/html", html);
    clipboardDataWritten = true;
  };

  copyTarget.addEventListener("copy", handleCopy);
  document.body.appendChild(copyTarget);

  try {
    const range = document.createRange();
    range.selectNodeContents(copyTarget);
    copyTarget.focus({ preventScroll: true });
    selection?.removeAllRanges();
    selection?.addRange(range);

    const copied = document.execCommand("copy");
    if (!copied || !clipboardDataWritten) {
      throw new Error("블로그 글을 클립보드에 복사하지 못했습니다.");
    }
  } finally {
    copyTarget.removeEventListener("copy", handleCopy);
    copyTarget.remove();
    selection?.removeAllRanges();
    previousRanges.forEach((range) => selection?.addRange(range));
    if (previousActiveElement instanceof HTMLElement) {
      previousActiveElement.focus({ preventScroll: true });
    }
  }
}

export async function copyBlogResult(result: BlogWireResult): Promise<void> {
  const plain = buildBlogPlainText(result);
  const html = buildBlogHtml(result);

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    copyBlogResultWithSelection(plain, html);
    return;
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([plain], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    }),
  ]);
}
