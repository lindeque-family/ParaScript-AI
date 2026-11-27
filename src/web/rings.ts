import earcut, { deviation } from "./earcut.js";
import type { Mesh } from "./model.js";

// A cylinder meeting a flat face is fenced in by coarser polygons: 24 sides, then 12, then 6.
// Those rings are only edges of the face mesh. They are not boolean cutters, so the rest of
// the plate stays a rectangle with a small hole instead of a fan across the whole surface.
// Anything that is not an axis-aligned box joined with or cut by vertical cylinders keeps
// the general boolean.

const EPS = 1e-5;

interface Pt {
    x: number;
    y: number;
}

interface Box {
    x0: number;
    y0: number;
    z0: number;
    x1: number;
    y1: number;
    z1: number;
}

interface Cyl {
    cx: number;
    cy: number;
    radius: number;
    segments: number;
    zLo: number;
    zHi: number;
    outer: number;
}

interface Level {
    sides: number;
    radius: number;
}

type Relation = "through" | "fromTop";

interface Tri {
    ax: number;
    ay: number;
    az: number;
    bx: number;
    by: number;
    bz: number;
    cx: number;
    cy: number;
    cz: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function unwrap(value: unknown): unknown {
    let current = value;
    while (isRecord(current) && current.tag === "Part" && "geometry" in current) current = current.geometry;
    return current;
}

function isAdd(value: unknown): value is { left: unknown; right: unknown } {
    return isRecord(value) && value.op === "add" && "left" in value && "right" in value;
}

function isSub(value: unknown): value is { left: unknown; right: unknown } {
    return isRecord(value) && value.op === "subtract" && "left" in value && "right" in value;
}

function gatherAdd(value: unknown): unknown[] | undefined {
    const current = unwrap(value);
    if (!isAdd(current)) return [current];
    const left = gatherAdd(current.left);
    const right = gatherAdd(current.right);
    if (left === undefined || right === undefined) return undefined;
    return [...left, ...right];
}

function gatherSub(value: unknown): { base: unknown; tools: unknown[] } | undefined {
    const tools: unknown[] = [];
    let current = unwrap(value);
    if (!isSub(current)) return undefined;
    while (isSub(current)) {
        tools.push(unwrap(current.right));
        current = unwrap(current.left);
    }
    return { base: current, tools };
}

function num(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function near(a: number, b: number): boolean {
    return Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b));
}

function mapOf(value: Record<string, unknown>): ((point: { x: number; y: number; z: number }) => { x: number; y: number; z: number }) | undefined {
    const mapPoint = value.mapPoint;
    if (mapPoint === undefined) return (point) => point;
    if (typeof mapPoint !== "function") return undefined;
    return (point) => {
        const mapped = mapPoint(point) as { x: number; y: number; z: number };
        return { x: mapped.x, y: mapped.y, z: mapped.z };
    };
}

function fitPrimitiveBox(value: Record<string, unknown>): Box | undefined {
    if (value.tag !== "Primitive" || value.kind !== "box") return undefined;
    const width = num(value.width);
    const depth = num(value.depth);
    const height = num(value.height);
    const map = mapOf(value);
    if (width === undefined || depth === undefined || height === undefined || map === undefined) return undefined;
    const corners = [
        [0, 0, 0], [width, 0, 0], [width, depth, 0], [0, depth, 0],
        [0, 0, height], [width, 0, height], [width, depth, height], [0, depth, height]
    ].map(([x, y, z]) => map({ x: x ?? 0, y: y ?? 0, z: z ?? 0 }));
    return aabbBox(corners);
}

function pointOnFace(face: Record<string, unknown>, uFrac: number, vFrac: number): { x: number; y: number; z: number } | undefined {
    if (typeof face.maxU !== "number" || typeof face.formula !== "function") return undefined;
    const u = uFrac * face.maxU;
    const minV = typeof face.minV === "function" ? face.minV(u) : face.minV;
    const maxV = typeof face.maxV === "function" ? face.maxV(u) : face.maxV;
    if (typeof minV !== "number" || typeof maxV !== "number") return undefined;
    const point = face.formula(u)(minV + vFrac * (maxV - minV)) as { x: number; y: number; z: number };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return undefined;
    return point;
}

