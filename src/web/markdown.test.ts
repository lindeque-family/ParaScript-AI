import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightParaScript, parascriptExamples, renderInline, renderLanguagePage, renderMarkdown } from "./markdown.js";

test("markdown rendering escapes text and keeps code fences literal", () => {
    assert.equal(renderInline("a <b> & \"c\""), "a &lt;b&gt; &amp; &quot;c&quot;");
    assert.equal(renderInline("use `a < b` here"), "use <code>a &lt; b</code> here");
    assert.equal(renderInline("see [workspace](/workspace)"), "see <a href=\"/workspace\">workspace</a>");
    assert.equal(renderInline("[x](javascript:alert(1))"), "[x](javascript:alert(1))");

    const html = renderMarkdown("# Title\n\n- one `code`\n- <tag>\n\n```parascript\n<script>\n```\n");
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /<li>one <code>code<\/code><\/li>/);
    assert.match(html, /<li>&lt;tag&gt;<\/li>/);
    assert.match(html, /<pre><code>&lt;script&gt;<\/code><\/pre>/);
});

test("a parascript example opens in the workspace", () => {
    const html = renderMarkdown("## Example: a broom\n\n```parascript\nexport(Broom)\n```\n\n```text\nsetup {}\n```\n");
    assert.equal(html.match(/class="example-open"/g)?.length, 1);
    assert.match(html, /<a class="example-open" href="\/workspace\?example=broom">Open in workspace<\/a>/);
    assert.match(html, /<pre><code><span class="kw">setup<\/span> \{\}<\/code><\/pre>/);

    const examples = parascriptExamples("## Example: a closed box\n\n```parascript\nexport(Brick)\n```\n## Example: a box with a cavity\n\n```parascript\nexport(HollowBox)\n```\n## Example: a sphere\n\n```text\nnot a script\n```\n## Example: a broom\n\n```parascript\nexport(Broom)\n```\n");
    assert.deepEqual(examples.map((example) => example.id), ["closed-box", "box-with-a-cavity", "broom"]);
    assert.equal(examples[2]?.source, "export(Broom)");
});

test("a script is colored like the homepage sphere", () => {
    const colored = highlightParaScript('export(Sphere(radius: 25.0)) // pole\n"mm"');
    assert.match(colored, /<span class="kw">export<\/span>\(<span class="fn">Sphere<\/span>\(/);
    assert.match(colored, /<span class="name">radius<\/span>: <span class="num">25\.0<\/span>/);
    assert.match(colored, /<span class="cmt">\/\/ pole<\/span>/);
    assert.match(colored, /<span class="str">&quot;mm&quot;<\/span>/);
    assert.equal(colored.includes("<script"), false);

    const escaped = renderMarkdown("```parascript\n<script>\n```\n");
    assert.match(escaped, /<pre><code>&lt;script&gt;<\/code><\/pre>/);
});

test("a guide figure and a remember note render", () => {
    const html = renderMarkdown("![A face](/guide/face.svg)\n\n> Remember: write the face.\n\n![bad](https://example.com/x.svg)\n");
    assert.match(html, /<figure class="guide"><img src="\/guide\/face.svg" alt="A face"><figcaption>A face<\/figcaption><\/figure>/);
    assert.match(html, /<aside class="remember"><p><strong>Remember\.<\/strong> write the face\.<\/p><\/aside>/);
    assert.equal(html.includes('src="https://example.com'), false);
});

test("the language page is a document with the rendered reference", () => {
    const page = renderLanguagePage("# ParaScript language\n\nRead [the workspace](/workspace).\n");
    assert.match(page, /<title>ParaScript language<\/title>/);
    assert.match(page, /href="\/workspace"/);
    assert.match(page, /href="\/site\.css"/);
    assert.match(page, /rel="icon" href="\/favicon\.svg"/);
    assert.match(page, /<h1>Write the shape\. The solid follows\.<\/h1>/);
    assert.match(page, /This page is the language and the standard library/);
    assert.match(page, /<h2>ParaScript language<\/h2>/);
    assert.match(page, /<a href="\/workspace">the workspace<\/a>/);
    assert.equal(page.includes(">Reference<"), false);
    assert.equal(page.includes("For models"), false);
    assert.equal(page.includes("/language.md"), false);
    assert.equal(page.includes('href="/prompt"'), false);
    assert.equal(page.includes("<script"), false);
});
