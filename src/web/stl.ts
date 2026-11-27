import earcut, { deviation } from "./earcut.js";
import type { Mesh } from "./model.js";

const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;
/** A vertex this close to an edge, in millimetres, is inserted into that edge. */
const JUNCTION_EPS = 1e-4;
const JUNCTION_CELL = 4;
/**
 * Open-edge vertices closer than this, in millimetres, are the same corner.
 * A slicer joins points a micron apart and still reports a crack a few microns wide.
 */
const WELD_EPS = 5e-3;
/**
 * A boundary loop thinner than this, in millimetres, is a seam between two copies of one curve.
 * The M3 collar and the cap inside the head leave a flat crack about 0.1 mm wide.
 */
const CRACK_WIDTH = 0.2;

/** Download name for a model. A missing or unusable name stays `solid.stl`. */
export function stlFilename(name: string | undefined): string {
    const cleaned = (name ?? "").replace(/[\u0000-\u001f"\\/:*?<>|]/g, "").trim();
    if (cleaned.length === 0 || cleaned === "." || cleaned === "..") return "solid.stl";
    return cleaned.toLowerCase().endsWith(".stl") ? cleaned : `${cleaned}.stl`;
}

/** Binary STL. The header does not start with "solid", which some tools read as ASCII. */
export function meshToStl(mesh: Mesh): Buffer {
    const watertight = watertightTriangles(mesh);
    const triangles: number[][] = [];
    for (const [a, b, c] of watertight.triangles) {
        const triangle = facetOf(watertight.positions, a, b, c);
        if (triangle !== null) triangles.push(triangle);
    }
    const out = Buffer.alloc(HEADER_BYTES + 4 + triangles.length * TRIANGLE_BYTES);
    out.write("ParaScript", 0, "latin1");
    out.writeUInt32LE(triangles.length, HEADER_BYTES);
    let offset = HEADER_BYTES + 4;
    for (const triangle of triangles) {
        for (const value of triangle) {
            out.writeFloatLE(value, offset);
            offset += 4;
        }
        out.writeUInt16LE(0, offset);
        offset += 2;
    }
    return out;
}

/**
 * A straight run of beads leaves three collinear corners in the cap.
 * That triangle has no area. Dropping it opens the three edges a slicer reports.
 * The long edge is split at the middle corner, and the flat triangle is removed.
 */
function watertightTriangles(mesh: Mesh): { positions: Float32Array; triangles: Array<[number, number, number]> } {
    const positions = new Float32Array(mesh.positions);
    const triangles: Array<[number, number, number] | undefined> = [];
    for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
        triangles.push([mesh.indices[index] ?? 0, mesh.indices[index + 1] ?? 0, mesh.indices[index + 2] ?? 0]);
    }
    insertTJunctions(positions, triangles);
    for (let index = 0; index < triangles.length; index += 1) {
        const triangle = triangles[index];
        if (triangle === undefined || crossLength(positions, triangle) >= 1e-12) continue;
        const base = longestEdge(positions, triangle);
        if (base === undefined) continue;
        const middle = triangle.find((vertex) => vertex !== base[0] && vertex !== base[1]);
        const mate = mateIndex(positions, triangles, base, index);
        if (middle === undefined || mate === undefined) continue;
        const split = splitEdge(triangles[mate], base, middle, positions);
        if (split === undefined) continue;
        triangles[mate] = split[0];
        triangles.push(split[1]);
        triangles[index] = undefined;
    }
    weldOpenVertices(positions, triangles);
    fillPlanarCracks(positions, triangles);
    return {
        positions,
        triangles: triangles.filter((triangle): triangle is [number, number, number] => triangle !== undefined)
    };
}

/** Move each open corner onto a neighbour that is already within {@link WELD_EPS}. */
function weldOpenVertices(positions: Float32Array, triangles: Array<[number, number, number] | undefined>): void {
    const counts = new Map<string, number>();
    for (const triangle of triangles) {
        if (triangle === undefined) continue;
        for (let edge = 0; edge < 3; edge += 1) {
            const name = edgeKey(positions, triangle[edge] ?? 0, triangle[(edge + 1) % 3] ?? 0);
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    const seen = new Set<number>();
    const vertices: number[] = [];
    for (const triangle of triangles) {
        if (triangle === undefined) continue;
        for (let edge = 0; edge < 3; edge += 1) {
            const from = triangle[edge] ?? 0;
            const to = triangle[(edge + 1) % 3] ?? 0;
            if ((counts.get(edgeKey(positions, from, to)) ?? 0) !== 1) continue;
            for (const vertex of [from, to]) {
                if (seen.has(vertex)) continue;
                seen.add(vertex);
                vertices.push(vertex);
            }
        }
    }
    if (vertices.length < 2) return;
    const parent = vertices.map((_, index) => index);
    const find = (index: number): number => {
        let cursor = index;
        while ((parent[cursor] ?? cursor) !== cursor) {
            const next = parent[cursor] ?? cursor;
            parent[cursor] = parent[next] ?? next;
            cursor = next;
        }
        return cursor;
    };
    const buckets = new Map<string, number[]>();
    const bucketOf = (vertex: number): string => {
        const x = positions[vertex * 3] ?? 0;
        const y = positions[vertex * 3 + 1] ?? 0;
        const z = positions[vertex * 3 + 2] ?? 0;
        return `${Math.floor(x / WELD_EPS)},${Math.floor(y / WELD_EPS)},${Math.floor(z / WELD_EPS)}`;
    };
    vertices.forEach((vertex, index) => {
        const key = bucketOf(vertex);
        const list = buckets.get(key);
        if (list === undefined) buckets.set(key, [index]);
        else list.push(index);
    });
    for (let index = 0; index < vertices.length; index += 1) {
        const vertex = vertices[index] ?? 0;
        const x = positions[vertex * 3] ?? 0;
        const y = positions[vertex * 3 + 1] ?? 0;
        const z = positions[vertex * 3 + 2] ?? 0;
        const ix = Math.floor(x / WELD_EPS);
        const iy = Math.floor(y / WELD_EPS);
        const iz = Math.floor(z / WELD_EPS);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                for (let dz = -1; dz <= 1; dz += 1) {
                    for (const other of buckets.get(`${ix + dx},${iy + dy},${iz + dz}`) ?? []) {
                        if (other <= index) continue;
                        const mate = vertices[other] ?? 0;
                        if (distance(positions, vertex, mate) > WELD_EPS) continue;
                        const left = find(index);
                        const right = find(other);
                        if (left !== right) parent[right] = left;
                    }
                }
            }
        }
    }
    const canonical = new Map<number, number>();
    for (let index = 0; index < vertices.length; index += 1) {
        const root = find(index);
        const vertex = vertices[index] ?? 0;
        const current = canonical.get(root);
        if (current === undefined || vertex < current) canonical.set(root, vertex);
    }
    // Every copy of a corner moves together. A closed face can use another index at the same point.
    const destination = new Map<string, number>();
    for (let index = 0; index < vertices.length; index += 1) {
        const vertex = vertices[index] ?? 0;
        destination.set(pointKey(positions, vertex), canonical.get(find(index)) ?? vertex);
    }
    const written = new Set<number>();
    for (const triangle of triangles) {
        if (triangle === undefined) continue;
        for (const vertex of triangle) {
            if (written.has(vertex)) continue;
            written.add(vertex);
            const source = destination.get(pointKey(positions, vertex));
            if (source === undefined || source === vertex) continue;
            positions[vertex * 3] = positions[source * 3] ?? 0;
            positions[vertex * 3 + 1] = positions[source * 3 + 1] ?? 0;
            positions[vertex * 3 + 2] = positions[source * 3 + 2] ?? 0;
        }
    }
}

/**
 * Two faces can trace one seam as two curves. Walk the narrow loop between them and fill it.
 * A wider opening, and a loop that is not flat, stays open.
 */
function fillPlanarCracks(positions: Float32Array, triangles: Array<[number, number, number] | undefined>): void {
    const counts = new Map<string, number>();
    for (const triangle of triangles) {
        if (triangle === undefined) continue;
        for (let edge = 0; edge < 3; edge += 1) {
            const name = edgeKey(positions, triangle[edge] ?? 0, triangle[(edge + 1) % 3] ?? 0);
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    type Half = { from: number; to: number; fromKey: string; toKey: string };
    const halves: Half[] = [];
    const outgoing = new Map<string, Half[]>();
    const directed = new Set<string>();
    for (const triangle of triangles) {
        if (triangle === undefined) continue;
        for (let edge = 0; edge < 3; edge += 1) {
            const from = triangle[edge] ?? 0;
            const to = triangle[(edge + 1) % 3] ?? 0;
            if ((counts.get(edgeKey(positions, from, to)) ?? 0) !== 1) continue;
            const half: Half = { from, to, fromKey: pointKey(positions, from), toKey: pointKey(positions, to) };
            halves.push(half);
            directed.add(`${half.fromKey}>${half.toKey}`);
            const list = outgoing.get(half.fromKey);
            if (list === undefined) outgoing.set(half.fromKey, [half]);
            else list.push(half);
        }
    }
    if (halves.length < 3) return;
    const next = new Map<Half, Half>();
    for (const half of halves) {
        const choices = outgoing.get(half.toKey) ?? [];
        let best: Half | undefined;
        let bestScore = Infinity;
        const backX = (positions[half.from * 3] ?? 0) - (positions[half.to * 3] ?? 0);
        const backY = (positions[half.from * 3 + 1] ?? 0) - (positions[half.to * 3 + 1] ?? 0);
        const backZ = (positions[half.from * 3 + 2] ?? 0) - (positions[half.to * 3 + 2] ?? 0);
        for (const candidate of choices) {
            if (candidate.toKey === half.fromKey) continue;
            const outX = (positions[candidate.to * 3] ?? 0) - (positions[half.to * 3] ?? 0);
            const outY = (positions[candidate.to * 3 + 1] ?? 0) - (positions[half.to * 3 + 1] ?? 0);
            const outZ = (positions[candidate.to * 3 + 2] ?? 0) - (positions[half.to * 3 + 2] ?? 0);
            const score = angleBetween(backX, backY, backZ, outX, outY, outZ);
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        if (best === undefined) continue;
        next.set(half, best);
    }
    const used = new Set<Half>();
    for (const start of halves) {
        if (used.has(start)) continue;
        const cycle: Half[] = [];
        const seen = new Set<Half>();
        let cursor: Half | undefined = start;
        let closed = false;
        while (cursor !== undefined && cycle.length <= halves.length) {
            if (cursor === start && cycle.length > 0) {
                closed = true;
                break;
            }
            if (seen.has(cursor) || used.has(cursor)) break;
            seen.add(cursor);
            cycle.push(cursor);
            cursor = next.get(cursor);
        }
        if (!closed) continue;
        for (const half of cycle) used.add(half);
        const added = crackTriangles(positions, cycle, counts, directed);
        for (const triangle of added) triangles.push(triangle);
    }
}

/** Triangles for one narrow flat loop, wound against the existing boundary. An empty list leaves the loop open. */
function crackTriangles(
    positions: Float32Array,
    cycle: ReadonlyArray<{ from: number; to: number; fromKey: string; toKey: string }>,
    counts: Map<string, number>,
    directed: Set<string>
): Array<[number, number, number]> {
    const ring: number[] = [];
    for (const half of cycle) {
        const last = ring[ring.length - 1];
        if (last !== undefined && samePoint(positions, last, half.from)) continue;
        ring.push(half.from);
    }
    if (ring.length > 1 && samePoint(positions, ring[0] ?? 0, ring[ring.length - 1] ?? 0)) ring.pop();
    if (ring.length < 3) return [];
    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;
    let perimeter = 0;
    for (let index = 0; index < ring.length; index += 1) {
        const from = ring[index] ?? 0;
        const to = ring[(index + 1) % ring.length] ?? 0;
        const ax = positions[from * 3] ?? 0;
        const ay = positions[from * 3 + 1] ?? 0;
        const az = positions[from * 3 + 2] ?? 0;
        const bx = positions[to * 3] ?? 0;
        const by = positions[to * 3 + 1] ?? 0;
        const bz = positions[to * 3 + 2] ?? 0;
        normalX += (ay - by) * (az + bz);
        normalY += (az - bz) * (ax + bx);
        normalZ += (ax - bx) * (ay + by);
        perimeter += Math.hypot(ax - bx, ay - by, az - bz);
    }
    const area = 0.5 * Math.hypot(normalX, normalY, normalZ);
    if (!(area > 1e-6) || perimeter <= 0 || (2 * area) / perimeter > CRACK_WIDTH) return [];
    const length = Math.hypot(normalX, normalY, normalZ);
    normalX /= length;
    normalY /= length;
    normalZ /= length;
    const origin = ring[0] ?? 0;
    const ox = positions[origin * 3] ?? 0;
    const oy = positions[origin * 3 + 1] ?? 0;
    const oz = positions[origin * 3 + 2] ?? 0;
    for (const vertex of ring) {
        const dx = (positions[vertex * 3] ?? 0) - ox;
        const dy = (positions[vertex * 3 + 1] ?? 0) - oy;
        const dz = (positions[vertex * 3 + 2] ?? 0) - oz;
        if (Math.abs(dx * normalX + dy * normalY + dz * normalZ) > 1e-2) return [];
    }
    let axisX = 0;
    let axisY = 0;
    let axisZ = 1;
    if (Math.abs(normalZ) > 0.9) {
        axisX = 1;
        axisY = 0;
        axisZ = 0;
    }
    let edgeX = axisY * normalZ - axisZ * normalY;
    let edgeY = axisZ * normalX - axisX * normalZ;
    let edgeZ = axisX * normalY - axisY * normalX;
    const edgeLength = Math.hypot(edgeX, edgeY, edgeZ) || 1;
    edgeX /= edgeLength;
    edgeY /= edgeLength;
    edgeZ /= edgeLength;
    const sideX = normalY * edgeZ - normalZ * edgeY;
    const sideY = normalZ * edgeX - normalX * edgeZ;
    const sideZ = normalX * edgeY - normalY * edgeX;
    const data: number[] = [];
    for (const vertex of ring) {
        const dx = (positions[vertex * 3] ?? 0) - ox;
        const dy = (positions[vertex * 3 + 1] ?? 0) - oy;
        const dz = (positions[vertex * 3 + 2] ?? 0) - oz;
        data.push(dx * edgeX + dy * edgeY + dz * edgeZ, dx * sideX + dy * sideY + dz * sideZ);
    }
    const indices = earcut(data, null, 2);
    const error = indices.length < 3 ? 1 : deviation(data, null, 2, indices);
    if (indices.length < 3 || !Number.isFinite(error) || error > 1e-3) return [];
    const proposed: Array<[number, number, number]> = [];
    for (let index = 0; index < indices.length; index += 3) {
        const triangle: [number, number, number] = [
            ring[indices[index] ?? 0] ?? 0,
            ring[indices[index + 1] ?? 0] ?? 0,
            ring[indices[index + 2] ?? 0] ?? 0
        ];
        if (crossLength(positions, triangle) < 1e-12) return [];
        proposed.push(triangle);
    }
    let along = 0;
    let against = 0;
    for (const triangle of proposed) {
        for (let edge = 0; edge < 3; edge += 1) {
            const from = pointKey(positions, triangle[edge] ?? 0);
            const to = pointKey(positions, triangle[(edge + 1) % 3] ?? 0);
            if (directed.has(`${from}>${to}`)) along += 1;
            if (directed.has(`${to}>${from}`)) against += 1;
        }
    }
    if (along > against) {
        for (const triangle of proposed) {
            const swap = triangle[1];
            triangle[1] = triangle[2];
            triangle[2] = swap;
        }
    }
    const extra = new Map<string, number>();
    for (const triangle of proposed) {
        for (let edge = 0; edge < 3; edge += 1) {
            const name = edgeKey(positions, triangle[edge] ?? 0, triangle[(edge + 1) % 3] ?? 0);
            const total = (counts.get(name) ?? 0) + (extra.get(name) ?? 0) + 1;
            if (total > 2) return [];
            extra.set(name, (extra.get(name) ?? 0) + 1);
        }
    }
    for (const [name, value] of extra) counts.set(name, (counts.get(name) ?? 0) + value);
    for (const triangle of proposed) {
        for (let edge = 0; edge < 3; edge += 1) {
            const from = pointKey(positions, triangle[edge] ?? 0);
            const to = pointKey(positions, triangle[(edge + 1) % 3] ?? 0);
            directed.add(`${from}>${to}`);
        }
    }
    return proposed;
}

function angleBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const left = Math.hypot(ax, ay, az);
    const right = Math.hypot(bx, by, bz);
    if (left === 0 || right === 0) return Math.PI;
    const cos = (ax * bx + ay * by + az * bz) / (left * right);
    return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/**
 * BSP can split one face at a point the neighbour does not share.
 * The neighbour keeps one long edge. Insert the point so both sides use the same short edges.
 * Only a vertex already on an open edge is inserted, so a closed mesh is left alone.
 */
function insertTJunctions(positions: ArrayLike<number>, triangles: Array<[number, number, number] | undefined>): void {
    const counts = new Map<string, number>();
    const ends = new Map<string, [number, number]>();
    const users = new Map<string, number[]>();
    for (let index = 0; index < triangles.length; index += 1) {
        const triangle = triangles[index];
        if (triangle === undefined) continue;
        for (let edge = 0; edge < 3; edge += 1) {
            const from = triangle[edge] ?? 0;
            const to = triangle[(edge + 1) % 3] ?? 0;
            const name = edgeKey(positions, from, to);
            counts.set(name, (counts.get(name) ?? 0) + 1);
            if (!ends.has(name)) ends.set(name, [from, to]);
            const list = users.get(name);
            if (list === undefined) users.set(name, [index]);
            else list.push(index);
        }
    }
    const seen = new Set<string>();
    const vertices: number[] = [];
    for (const [name, count] of counts) {
        if (count !== 1) continue;
        const pair = ends.get(name);
        if (pair === undefined) continue;
        for (const vertex of pair) {
            const key = pointKey(positions, vertex);
            if (seen.has(key)) continue;
            seen.add(key);
            vertices.push(vertex);
        }
    }
    if (vertices.length === 0) return;
    const buckets = new Map<string, number[]>();
    for (const vertex of vertices) {
        const key = cellKey(
            cellIndex(positions[vertex * 3] ?? 0),
            cellIndex(positions[vertex * 3 + 1] ?? 0),
            cellIndex(positions[vertex * 3 + 2] ?? 0)
        );
        const list = buckets.get(key);
        if (list === undefined) buckets.set(key, [vertex]);
        else list.push(vertex);
    }
    const proposals: Array<{ name: string; from: number; to: number; middles: number[] }> = [];
    for (const [name, count] of counts) {
        if (count !== 1) continue;
        const pair = ends.get(name);
        if (pair === undefined) continue;
        const [from, to] = pair;
        if (distance(positions, from, to) <= JUNCTION_EPS) continue;
        const cuts = cutsOnEdge(positions, buckets, vertices, from, to);
        if (cuts.length === 0) continue;
        cuts.sort((left, right) => left.t - right.t);
        const middles: number[] = [];
        const used = new Set<string>();
        for (const cut of cuts) {
            const key = pointKey(positions, cut.vertex);
            if (used.has(key)) continue;
            used.add(key);
            middles.push(cut.vertex);
        }
        proposals.push({ name, from, to, middles });
    }
    const active = keepProposals(positions, counts, proposals);
    for (let index = 0; index < proposals.length; index += 1) {
        if (!active[index]) continue;
        const proposal = proposals[index];
        if (proposal === undefined) continue;
        splitMatchingEdges(positions, triangles, users, proposal.from, proposal.to, proposal.middles);
    }
}

/** Keep the splits that leave every edge on one or two triangles. */
function keepProposals(
    positions: ArrayLike<number>,
    counts: ReadonlyMap<string, number>,
    proposals: ReadonlyArray<{ name: string; from: number; to: number; middles: number[] }>
): boolean[] {
    const active = proposals.map(() => true);
    const final = new Map(counts);
    const touched = new Map<string, number[]>();
    for (let index = 0; index < proposals.length; index += 1) {
        const proposal = proposals[index];
        if (proposal === undefined) continue;
        final.set(proposal.name, (final.get(proposal.name) ?? 0) - 1);
        for (const key of segmentKeys(positions, proposal.from, proposal.middles, proposal.to)) {
            final.set(key, (final.get(key) ?? 0) + 1);
            const users = touched.get(key);
            if (users === undefined) touched.set(key, [index]);
            else users.push(index);
        }
    }
    const over = new Set<string>();
    for (const [key, value] of final) if (value > 2) over.add(key);
    while (over.size > 0) {
        const score = new Map<number, number>();
        for (const key of over) {
            for (const index of touched.get(key) ?? []) {
                if (!active[index]) continue;
                score.set(index, (score.get(index) ?? 0) + 1);
            }
        }
        let drop = -1;
        let worst = 0;
        for (const [index, value] of score) {
            if (value > worst) {
                drop = index;
                worst = value;
            }
        }
        if (drop < 0) break;
        active[drop] = false;
        const proposal = proposals[drop];
        if (proposal === undefined) break;
        const restored = (final.get(proposal.name) ?? 0) + 1;
        final.set(proposal.name, restored);
        if (restored > 2) over.add(proposal.name);
        else over.delete(proposal.name);
        for (const key of segmentKeys(positions, proposal.from, proposal.middles, proposal.to)) {
            const value = (final.get(key) ?? 0) - 1;
            final.set(key, value);
            if (value > 2) over.add(key);
            else over.delete(key);
        }
    }
    return active;
}

function cellIndex(value: number): number {
    return Math.floor(value / JUNCTION_CELL);
}

function cellKey(ix: number, iy: number, iz: number): string {
    return `${ix},${iy},${iz}`;
}

function cutsOnEdge(
    positions: ArrayLike<number>,
    buckets: ReadonlyMap<string, number[]>,
    vertices: readonly number[],
    from: number,
    to: number
): Array<{ vertex: number; t: number }> {
    const ax = positions[from * 3] ?? 0;
    const ay = positions[from * 3 + 1] ?? 0;
    const az = positions[from * 3 + 2] ?? 0;
    const bx = positions[to * 3] ?? 0;
    const by = positions[to * 3 + 1] ?? 0;
    const bz = positions[to * 3 + 2] ?? 0;
    const ix0 = cellIndex(Math.min(ax, bx) - JUNCTION_EPS);
    const ix1 = cellIndex(Math.max(ax, bx) + JUNCTION_EPS);
    const iy0 = cellIndex(Math.min(ay, by) - JUNCTION_EPS);
    const iy1 = cellIndex(Math.max(ay, by) + JUNCTION_EPS);
    const iz0 = cellIndex(Math.min(az, bz) - JUNCTION_EPS);
    const iz1 = cellIndex(Math.max(az, bz) + JUNCTION_EPS);
    const cuts: Array<{ vertex: number; t: number }> = [];
    const span = (ix1 - ix0 + 1) * (iy1 - iy0 + 1) * (iz1 - iz0 + 1);
    const consider = (vertex: number): void => {
        const t = edgeParameter(positions, from, to, vertex);
        if (t !== undefined) cuts.push({ vertex, t });
    };
    if (span > 1024) {
        for (const vertex of vertices) consider(vertex);
        return cuts;
    }
    for (let ix = ix0; ix <= ix1; ix += 1) {
        for (let iy = iy0; iy <= iy1; iy += 1) {
            for (let iz = iz0; iz <= iz1; iz += 1) {
                for (const vertex of buckets.get(cellKey(ix, iy, iz)) ?? []) consider(vertex);
            }
        }
    }
    return cuts;
}

function segmentKeys(positions: ArrayLike<number>, from: number, middles: readonly number[], to: number): string[] {
    const points = [from, ...middles, to];
    const keys: string[] = [];
    for (let index = 0; index + 1 < points.length; index += 1) {
        keys.push(edgeKey(positions, points[index] ?? 0, points[index + 1] ?? 0));
    }
    return keys;
}

function splitMatchingEdges(
    positions: ArrayLike<number>,
    triangles: Array<[number, number, number] | undefined>,
    users: Map<string, number[]>,
    from: number,
    to: number,
    middles: readonly number[]
): void {
    const hits = [...(users.get(edgeKey(positions, from, to)) ?? [])];
    for (const hit of hits) {
        const parts = splitEdgeChain(triangles[hit], [from, to], middles, positions);
        if (parts === undefined) continue;
        unlinkTriangle(positions, triangles, users, hit);
        triangles[hit] = parts[0];
        linkTriangle(positions, triangles, users, hit);
        for (let index = 1; index < parts.length; index += 1) {
            const part = parts[index];
            if (part === undefined) continue;
            triangles.push(part);
            linkTriangle(positions, triangles, users, triangles.length - 1);
        }
    }
}

function linkTriangle(
    positions: ArrayLike<number>,
    triangles: ReadonlyArray<[number, number, number] | undefined>,
    users: Map<string, number[]>,
    index: number
): void {
    const triangle = triangles[index];
    if (triangle === undefined) return;
    for (let edge = 0; edge < 3; edge += 1) {
        const name = edgeKey(positions, triangle[edge] ?? 0, triangle[(edge + 1) % 3] ?? 0);
        const list = users.get(name);
        if (list === undefined) users.set(name, [index]);
        else list.push(index);
    }
}

function unlinkTriangle(
    positions: ArrayLike<number>,
    triangles: ReadonlyArray<[number, number, number] | undefined>,
    users: Map<string, number[]>,
    index: number
): void {
    const triangle = triangles[index];
    if (triangle === undefined) return;
    for (let edge = 0; edge < 3; edge += 1) {
        const list = users.get(edgeKey(positions, triangle[edge] ?? 0, triangle[(edge + 1) % 3] ?? 0));
        if (list === undefined) continue;
        const at = list.indexOf(index);
        if (at >= 0) list.splice(at, 1);
    }
}

/** Position of `vertex` along the edge, or undefined when it is not strictly inside. */
function edgeParameter(positions: ArrayLike<number>, from: number, to: number, vertex: number): number | undefined {
    if (samePoint(positions, from, vertex) || samePoint(positions, to, vertex)) return undefined;
    const ax = positions[from * 3] ?? 0;
    const ay = positions[from * 3 + 1] ?? 0;
    const az = positions[from * 3 + 2] ?? 0;
    const bx = positions[to * 3] ?? 0;
    const by = positions[to * 3 + 1] ?? 0;
    const bz = positions[to * 3 + 2] ?? 0;
    const vx = positions[vertex * 3] ?? 0;
    const vy = positions[vertex * 3 + 1] ?? 0;
    const vz = positions[vertex * 3 + 2] ?? 0;
    if (vx < Math.min(ax, bx) - JUNCTION_EPS || vx > Math.max(ax, bx) + JUNCTION_EPS) return undefined;
    if (vy < Math.min(ay, by) - JUNCTION_EPS || vy > Math.max(ay, by) + JUNCTION_EPS) return undefined;
    if (vz < Math.min(az, bz) - JUNCTION_EPS || vz > Math.max(az, bz) + JUNCTION_EPS) return undefined;
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const lengthSquared = abx * abx + aby * aby + abz * abz;
    if (lengthSquared <= JUNCTION_EPS * JUNCTION_EPS) return undefined;
    const t = ((vx - ax) * abx + (vy - ay) * aby + (vz - az) * abz) / lengthSquared;
    if (t <= 0 || t >= 1) return undefined;
    const px = ax + t * abx;
    const py = ay + t * aby;
    const pz = az + t * abz;
    const gap = Math.hypot(vx - px, vy - py, vz - pz);
    const along = Math.hypot(px - ax, py - ay, pz - az);
    const remain = Math.hypot(bx - px, by - py, bz - pz);
    return gap <= JUNCTION_EPS && along > JUNCTION_EPS && remain > JUNCTION_EPS ? t : undefined;
}

function mateIndex(
    positions: ArrayLike<number>,
    triangles: ReadonlyArray<[number, number, number] | undefined>,
    edge: [number, number],
    skip: number
): number | undefined {
    const name = edgeKey(positions, edge[0], edge[1]);
    let found: number | undefined;
    for (let index = 0; index < triangles.length; index += 1) {
        if (index === skip) continue;
        const triangle = triangles[index];
        if (triangle === undefined) continue;
        for (let corner = 0; corner < 3; corner += 1) {
            if (edgeKey(positions, triangle[corner] ?? 0, triangle[(corner + 1) % 3] ?? 0) !== name) continue;
            if (found !== undefined) return undefined;
            found = index;
        }
    }
    return found;
}

/** Replace one edge with the chain of short edges through each middle vertex. */
function splitEdgeChain(
    triangle: [number, number, number] | undefined,
    edge: [number, number],
    middles: readonly number[],
    positions: ArrayLike<number>
): Array<[number, number, number]> | undefined {
    if (triangle === undefined || middles.length === 0) return undefined;
    const forward = triangle.some((vertex, index) => (
        samePoint(positions, vertex, edge[0]) && samePoint(positions, triangle[(index + 1) % 3] ?? 0, edge[1])
    ));
    if (!forward && !triangle.some((vertex, index) => (
        samePoint(positions, vertex, edge[1]) && samePoint(positions, triangle[(index + 1) % 3] ?? 0, edge[0])
    ))) return undefined;
    const from = forward ? edge[0] : edge[1];
    const to = forward ? edge[1] : edge[0];
    const far = triangle.find((vertex) => !samePoint(positions, vertex, edge[0]) && !samePoint(positions, vertex, edge[1]));
    if (far === undefined) return undefined;
    const ordered = (forward ? middles : [...middles].reverse()).filter((middle) => (
        !samePoint(positions, middle, far) && !samePoint(positions, middle, from) && !samePoint(positions, middle, to)
    ));
    if (ordered.length === 0) return undefined;
    const parts: Array<[number, number, number]> = [];
    let current = from;
    for (const middle of ordered) {
        parts.push([current, middle, far]);
        current = middle;
    }
    parts.push([current, to, far]);
    return parts;
}

/** Replace the mate's long edge with the two short edges, keeping its winding. */
function splitEdge(
    triangle: [number, number, number] | undefined,
    edge: [number, number],
    middle: number,
    positions: ArrayLike<number>
): [[number, number, number], [number, number, number]] | undefined {
    if (triangle === undefined) return undefined;
    const start = triangle.findIndex((vertex, index) => (
        samePoint(positions, vertex, edge[0]) && samePoint(positions, triangle[(index + 1) % 3] ?? 0, edge[1])
    ));
    const from = start >= 0 ? edge[0] : edge[1];
    const to = start >= 0 ? edge[1] : edge[0];
    if (start < 0 && !triangle.some((vertex, index) => (
        samePoint(positions, vertex, edge[1]) && samePoint(positions, triangle[(index + 1) % 3] ?? 0, edge[0])
    ))) return undefined;
    const far = triangle.find((vertex) => !samePoint(positions, vertex, edge[0]) && !samePoint(positions, vertex, edge[1]));
    if (far === undefined || samePoint(positions, far, middle)) return undefined;
    return [[from, middle, far], [middle, to, far]];
}

function longestEdge(positions: ArrayLike<number>, triangle: [number, number, number]): [number, number] | undefined {
    const [a, b, c] = triangle;
    const ab = distance(positions, a, b);
    const bc = distance(positions, b, c);
    const ca = distance(positions, c, a);
    const span = Math.max(ab, bc, ca);
    // The middle corner sits on the long edge only when the other two lengths add up to it.
    if (Math.abs(ab + bc + ca - 2 * span) > 1e-4) return undefined;
    if (span === ab && span > bc && span > ca) return [a, b];
    if (span === bc && span > ab && span > ca) return [b, c];
    if (span === ca && span > ab && span > bc) return [c, a];
    return undefined;
}

function crossLength(positions: ArrayLike<number>, triangle: [number, number, number]): number {
    const [a, b, c] = triangle;
    const ax = positions[a * 3] ?? Number.NaN;
    const ay = positions[a * 3 + 1] ?? Number.NaN;
    const az = positions[a * 3 + 2] ?? Number.NaN;
    const ux = (positions[b * 3] ?? Number.NaN) - ax;
    const uy = (positions[b * 3 + 1] ?? Number.NaN) - ay;
    const uz = (positions[b * 3 + 2] ?? Number.NaN) - az;
    const vx = (positions[c * 3] ?? Number.NaN) - ax;
    const vy = (positions[c * 3 + 1] ?? Number.NaN) - ay;
    const vz = (positions[c * 3 + 2] ?? Number.NaN) - az;
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function distance(positions: ArrayLike<number>, from: number, to: number): number {
    const dx = (positions[from * 3] ?? 0) - (positions[to * 3] ?? 0);
    const dy = (positions[from * 3 + 1] ?? 0) - (positions[to * 3 + 1] ?? 0);
    const dz = (positions[from * 3 + 2] ?? 0) - (positions[to * 3 + 2] ?? 0);
    return Math.hypot(dx, dy, dz);
}

function samePoint(positions: ArrayLike<number>, left: number, right: number): boolean {
    return pointKey(positions, left) === pointKey(positions, right);
}

function edgeKey(positions: ArrayLike<number>, from: number, to: number): string {
    const left = pointKey(positions, from);
    const right = pointKey(positions, to);
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function pointKey(positions: ArrayLike<number>, index: number): string {
    const offset = index * 3;
    return `${positions[offset]},${positions[offset + 1]},${positions[offset + 2]}`;
}

function facetOf(positions: ArrayLike<number>, a: number, b: number, c: number): number[] | null {
    const values = [a, b, c].flatMap((corner) => [
        positions[corner * 3] ?? Number.NaN,
        positions[corner * 3 + 1] ?? Number.NaN,
        positions[corner * 3 + 2] ?? Number.NaN
    ]);
    if (values.some((value) => !Number.isFinite(value))) return null;
    const ax = values[0] ?? 0;
    const ay = values[1] ?? 0;
    const az = values[2] ?? 0;
    const bx = values[3] ?? 0;
    const by = values[4] ?? 0;
    const bz = values[5] ?? 0;
    const cx = values[6] ?? 0;
    const cy = values[7] ?? 0;
    const cz = values[8] ?? 0;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-12) return null;
    nx /= length;
    ny /= length;
    nz /= length;
    return [nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz];
}