function fitSurfaceBox(value: Record<string, unknown>): Box | undefined {
    if (value.tag !== "Solid3D" || !Array.isArray(value.faces) || value.faces.length < 6) return undefined;
    const corners: { x: number; y: number; z: number }[] = [];
    for (const face of value.faces) {
        if (!isRecord(face)) return undefined;
        for (const u of [0, 1]) {
            for (const v of [0, 1]) {
                const point = pointOnFace(face, u, v);
                if (point === undefined) return undefined;
                corners.push(point);
            }
        }
    }
    return aabbBox(corners);
}

function aabbBox(corners: readonly { x: number; y: number; z: number }[]): Box | undefined {
    if (corners.length < 8) return undefined;
    let x0 = Infinity;
    let y0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let z1 = -Infinity;
    for (const corner of corners) {
        x0 = Math.min(x0, corner.x);
        y0 = Math.min(y0, corner.y);
        z0 = Math.min(z0, corner.z);
        x1 = Math.max(x1, corner.x);
        y1 = Math.max(y1, corner.y);
        z1 = Math.max(z1, corner.z);
    }
    if (!(x1 - x0 > EPS && y1 - y0 > EPS && z1 - z0 > EPS)) return undefined;
    for (const corner of corners) {
        const onX = near(corner.x, x0) || near(corner.x, x1);
        const onY = near(corner.y, y0) || near(corner.y, y1);
        const onZ = near(corner.z, z0) || near(corner.z, z1);
        if (!onX || !onY || !onZ) return undefined;
    }
    return { x0, y0, z0, x1, y1, z1 };
}

function ringLevels(radius: number, segments: number): Level[] {
    const levels: Level[] = [{ sides: segments, radius }];
    let sides = segments;
    let current = radius;
    while (sides > 6) {
        const next = Math.floor(sides / 2);
        if (next < 4) break;
        const outer = current / Math.cos(Math.PI / next) * 1.0001;
        levels.push({ sides: next, radius: outer });
        current = outer;
        sides = next;
        if (next <= 6) break;
    }
    return levels;
}

function fitPrimitiveCylinder(value: Record<string, unknown>): Cyl | undefined {
    if (value.tag !== "Primitive" || value.kind !== "cylinder") return undefined;
    const radius = num(value.radius);
    const height = num(value.height);
    const segments = Math.max(3, Math.floor(num(value.segments) ?? 24));
    const map = mapOf(value);
    if (radius === undefined || height === undefined || map === undefined) return undefined;
    const bottom = map({ x: 0, y: 0, z: 0 });
    const top = map({ x: 0, y: 0, z: height });
    const rim = map({ x: radius, y: 0, z: 0 });
    const rimAcross = map({ x: 0, y: radius, z: 0 });
    return verticalCylinder(bottom, top, rim, rimAcross, radius, segments);
}

function fitSurfaceCylinder(value: Record<string, unknown>, segments: number): Cyl | undefined {
    if (value.tag !== "Solid3D" || !Array.isArray(value.faces)) return undefined;
    for (const face of value.faces) {
        if (!isRecord(face)) continue;
        const fitted = fitWall(face, segments);
        if (fitted !== undefined) return fitted;
    }
    return undefined;
}

function fitWall(face: Record<string, unknown>, segments: number): Cyl | undefined {
    const bottom: { x: number; y: number; z: number }[] = [];
    const top: { x: number; y: number; z: number }[] = [];
    for (const u of [0, 0.25, 0.5, 0.75]) {
        const low = pointOnFace(face, u, 0);
        const high = pointOnFace(face, u, 1);
        if (low === undefined || high === undefined) return undefined;
        bottom.push(low);
        top.push(high);
    }
    const low = bottom[0];
    const high = top[0];
    if (low === undefined || high === undefined) return undefined;
    if (!bottom.every((point) => near(point.z, low.z)) || !top.every((point) => near(point.z, high.z))) return undefined;
    if (near(low.z, high.z)) return undefined;
    const center = {
        x: bottom.reduce((sum, point) => sum + point.x, 0) / bottom.length,
        y: bottom.reduce((sum, point) => sum + point.y, 0) / bottom.length
    };
    const topCenter = {
        x: top.reduce((sum, point) => sum + point.x, 0) / top.length,
        y: top.reduce((sum, point) => sum + point.y, 0) / top.length
    };
    if (!near(center.x, topCenter.x) || !near(center.y, topCenter.y)) return undefined;
    const radius = Math.hypot((bottom[0]?.x ?? 0) - center.x, (bottom[0]?.y ?? 0) - center.y);
    if (!(radius > EPS)) return undefined;
    if (!bottom.every((point) => near(Math.hypot(point.x - center.x, point.y - center.y), radius))) return undefined;
    if (!top.every((point) => near(Math.hypot(point.x - center.x, point.y - center.y), radius))) return undefined;
    const zLo = Math.min(low.z, high.z);
    const zHi = Math.max(low.z, high.z);
    const outer = ringLevels(radius, segments).at(-1)?.radius ?? radius;
    return { cx: center.x, cy: center.y, radius, segments, zLo, zHi, outer };
}

