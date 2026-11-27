import { meshToPolygons, orientPatchesOutward, polygonsToMesh, subtractPolygons, unionPolygons } from "./csg.js";
import { plateRingMesh } from "./rings.js";

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

interface FaceGrid {
    readonly face: SurfaceFace;
    readonly uSteps: number;
    readonly vSteps: number;
}

function pointOnFace(face: SurfaceFace, uFrac: number, vFrac: number): Vector3 {
    const u = uFrac * face.maxU;
    const minV = typeof face.minV === "function" ? face.minV(u) : face.minV;
    const maxV = typeof face.maxV === "function" ? face.maxV(u) : face.maxV;
    const v = minV + vFrac * (maxV - minV);
    const point = face.formula(u)(v);
    return { x: point.x, y: point.y, z: point.z };
}

/** A straight axis is one step. Equal steps of the sample vector mean the formula is linear there. */
function isLinearAxis(face: SurfaceFace, axis: "u" | "v"): boolean {
    const stations = [0, 0.25, 0.5, 0.75, 1];
    const cuts = [0, 0.5, 1];
    try {
        for (const cut of cuts) {
            const row: Vector3[] = [];
            for (const station of stations) {
                const point = axis === "u" ? pointOnFace(face, station, cut) : pointOnFace(face, cut, station);
                if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return false;
                row.push(point);
            }
            const first = row[0];
            const second = row[1];
            if (first === undefined || second === undefined) return false;
            const step = { x: second.x - first.x, y: second.y - first.y, z: second.z - first.z };
            if (Math.hypot(step.x, step.y, step.z) <= 1e-9) continue;
            let scale = 1;
            for (const point of row) scale = Math.max(scale, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
            const tolerance = 1e-4 * scale;
            for (let index = 1; index < row.length; index++) {
                const previous = row[index - 1];
                const current = row[index];
                if (previous === undefined || current === undefined) return false;
                const dx = current.x - previous.x - step.x;
                const dy = current.y - previous.y - step.y;
                const dz = current.z - previous.z - step.z;
                if (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance || Math.abs(dz) > tolerance) return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

function gridsFor(faces: readonly SurfaceFace[], steps: number, adaptive: boolean): FaceGrid[] {
    const curved = Math.max(1, Math.floor(steps));
    return faces.map((face) => {
        if (!adaptive || curved <= 1 || !Number.isFinite(face.maxU)) {
            return { face, uSteps: curved, vSteps: curved };
        }
        return {
            face,
            uSteps: isLinearAxis(face, "u") ? 1 : curved,
            vSteps: isLinearAxis(face, "v") ? 1 : curved
        };
    });
}

export function tessellateFaces(faces: readonly SurfaceFace[], steps = DEFAULT_TESSELLATION_STEPS, adaptive = false): Mesh {
    const grids = gridsFor(faces, steps, adaptive);
    let vertexCount = 0;
    let indexCount = 0;
    for (const grid of grids) {
        vertexCount += (grid.uSteps + 1) * (grid.vSteps + 1);
        indexCount += grid.uSteps * grid.vSteps * 6;
    }
    const positions = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    let vertexBase = 0;
    let indexCursor = 0;

    for (const grid of grids) {
        const stride = grid.vSteps + 1;
        for (let i = 0; i <= grid.uSteps; i++) {
            const u = (i / grid.uSteps) * grid.face.maxU;
            const minV = typeof grid.face.minV === "function" ? grid.face.minV(u) : grid.face.minV;
            const maxV = typeof grid.face.maxV === "function" ? grid.face.maxV(u) : grid.face.maxV;
            for (let j = 0; j <= grid.vSteps; j++) {
                const v = minV + (j / grid.vSteps) * (maxV - minV);
                const point = grid.face.formula(u)(v);
                const offset = (vertexBase + i * stride + j) * 3;
                positions[offset] = point.x;
                positions[offset + 1] = point.y;
                positions[offset + 2] = point.z;
            }
        }

        for (let i = 0; i < grid.uSteps; i++) {
            for (let j = 0; j < grid.vSteps; j++) {
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

        vertexBase += (grid.uSteps + 1) * stride;
    }

    return { positions, indices };
}

interface PrimitiveSolid {
    readonly tag: "Primitive";
    readonly kind?: string;
    readonly width?: number;
    readonly depth?: number;
    readonly height?: number;
    readonly radius?: number;
    readonly segments?: number;
    readonly mapPoint?: (point: Vector3) => Vector3;
}

function isPrimitive(value: unknown): value is PrimitiveSolid {
    return isRecord(value) && value.tag === "Primitive" && (value.kind === "box" || value.kind === "cylinder" || value.kind === "sphere");
}

function placePoint(primitive: PrimitiveSolid, point: Vector3): Vector3 {
    const mapped = primitive.mapPoint ? primitive.mapPoint(point) : point;
    return { x: mapped.x, y: mapped.y, z: mapped.z };
}

function primitiveMesh(primitive: PrimitiveSolid): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const push = (a: Vector3, b: Vector3, c: Vector3) => {
        const base = positions.length / 3;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        indices.push(base, base + 1, base + 2);
    };
    if (primitive.kind === "box") {
        const w = primitive.width ?? 0;
        const d = primitive.depth ?? 0;
        const h = primitive.height ?? 0;
        const p = (x: number, y: number, z: number) => placePoint(primitive, { x, y, z });
        const a = p(0, 0, 0);
        const b = p(w, 0, 0);
        const c = p(w, d, 0);
        const d0 = p(0, d, 0);
        const at = p(0, 0, h);
        const bt = p(w, 0, h);
        const ct = p(w, d, h);
        const dt = p(0, d, h);
        push(a, d0, b);
        push(d0, c, b);
        push(at, bt, dt);
        push(bt, ct, dt);
        push(a, b, at);
        push(b, bt, at);
        push(d0, dt, c);
        push(dt, ct, c);
        push(a, at, d0);
        push(at, dt, d0);
        push(b, c, bt);
        push(c, ct, bt);
    } else if (primitive.kind === "sphere") {
        const radius = primitive.radius ?? 0;
        const slices = Math.max(3, Math.floor(primitive.segments ?? 24));
        const stacks = Math.max(2, Math.floor(slices / 2));
        const p = (x: number, y: number, z: number) => placePoint(primitive, { x, y, z });
        const ring = (stack: number, slice: number): Vector3 => {
            const v = (stack / stacks) * Math.PI;
            const u = (slice / slices) * Math.PI * 2;
            return p(radius * Math.cos(u) * Math.sin(v), radius * Math.sin(u) * Math.sin(v), radius * Math.cos(v));
        };
        const top = p(0, 0, radius);
        const bottom = p(0, 0, -radius);
        for (let slice = 0; slice < slices; slice++) {
            const next = (slice + 1) % slices;
            push(top, ring(1, slice), ring(1, next));
            push(bottom, ring(stacks - 1, next), ring(stacks - 1, slice));
            for (let stack = 1; stack < stacks - 1; stack++) {
                const upper = ring(stack, slice);
                const upperNext = ring(stack, next);
                const lower = ring(stack + 1, slice);
                const lowerNext = ring(stack + 1, next);
                push(upper, lowerNext, upperNext);
                push(upper, lower, lowerNext);
            }
        }
    } else {
        const radius = primitive.radius ?? 0;
        const height = primitive.height ?? 0;
        const segments = Math.max(3, Math.floor(primitive.segments ?? 24));
        const p = (x: number, y: number, z: number) => placePoint(primitive, { x, y, z });
        const bottom: Vector3[] = [];
        const top: Vector3[] = [];
        for (let index = 0; index < segments; index++) {
            const angle = (index / segments) * Math.PI * 2;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            bottom.push(p(x, y, 0));
            top.push(p(x, y, height));
        }
        const bottomCenter = p(0, 0, 0);
        const topCenter = p(0, 0, height);
        for (let index = 0; index < segments; index++) {
            const next = (index + 1) % segments;
            const bi = bottom[index];
            const bj = bottom[next];
            const ti = top[index];
            const tj = top[next];
            if (bi === undefined || bj === undefined || ti === undefined || tj === undefined) continue;
            push(bottomCenter, bj, bi);
            push(topCenter, ti, tj);
            push(bi, bj, tj);
            push(bi, tj, ti);
        }
    }
    return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
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
    if (isPrimitive(model)) return primitiveMesh(model);
    if (isBooleanNode(model, "add") || isBooleanNode(model, "subtract")) {
        // The ring mesh is already triangles. Routing it through polygons drops the thin ones and opens the surface.
        const ringed = plateRingMesh(model, booleanSteps);
        if (ringed !== undefined && ringed.indices.length > 0) return ringed;
        return polygonsToMesh(solidPolygons(model, booleanSteps));
    }
    const faces = collectFaces(model);
    return tessellateFaces(faces, tessellationStepsFor(faces.length));
}

// (A - B) - C is A minus the union of the tools. One subtraction beats a boolean per hole.
function subtractionChain(value: unknown): { base: unknown; tools: unknown[] } | undefined {
    const tools: unknown[] = [];
    let current = partGeometry(value);
    if (!isBooleanNode(current, "subtract")) return undefined;
    while (isBooleanNode(current, "subtract")) {
        tools.push(current.right);
        current = partGeometry(current.left);
    }
    if (tools.length < 2) return undefined;
    return { base: current, tools };
}

type PolygonLike = ReturnType<typeof subtractPolygons>[number];

function unionAll(meshes: readonly (readonly PolygonLike[])[], what: string): PolygonLike[] {
    const first = meshes[0];
    if (first === undefined || first.length === 0) throw new Error(what);
    let combined: PolygonLike[] = [...first];
    for (let index = 1; index < meshes.length; index++) {
        const next = meshes[index];
        if (next === undefined || next.length === 0) throw new Error(what);
        combined = unionPolygons(combined, next);
    }
    return combined;
}

// combine returns a SeatedSolid3D: union for +, one subtraction for -.
function solidPolygons(value: unknown, steps: number): ReturnType<typeof subtractPolygons> {
    const model = partGeometry(value);
    // Vertical cylinders on an axis-aligned plate are meshed with rings, so the
    // plate face is not sliced by every cylinder side. Other solids use the boolean.
    const ringed = plateRingMesh(model, steps);
    if (ringed !== undefined && ringed.indices.length > 0) return meshToPolygons(ringed);
    const chain = subtractionChain(model);
    if (chain) {
        const base = solidPolygons(chain.base, steps);
        const tools = unionAll(chain.tools.map((tool) => solidPolygons(tool, steps)), "Subtraction needs two solids.");
        if (base.length === 0) throw new Error("Subtraction needs two solids.");
        return subtractPolygons(base, tools);
    }
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
    if (isPrimitive(model)) return meshToPolygons(primitiveMesh(model));
    const faces = collectFaces(model);
    // A flat face is two triangles. Sampling it on the boolean grid is what made a small plate time out.
    const patches = faces.map((face) => meshToPolygons(tessellateFaces([face], steps, true)));
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
