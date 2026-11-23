import { test } from "node:test";
import assert from "node:assert/strict";
import { modelPrompt, parascriptExamples, renderInline, renderLanguagePage, renderMarkdown, renderPromptPage } from "./markdown.js";

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
    assert.match(page, /href="\/prompt"/);
    assert.equal(page.includes("<script"), false);
});

test("the model prompt is the instruction followed by the reference", () => {
    const prompt = modelPrompt("ref & <x>\n");
    assert.match(prompt, /^ParaScript is the language you use to describe one closed solid/);
    assert.match(prompt, /A face is a formula: two numbers in, one point out/);
    assert.match(prompt, /That is what the language is for/);
    assert.match(prompt, /Reply with one complete script and no surrounding explanation/);
    assert.match(prompt, /The reference is included here in full/);
    assert.match(prompt, /Copy the smallest example that already does what is asked/);
    assert.match(prompt, /The plate is the form for a grid or a circle of features/);
    assert.equal(prompt.endsWith("ref & <x>\n"), true);
});

test("the prompt page keeps the prompt inside the textarea", () => {
    const page = renderPromptPage("use </textarea><script>alert(1)</script> & \"x\"");
    assert.match(page, /<title>ParaScript prompt<\/title>/);
    assert.match(page, /<textarea id="model-prompt"/);
    assert.match(page, />Copy prompt</);
    assert.match(page, /href="\/workspace"/);
    const field = page.match(/<textarea id="model-prompt"[^>]*>([\s\S]*?)<\/textarea>/);
    assert.equal(field?.[1], "use &lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;");
});