function verticalCylinder(
    bottom: { x: number; y: number; z: number },
    top: { x: number; y: number; z: number },
    rim: { x: number; y: number; z: number },
    rimAcross: { x: number; y: number; z: number },
    radius: number,
    segments: number
): Cyl | undefined {
    if (Math.hypot(top.x - bottom.x, top.y - bottom.y) > 1e-4 * Math.max(1, Math.abs(top.z - bottom.z))) return undefined;
    if (!near(rim.z, bottom.z) || !near(rimAcross.z, bottom.z)) return undefined;
    const fitted = Math.hypot(rim.x - bottom.x, rim.y - bottom.y);
    const across = Math.hypot(rimAcross.x - bottom.x, rimAcross.y - bottom.y);
    if (!near(fitted, radius) || !near(across, radius)) return undefined;
    const zLo = Math.min(bottom.z, top.z);
    const zHi = Math.max(bottom.z, top.z);
    if (!(zHi - zLo > EPS)) return undefined;
    const outer = ringLevels(radius, segments).at(-1)?.radius ?? radius;
    return { cx: bottom.x, cy: bottom.y, radius, segments, zLo, zHi, outer };
}

function shapeOf(value: unknown, steps: number): { box: Box } | { cyl: Cyl } | undefined {
    const current = unwrap(value);
    if (!isRecord(current)) return undefined;
    const box = fitPrimitiveBox(current) ?? fitSurfaceBox(current);
    if (box !== undefined && current.tag === "Primitive" && current.kind === "box") return { box };
    if (box !== undefined && current.tag === "Solid3D") return { box };
    const segments = Math.max(8, steps);
    const cyl = fitPrimitiveCylinder(current) ?? fitSurfaceCylinder(current, segments % 2 === 0 ? segments : segments + 1);
    if (cyl !== undefined) return { cyl };
    return undefined;
}

function relationOf(box: Box, cyl: Cyl): Relation | "reject" {
    const insideX = cyl.cx - cyl.outer >= box.x0 + EPS && cyl.cx + cyl.outer <= box.x1 - EPS;
    const insideY = cyl.cy - cyl.outer >= box.y0 + EPS && cyl.cy + cyl.outer <= box.y1 - EPS;
    if (!insideX || !insideY) return "reject";
    const coversBottom = cyl.zLo <= box.z0 + 1e-4;
    const coversTop = cyl.zHi >= box.z1 - 1e-4;
    const entersTop = cyl.zLo < box.z1 - 1e-4 && cyl.zHi > box.z1 + 1e-4 && cyl.zLo > box.z0 + 1e-4;
    if (coversBottom && coversTop) return "through";
    if (entersTop) return "fromTop";
    return "reject";
}

function ngon(cx: number, cy: number, radius: number, sides: number): Pt[] {
    const ring: Pt[] = [];
    for (let index = 0; index < sides; index++) {
        const angle = (index / sides) * Math.PI * 2;
        ring.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return ring;
}

function area(ring: readonly Pt[]): number {
    let sum = 0;
    for (let index = 0; index < ring.length; index++) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        if (current === undefined || next === undefined) continue;
        sum += current.x * next.y - next.x * current.y;
    }
    return sum * 0.5;
}

function ensureCcw(ring: readonly Pt[]): Pt[] {
    const copy = ring.slice();
    return area(copy) < 0 ? copy.reverse() : copy;
}

