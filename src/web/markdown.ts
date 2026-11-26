function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}

const paraScriptKeywords = new Set([
    "setup", "parameters", "param", "def", "fn", "export", "return", "true", "false", "match", "let", "in"
]);

/** Color a script the way the homepage sphere is colored. */
export function highlightParaScript(source: string): string {
    const identStart = /[A-Za-z_]/;
    const identChar = /[A-Za-z0-9_]/;
    let html = "";
    let index = 0;
    let pendingName = false;
    while (index < source.length) {
        const current = source[index] ?? "";
        if (current === "/" && source[index + 1] === "/") {
            const end = source.indexOf("\n", index);
            const stop = end === -1 ? source.length : end;
            html += `<span class="cmt">${escapeHtml(source.slice(index, stop))}</span>`;
            index = stop;
            pendingName = false;
            continue;
        }
        if (current === "\"") {
            let cursor = index + 1;
            while (cursor < source.length && source[cursor] !== "\"") {
                if (source[cursor] === "\\") cursor += 1;
                cursor += 1;
            }
            if (cursor < source.length) cursor += 1;
            html += `<span class="str">${escapeHtml(source.slice(index, cursor))}</span>`;
            index = cursor;
            pendingName = false;
            continue;
        }
        if (current === "$" && identStart.test(source[index + 1] ?? "")) {
            let cursor = index + 1;
            while (cursor < source.length && identChar.test(source[cursor] ?? "")) cursor += 1;
            html += `<span class="name">${escapeHtml(source.slice(index, cursor))}</span>`;
            index = cursor;
            pendingName = false;
            continue;
        }
        if ((current >= "0" && current <= "9") || (current === "." && /[0-9]/.test(source[index + 1] ?? ""))) {
            let cursor = index + 1;
            while (cursor < source.length && /[0-9.]/.test(source[cursor] ?? "")) cursor += 1;
            html += `<span class="num">${escapeHtml(source.slice(index, cursor))}</span>`;
            index = cursor;
            pendingName = false;
            continue;
        }
        if (current === "." && identStart.test(source[index + 1] ?? "")) {
            let cursor = index + 1;
            while (cursor < source.length && identChar.test(source[cursor] ?? "")) cursor += 1;
            html += `.<span class="name">${escapeHtml(source.slice(index + 1, cursor))}</span>`;
            index = cursor;
            pendingName = false;
            continue;
        }
        if (identStart.test(current)) {
            let cursor = index + 1;
            while (cursor < source.length && identChar.test(source[cursor] ?? "")) cursor += 1;
            const word = source.slice(index, cursor);
            let look = cursor;
            while (look < source.length && (source[look] === " " || source[look] === "\t")) look += 1;
            const next = source[look] ?? "";
            const kind = paraScriptKeywords.has(word)
                ? "kw"
                : pendingName
                    ? "fn"
                    : next === "("
                        ? "fn"
                        : next === ":"
                            ? "name"
                            : "";
            html += kind === "" ? escapeHtml(word) : `<span class="${kind}">${escapeHtml(word)}</span>`;
            pendingName = word === "def" || word === "param";
            index = cursor;
            continue;
        }
        html += escapeHtml(current);
        if (current !== " " && current !== "\t" && current !== "\n" && current !== "\r") pendingName = false;
        index += 1;
    }
    return html;
}

function isSafeHref(href: string): boolean {
    if (href.startsWith("/") && !href.startsWith("//")) return true;
    return href.startsWith("https://") || href.startsWith("http://");
}

