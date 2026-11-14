import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRequestFile, startServer } from "./server.js";

test("resolveRequestFile serves the portal page and compiled modules", () => {
    assert.equal(resolveRequestFile("/")?.endsWith("/src/web/index.html"), true);
    assert.equal(resolveRequestFile("/index.html")?.endsWith("/src/web/index.html"), true);
    assert.equal(resolveRequestFile("/dist/web/main.js")?.endsWith("/dist/web/main.js"), true);
    assert.equal(resolveRequestFile("/dist/web/main.js?v=18")?.endsWith("/dist/web/main.js"), true);
    assert.equal(resolveRequestFile("/dist/parascript/compile.js")?.endsWith("/dist/parascript/compile.js"), true);
});

test("resolveRequestFile rejects paths outside dist", () => {
    assert.equal(resolveRequestFile("/package.json"), undefined);
    assert.equal(resolveRequestFile("/dist/../package.json"), undefined);
    assert.equal(resolveRequestFile("/dist/%2e%2e/package.json"), undefined);
    assert.equal(resolveRequestFile("http://localhost/dist/../../package.json"), undefined);
});

test("server returns the workspace page and blocks traversal", async () => {
    const server = startServer(0);
    await once(server, "listening");
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;
    try {
        const page = await fetch(`${base}/`);
        assert.equal(page.status, 200);
        assert.match(page.headers.get("content-type") ?? "", /text\/html/);
        assert.equal(page.headers.get("cache-control"), "no-store");
        const html = await page.text();
        assert.match(html, /src="\/dist\/web\/main\.js\?v=18"/);
        assert.match(html, /id="solid-sides"/);
        assert.match(html, /type="checkbox"/);

        const moduleResponse = await fetch(`${base}/dist/web/main.js?v=18`);
        assert.equal(moduleResponse.status, 200);
        assert.equal(moduleResponse.headers.get("cache-control"), "no-store");
        assert.match(moduleResponse.headers.get("content-type") ?? "", /javascript/);
        const moduleText = await moduleResponse.text();
        assert.match(moduleText, /compileParaScriptSource/);
        assert.match(moduleText, /solid-sides/);
        assert.match(moduleText, /setSolid/);
        assert.match(moduleText, /setUpAxis/);

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
