import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileParaScriptSource } from "../parascript/compile.js";
import { parascriptExamples, renderLanguagePage } from "./markdown.js";
import { evaluateModelModule, modelMesh } from "./model.js";
import { meshToStl, stlFilename } from "./stl.js";

const maxScriptBytes = 100_000_000;

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const distRoot = resolve(projectRoot, "dist");
const webRoot = resolve(projectRoot, "src", "web");

function webFile(name: string): string {
    const full = resolve(webRoot, name);
    const prefix = webRoot.endsWith(sep) ? webRoot : webRoot + sep;
    if (!full.startsWith(prefix)) throw new Error(`Page escaped the web root: ${name}`);
    return full;
}

const pages: Record<string, string> = {
    "/": webFile("home.html"),
    "/workspace": webFile("index.html"),
    "/index.html": webFile("index.html"),
    "/llms.txt": webFile("llms.txt"),
    "/site.css": webFile("site.css"),
    "/favicon.svg": webFile("favicon.svg")
};

const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml"
};

export function requestPathname(urlPath: string): string | undefined {
    try {
        return decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
    } catch {
        return undefined;
    }
}

export function resolveRequestFile(urlPath: string): string | undefined {
    const pathname = requestPathname(urlPath);
    if (pathname === undefined) return undefined;
    const page = pages[pathname];
    if (page !== undefined) return page;
    const guide = /^\/guide\/([a-z0-9-]+\.svg)$/.exec(pathname);
    if (guide !== null) return webFile(`guide/${guide[1] ?? ""}`);
    if (!pathname.startsWith("/dist/")) return undefined;
    const full = resolve(distRoot, pathname.slice("/dist/".length));
    const prefix = distRoot.endsWith(sep) ? distRoot : distRoot + sep;
    if (!full.startsWith(prefix)) return undefined;
    return full;
}

export function startServer(port = 3000, host = "127.0.0.1"): Server {
    const server = createServer((request, response) => {
        void handle(request, response);
    });
    server.listen(port, host);
    return server;
}

function contentType(filePath: string): string {
    return contentTypes[extname(filePath)] ?? "application/octet-stream";
}

function sendText(response: ServerResponse, status: number, message: string): void {
    if (response.headersSent) return;
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(message);
}

function searchParam(urlPath: string, name: string): string | undefined {
    try {
        const value = new URL(urlPath, "http://localhost").searchParams.get(name);
        if (value === null || value === "") return undefined;
        return value;
    } catch {
        return undefined;
    }
}

function escapeTextarea(source: string): string {
    return source
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

async function sendWorkspaceExample(response: ServerResponse, method: string, exampleId: string): Promise<void> {
    if (!/^[a-z0-9-]{1,80}$/.test(exampleId)) {
        sendText(response, 404, "Unknown example.");
        return;
    }
    let markdown: string;
    let html: string;
    try {
        markdown = await readFile(webFile("language.md"), "utf8");
        html = await readFile(webFile("index.html"), "utf8");
    } catch {
        sendText(response, 500, "Server error.");
        return;
    }
    const example = parascriptExamples(markdown).find((item) => item.id === exampleId);
    const textarea = /<textarea id="code-input" spellcheck="false">[\s\S]*?<\/textarea>/;
    if (example === undefined || !textarea.test(html)) {
        sendText(response, example === undefined ? 404 : 500, example === undefined ? "Unknown example." : "Server error.");
        return;
    }
    const page = html.replace(
        textarea,
        `<textarea id="code-input" spellcheck="false">${escapeTextarea(example.source)}</textarea>`
    );
    const body = Buffer.from(page);
    response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store"
    });
    response.end(method === "HEAD" ? undefined : body);
}

async function sendAssets(response: ServerResponse, method: string): Promise<void> {
    let markdown: string;
    try {
        markdown = await readFile(webFile("parascript-assets.md"), "utf8");
    } catch {
        sendText(response, 500, "Server error.");
        return;
    }
    const body = Buffer.from(markdown);
    response.writeHead(200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Length": body.length,
        "Content-Disposition": "attachment; filename=\"parascript-assets.md\"",
        "Cache-Control": "no-store"
    });
    response.end(method === "HEAD" ? undefined : body);
}

async function sendLanguage(response: ServerResponse, method: string): Promise<void> {
    let markdown: string;
    try {
        markdown = await readFile(webFile("language.md"), "utf8");
    } catch {
        sendText(response, 500, "Server error.");
        return;
    }
    const body = Buffer.from(renderLanguagePage(markdown));
    response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store"
    });
    response.end(method === "HEAD" ? undefined : body);
}

