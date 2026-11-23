import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { modelPrompt, parascriptExamples, renderLanguagePage, renderPromptPage } from "./markdown.js";

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
    "/language.md": webFile("language.md"),
    "/llms.txt": webFile("llms.txt"),
    "/site.css": webFile("site.css")
};

const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8"
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

async function sendPrompt(response: ServerResponse, method: string): Promise<void> {
    let markdown: string;
    try {
        markdown = await readFile(webFile("language.md"), "utf8");
    } catch {
        sendText(response, 500, "Server error.");
        return;
    }
    const body = Buffer.from(renderPromptPage(modelPrompt(markdown)));
    response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
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

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
        sendText(response, 405, "Method not allowed.");
        return;
    }
    const pathname = requestPathname(request.url ?? "/");
    if (pathname === "/language") {
        await sendLanguage(response, method);
        return;
    }
    if (pathname === "/prompt") {
        await sendPrompt(response, method);
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