function clean(ring: readonly Pt[]): Pt[] {
    const spaced: Pt[] = [];
    for (const point of ring) {
        const previous = spaced[spaced.length - 1];
        if (previous !== undefined && Math.hypot(point.x - previous.x, point.y - previous.y) <= 1e-6) continue;
        spaced.push(point);
    }
    if (spaced.length > 1) {
        const first = spaced[0];
        const last = spaced[spaced.length - 1];
        if (first !== undefined && last !== undefined && Math.hypot(first.x - last.x, first.y - last.y) <= 1e-6) spaced.pop();
    }
    const simplified: Pt[] = [];
    for (let index = 0; index < spaced.length; index++) {
        const previous = spaced[(index + spaced.length - 1) % spaced.length];
        const current = spaced[index];
        const next = spaced[(index + 1) % spaced.length];
        if (previous === undefined || current === undefined || next === undefined) continue;
        const cross = (current.x - previous.x) * (next.y - previous.y) - (current.y - previous.y) * (next.x - previous.x);
        const scale = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
        if (Math.abs(cross) / scale <= 1e-8) continue;
        simplified.push(current);
    }
    return simplified.length >= 3 ? simplified : spaced;
}

function onBoundary(poly: readonly Pt[], point: Pt): boolean {
    for (let index = 0; index < poly.length; index++) {
        const start = poly[index];
        const end = poly[(index + 1) % poly.length];
        if (start === undefined || end === undefined) continue;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length2 = dx * dx + dy * dy;
        if (length2 <= 1e-16) continue;
        let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2;
        t = Math.min(1, Math.max(0, t));
        const distance = Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
        if (distance <= 1e-5) return true;
    }
    return false;
}

function contains(poly: readonly Pt[], point: Pt): boolean {
    if (onBoundary(poly, point)) return true;
    return strictlyInside(poly, point);
}

function strictlyInside(poly: readonly Pt[], point: Pt): boolean {
    if (onBoundary(poly, point)) return false;
    let inside = false;
    for (let index = 0, previous = poly.length - 1; index < poly.length; previous = index++) {
        const start = poly[previous];
        const end = poly[index];
        if (start === undefined || end === undefined) continue;
        if ((start.y > point.y) !== (end.y > point.y)) {
            const x = start.x + (end.x - start.x) * (point.y - start.y) / (end.y - start.y);
            if (x > point.x) inside = !inside;
        }
    }
    return inside;
}

function snap(point: Pt): Pt {
    return { x: Math.round(point.x / 1e-6) * 1e-6, y: Math.round(point.y / 1e-6) * 1e-6 };
}

// A vertex average of a concave outline can fall in a gap. Step just inside one edge instead.
function interiorPoint(ring: readonly Pt[]): Pt | undefined {
    const ccw = ensureCcw(ring);
    for (let index = 0; index < ccw.length; index++) {
        const start = ccw[index];
        const end = ccw[(index + 1) % ccw.length];
        if (start === undefined || end === undefined) continue;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length <= 1e-8) continue;
        const point = { x: (start.x + end.x) / 2 - dy / length * 1e-3, y: (start.y + end.y) / 2 + dx / length * 1e-3 };
        if (strictlyInside(ccw, point)) return point;
    }
    return undefined;
}

function at(start: Pt, end: Pt, t: number): Pt {
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

function projectT(start: Pt, end: Pt, point: Pt): number | undefined {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length2 = dx * dx + dy * dy;
    if (length2 <= 1e-16) return undefined;
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2;
    const closest = at(start, end, Math.min(1, Math.max(0, t)));
    if (Math.hypot(point.x - closest.x, point.y - closest.y) > 1e-5) return undefined;
    return t;
}

function crossT(start: Pt, end: Pt, otherStart: Pt, otherEnd: Pt): number | undefined {
    const rx = end.x - start.x;
    const ry = end.y - start.y;
    const sx = otherEnd.x - otherStart.x;
    const sy = otherEnd.y - otherStart.y;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) <= 1e-12) return undefined;
    const qx = otherStart.x - start.x;
    const qy = otherStart.y - start.y;
    const t = (qx * sy - qy * sx) / denom;
    const u = (qx * ry - qy * rx) / denom;
    if (t <= 1e-8 || t >= 1 - 1e-8 || u <= 1e-8 || u >= 1 - 1e-8) return undefined;
    return t;
}

interface Half {
    a: Pt;
    b: Pt;
}