export function renderInline(text: string): string {
    let html = "";
    let index = 0;
    while (index < text.length) {
        if (text.startsWith("`", index)) {
            const end = text.indexOf("`", index + 1);
            if (end === -1) {
                html += escapeHtml(text.slice(index));
                break;
            }
            html += `<code>${escapeHtml(text.slice(index + 1, end))}</code>`;
            index = end + 1;
            continue;
        }
        if (text.startsWith("[", index)) {
            const labelEnd = text.indexOf("]", index + 1);
            const hrefEnd = labelEnd === -1 || !text.startsWith("](", labelEnd)
                ? -1
                : text.indexOf(")", labelEnd + 2);
            const href = hrefEnd === -1 ? "" : text.slice(labelEnd + 2, hrefEnd);
            if (hrefEnd !== -1 && isSafeHref(href)) {
                const label = renderInline(text.slice(index + 1, labelEnd));
                html += `<a href="${escapeHtml(href)}">${label}</a>`;
                index = hrefEnd + 1;
                continue;
            }
        }
        const nextCode = text.indexOf("`", index);
        let nextLink = -1;
        for (let cursor = index; cursor < text.length; cursor += 1) {
            if (!text.startsWith("[", cursor)) continue;
            const labelEnd = text.indexOf("]", cursor + 1);
            const hrefEnd = labelEnd === -1 || !text.startsWith("](", labelEnd)
                ? -1
                : text.indexOf(")", labelEnd + 2);
            const href = hrefEnd === -1 ? "" : text.slice(labelEnd + 2, hrefEnd);
            if (hrefEnd !== -1 && isSafeHref(href)) {
                nextLink = cursor;
                break;
            }
        }
        const candidates = [nextCode, nextLink].filter((position) => position >= 0);
        const next = candidates.length === 0 ? text.length : Math.min(...candidates);
        if (next === index) {
            html += escapeHtml(text[index] ?? "");
            index += 1;
            continue;
        }
        html += escapeHtml(text.slice(index, next));
        index = next;
    }
    return html;
}

const headingPattern = /^(#{1,3}) (.+)$/;

export interface ParaScriptExample {
    readonly id: string;
    readonly source: string;
}

function exampleSlug(heading: string): string {
    const name = heading.replace(/^example:\s*/i, "").replace(/^a\s+/i, "");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : "example";
}

/** Complete `parascript` scripts, in page order. The id is the workspace query. */
export function parascriptExamples(source: string): ParaScriptExample[] {
    const lines = source.replaceAll("\r\n", "\n").split("\n");
    const examples: ParaScriptExample[] = [];
    const used = new Map<string, number>();
    let heading = "";
    let index = 0;
    while (index < lines.length) {
        const line = lines[index] ?? "";
        if (line.startsWith("```")) {
            const lang = line.slice(3).trim();
            const body: string[] = [];
            index += 1;
            while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
                body.push(lines[index] ?? "");
                index += 1;
            }
            if (index < lines.length) index += 1;
            if (lang === "parascript") {
                const base = exampleSlug(heading);
                const seen = used.get(base) ?? 0;
                used.set(base, seen + 1);
                examples.push({ id: seen === 0 ? base : `${base}-${seen + 1}`, source: body.join("\n") });
            }
            continue;
        }
        const headingMatch = headingPattern.exec(line);
        if (headingMatch) heading = headingMatch[2] ?? "";
        index += 1;
    }
    return examples;
}