class BodyLimitError extends Error {
    constructor() {
        super("The script is too large.");
        this.name = "BodyLimitError";
    }
}

function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
    return new Promise((resolveBody, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        request.on("data", (chunk: Buffer | string) => {
            if (settled) return;
            const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            size += buf.length;
            if (size > limit) {
                request.pause();
                fail(new BodyLimitError());
                return;
            }
            chunks.push(buf);
        });
        request.on("end", () => {
            if (settled) return;
            settled = true;
            resolveBody(Buffer.concat(chunks));
        });
        request.on("error", (error) => fail(error));
    });
}

async function sendStl(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let source: string;
    try {
        source = (await readBody(request, maxScriptBytes)).toString("utf8");
    } catch (err: unknown) {
        const tooLarge = err instanceof BodyLimitError;
        sendText(response, tooLarge ? 413 : 400, err instanceof Error ? err.message : "Could not read the script.");
        request.destroy();
        return;
    }
    if (source.trim() === "") {
        sendText(response, 400, "The script is empty.");
        return;
    }
    const compiled = compileParaScriptSource(source);
    if (!compiled.success || compiled.javascriptCode === undefined) {
        sendText(response, 400, compiled.errorMessage ?? "Compilation failed.");
        return;
    }
    try {
        const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode));
        const stl = meshToStl(mesh);
        if (stl.readUInt32LE(80) === 0) {
            sendText(response, 400, "The script did not produce a solid.");
            return;
        }
        response.writeHead(200, {
            "Content-Type": "model/stl",
            "Content-Length": stl.length,
            "Content-Disposition": `attachment; filename="${stlFilename(compiled.name)}"`,
            "Cache-Control": "no-store"
        });
        response.end(stl);
    } catch (err: unknown) {
        sendText(response, 400, err instanceof Error ? err.message : "Model execution failed.");
    }
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? "GET";
    const pathname = requestPathname(request.url ?? "/");
    if (pathname === "/stl") {
        if (method !== "POST") {
            sendText(response, 405, "Method not allowed.");
            return;
        }
        await sendStl(request, response);
        return;
    }
    if (method !== "GET" && method !== "HEAD") {
        sendText(response, 405, "Method not allowed.");
        return;
    }
    if (pathname === "/language") {
        await sendLanguage(response, method);
        return;
    }
    if (pathname === "/parascript-assets.md") {
        await sendAssets(response, method);
        return;
    }
    const exampleId = pathname === "/workspace" || pathname === "/index.html"
        ? searchParam(request.url ?? "/", "example")
        : undefined;
    if (exampleId !== undefined) {
        await sendWorkspaceExample(response, method, exampleId);
        return;
    }
    const filePath = resolveRequestFile(request.url ?? "/");
    if (filePath === undefined) {
        sendText(response, 404, "Not found.");
        return;
    }
    try {
        const info = await stat(filePath);
        if (!info.isFile()) {
            sendText(response, 404, "Not found.");
            return;
        }
        response.writeHead(200, {
            "Content-Type": contentType(filePath),
            "Content-Length": info.size,
            "Cache-Control": "no-store"
        });
        if (method === "HEAD") {
            response.end();
            return;
        }
        response.end(await readFile(filePath));
    } catch (err: unknown) {
        const code = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
        if (code === "ENOENT") {
            sendText(response, 404, "Not found.");
            return;
        }
        sendText(response, 500, "Server error.");
    }
}

function portFromEnv(value: string | undefined): number {
    if (value === undefined || value === "") return 3000;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid PORT: ${value}`);
    }
    return port;
}

function hostFromEnv(value: string | undefined): string {
    if (value === undefined || value === "") return "127.0.0.1";
    if (!/^[A-Za-z0-9.:%-]{1,253}$/.test(value)) {
        throw new Error(`Invalid HOST: ${value}`);
    }
    return value;
}

export function listenConfigFromEnv(env: NodeJS.ProcessEnv = process.env): { port: number; host: string } {
    return {
        port: portFromEnv(env["PORT"]),
        host: hostFromEnv(env["HOST"])
    };
}

function isDirectRun(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
    const { port, host } = listenConfigFromEnv();
    const server = startServer(port, host);
    server.on("listening", () => {
        const shown = host.includes(":") ? `[${host}]` : host;
        console.log(`ParaScript portal at http://${shown}:${port}`);
    });
}