function unionLoops(polys: readonly (readonly Pt[])[]): Pt[][] | undefined {
    const shapes = polys.map((poly) => ensureCcw(clean(poly))).filter((poly) => poly.length >= 3);
    if (shapes.length === 0) return undefined;
    const edges: [Pt, Pt][] = [];
    for (const poly of shapes) {
        for (let index = 0; index < poly.length; index++) {
            const start = poly[index];
            const end = poly[(index + 1) % poly.length];
            if (start === undefined || end === undefined) continue;
            edges.push([start, end]);
        }
    }
    const halves: Half[] = [];
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
        const edge = edges[edgeIndex];
        if (edge === undefined) continue;
        const [start, end] = edge;
        const ts = [0, 1];
        for (let otherIndex = 0; otherIndex < edges.length; otherIndex++) {
            if (otherIndex === edgeIndex) continue;
            const other = edges[otherIndex];
            if (other === undefined) continue;
            const crossing = crossT(start, end, other[0], other[1]);
            if (crossing !== undefined) ts.push(crossing);
            const startT = projectT(start, end, other[0]);
            const endT = projectT(start, end, other[1]);
            if (startT !== undefined && startT > 1e-8 && startT < 1 - 1e-8) ts.push(startT);
            if (endT !== undefined && endT > 1e-8 && endT < 1 - 1e-8) ts.push(endT);
        }
        ts.sort((left, right) => left - right);
        const unique: number[] = [];
        for (const t of ts) {
            const previous = unique[unique.length - 1];
            if (previous === undefined || t - previous > 1e-8) unique.push(t);
        }
        for (let index = 0; index + 1 < unique.length; index++) {
            const t0 = unique[index];
            const t1 = unique[index + 1];
            if (t0 === undefined || t1 === undefined) continue;
            const from = at(start, end, t0);
            const to = at(start, end, t1);
            if (Math.hypot(to.x - from.x, to.y - from.y) <= 1e-6) continue;
            const mid = at(start, end, (t0 + t1) / 2);
            let covered = false;
            for (const poly of shapes) {
                if (strictlyInside(poly, mid)) {
                    covered = true;
                    break;
                }
            }
            if (covered) continue;
            halves.push({ a: snap(from), b: snap(to) });
        }
    }
    // Identical beads share a boundary. Keep one copy of that edge; cancel a real internal seam.
    const loops = stitch(keepBoundary(halves));
    if (loops === undefined) return undefined;
    // A barely-overlapping pair of polygons can leave a hairline loop. It is not a bead.
    const minArea = Math.min(...shapes.map((shape) => Math.abs(area(shape))));
    const kept = loops.filter((loop) => Math.abs(area(loop)) > minArea * 0.05);
    return kept.length > 0 ? kept : undefined;
}

function keepBoundary(halves: readonly Half[]): Half[] {
    const counts = new Map<string, { a: Pt; b: Pt; n: number }>();
    for (const edge of halves) {
        if (Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) <= 1e-6) continue;
        const key = `${pointKey(edge.a)}>${pointKey(edge.b)}`;
        const found = counts.get(key);
        if (found === undefined) counts.set(key, { a: edge.a, b: edge.b, n: 1 });
        else found.n += 1;
    }
    const consumed = new Set<string>();
    const kept: Half[] = [];
    for (const [key, edge] of counts) {
        if (consumed.has(key)) continue;
        const rev = `${pointKey(edge.b)}>${pointKey(edge.a)}`;
        const back = counts.get(rev);
        const remain = edge.n - (back?.n ?? 0);
        consumed.add(key);
        if (remain >= 0) consumed.add(rev);
        if (remain > 0) kept.push({ a: edge.a, b: edge.b });
    }
    return kept;
}

function pointKey(point: Pt): string {
    return `${Math.round(point.x / 1e-6)},${Math.round(point.y / 1e-6)}`;
}

