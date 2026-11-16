import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const distRoot = resolve(projectRoot, "dist");
const indexPath = resolve(projectRoot, "src", "web", "index.html");

const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8"
};

export function resolveRequestFile(urlPath: string): string | undefined {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
    } catch {
        return undefined;
    }
    if (pathname === "/" || pathname === "/index.html") return indexPath;
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

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
        sendText(response, 405, "Method not allowed.");
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