export function renderMarkdown(source: string): string {
    const lines = source.replaceAll("\r\n", "\n").split("\n");
    const examples = parascriptExamples(source);
    let exampleIndex = 0;
    const blocks: string[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index] ?? "";
        if (line.trim() === "") {
            index += 1;
            continue;
        }
        if (line.startsWith("```")) {
            const lang = line.slice(3).trim();
            const body: string[] = [];
            index += 1;
            while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
                body.push(lines[index] ?? "");
                index += 1;
            }
            if (index < lines.length) index += 1;
            const raw = body.join("\n");
            const code = `<pre><code>${lang === "parascript" || lang === "text" ? highlightParaScript(raw) : escapeHtml(raw)}</code></pre>`;
            if (lang === "parascript") {
                const id = examples[exampleIndex]?.id ?? "example";
                exampleIndex += 1;
                blocks.push(`<div class="example"><a class="example-open" href="/workspace?example=${escapeHtml(id)}">Open in workspace</a>${code}</div>`);
            } else {
                blocks.push(code);
            }
            continue;
        }
        const heading = headingPattern.exec(line);
        if (heading) {
            const level = heading[1]?.length ?? 1;
            blocks.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
            index += 1;
            continue;
        }
        if (line.startsWith("- ")) {
            const items: string[] = [];
            while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
                items.push(`<li>${renderInline((lines[index] ?? "").slice(2))}</li>`);
                index += 1;
            }
            blocks.push(`<ul>${items.join("")}</ul>`);
            continue;
        }
        if (line.startsWith("> ")) {
            const note = line.slice(2);
            const remember = note.startsWith("Remember: ");
            const body = remember
                ? `<strong>Remember.</strong> ${renderInline(note.slice("Remember: ".length))}`
                : renderInline(note);
            blocks.push(`<aside class="remember"><p>${body}</p></aside>`);
            index += 1;
            continue;
        }
        const figure = /^!\[([^\]]*)\]\((\/guide\/[a-z0-9-]+\.svg)\)$/.exec(line);
        if (figure) {
            const alt = escapeHtml(figure[1] ?? "");
            const src = escapeHtml(figure[2] ?? "");
            blocks.push(`<figure class="guide"><img src="${src}" alt="${alt}"><figcaption>${alt}</figcaption></figure>`);
            index += 1;
            continue;
        }
        const paragraph: string[] = [];
        while (index < lines.length) {
            const current = lines[index] ?? "";
            const figureLine = /^!\[([^\]]*)\]\(\/guide\/[a-z0-9-]+\.svg\)$/.test(current);
            if (current.trim() === "" || current.startsWith("```") || current.startsWith("- ") || current.startsWith("> ") || figureLine || /^#{1,3} /.test(current)) break;
            paragraph.push(current);
            index += 1;
        }
        blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }
    return blocks.join("\n");
}

function shiftHeadings(html: string): string {
    return html
        .replaceAll("<h3>", "<h4>").replaceAll("</h3>", "</h4>")
        .replaceAll("<h2>", "<h3>").replaceAll("</h2>", "</h3>")
        .replaceAll("<h1>", "<h2>").replaceAll("</h1>", "</h2>");
}

export function renderLanguagePage(markdown: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ParaScript language</title>
<meta name="description" content="ParaScript writes a solid as formulas, seats the parts by their anchors, and draws the result in the browser.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<header class="site">
<a class="brand" href="/">ParaScript</a>
<nav>
<a href="/workspace">Workspace</a>
</nav>
</header>
<section class="hero">
<div class="hero-copy">
<p class="eyebrow">The language</p>
<h1>Write the shape. The solid follows.</h1>
<p class="lede">ParaScript describes a closed solid as the formulas of its faces. Each part keeps its own coordinates and publishes the anchors it is willing to share. A join lines those anchors up, then adds the part or cuts it away. The workspace compiles the script in your browser and draws the result. This page is the language and the standard library: the rules below, and the names a script can call without defining them.</p>
<p class="actions">
<a class="primary" href="/workspace">Open the workspace</a>
</p>
</div>
</section>
<section class="points" aria-label="Why ParaScript">
<article class="point">
<h2>Faces are formulas</h2>
<p>A flat wall, a rounded case, and a screw thread are the same kind of description: two numbers in, one point out. There is no shelf of primitive solids to click through.</p>
</article>
<article class="point">
<h2>Parts meet on purpose</h2>
<p>You name the directions that should be parallel and the points that should touch. The join turns the incoming part, slides it into place, and only then adds it or cuts it away.</p>
</article>
<article class="point">
<h2>Parts are functions</h2>
<p>Write a part once, as a function of its sizes. Call that function at every place the shape appears, and pass the sizes at the call, including in <code>export</code>. In the broom, one cylinder is the handle, the ferrule, and the hole.</p>
</article>
</section>
<article id="reference" class="reference">
${shiftHeadings(renderMarkdown(markdown))}
</article>
</body>
</html>
`;
}
