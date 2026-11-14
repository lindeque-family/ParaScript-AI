import type { Mesh } from "./model.js";

const EPS = 1e-5;

interface Vec {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

interface Plane {
    readonly normal: Vec;
    readonly w: number;
}

interface Polygon {
    readonly vertices: Vec[];
    readonly plane: Plane;
}

const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

function add(a: Vec, b: Vec): Vec {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec, b: Vec): Vec {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec, factor: number): Vec {
    return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

function dot(a: Vec, b: Vec): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec, b: Vec): Vec {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function length(a: Vec): number {
    return Math.hypot(a.x, a.y, a.z);
}

function lerp(a: Vec, b: Vec, t: number): Vec {
    return add(a, scale(sub(b, a), t));
}

function polygonArea(vertices: readonly Vec[]): number {
    let normal = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        if (current === undefined || next === undefined) continue;
        normal = add(normal, cross(current, next));
    }
    return length(normal) * 0.5;
}

function planeFrom(vertices: readonly Vec[]): Plane | undefined {
    let normal = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        if (current === undefined || next === undefined) continue;
        normal = {
            x: normal.x + (current.y - next.y) * (current.z + next.z),
            y: normal.y + (current.z - next.z) * (current.x + next.x),
            z: normal.z + (current.x - next.x) * (current.y + next.y)
        };
    }
    const magnitude = length(normal);
    const origin = vertices[0];
    if (magnitude < EPS || origin === undefined) return undefined;
    const unit = scale(normal, 1 / magnitude);
    return { normal: unit, w: dot(unit, origin) };
}

function flipPolygon(poly: Polygon): Polygon {
    return {
        vertices: [...poly.vertices].reverse(),
        plane: { normal: scale(poly.plane.normal, -1), w: -poly.plane.w }
    };
}

function splitPolygon(
    plane: Plane,
    poly: Polygon,
    coplanarFront: Polygon[],
    coplanarBack: Polygon[],
    front: Polygon[],
    back: Polygon[]
): void {
    const types: number[] = [];
    let polygonType = 0;
    for (const vertex of poly.vertices) {
        const distance = dot(plane.normal, vertex) - plane.w;
        const type = distance < -EPS ? BACK : distance > EPS ? FRONT : COPLANAR;
        polygonType |= type;
        types.push(type);
    }

    switch (polygonType) {
        case COPLANAR:
            (dot(plane.normal, poly.plane.normal) > 0 ? coplanarFront : coplanarBack).push(poly);
            return;
        case FRONT:
            front.push(poly);
            return;
        case BACK:
            back.push(poly);
            return;
        default:
            break;
    }

    const frontVertices: Vec[] = [];
    const backVertices: Vec[] = [];
    for (let i = 0; i < poly.vertices.length; i++) {
        const j = (i + 1) % poly.vertices.length;
        const ti = types[i];
        const tj = types[j];
        const vi = poly.vertices[i];
        const vj = poly.vertices[j];
        if (ti === undefined || tj === undefined || vi === undefined || vj === undefined) continue;
        if (ti !== BACK) frontVertices.push(vi);
        if (ti !== FRONT) backVertices.push(vi);
        if ((ti | tj) === SPANNING) {
            const edge = sub(vj, vi);
            const denom = dot(plane.normal, edge);
            const t = Math.abs(denom) < EPS ? 0 : (plane.w - dot(plane.normal, vi)) / denom;
            const point = lerp(vi, vj, t);
            frontVertices.push(point);
            backVertices.push(point);
        }
    }
    if (frontVertices.length >= 3 && polygonArea(frontVertices) > EPS) {
        front.push({ vertices: frontVertices, plane: poly.plane });
    }
    if (backVertices.length >= 3 && polygonArea(backVertices) > EPS) {
        back.push({ vertices: backVertices, plane: poly.plane });
    }
}

class Node {
    private plane: Plane | undefined;
    private front: Node | undefined;
    private back: Node | undefined;
    private polygons: Polygon[] = [];

    build(polygons: Polygon[]): void {
        if (polygons.length === 0) return;
        if (this.plane === undefined) this.plane = polygons[0]?.plane;
        const plane = this.plane;
        if (plane === undefined) return;
        const front: Polygon[] = [];
        const back: Polygon[] = [];
        for (const poly of polygons) {
            splitPolygon(plane, poly, this.polygons, this.polygons, front, back);
        }
        if (front.length > 0) {
            this.front ??= new Node();
            this.front.build(front);
        }
        if (back.length > 0) {
            this.back ??= new Node();
            this.back.build(back);
        }
    }

    invert(): void {
        this.polygons = this.polygons.map(flipPolygon);
        if (this.plane !== undefined) {
            this.plane = { normal: scale(this.plane.normal, -1), w: -this.plane.w };
        }
        this.front?.invert();
        this.back?.invert();
        const swap = this.front;
        this.front = this.back;
        this.back = swap;
    }

    clipPolygons(polygons: Polygon[]): Polygon[] {
        if (this.plane === undefined) return polygons.slice();
        let front: Polygon[] = [];
        let back: Polygon[] = [];
        for (const poly of polygons) {
            splitPolygon(this.plane, poly, front, back, front, back);
        }
        if (this.front !== undefined) front = this.front.clipPolygons(front);
        back = this.back !== undefined ? this.back.clipPolygons(back) : [];
        return front.concat(back);
    }

    clipTo(other: Node): void {
        this.polygons = other.clipPolygons(this.polygons);
        this.front?.clipTo(other);
        this.back?.clipTo(other);
    }

