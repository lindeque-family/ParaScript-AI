const { compileParaScriptSource } = await import(new URL("../parascript/compile.js?v=24", import.meta.url).href) as typeof import("../parascript/compile.js");
const { evaluateModelModule, modelAnchor, modelMesh, offsetMesh, tessellateFaces } = await import(new URL("./model.js?v=24", import.meta.url).href) as typeof import("./model.js");
const { ManifoldViewport } = await import(new URL("./render.js?v=24", import.meta.url).href) as typeof import("./render.js");
const { clampPaneSize, paneSizeFromPointer } = await import(new URL("./splitter.js?v=24", import.meta.url).href) as typeof import("./splitter.js");

function requireElement<T extends Element>(id: string, ctor: new () => T): T {
    const element = document.getElementById(id);
    if (!(element instanceof ctor)) {
        throw new Error(`Missing #${id}.`);
    }
    return element;
}

const canvas = requireElement("manifold-canvas", HTMLCanvasElement);
const statusOverlay = requireElement("compiler-status", HTMLElement);
const compileBtn = requireElement("compile-btn", HTMLButtonElement);
const stlBtn = requireElement("stl-btn", HTMLButtonElement);
const codeInput = requireElement("code-input", HTMLTextAreaElement);
const solidSides = requireElement("solid-sides", HTMLInputElement);
const app = requireElement("app-container", HTMLElement);
const editor = requireElement("editor-pane", HTMLElement);
const splitter = requireElement("pane-splitter", HTMLElement);

const viewport = new ManifoldViewport(canvas);
viewport.setSolid(solidSides.checked);
solidSides.addEventListener("change", () => {
    viewport.setSolid(solidSides.checked);
});

const stackedQuery = window.matchMedia("(max-width: 800px)");
const minPane = 180;

function syncSplitterOrientation(): void {
    splitter.setAttribute("aria-orientation", stackedQuery.matches ? "horizontal" : "vertical");
}

function placeEditor(size: number): void {
    const stacked = stackedQuery.matches;
    const editorBounds = editor.getBoundingClientRect();
    const appBounds = app.getBoundingClientRect();
    const start = stacked ? editorBounds.top : editorBounds.left;
    const end = stacked ? appBounds.bottom : appBounds.right;
    const bar = stacked ? splitter.offsetHeight : splitter.offsetWidth;
    const next = clampPaneSize(size, end - start, bar, minPane);
    editor.style.flexBasis = `${next}px`;
    const usable = Math.max(1, end - start - bar);
    splitter.setAttribute("aria-valuenow", String(Math.round((next / usable) * 100)));
    viewport.resize();
}

syncSplitterOrientation();
stackedQuery.addEventListener("change", () => {
    editor.style.flexBasis = "";
    syncSplitterOrientation();
    viewport.resize();
});

splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    splitter.setPointerCapture(event.pointerId);
    const drag = (move: PointerEvent) => {
        const stacked = stackedQuery.matches;
        const editorBounds = editor.getBoundingClientRect();
        const appBounds = app.getBoundingClientRect();
        placeEditor(paneSizeFromPointer({
            start: stacked ? editorBounds.top : editorBounds.left,
            end: stacked ? appBounds.bottom : appBounds.right,
            splitter: stacked ? splitter.offsetHeight : splitter.offsetWidth,
            pointer: stacked ? move.clientY : move.clientX,
            min: minPane
        }));
    };
    const stop = (end: PointerEvent) => {
        if (end.pointerId !== event.pointerId) return;
        splitter.removeEventListener("pointermove", drag);
        splitter.removeEventListener("pointerup", stop);
        splitter.removeEventListener("pointercancel", stop);
    };
    splitter.addEventListener("pointermove", drag);
    splitter.addEventListener("pointerup", stop);
    splitter.addEventListener("pointercancel", stop);
});

splitter.addEventListener("keydown", (event) => {
    const shrink = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const grow = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (!shrink && !grow) return;
    event.preventDefault();
    const stacked = stackedQuery.matches;
    const editorBounds = editor.getBoundingClientRect();
    const current = stacked ? editorBounds.height : editorBounds.width;
    placeEditor(current + (grow ? 32 : -32));
});

function showError(message: string): void {
    statusOverlay.hidden = false;
    statusOverlay.className = "status-error";
    statusOverlay.textContent = message;
}

function hideStatus(): void {
    statusOverlay.hidden = true;
    statusOverlay.className = "";
    statusOverlay.textContent = "";
}

function describeResult(value: unknown): string {
    if (typeof value === "function") return "Call the component before exporting it.";
    if (typeof value === "number") {
        return Number.isNaN(value)
            ? "The subtraction did not receive two solids."
            : "The script returned a number.";
    }
    if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        const tag = typeof record.tag === "string" ? record.tag : "";
        const op = typeof record.op === "string" ? record.op : "";
        const kind = [tag, op].filter((part) => part !== "").join(" ");
        return kind === "" ? "The result has no faces." : `The result was ${kind} with no faces.`;
    }
    return "The script did not export a solid.";
}

async function runSolver(): Promise<void> {
    hideStatus();
    const result = compileParaScriptSource(codeInput.value);
    if (!result.success || result.javascriptCode === undefined) {
        showError(result.errorMessage ?? "Compilation failed.");
        viewport.setMesh(tessellateFaces([]));
        return;
    }
    if (result.coordinateSystem !== undefined) viewport.setUpAxis(result.coordinateSystem);

    try {
        const evaluated = await evaluateModelModule(result.javascriptCode);
        const mesh = modelMesh(evaluated);
        const anchor = modelAnchor(evaluated);
        const view = anchor ? offsetMesh(mesh, anchor) : mesh;
        viewport.setMesh(view);
        if (view.indices.length === 0) {
            showError(`No renderable faces. ${describeResult(evaluated)}`);
        }
    } catch (err: unknown) {
        showError(err instanceof Error ? err.message : "Model execution failed.");
        viewport.setMesh(tessellateFaces([]));
    }
}

async function downloadStl(): Promise<void> {
    hideStatus();
    stlBtn.disabled = true;
    try {
        const response = await fetch("/stl", {
            method: "POST",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: codeInput.value
        });
        if (!response.ok) {
            showError((await response.text()) || "STL export failed.");
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "solid.stl";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
        showError(err instanceof Error ? err.message : "Download failed.");
    } finally {
        stlBtn.disabled = false;
    }
}

compileBtn.addEventListener("click", () => {
    void runSolver();
});
stlBtn.addEventListener("click", () => {
    void downloadStl();
});
viewport.resize();
requestAnimationFrame(() => viewport.resize());
void runSolver();
