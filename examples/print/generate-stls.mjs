import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import earcut from "earcut";

const outDir = new URL(".", import.meta.url).pathname;

function addQuad(tris, a, b, c, d, hint) {
    const n = normal(a, b, c);
    const dot = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2];
    if (dot >= 0) {
        tris.push([a, b, c], [a, c, d]);
    } else {
        tris.push([a, d, c], [a, c, b]);
    }
}

function normal(a, b, c) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
}

function addBox(tris, x0, y0, z0, x1, y1, z1) {
    addQuad(tris, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
    addQuad(tris, [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1]);
    addQuad(tris, [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, -1, 0]);
    addQuad(tris, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
    addQuad(tris, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]);
    addQuad(tris, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
}

function addCylinder(tris, cx, cy, z0, z1, radius, segments, outward) {
    const sign = outward ? 1 : -1;
    for (let i = 0; i < segments; i++) {
        const t0 = (2 * Math.PI * i) / segments;
        const t1 = (2 * Math.PI * (i + 1)) / segments;
        const p0 = [cx + radius * Math.cos(t0), cy + radius * Math.sin(t0)];
        const p1 = [cx + radius * Math.cos(t1), cy + radius * Math.sin(t1)];
        const hint = [(p0[0] - cx) * sign, (p0[1] - cy) * sign, 0];
        addQuad(
            tris,
            [p0[0], p0[1], z0],
            [p1[0], p1[1], z0],
            [p1[0], p1[1], z1],
            [p0[0], p0[1], z1],
            hint
        );
    }
}

function addDisk(tris, cx, cy, z, radius, segments, up) {
    const hint = [0, 0, up ? 1 : -1];
    for (let i = 0; i < segments; i++) {
        const t0 = (2 * Math.PI * i) / segments;
        const t1 = (2 * Math.PI * (i + 1)) / segments;
        const a = [cx, cy, z];
        const b = [cx + radius * Math.cos(t0), cy + radius * Math.sin(t0), z];
        const c = [cx + radius * Math.cos(t1), cy + radius * Math.sin(t1), z];
        const n = normal(a, b, c);
        const dot = n[2] * hint[2];
        tris.push(dot >= 0 ? [a, b, c] : [a, c, b]);
    }
}

function addAnnulus(tris, cx, cy, z, inner, outer, segments, up) {
    const hint = [0, 0, up ? 1 : -1];
    for (let i = 0; i < segments; i++) {
        const t0 = (2 * Math.PI * i) / segments;
        const t1 = (2 * Math.PI * (i + 1)) / segments;
        const c0 = Math.cos(t0);
        const s0 = Math.sin(t0);
        const c1 = Math.cos(t1);
        const s1 = Math.sin(t1);
        addQuad(
            tris,
            [cx + inner * c0, cy + inner * s0, z],
            [cx + outer * c0, cy + outer * s0, z],
            [cx + outer * c1, cy + outer * s1, z],
            [cx + inner * c1, cy + inner * s1, z],
            hint
        );
    }
}

function addHalfTube(tris, cx, y0, y1, zc, rIn, rOut, segments) {
    const outer = [];
    const inner = [];
    for (let i = 0; i <= segments; i++) {
        const t = (Math.PI * i) / segments;
        outer.push([cx + rOut * Math.cos(t), zc + rOut * Math.sin(t)]);
        inner.push([cx + rIn * Math.cos(t), zc + rIn * Math.sin(t)]);
    }
    for (let i = 0; i < segments; i++) {
        const radial = [outer[i][0] - cx, 0, outer[i][1] - zc];
        addQuad(
            tris,
            [outer[i][0], y0, outer[i][1]],
            [outer[i + 1][0], y0, outer[i + 1][1]],
            [outer[i + 1][0], y1, outer[i + 1][1]],
            [outer[i][0], y1, outer[i][1]],
            radial
        );
        addQuad(
            tris,
            [inner[i][0], y0, inner[i][1]],
            [inner[i][0], y1, inner[i][1]],
            [inner[i + 1][0], y1, inner[i + 1][1]],
            [inner[i + 1][0], y0, inner[i + 1][1]],
            [cx - inner[i][0], 0, zc - inner[i][1]]
        );
    }
    for (const y of [y0, y1]) {
        for (let i = 0; i < segments; i++) {
            addQuad(
                tris,
                [outer[i][0], y, outer[i][1]],
                [inner[i][0], y, inner[i][1]],
                [inner[i + 1][0], y, inner[i + 1][1]],
                [outer[i + 1][0], y, outer[i + 1][1]],
                [0, y === y0 ? -1 : 1, 0]
            );
        }
    }
    for (const i of [0, segments]) {
        addQuad(
            tris,
            [outer[i][0], y0, outer[i][1]],
            [outer[i][0], y1, outer[i][1]],
            [inner[i][0], y1, inner[i][1]],
            [inner[i][0], y0, inner[i][1]],
            [0, 0, -1]
        );
    }
}

function circle(cx, cy, radius, segments, clockwise) {
    const points = [];
    for (let i = 0; i < segments; i++) {
        const t = (2 * Math.PI * i) / segments;
        const a = clockwise ? -t : t;
        points.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    return points;
}

function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
    const d1 = cross(a, b, c);
    const d2 = cross(a, b, d);
    const d3 = cross(c, d, a);
    const d4 = cross(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function visible(from, to, poly, toIndex) {
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        if (i === toIndex || j === toIndex) continue;
        if (segmentsIntersect(from, to, poly[i], poly[j])) return false;
    }
    return true;
}

function bridgeHole(outer, hole) {
    let hi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[hi].x) hi = i;
    const hp = hole[hi];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < outer.length; i++) {
        const p = outer[i];
        if (p.x < hp.x - 1e-8) continue;
        if (!visible(hp, p, outer, i)) continue;
        const d = (p.x - hp.x) ** 2 + (p.y - hp.y) ** 2;
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    if (best < 0) throw new Error("Could not bridge a lid hole.");
    const merged = outer.slice(0, best + 1);
    for (let k = 0; k <= hole.length; k++) merged.push(hole[(hi + k) % hole.length]);
    merged.push(outer[best]);
    for (let i = best + 1; i < outer.length; i++) merged.push(outer[i]);
    return merged;
}

function earClip(poly) {
    const idx = poly.map((_, i) => i);
    const tris = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 20000) {
        let clipped = false;
        for (let i = 0; i < idx.length; i++) {
            const i0 = idx[(i + idx.length - 1) % idx.length];
            const i1 = idx[i];
            const i2 = idx[(i + 1) % idx.length];
            if (cross(poly[i0], poly[i1], poly[i2]) <= 1e-9) continue;
            let blocked = false;
            for (const j of idx) {
                if (j === i0 || j === i1 || j === i2) continue;
                const p = poly[j];
                const c1 = cross(poly[i0], poly[i1], p);
                const c2 = cross(poly[i1], poly[i2], p);
                const c3 = cross(poly[i2], poly[i0], p);
                if (c1 >= -1e-9 && c2 >= -1e-9 && c3 >= -1e-9) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;
            tris.push([i0, i1, i2]);
            idx.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) throw new Error("Lid triangulation stalled.");
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris.map((ids) => ids.map((id) => poly[id]));
}

function dedupe(points) {
    const out = [];
    for (const point of points) {
        const prev = out[out.length - 1];
        if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < 1e-7) continue;
        out.push(point);
    }
    if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-7) out.pop();
    return out;
}

function sectorWithHole(a0, a1, r0, r1, hole, holeSegs) {
    const arc = (radius, from, to, count) => {
        const points = [];
        for (let i = 0; i <= count; i++) {
            const t = from + ((to - from) * i) / count;
            points.push({ x: radius * Math.cos(t), y: radius * Math.sin(t) });
        }
        return points;
    };
    const inner = arc(r0, a0, a1, 3);
    const outer = arc(r1, a1, a0, 3);
    return bridgeHole(dedupe([...inner, ...outer.slice(1, -1)]), circle(hole.x, hole.y, hole.r, holeSegs, true));
}

function pushFace(tris, z, up, a, b, c) {
    const pa = [a.x, a.y, z];
    const pb = [b.x, b.y, z];
    const pc = [c.x, c.y, z];
    const n = normal(pa, pb, pc);
    tris.push(n[2] * (up ? 1 : -1) >= 0 ? [pa, pb, pc] : [pa, pc, pb]);
}

function stitchHole(tris, z, up, outer, hole, center) {
    const ang = (p) => {
        const a = Math.atan2(p.y - center.y, p.x - center.x);
        return a < 0 ? a + Math.PI * 2 : a;
    };
    const nearest = hole.map((point) => {
        const target = ang(point);
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < outer.length; i++) {
            let d = Math.abs(ang(outer[i]) - target);
            if (d > Math.PI) d = Math.PI * 2 - d;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    });
    for (let i = 0; i < hole.length; i++) {
        const j = (i + 1) % hole.length;
        const oi = nearest[i];
        const oj = nearest[j];
        pushFace(tris, z, up, hole[i], hole[j], outer[oi]);
        let k = oi;
        let steps = 0;
        while (k !== oj && steps++ < outer.length) {
            const next = (k + 1) % outer.length;
            pushFace(tris, z, up, hole[j], outer[k], outer[next]);
            k = next;
        }
    }
}

function addLidFace(tris, z, up, outerR, segments) {
    const holeR = 1;
    const orbit = 7;
    const bandIn = 5;
    const bandOut = 9;
    const per = segments / 6;
    addAnnulus(tris, 0, 0, z, holeR, bandIn, segments, up);
    addAnnulus(tris, 0, 0, z, bandOut, outerR, segments, up);
    for (let i = 0; i < 6; i++) {
        const a0 = (2 * Math.PI * i) / 6;
        const a1 = (2 * Math.PI * (i + 1)) / 6;
        const outer = [];
        for (let k = 0; k <= per; k++) {
            const t = a0 + ((a1 - a0) * k) / per;
            outer.push({ x: bandIn * Math.cos(t), y: bandIn * Math.sin(t) });
        }
        for (let k = 0; k <= per; k++) {
            const t = a1 - ((a1 - a0) * k) / per;
            outer.push({ x: bandOut * Math.cos(t), y: bandOut * Math.sin(t) });
        }
        const mid = (a0 + a1) / 2;
        const center = { x: orbit * Math.cos(mid), y: orbit * Math.sin(mid) };
        const hole = [];
        for (let k = 0; k < 14; k++) {
            const t = (2 * Math.PI * k) / 14;
            hole.push({ x: center.x + holeR * Math.cos(t), y: center.y + holeR * Math.sin(t) });
        }
        stitchHole(tris, z, up, outer, hole, center);
    }
}

function addHoleWalls(tris, z0, z1, holes, segments) {
    for (const hole of holes) {
        addCylinder(tris, hole.x, hole.y, z0, z1, hole.r, segments, false);
    }
}

function cableOrganizer() {
    const tris = [];
    addBox(tris, 0, 0, 0, 90, 46, 8);
    for (const cx of [18, 45, 72]) {
        addHalfTube(tris, cx, 7, 39, 7.6, 4.5, 7.2, 18);
    }
    return tris;
}

function shakerBody() {
    const tris = [];
    const seg = 48;
    addCylinder(tris, 0, 0, 0, 55, 16, seg, true);
    addCylinder(tris, 0, 0, 2, 55, 14, seg, false);
    addDisk(tris, 0, 0, 0, 16, seg, false);
    addDisk(tris, 0, 0, 2, 14, seg, true);
    addAnnulus(tris, 0, 0, 55, 14, 16, seg, true);
    return tris;
}

function addAnnulusAt(tris, cx, cy, z, inner, outer, segments, up) {
    const hint = [0, 0, up ? 1 : -1];
    for (let i = 0; i < segments; i++) {
        const t0 = (2 * Math.PI * i) / segments;
        const t1 = (2 * Math.PI * (i + 1)) / segments;
        const c0 = Math.cos(t0);
        const s0 = Math.sin(t0);
        const c1 = Math.cos(t1);
        const s1 = Math.sin(t1);
        addQuad(
            tris,
            [cx + inner * c0, cy + inner * s0, z],
            [cx + outer * c0, cy + outer * s0, z],
            [cx + outer * c1, cy + outer * s1, z],
            [cx + inner * c1, cy + inner * s1, z],
            hint
        );
    }
}

function addHoledDisk(tris, z, up, outerR, outerSeg, holes, holeSeg) {
    const coords = [];
    for (let i = 0; i < outerSeg; i++) {
        const t = (2 * Math.PI * i) / outerSeg;
        coords.push(outerR * Math.cos(t), outerR * Math.sin(t));
    }
    const holeIndices = [];
    for (const hole of holes) {
        holeIndices.push(coords.length / 2);
        for (let i = 0; i < holeSeg; i++) {
            const t = (2 * Math.PI * i) / holeSeg;
            coords.push(hole.x + hole.r * Math.cos(t), hole.y + hole.r * Math.sin(t));
        }
    }
    const indices = earcut(coords, holeIndices);
    for (let i = 0; i < indices.length; i += 3) {
        const at = (id) => [coords[id * 2], coords[id * 2 + 1], z];
        const a = at(indices[i]);
        const b = at(indices[i + 1]);
        const c = at(indices[i + 2]);
        const n = normal(a, b, c);
        tris.push(n[2] * (up ? 1 : -1) >= 0 ? [a, b, c] : [a, c, b]);
    }
}

function shakerCap() {
    const tris = [];
    const seg = 48;
    const holeSeg = 16;
    const holes = [{ x: 0, y: 0, r: 1.2 }];
    for (let i = 0; i < 6; i++) {
        const t = (2 * Math.PI * i) / 6;
        holes.push({ x: 7 * Math.cos(t), y: 7 * Math.sin(t), r: 1.2 });
    }
    addCylinder(tris, 0, 0, 0, 10.5, 18.6, seg, true);
    addCylinder(tris, 0, 0, 0, 8, 16.3, seg, false);
    addAnnulus(tris, 0, 0, 0, 16.3, 18.6, seg, false);
    addHoledDisk(tris, 8, false, 16.3, seg, holes, holeSeg);
    addHoledDisk(tris, 10.5, true, 18.6, seg, holes, holeSeg);
    for (const hole of holes) {
        addCylinder(tris, hole.x, hole.y, 8, 10.5, hole.r, holeSeg, false);
    }
    return tris;
}

function edgeKey(a, b) {
    const q = (v) => Math.round(v * 1000);
    const ka = `${q(a[0])},${q(a[1])},${q(a[2])}`;
    const kb = `${q(b[0])},${q(b[1])},${q(b[2])}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function assertClosed(name, tris) {
    const counts = new Map();
    for (const [a, b, c] of tris) {
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
            const key = edgeKey(p, q);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    let open = 0;
    for (const count of counts.values()) if (count !== 2) open++;
    if (open !== 0) throw new Error(`${name} is not watertight: ${open} bad edges, ${tris.length} triangles.`);
}

function writeStl(filePath, tris) {
    const buffer = Buffer.alloc(84 + tris.length * 50);
    buffer.write("ParaScript print", 0);
    buffer.writeUInt32LE(tris.length, 80);
    let offset = 84;
    for (const [a, b, c] of tris) {
        const n = normal(a, b, c);
        buffer.writeFloatLE(n[0], offset);
        buffer.writeFloatLE(n[1], offset + 4);
        buffer.writeFloatLE(n[2], offset + 8);
        let cursor = offset + 12;
        for (const p of [a, b, c]) {
            buffer.writeFloatLE(p[0], cursor);
            buffer.writeFloatLE(p[1], cursor + 4);
            buffer.writeFloatLE(p[2], cursor + 8);
            cursor += 12;
        }
        offset += 50;
    }
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, buffer);
}

const parts = [
    ["cable-organizer.stl", cableOrganizer()],
    ["salt-shaker-body.stl", shakerBody()],
    ["salt-shaker-cap.stl", shakerCap()]
];

for (const [name, tris] of parts) {
    assertClosed(name, tris);
    writeStl(new URL(name, import.meta.url).pathname, tris);
    console.log(`${name}: ${tris.length} triangles`);
}