    allPolygons(): Polygon[] {
        let polygons = this.polygons.slice();
        if (this.front !== undefined) polygons = polygons.concat(this.front.allPolygons());
        if (this.back !== undefined) polygons = polygons.concat(this.back.allPolygons());
        return polygons;
    }
}

function clonePolygons(polygons: readonly Polygon[]): Polygon[] {
    return polygons.map((poly) => ({
        vertices: poly.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y, z: vertex.z })),
        plane: { normal: { ...poly.plane.normal }, w: poly.plane.w }
    }));
}

export function meshToPolygons(mesh: Mesh): Polygon[] {
    const polygons: Polygon[] = [];
    const { positions, indices } = mesh;
    for (let i = 0; i < indices.length; i += 3) {
        const ai = indices[i];
        const bi = indices[i + 1];
        const ci = indices[i + 2];
        if (ai === undefined || bi === undefined || ci === undefined) continue;
        const vertices = [ai, bi, ci].map((index) => ({
            x: positions[index * 3] ?? 0,
            y: positions[index * 3 + 1] ?? 0,
            z: positions[index * 3 + 2] ?? 0
        }));
        const plane = planeFrom(vertices);
        if (plane === undefined) continue;
        polygons.push({ vertices, plane });
    }
    return polygons;
}

export function polygonsToMesh(polygons: readonly Polygon[]): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const poly of polygons) {
        const base = positions.length / 3;
        for (const vertex of poly.vertices) {
            positions.push(vertex.x, vertex.y, vertex.z);
        }
        for (let i = 1; i < poly.vertices.length - 1; i++) {
            indices.push(base, base + i, base + i + 1);
        }
    }
    return {
        positions: Float32Array.from(positions),
        indices: Uint32Array.from(indices)
    };
}

export function orientPatchesOutward(patches: readonly (readonly Polygon[])[]): Polygon[] {
    const all = patches.flat();
    if (all.length === 0) return [];
    let count = 0;
    let centroid = { x: 0, y: 0, z: 0 };
    for (const poly of all) {
        for (const vertex of poly.vertices) {
            centroid = add(centroid, vertex);
            count++;
        }
    }
    centroid = scale(centroid, 1 / count);
    const oriented: Polygon[] = [];
    for (const patch of patches) {
        for (const poly of patch) {
            let center = { x: 0, y: 0, z: 0 };
            for (const vertex of poly.vertices) center = add(center, vertex);
            center = scale(center, 1 / poly.vertices.length);
            // Convex solids: a polygon faces outward when its normal points away from the solid centroid.
            // A curved wall's triangles cancel if they are flipped as one patch, so each polygon is judged alone.
            const outward = dot(poly.plane.normal, sub(center, centroid)) >= 0;
            oriented.push(outward ? poly : flipPolygon(poly));
        }
    }
    return oriented;
}

// BSP subtraction. Both inputs must be closed solids with outward normals.
export function subtractPolygons(target: readonly Polygon[], tool: readonly Polygon[]): Polygon[] {
    const a = new Node();
    const b = new Node();
    a.build(clonePolygons(target));
    b.build(clonePolygons(tool));
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return a.allPolygons();
}

export function subtractMeshes(target: Mesh, tool: Mesh): Mesh {
    return polygonsToMesh(subtractPolygons(meshToPolygons(target), meshToPolygons(tool)));
}

// BSP union. Both inputs must be closed solids with outward normals.
export function unionPolygons(target: readonly Polygon[], tool: readonly Polygon[]): Polygon[] {
    const a = new Node();
    const b = new Node();
    a.build(clonePolygons(target));
    b.build(clonePolygons(tool));
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    return a.allPolygons();
}

export function unionMeshes(target: Mesh, tool: Mesh): Mesh {
    return polygonsToMesh(unionPolygons(meshToPolygons(target), meshToPolygons(tool)));
}

function vertexAt(mesh: Mesh, index: number): Vec {
    return {
        x: mesh.positions[index * 3] ?? 0,
        y: mesh.positions[index * 3 + 1] ?? 0,
        z: mesh.positions[index * 3 + 2] ?? 0
    };
}

export function pointInsideMesh(mesh: Mesh, point: Vec): boolean {
    const direction = { x: 0.913, y: 0.279, z: 0.137 };
    const hits = new Set<number>();
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const ai = mesh.indices[i];
        const bi = mesh.indices[i + 1];
        const ci = mesh.indices[i + 2];
        if (ai === undefined || bi === undefined || ci === undefined) continue;
        const distance = rayHit(point, direction, vertexAt(mesh, ai), vertexAt(mesh, bi), vertexAt(mesh, ci));
        if (distance !== undefined) hits.add(Math.round(distance * 1e5));
    }
    return hits.size % 2 === 1;
}

function rayHit(origin: Vec, direction: Vec, a: Vec, b: Vec, c: Vec): number | undefined {
    const ab = sub(b, a);
    const ac = sub(c, a);
    const pvec = cross(direction, ac);
    const det = dot(ab, pvec);
    if (Math.abs(det) < 1e-8) return undefined;
    const inverse = 1 / det;
    const tvec = sub(origin, a);
    const u = dot(tvec, pvec) * inverse;
    if (u < 0 || u > 1) return undefined;
    const qvec = cross(tvec, ab);
    const v = dot(direction, qvec) * inverse;
    if (v < 0 || u + v > 1) return undefined;
    const t = dot(ac, qvec) * inverse;
    if (t <= 1e-8) return undefined;
    return t;
}
