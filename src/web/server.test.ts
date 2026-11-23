import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileParaScriptSource } from "../parascript/compile.js";
import { evaluateModelModule, modelMesh } from "./model.js";
import { listenConfigFromEnv, resolveRequestFile, startServer } from "./server.js";

test("resolveRequestFile serves the portal pages and compiled modules", () => {
    assert.equal(resolveRequestFile("/")?.endsWith("/src/web/home.html"), true);
    assert.equal(resolveRequestFile("/workspace")?.endsWith("/src/web/index.html"), true);
    assert.equal(resolveRequestFile("/index.html")?.endsWith("/src/web/index.html"), true);
    assert.equal(resolveRequestFile("/language.md")?.endsWith("/src/web/language.md"), true);
    assert.equal(resolveRequestFile("/llms.txt")?.endsWith("/src/web/llms.txt"), true);
    assert.equal(resolveRequestFile("/site.css")?.endsWith("/src/web/site.css"), true);
    assert.equal(resolveRequestFile("/dist/web/main.js")?.endsWith("/dist/web/main.js"), true);
    assert.equal(resolveRequestFile("/dist/web/main.js?v=20")?.endsWith("/dist/web/main.js"), true);
    assert.equal(resolveRequestFile("/dist/parascript/compile.js")?.endsWith("/dist/parascript/compile.js"), true);
});

test("resolveRequestFile rejects paths outside dist", () => {
    assert.equal(resolveRequestFile("/package.json"), undefined);
    assert.equal(resolveRequestFile("/dist/../package.json"), undefined);
    assert.equal(resolveRequestFile("/dist/%2e%2e/package.json"), undefined);
    assert.equal(resolveRequestFile("http://localhost/dist/../../package.json"), undefined);
});

test("listen config stays on loopback unless HOST is set", () => {
    assert.deepEqual(listenConfigFromEnv({}), { port: 3000, host: "127.0.0.1" });
    assert.deepEqual(listenConfigFromEnv({ HOST: "", PORT: "" }), { port: 3000, host: "127.0.0.1" });
    assert.deepEqual(listenConfigFromEnv({ HOST: "0.0.0.0", PORT: "8080" }), { port: 8080, host: "0.0.0.0" });
    assert.throws(() => listenConfigFromEnv({ HOST: "not a host" }), /Invalid HOST/);
    assert.throws(() => listenConfigFromEnv({ PORT: "nope" }), /Invalid PORT/);
});

test("startServer binds the host it is given", async () => {
    const server = startServer(0, "0.0.0.0");
    await once(server, "listening");
    try {
        const address = server.address();
        assert.equal(typeof address === "object" && address !== null ? address.address : "", "0.0.0.0");
    } finally {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
    }
});

