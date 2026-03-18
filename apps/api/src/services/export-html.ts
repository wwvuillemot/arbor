export function wrapMarkdownInHtmlDocument(
  markdown: string,
  title: string,
): string {
  const htmlContent = markdownToBasicHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || "Export")}</title>
  <style>
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.3em; }
    h4, h5, h6 { font-size: 1.1em; margin-top: 1em; }
    p { margin: 0.8em 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    img { max-width: 100%; height: auto; }
    body > img,
    h1 + img, h2 + img, h3 + img, h4 + img, h5 + img, h6 + img {
      display: block;
      margin: 1.25em auto 1.5em;
      max-height: 420px;
      object-fit: contain;
      page-break-inside: avoid;
    }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 2em; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

function markdownToBasicHtml(markdown: string): string {
  let html = markdown;

  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, language: string, code: string) =>
      `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`,
  );

  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/^---$/gm, "<hr>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/^(?:> (.+)\n?)+/gm, (match) => {
    const text = match.replace(/^> ?/gm, "").trim();
    return `<blockquote><p>${text}</p></blockquote>`;
  });

  return html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (
        !trimmed ||
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<img")
      ) {
        return trimmed;
      }

      return `<p>${trimmed}</p>`;
    })
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
