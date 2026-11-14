import { meshToPolygons, orientPatchesOutward, polygonsToMesh, subtractPolygons, unionPolygons } from "./csg.js";

export interface Vector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface SurfaceFace {
    readonly tag: "Surface2D";
    readonly maxU: number;
    readonly minV: number | ((u: number) => number);
    readonly maxV: number | ((u: number) => number);
    readonly formula: (u: number) => (v: number) => Vector3;
}

export interface SolidModel {
    readonly tag: "Solid3D";
    readonly faces: readonly SurfaceFace[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isSurfaceFace(value: unknown): value is SurfaceFace {
    if (!isRecord(value)) return false;
    return value.tag === "Surface2D"
        && typeof value.maxU === "number"
        && (typeof value.minV === "number" || typeof value.minV === "function")
        && (typeof value.maxV === "number" || typeof value.maxV === "function")
        && typeof value.formula === "function";
}

export interface Mesh {
    readonly positions: Float32Array;
    readonly indices: Uint32Array;
}

const BOOLEAN_TESSELLATION_STEPS = 12;

interface BooleanCombination {
    readonly op: "add" | "subtract";
    readonly left: unknown;
    readonly right: unknown;
}

export const DEFAULT_TESSELLATION_STEPS = 40;

export function tessellationStepsFor(faceCount: number): number {
    if (faceCount <= 1) return DEFAULT_TESSELLATION_STEPS;
    const steps = Math.floor(Math.sqrt(8192 / (2 * faceCount)));
    return Math.max(16, Math.min(32, steps));
}

export function tessellateFaces(faces: readonly SurfaceFace[], steps = DEFAULT_TESSELLATION_STEPS): Mesh {
    const stride = steps + 1;
    const positions = new Float32Array(faces.length * stride * stride * 3);
    const indices = new Uint32Array(faces.length * steps * steps * 6);
    let vertexBase = 0;
    let indexCursor = 0;

    for (const face of faces) {
        for (let i = 0; i <= steps; i++) {
            const u = (i / steps) * face.maxU;
            const minV = typeof face.minV === "function" ? face.minV(u) : face.minV;
            const maxV = typeof face.maxV === "function" ? face.maxV(u) : face.maxV;
            for (let j = 0; j <= steps; j++) {
                const v = minV + (j / steps) * (maxV - minV);
                const point = face.formula(u)(v);
                const offset = (vertexBase + i * stride + j) * 3;
                positions[offset] = point.x;
                positions[offset + 1] = point.y;
                positions[offset + 2] = point.z;
            }
        }

        for (let i = 0; i < steps; i++) {
            for (let j = 0; j < steps; j++) {
                const a = vertexBase + i * stride + j;
                const b = a + 1;
                const c = a + stride;
                const d = c + 1;
                indices[indexCursor++] = a;
                indices[indexCursor++] = b;
                indices[indexCursor++] = c;
                indices[indexCursor++] = b;
                indices[indexCursor++] = d;
                indices[indexCursor++] = c;
            }
        }

        vertexBase += stride * stride;
    }

    return { positions, indices };
}

function isBooleanNode(value: unknown, op: BooleanCombination["op"]): value is BooleanCombination {
    return isRecord(value) && value.op === op && "left" in value && "right" in value;
}

function partGeometry(value: unknown): unknown {
    let current = value;
    while (isRecord(current) && current.tag === "Part" && "geometry" in current) current = current.geometry;
    return current;
}

/** The `origin` anchor a component published, in the same space as its geometry. */
export function modelAnchor(value: unknown): Vector3 | null {
    if (!isRecord(value) || value.tag !== "Part" || !isRecord(value.anchors)) return null;
    const origin = value.anchors.origin;
    if (!isRecord(origin)) return null;
    const { x, y, z } = origin;
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z };
}

/** Shift a copy of the mesh so `anchor` sits on the view origin. */
export function offsetMesh(mesh: Mesh, anchor: Vector3): Mesh {
    const positions = new Float32Array(mesh.positions.length);
    for (let i = 0; i < mesh.positions.length; i += 3) {
        positions[i] = (mesh.positions[i] ?? 0) - anchor.x;
        positions[i + 1] = (mesh.positions[i + 1] ?? 0) - anchor.y;
        positions[i + 2] = (mesh.positions[i + 2] ?? 0) - anchor.z;
    }
    return { positions, indices: mesh.indices };
}

export function modelMesh(value: unknown, booleanSteps = BOOLEAN_TESSELLATION_STEPS): Mesh {
    const model = partGeometry(value);
    if (isBooleanNode(model, "add") || isBooleanNode(model, "subtract")) {
        return polygonsToMesh(solidPolygons(model, booleanSteps));
    }
    const faces = collectFaces(model);
    return tessellateFaces(faces, tessellationStepsFor(faces.length));
}

// combine returns a SeatedSolid3D: union for +, one subtraction for -.
function solidPolygons(value: unknown, steps: number): ReturnType<typeof subtractPolygons> {
    const model = partGeometry(value);
    if (isBooleanNode(model, "add")) {
        const left = solidPolygons(model.left, steps);
        const right = solidPolygons(model.right, steps);
        if (left.length === 0 || right.length === 0) throw new Error("Addition needs two solids.");
        return unionPolygons(left, right);
    }
    if (isBooleanNode(model, "subtract")) {
        const left = solidPolygons(model.left, steps);
        const right = solidPolygons(model.right, steps);
        if (left.length === 0 || right.length === 0) throw new Error("Subtraction needs two solids.");
        return subtractPolygons(left, right);
    }
    const faces = collectFaces(model);
    const patches = faces.map((face) => meshToPolygons(tessellateFaces([face], steps)));
    return orientPatchesOutward(patches);
}

export function collectFaces(value: unknown): SurfaceFace[] {
    const model = partGeometry(value);
    if (isSurfaceFace(model)) return [model];
    if (isRecord(model) && model.tag === "Solid3D" && Array.isArray(model.faces)) {
        return model.faces.filter(isSurfaceFace);
    }
    return [];
}

export async function evaluateModelModule(javascriptCode: string): Promise<unknown> {
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(javascriptCode)}`;
    const compiled: { executeModelPipeline?: () => unknown } = await import(url);
    if (typeof compiled.executeModelPipeline !== "function") {
        throw new Error("Generated model module is missing executeModelPipeline().");
    }
    return compiled.executeModelPipeline();
}
