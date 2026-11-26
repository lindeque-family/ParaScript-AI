import type { Mesh } from "./model.js";

const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;

/** Binary STL. The header does not start with "solid", which some tools read as ASCII. */
export function meshToStl(mesh: Mesh): Buffer {
    const triangles: number[][] = [];
    for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
        const triangle = triangleOf(mesh, index);
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

function triangleOf(mesh: Mesh, index: number): number[] | null {
    const { positions, indices } = mesh;
    const corners = [indices[index] ?? 0, indices[index + 1] ?? 0, indices[index + 2] ?? 0];
    const values: number[] = [];
    for (const corner of corners) {
        values.push(
            positions[corner * 3] ?? Number.NaN,
            positions[corner * 3 + 1] ?? Number.NaN,
            positions[corner * 3 + 2] ?? Number.NaN
        );
    }
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