function stitch(edges: readonly Half[]): Pt[][] | undefined {
    const outgoing = new Map<string, { point: Pt; to: Pt; used: boolean }[]>();
    const add = (from: Pt, to: Pt): void => {
        const key = pointKey(from);
        const list = outgoing.get(key);
        const step = { point: from, to, used: false };
        if (list === undefined) outgoing.set(key, [step]);
        else list.push(step);
    };
    for (const edge of edges) add(edge.a, edge.b);
    const loops: Pt[][] = [];
    for (const list of outgoing.values()) {
        for (const start of list) {
            if (start.used) continue;
            start.used = true;
            const loop = [start.point];
            let previous = start.point;
            let current = start.to;
            let guard = edges.length + 2;
            while (pointKey(current) !== pointKey(start.point)) {
                if (guard-- < 0) return undefined;
                loop.push(current);
                const choices = outgoing.get(pointKey(current));
                if (choices === undefined) return undefined;
                let best: { point: Pt; to: Pt; used: boolean } | undefined;
                let bestTurn = Infinity;
                const incomingX = current.x - previous.x;
                const incomingY = current.y - previous.y;
                for (const choice of choices) {
                    if (choice.used) continue;
                    const outX = choice.to.x - current.x;
                    const outY = choice.to.y - current.y;
                    let turn = Math.atan2(incomingX * outY - incomingY * outX, incomingX * outX + incomingY * outY);
                    if (turn <= 1e-12) turn += Math.PI * 2;
                    if (turn < bestTurn) {
                        bestTurn = turn;
                        best = choice;
                    }
                }
                if (best === undefined) return undefined;
                best.used = true;
                previous = current;
                current = best.to;
            }
            const cleaned = clean(loop);
            if (cleaned.length >= 3 && Math.abs(area(cleaned)) > 1e-8) loops.push(ensureCcw(cleaned));
        }
    }
    return loops;
}

function triangulate(outer: readonly Pt[], holes: readonly (readonly Pt[])[], z: number, positive: boolean): Tri[] | undefined {
    const outline = clean(ensureCcw(outer));
    if (outline.length < 3) return undefined;
    const data: number[] = [];
    const holeStarts: number[] = [];
    const push = (ring: readonly Pt[]): void => {
        for (const point of ring) data.push(point.x, point.y);
    };
    push(outline);
    for (const hole of holes) {
        const cleaned = clean(ensureCcw(hole));
        if (cleaned.length < 3) return undefined;
        const probe = interiorPoint(cleaned);
        if (probe === undefined || !contains(outline, probe)) return undefined;
        holeStarts.push(data.length / 2);
        push([...cleaned].reverse());
    }
    if (Math.abs(area(outline)) <= 1e-8) return undefined;
    const holesArg = holeStarts.length > 0 ? holeStarts : null;
    const indices = earcut(data, holesArg, 2);
    const error = indices.length < 3 ? 1 : deviation(data, holesArg, 2, indices);
    if (indices.length < 3 || !Number.isFinite(error) || error > 1e-3) return undefined;
    let signed = 0;
    const tris: Tri[] = [];
    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index] ?? 0;
        const ib = indices[index + 1] ?? 0;
        const ic = indices[index + 2] ?? 0;
        const ax = data[ia * 2] ?? 0;
        const ay = data[ia * 2 + 1] ?? 0;
        const bx = data[ib * 2] ?? 0;
        const by = data[ib * 2 + 1] ?? 0;
        const cx = data[ic * 2] ?? 0;
        const cy = data[ic * 2 + 1] ?? 0;
        signed += (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        tris.push({ ax, ay, az: z, bx, by, bz: z, cx, cy, cz: z });
    }
    if ((signed > 0) !== positive) {
        for (const tri of tris) {
            const bx = tri.bx;
            const by = tri.by;
            tri.bx = tri.cx;
            tri.by = tri.cy;
            tri.cx = bx;
            tri.cy = by;
        }
    }
    return tris;
}

function wall(loop: readonly Pt[], z0: number, z1: number, outwardRight: boolean): Tri[] {
    const tris: Tri[] = [];
    const ring = ensureCcw(loop);
    for (let index = 0; index < ring.length; index++) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        if (start === undefined || end === undefined) continue;
        const quad: Tri[] = outwardRight
            ? [
                { ax: start.x, ay: start.y, az: z0, bx: end.x, by: end.y, bz: z0, cx: end.x, cy: end.y, cz: z1 },
                { ax: start.x, ay: start.y, az: z0, bx: end.x, by: end.y, bz: z1, cx: start.x, cy: start.y, cz: z1 }
            ]
            : [
                { ax: start.x, ay: start.y, az: z0, bx: end.x, by: end.y, bz: z1, cx: end.x, cy: end.y, cz: z0 },
                { ax: start.x, ay: start.y, az: z0, bx: start.x, by: start.y, bz: z1, cx: end.x, cy: end.y, cz: z1 }
            ];
        tris.push(...quad);
    }
    return tris;
}

