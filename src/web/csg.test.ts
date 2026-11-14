import { test } from "node:test";
import assert from "node:assert/strict";
import type { Mesh } from "./model.js";
import { pointInsideMesh, subtractMeshes, unionMeshes } from "./csg.js";

function quad(a: number[], b: number[], c: number[], d: number[], positions: number[], indices: number[]): void {
    const base = positions.length / 3;
    for (const vertex of [a, b, c, d]) {
        positions.push(vertex[0] ?? 0, vertex[1] ?? 0, vertex[2] ?? 0);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], positions, indices);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], positions, indices);
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], positions, indices);
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], positions, indices);
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], positions, indices);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], positions, indices);
    return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

test("subtractMeshes cuts a through-hole out of a box", () => {
    const block = box(0, 0, 0, 2, 2, 1);
    const hole = box(0.5, 0.5, -0.5, 1.5, 1.5, 1.5);
    assert.equal(pointInsideMesh(block, { x: 0.2, y: 0.2, z: 0.5 }), true);
    const cut = subtractMeshes(block, hole);
    assert.equal(pointInsideMesh(cut, { x: 0.2, y: 0.2, z: 0.5 }), true);
    assert.equal(pointInsideMesh(cut, { x: 1, y: 1, z: 0.5 }), false);
    assert.equal(pointInsideMesh(cut, { x: 4, y: 4, z: 4 }), false);
});

test("unionMeshes keeps both disjoint solids", () => {
    const left = box(0, 0, 0, 1, 1, 1);
    const right = box(2, 0, 0, 3, 1, 1);
    const fused = unionMeshes(left, right);
    assert.equal(pointInsideMesh(fused, { x: 0.5, y: 0.5, z: 0.5 }), true);
    assert.equal(pointInsideMesh(fused, { x: 2.5, y: 0.5, z: 0.5 }), true);
    assert.equal(pointInsideMesh(fused, { x: 1.5, y: 0.5, z: 0.5 }), false);
    assert.equal(pointInsideMesh(fused, { x: 4, y: 4, z: 4 }), false);
});
