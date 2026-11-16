import { test } from "node:test";
import assert from "node:assert/strict";
import { parascriptExamples, renderInline, renderLanguagePage, renderMarkdown } from "./markdown.js";

test("markdown rendering escapes text and keeps code fences literal", () => {
    assert.equal(renderInline("a <b> & \"c\""), "a &lt;b&gt; &amp; &quot;c&quot;");
    assert.equal(renderInline("use `a < b` here"), "use <code>a &lt; b</code> here");
    assert.equal(renderInline("see [language](/language.md)"), "see <a href=\"/language.md\">language</a>");
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
    assert.match(html, /<pre><code>setup \{\}<\/code><\/pre>/);

    const examples = parascriptExamples("## Example: a closed box\n\n```parascript\nexport(Brick)\n```\n## Example: a box with a cavity\n\n```parascript\nexport(HollowBox)\n```\n## Example: a sphere\n\n```text\nnot a script\n```\n## Example: a broom\n\n```parascript\nexport(Broom)\n```\n");
    assert.deepEqual(examples.map((example) => example.id), ["closed-box", "box-with-a-cavity", "broom"]);
    assert.equal(examples[2]?.source, "export(Broom)");
});

test("the language page is a document with the rendered reference", () => {
    const page = renderLanguagePage("# ParaScript language\n\nRead [the text](/language.md).\n");
    assert.match(page, /<title>ParaScript language<\/title>/);
    assert.match(page, /href="\/workspace"/);
    assert.match(page, /href="\/site\.css"/);
    assert.match(page, /<h1>Write the shape\. The solid follows\.<\/h1>/);
    assert.match(page, /<h2>ParaScript language<\/h2>/);
    assert.match(page, /<a href="\/language\.md">the text<\/a>/);
});