function sideQuads(box: Box, tris: Tri[]): void {
    const { x0, y0, z0, x1, y1, z1 } = box;
    const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number): void => {
        tris.push({ ax, ay, az, bx, by, bz, cx, cy, cz });
        tris.push({ ax: bx, ay: by, az: bz, bx: dx, by: dy, bz: dz, cx, cy, cz });
    };
    push(x0, y0, z0, x1, y0, z0, x0, y0, z1, x1, y0, z1);
    push(x1, y1, z0, x0, y1, z0, x1, y1, z1, x0, y1, z1);
    push(x0, y1, z0, x0, y0, z0, x0, y1, z1, x0, y0, z1);
    push(x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1);
}

function loopsInside(outers: readonly (readonly Pt[])[], inners: readonly (readonly Pt[])[]): Map<number, Pt[][]> | undefined {
    const owned = new Map<number, Pt[][]>();
    for (const inner of inners) {
        const probe = interiorPoint(inner);
        if (probe === undefined) return undefined;
        let home = -1;
        let homeArea = Infinity;
        for (let index = 0; index < outers.length; index++) {
            const outer = outers[index];
            if (outer === undefined || !contains(outer, probe)) continue;
            const size = Math.abs(area(outer));
            if (size < homeArea) {
                homeArea = size;
                home = index;
            }
        }
        if (home < 0) return undefined;
        const list = owned.get(home);
        if (list === undefined) owned.set(home, [inner.slice()]);
        else list.push(inner.slice());
    }
    return owned;
}

function band(outers: readonly (readonly Pt[])[], inners: readonly (readonly Pt[])[], z: number, positive: boolean): Tri[] | undefined {
    const nested = loopsInside(outers, inners);
    if (nested === undefined) return undefined;
    const tris: Tri[] = [];
    for (let index = 0; index < outers.length; index++) {
        const outer = outers[index];
        if (outer === undefined) continue;
        const piece = triangulate(outer, nested.get(index) ?? [], z, positive);
        if (piece === undefined) return undefined;
        tris.push(...piece);
    }
    return tris;
}

function heightsMatch(cyls: readonly Cyl[]): boolean {
    for (let i = 0; i < cyls.length; i++) {
        for (let j = i + 1; j < cyls.length; j++) {
            const left = cyls[i];
            const right = cyls[j];
            if (left === undefined || right === undefined) continue;
            const overlap = Math.hypot(left.cx - right.cx, left.cy - right.cy) < left.outer + right.outer;
            if (!overlap) continue;
            if (Math.abs(left.zLo - right.zLo) > 1e-4 || Math.abs(left.zHi - right.zHi) > 1e-4) return false;
        }
    }
    return true;
}

function levelLoops(cyls: readonly Cyl[], level: number): Pt[][] | undefined {
    const polys: Pt[][] = [];
    for (const cyl of cyls) {
        const chosen = ringLevels(cyl.radius, cyl.segments)[level];
        if (chosen === undefined) return undefined;
        polys.push(ngon(cyl.cx, cyl.cy, chosen.radius, chosen.sides));
    }
    return unionLoops(polys);
}

