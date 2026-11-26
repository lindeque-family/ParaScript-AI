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
    assert.equal(resolveRequestFile("/language.md"), undefined);
    assert.equal(resolveRequestFile("/llms.txt")?.endsWith("/src/web/llms.txt"), true);
    assert.equal(resolveRequestFile("/site.css")?.endsWith("/src/web/site.css"), true);
    assert.equal(resolveRequestFile("/favicon.svg")?.endsWith("/src/web/favicon.svg"), true);
    assert.equal(resolveRequestFile("/guide/face.svg")?.endsWith("/src/web/guide/face.svg"), true);
    assert.equal(resolveRequestFile("/guide/nope.png"), undefined);
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
        assert.match(landingHtml, /class="workflow"/);
        assert.match(landingHtml, /Prompt only/);
        assert.match(landingHtml, /Prompt and the assets/);
        assert.match(landingHtml, /A prompt alone asks a model to invent the solid/);
        assert.match(landingHtml, /Open the workspace/);
        assert.match(landingHtml, /See how it works/);
        assert.match(landingHtml, /rel="icon" href="\/favicon\.svg"/);
        assert.match(landingHtml, /class="sample"/);
        assert.match(landingHtml, /A sphere is one face/);
        assert.match(landingHtml, /export<\/span>\(<span class="fn">Sphere<\/span>/);
        assert.match(landingHtml, /href="\/workspace\?example=sphere"/);
        assert.match(landingHtml, /href="\/parascript-assets\.md"/);
        assert.match(landingHtml, /Download the AI assets/);
        assert.equal(landingHtml.includes("for-a-language-model"), false);
        assert.equal(landingHtml.includes("For a language model"), false);
        assert.match(landingHtml, /href="\/language"/);
        assert.equal(landingHtml.includes("/language.md"), false);
        assert.match(landingHtml, /href="\/workspace"/);
        assert.match(landingHtml, /href="\/llms\.txt"/);
        assert.equal(landingHtml.includes('href="/prompt"'), false);

        const assets = await fetch(`${base}/parascript-assets.md`);
        assert.equal(assets.status, 200);
        assert.match(assets.headers.get("content-type") ?? "", /text\/markdown/);
        assert.equal(assets.headers.get("cache-control"), "no-store");
        assert.match(assets.headers.get("content-disposition") ?? "", /attachment;\s*filename="parascript-assets\.md"/);
        const assetsText = await assets.text();
        assert.match(assetsText, /^ParaScript is the language you use to describe one closed solid/);
        assert.match(assetsText, /Use only the forms in this file/);
        assert.match(assetsText, /def place_components = host => points => place => combine => fold/);
        assert.match(assetsText, /\$bristles\.top\.width/);
        assert.match(assetsText, /iso_4017\.across_flats/);
        assert.match(assetsText, /meet: frame: vector => placed: vector => Meet/);
        assert.match(assetsText, /frame: SeatedSolid3D => placed: SeatedSolid3D => SeatedSolid3D/);
        assert.match(assetsText, /coordinate_system => solid/);
        assert.match(assetsText, /export\(Sphere\(radius: 25\.0\)\)/);
        assert.equal(assetsText.includes("Samsung"), false);
        assert.equal(assetsText.includes("/workspace"), false);
        assert.equal(assetsText.includes("/language.md"), false);
        assert.equal(assetsText.includes("/llms.txt"), false);
        assert.equal(assetsText.includes("]("), false);
        assert.ok(assetsText.length < 28000);
        assert.deepEqual(assetsText.match(/https?:\/\/[^\s)]+/g), ["https://parascript.lindeque.family/"]);
        for (const source of assetsText.matchAll(/```parascript\n([\s\S]*?)```/g)) {
            const script = source[1] ?? "";
            const compiled = compileParaScriptSource(script);
            assert.equal(compiled.success, true, compiled.errorMessage ?? "");
        }
        const assetsHead = await fetch(`${base}/parascript-assets.md`, { method: "HEAD" });
        assert.equal(assetsHead.status, 200);
        assert.equal(await assetsHead.text(), "");

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
        assert.equal(html.includes('href="/prompt"'), false);

        const reference = await fetch(`${base}/language`);
        assert.equal(reference.status, 200);
        assert.match(reference.headers.get("content-type") ?? "", /text\/html/);
        const referenceHtml = await reference.text();
        assert.match(referenceHtml, /<h1>Write the shape\. The solid follows\.<\/h1>/);
        assert.match(referenceHtml, /This page is the language and the standard library/);
        assert.match(referenceHtml, /href="\/site\.css"/);
        assert.match(referenceHtml, /<h2>ParaScript language<\/h2>/);
        assert.match(referenceHtml, /A second copy of the same faces is a mistake/);
        assert.match(referenceHtml, /<span class="kw">export<\/span>\(<span class="fn">Sphere<\/span>/);
        assert.match(referenceHtml, /<span class="num">25\.0<\/span>/);
        assert.match(referenceHtml, /<span class="fn">HollowBox<\/span>/);
        assert.match(referenceHtml, /<span class="fn">Broom<\/span>/);
        assert.match(referenceHtml, /<span class="fn">PlateWithKnobs<\/span>/);
        assert.match(referenceHtml, /<span class="str">/);
        assert.match(referenceHtml, /<span class="cmt">/);
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
        assert.match(referenceHtml, /<span class="fn">Tube<\/span>/);
        assert.match(referenceHtml, /<span class="fn">Box<\/span>/);
        assert.match(referenceHtml, /<span class="fn">Disk<\/span>/);
        assert.match(referenceHtml, /<span class="name">\$plate<\/span>/);
        assert.match(referenceHtml, /<span class="name">\$handle<\/span>/);
        assert.match(referenceHtml, /<span class="name">\$hang<\/span>/);
        assert.match(referenceHtml, /<span class="name">\$ferrule<\/span>/);
        assert.equal(referenceHtml.includes("<script"), false);
        assert.equal(referenceHtml.includes('href="/prompt"'), false);
        assert.equal(referenceHtml.includes(">Reference<"), false);
        assert.equal(referenceHtml.includes("For models"), false);
        assert.equal(referenceHtml.includes("/language.md"), false);
        assert.match(referenceHtml, /How to write a solid/);
        assert.match(referenceHtml, /src="\/guide\/face.svg"/);
        assert.match(referenceHtml, /src="\/guide\/face-sweep.svg"/);
        assert.match(referenceHtml, /The tip slides along one line/);
        assert.match(referenceHtml, /src="\/guide\/part.svg"/);
        assert.match(referenceHtml, /src="\/guide\/parameters.svg"/);
        assert.match(referenceHtml, /src="\/guide\/anchors.svg"/);
        assert.match(referenceHtml, /src="\/guide\/join.svg"/);
        assert.match(referenceHtml, /src="\/guide\/export.svg"/);
        assert.match(referenceHtml, /src="\/guide\/script.svg"/);
        assert.match(referenceHtml, /src="\/guide\/names.svg"/);
        assert.match(referenceHtml, /src="\/guide\/pipe.svg"/);
        assert.match(referenceHtml, /src="\/guide\/tuple.svg"/);
        assert.match(referenceHtml, /src="\/guide\/vector.svg"/);
        assert.match(referenceHtml, /src="\/guide\/origin.svg"/);
        assert.match(referenceHtml, /src="\/guide\/arithmetic.svg"/);
        assert.match(referenceHtml, /src="\/guide\/types.svg"/);
        assert.match(referenceHtml, /src="\/guide\/lists.svg"/);
        assert.match(referenceHtml, /src="\/guide\/refused.svg"/);
        assert.match(referenceHtml, /class="remember"/);
        assert.match(referenceHtml, /frame - placed/);
        assert.match(referenceHtml, /The plate is the form to copy/);
        assert.match(referenceHtml, /iso_4017/);
        assert.match(referenceHtml, /Surface2D/);
        assert.match(referenceHtml, /\$plate\.size/);

        const promptPage = await fetch(`${base}/prompt`);
        assert.equal(promptPage.status, 404);
        const promptHead = await fetch(`${base}/prompt`, { method: "HEAD" });
        assert.equal(promptHead.status, 404);

        const markdown = await fetch(`${base}/language.md`);
        assert.equal(markdown.status, 404);
        const markdownHead = await fetch(`${base}/language.md`, { method: "HEAD" });
        assert.equal(markdownHead.status, 404);

        const face = await fetch(`${base}/guide/face.svg`);
        assert.equal(face.status, 200);
        assert.match(face.headers.get("content-type") ?? "", /image\/svg\+xml/);
        const faceSvg = await face.text();
        assert.match(faceSvg, />u</);
        assert.match(faceSvg, />v</);
        assert.match(faceSvg, />point</);

        const index = await fetch(`${base}/llms.txt`);
        assert.equal(index.status, 200);
        assert.match(index.headers.get("content-type") ?? "", /text\/plain/);
        const indexText = await index.text();
        assert.match(indexText, /https:\/\/parascript\.lindeque\.family\/language\)/);
        assert.equal(indexText.includes("/language.md"), false);
        assert.match(indexText, /\/parascript-assets\.md/);
        assert.equal(indexText.includes("/prompt"), false);
        assert.match(indexText, /three calls to one/);
        assert.match(indexText, /How to write a solid/);
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
