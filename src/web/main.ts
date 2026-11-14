const { compileParaScriptSource } = await import(new URL("../parascript/compile.js?v=18", import.meta.url).href) as typeof import("../parascript/compile.js");
const { evaluateModelModule, modelAnchor, modelMesh, offsetMesh, tessellateFaces } = await import(new URL("./model.js?v=18", import.meta.url).href) as typeof import("./model.js");
const { ManifoldViewport } = await import(new URL("./render.js?v=18", import.meta.url).href) as typeof import("./render.js");

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
const codeInput = requireElement("code-input", HTMLTextAreaElement);
const solidSides = requireElement("solid-sides", HTMLInputElement);

const viewport = new ManifoldViewport(canvas);
solidSides.addEventListener("change", () => {
    viewport.setSolid(solidSides.checked);
});

function showError(message: string): void {
    statusOverlay.className = "status-error";
    statusOverlay.textContent = message;
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
    statusOverlay.className = "status-success";
    statusOverlay.textContent = "Compiling...";
    const result = compileParaScriptSource(codeInput.value);
    if (!result.success || result.javascriptCode === undefined) {
        showError(result.errorMessage ?? "Compilation failed.");
        viewport.setMesh(tessellateFaces([]));
        return;
    }
    if (result.coordinateSystem !== undefined) viewport.setUpAxis(result.coordinateSystem);

    try {
        const evaluated = await evaluateModelModule(result.javascriptCode);
        statusOverlay.textContent = "Meshing...";
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        const mesh = modelMesh(evaluated);
        const anchor = modelAnchor(evaluated);
        const view = anchor ? offsetMesh(mesh, anchor) : mesh;
        const triangles = view.indices.length / 3;
        viewport.setMesh(view);
        if (triangles === 0) {
            showError(`Compiled. No renderable faces. ${describeResult(evaluated)}`);
            return;
        }
        statusOverlay.className = "status-success";
        statusOverlay.textContent = `Compiled ${triangles} triangles.`;
    } catch (err: unknown) {
        showError(err instanceof Error ? err.message : "Model execution failed.");
        viewport.setMesh(tessellateFaces([]));
    }
}

compileBtn.addEventListener("click", () => {
    void runSolver();
});
viewport.resize();
requestAnimationFrame(() => viewport.resize());
void runSolver();