function build(box: Box, cyls: readonly Cyl[], op: "add" | "subtract"): Mesh | undefined {
    if (cyls.length === 0 || !heightsMatch(cyls)) return undefined;
    const relations = cyls.map((cyl) => relationOf(box, cyl));
    if (relations.some((kind) => kind === "reject")) return undefined;
    const mode = relations[0];
    if (mode === undefined || relations.some((kind) => kind !== mode)) return undefined;
    if (op === "subtract" && mode !== "through") return undefined;
    if (op === "add" && mode !== "fromTop" && mode !== "through") return undefined;
    const depth = cyls.reduce((smallest, cyl) => Math.min(smallest, ringLevels(cyl.radius, cyl.segments).length), Infinity);
    if (!Number.isFinite(depth) || depth < 1) return undefined;
    const levels: Pt[][][] = [];
    for (let index = 0; index < depth; index++) {
        const loops = levelLoops(cyls, index);
        if (loops === undefined || loops.length === 0) return undefined;
        levels.push(loops);
    }
    const finest = levels[0];
    const coarsest = levels[levels.length - 1];
    if (finest === undefined || coarsest === undefined) return undefined;
    const tris: Tri[] = [];
    const top = triangulate(
        [
            { x: box.x0, y: box.y0 },
            { x: box.x1, y: box.y0 },
            { x: box.x1, y: box.y1 },
            { x: box.x0, y: box.y1 }
        ],
        coarsest,
        box.z1,
        true
    );
    if (top === undefined) return undefined;
    tris.push(...top);
    for (let index = levels.length - 1; index > 0; index--) {
        const outer = levels[index];
        const inner = levels[index - 1];
        if (outer === undefined || inner === undefined) return undefined;
        const piece = band(outer, inner, box.z1, true);
        if (piece === undefined) return undefined;
        tris.push(...piece);
    }
    const holeBottom = mode === "through";
    if (holeBottom) {
        const bottom = triangulate(
            [
                { x: box.x0, y: box.y0 },
                { x: box.x0, y: box.y1 },
                { x: box.x1, y: box.y1 },
                { x: box.x1, y: box.y0 }
            ],
            coarsest,
            box.z0,
            false
        );
        if (bottom === undefined) return undefined;
        tris.push(...bottom);
        for (let index = levels.length - 1; index > 0; index--) {
            const outer = levels[index];
            const inner = levels[index - 1];
            if (outer === undefined || inner === undefined) return undefined;
            const piece = band(outer, inner, box.z0, false);
            if (piece === undefined) return undefined;
            tris.push(...piece);
        }
        for (const loop of finest) tris.push(...wall(loop, box.z0, box.z1, false));
    } else {
        tris.push(
            { ax: box.x0, ay: box.y0, az: box.z0, bx: box.x0, by: box.y1, bz: box.z0, cx: box.x1, cy: box.y0, cz: box.z0 },
            { ax: box.x0, ay: box.y1, az: box.z0, bx: box.x1, by: box.y1, bz: box.z0, cx: box.x1, cy: box.y0, cz: box.z0 }
        );
    }
    sideQuads(box, tris);
    if (op === "add") {
        for (const loop of finest) {
            const members = cyls.filter((cyl) => contains(loop, { x: cyl.cx, y: cyl.cy }));
            const owner = members[0];
            if (owner === undefined) return undefined;
            if (members.some((cyl) => Math.abs(cyl.zHi - owner.zHi) > 1e-4 || Math.abs(cyl.zLo - owner.zLo) > 1e-4)) return undefined;
            tris.push(...wall(loop, box.z1, owner.zHi, true));
            const cap = triangulate(loop, [], owner.zHi, true);
            if (cap === undefined) return undefined;
            tris.push(...cap);
            if (mode === "through" && owner.zLo < box.z0 - 1e-4) {
                tris.push(...wall(loop, owner.zLo, box.z0, true));
                const low = triangulate(loop, [], owner.zLo, false);
                if (low === undefined) return undefined;
                tris.push(...low);
            }
        }
    }
    const positions: number[] = [];
    const indices: number[] = [];
    for (const tri of tris) {
        const base = positions.length / 3;
        positions.push(tri.ax, tri.ay, tri.az, tri.bx, tri.by, tri.bz, tri.cx, tri.cy, tri.cz);
        indices.push(base, base + 1, base + 2);
    }
    return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

export function plateRingMesh(value: unknown, steps = 12): Mesh | undefined {
    const added = gatherAdd(value);
    if (added !== undefined && added.length >= 2) {
        const shapes = added.map((part) => shapeOf(part, steps));
        if (shapes.every((shape) => shape !== undefined)) {
            const boxes = shapes.flatMap((shape) => shape !== undefined && "box" in shape ? [shape.box] : []);
            const cyls = shapes.flatMap((shape) => shape !== undefined && "cyl" in shape ? [shape.cyl] : []);
            if (boxes.length === 1 && cyls.length === added.length - 1) {
                const box = boxes[0];
                if (box !== undefined) return build(box, cyls, "add");
            }
        }
    }
    const cut = gatherSub(value);
    if (cut === undefined) return undefined;
    const boxShape = shapeOf(cut.base, steps);
    const cyls = cut.tools.map((tool) => shapeOf(tool, steps));
    if (boxShape === undefined || !("box" in boxShape) || cyls.some((cyl) => cyl === undefined || !("cyl" in cyl))) return undefined;
    const fitted = cyls.flatMap((cyl) => cyl !== undefined && "cyl" in cyl ? [cyl.cyl] : []);
    if (fitted.length !== cut.tools.length) return undefined;
    return build(boxShape.box, fitted, "subtract");
}