function textareaSource(html: string): string {
    const source = html.match(/<textarea id="code-input"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    return source.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

test("an example opens in the workspace", async () => {
    const server = startServer(0);
    await once(server, "listening");
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;
    try {
        const broom = await fetch(`${base}/workspace?example=broom`);
        assert.equal(broom.status, 200);
        assert.match(broom.headers.get("content-type") ?? "", /text\/html/);
        const broomHtml = await broom.text();
        assert.match(broomHtml, /id="solid-sides" type="checkbox" checked/);
        const broomSource = textareaSource(broomHtml);
        assert.match(broomSource, /export\(Broom\)/);
        assert.equal(broomSource.includes("Pyramid"), false);
        assert.equal(compileParaScriptSource(broomSource).success, true);

        const sphere = await fetch(`${base}/index.html?example=sphere`);
        assert.equal(sphere.status, 200);
        const sphereSource = textareaSource(await sphere.text());
        assert.match(sphereSource, /export\(Sphere\(radius: 25\.0\)\)/);
        const compiled = compileParaScriptSource(sphereSource);
        assert.equal(compiled.success, true, compiled.errorMessage ?? "");
        const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
        assert.ok(mesh.indices.length > 0);

        const plain = await fetch(`${base}/workspace`);
        assert.match(await plain.text(), /export\(Pyramid\)/);

        const missing = await fetch(`${base}/workspace?example=nope`);
        assert.equal(missing.status, 404);
    } finally {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
    }
});

test("server returns the workspace page and blocks traversal", async () => {
    const server = startServer(0);
    await once(server, "listening");
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;
    try {
        const landing = await fetch(`${base}/`);
        assert.equal(landing.status, 200);
        assert.match(landing.headers.get("content-type") ?? "", /text\/html/);
        assert.equal(landing.headers.get("cache-control"), "no-store");
        const landingHtml = await landing.text();
        assert.match(landingHtml, /class="philosophy"/);
        assert.match(landingHtml, /writes language well/);
        assert.match(landingHtml, /id="for-a-language-model"/);
        assert.match(landingHtml, /href="\/language\.md"/);
        assert.match(landingHtml, /href="\/workspace"/);
        assert.match(landingHtml, /href="\/llms\.txt"/);
        assert.match(landingHtml, /href="\/prompt"/);

        const page = await fetch(`${base}/workspace`);
        assert.equal(page.status, 200);
        assert.match(page.headers.get("content-type") ?? "", /text\/html/);
        const html = await page.text();
        assert.match(html, /src="\/dist\/web\/main\.js\?v=24"/);
        assert.match(html, /id="pane-splitter"/);
        assert.match(html, /role="separator"/);
        assert.match(html, /cursor:\s*col-resize/);
        assert.match(html, /cursor:\s*row-resize/);
        assert.match(html, /id="compiler-status" hidden/);
        assert.equal(html.includes("Compiled"), false);
        assert.match(html, /max-width:\s*800px/);
        assert.match(html, /touch-action:\s*none/);
        assert.match(html, /id="solid-sides" type="checkbox" checked/);
        assert.match(html, /href="\/language"/);
        assert.match(html, /href="\/prompt"/);

        const reference = await fetch(`${base}/language`);
        assert.equal(reference.status, 200);
        assert.match(reference.headers.get("content-type") ?? "", /text\/html/);
        const referenceHtml = await reference.text();
        assert.match(referenceHtml, /<h1>Write the shape\. The solid follows\.<\/h1>/);
        assert.match(referenceHtml, /href="\/site\.css"/);
        assert.match(referenceHtml, /<h2>ParaScript language<\/h2>/);
        assert.match(referenceHtml, /A second copy of the same faces is a mistake/);
        assert.match(referenceHtml, /export\(Sphere\(radius: 25\.0\)\)/);
        assert.match(referenceHtml, /export\(HollowBox\)/);
        assert.match(referenceHtml, /export\(Broom\)/);
        assert.match(referenceHtml, /PlateWithKnobs\(coords: coords\)/);
        assert.equal(referenceHtml.match(/Open in workspace/g)?.length, 8);
        assert.match(referenceHtml, /href="\/workspace\?example=sphere"/);
        assert.match(referenceHtml, /href="\/workspace\?example=box"/);
        assert.match(referenceHtml, /href="\/workspace\?example=broom"/);
        assert.match(referenceHtml, /href="\/workspace\?example=plate"/);
        assert.match(referenceHtml, /href="\/workspace\?example=screw"/);
        assert.match(referenceHtml, /href="\/workspace\?example=remote"/);
        assert.match(referenceHtml, /href="\/workspace\?example=car"/);
        assert.match(referenceHtml, /href="\/workspace\?example=desk-set"/);
        assert.match(referenceHtml, /The handle, the ferrule, and the hole through the handle are three calls/);
        assert.match(referenceHtml, /Tube\(coords: coords, radius: radius, height: height\)/);
        assert.match(referenceHtml, /Box\(width: \$plate\.size, depth: \$plate\.size, height: \$plate\.thickness\)/);
        assert.match(referenceHtml, /Disk\(coords: coords, radius: radius, z: 0\.0\)/);
        assert.match(referenceHtml, /Disk\(coords: coords, radius: radius, z: height\)/);
        assert.match(referenceHtml, /Cylinder\(\s*radius: \$handle\.radius,\s*height: \$handle\.length\)/);
        assert.match(referenceHtml, /Cylinder\(\s*radius: \$hang\.radius,\s*height: \$handle\.radius \* 2\.0 \+ 8\.0\)/);
        assert.match(referenceHtml, /Cylinder\(\s*radius: \$ferrule\.radius,\s*height: \$ferrule\.height\)/);
        assert.equal(referenceHtml.includes("<script"), false);
        assert.match(referenceHtml, /href="\/prompt"/);

        const promptPage = await fetch(`${base}/prompt`);
        assert.equal(promptPage.status, 200);
        assert.match(promptPage.headers.get("content-type") ?? "", /text\/html/);
        assert.equal(promptPage.headers.get("cache-control"), "no-store");
        const promptHtml = await promptPage.text();
        assert.match(promptHtml, /<title>ParaScript prompt<\/title>/);
        assert.match(promptHtml, /<textarea id="model-prompt"/);
        assert.match(promptHtml, />Copy prompt</);
        assert.match(promptHtml, /ParaScript is the language you use to describe one closed solid/);
        assert.match(promptHtml, /That is what the language is for/);
        assert.match(promptHtml, /Guidance for a language model/);
        assert.match(promptHtml, /export\(Sphere\(radius: 25\.0\)\)/);
        assert.match(promptHtml, /href="\/workspace"/);
        const promptField = promptHtml.match(/<textarea id="model-prompt"[^>]*>([\s\S]*?)<\/textarea>/);
        assert.match(promptField?.[1] ?? "", /ParaScript is the language you use to describe one closed solid/);
        assert.equal((promptField?.[1] ?? "").includes("<script"), false);

        const promptHead = await fetch(`${base}/prompt`, { method: "HEAD" });
        assert.equal(promptHead.status, 200);
        assert.equal(await promptHead.text(), "");

        const markdown = await fetch(`${base}/language.md`);
        assert.equal(markdown.status, 200);
        assert.match(markdown.headers.get("content-type") ?? "", /text\/markdown/);
        const markdownText = await markdown.text();
        assert.match(markdownText, /shift\(d: 3\.0\) >> scale\(k: 2\.0\)/);
        assert.match(markdownText, /def place_components = host => points => place => combine => fold\(/);
        assert.match(markdownText, /let bottom = Disk\(coords: coords, radius: radius, z: 0\.0\) in/);
        assert.match(markdownText, /\[1\.0, 2\.0, 3\.0\] \|> map\(f: item => item \* 2\.0\)/);
        assert.match(markdownText, /`\|>` pipes a value into a function/);
        assert.match(markdownText, /## Guidance for a language model/);
        assert.match(markdownText, /## Lessons/);
        assert.match(markdownText, /T => T => number/);
        assert.match(markdownText, /parameters \{/);
        assert.match(markdownText, /\$plate\.size/);
        assert.match(markdownText, /The plate is the form to copy/);
        assert.match(markdownText, /place_components` seats one component/);
        assert.match(markdownText, /iso_4017/);
        assert.match(markdownText, /```parascript/);
        assert.match(markdownText, /Surface2D/);

        const index = await fetch(`${base}/llms.txt`);
        assert.equal(index.status, 200);
        assert.match(index.headers.get("content-type") ?? "", /text\/plain/);
        const indexText = await index.text();
        assert.match(indexText, /\/language\.md/);
        assert.match(indexText, /\/prompt/);
        assert.match(indexText, /three calls to one/);
        assert.match(indexText, /Guidance for a language model/);
        assert.match(indexText, /\$plate\.size/);
        assert.match(indexText, /## Lessons/);
        assert.match(indexText, /vector_grid/);
        assert.match(indexText, /parameters/);
        assert.match(indexText, /place_components/);

        const style = await fetch(`${base}/site.css`);
        assert.equal(style.status, 200);
        assert.match(style.headers.get("content-type") ?? "", /text\/css/);

        const moduleResponse = await fetch(`${base}/dist/web/main.js?v=24`);
        assert.equal(moduleResponse.status, 200);
        assert.equal(moduleResponse.headers.get("cache-control"), "no-store");
        assert.match(moduleResponse.headers.get("content-type") ?? "", /javascript/);
        const moduleText = await moduleResponse.text();
        assert.match(moduleText, /compileParaScriptSource/);
        assert.match(moduleText, /solid-sides/);
        assert.match(moduleText, /setSolid\(solidSides\.checked\)/);
        assert.match(moduleText, /setUpAxis/);
        assert.match(moduleText, /pane-splitter/);
        assert.match(moduleText, /max-width: 800px/);
        assert.equal(moduleText.includes("Compiled"), false);

        const compiler = await fetch(`${base}/dist/parascript/compile.js`);
        assert.equal(compiler.status, 200);

        const escaped = await fetch(`${base}/dist/../package.json`);
        assert.equal(escaped.status, 404);

        const posted = await fetch(`${base}/`, { method: "POST" });
        assert.equal(posted.status, 405);
    } finally {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
    }
});
