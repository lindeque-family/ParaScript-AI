import { test } from "node:test";
import assert from "node:assert/strict";
import { meshToStl, stlFilename } from "./stl.js";

function edgeCounts(stl: Buffer): Map<string, number> {
    const count = stl.readUInt32LE(80);
    const counts = new Map<string, number>();
    let offset = 84;
    for (let triangle = 0; triangle < count; triangle += 1) {
        offset += 12;
        const corners: string[] = [];
        for (let corner = 0; corner < 3; corner += 1) {
            corners.push(`${stl.readFloatLE(offset)},${stl.readFloatLE(offset + 4)},${stl.readFloatLE(offset + 8)}`);
            offset += 12;
        }
        offset += 2;
        for (let edge = 0; edge < 3; edge += 1) {
            const left = corners[edge] ?? "";
            const right = corners[(edge + 1) % 3] ?? "";
            const name = left < right ? `${left}|${right}` : `${right}|${left}`;
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    return counts;
}

function boundaryEdges(stl: Buffer): number {
    let open = 0;
    for (const value of edgeCounts(stl).values()) if (value === 1) open += 1;
    return open;
}

test("a triangle becomes one binary STL facet", () => {
    const stl = meshToStl({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2])
    });
    assert.equal(stl.length, 134);
    assert.equal(stl.subarray(0, 10).toString("latin1"), "ParaScript");
    assert.equal(stl.readUInt32LE(80), 1);
    assert.ok(Math.abs(stl.readFloatLE(84 + 8) - 1) < 1e-6);
    assert.ok(Math.abs(stl.readFloatLE(84 + 12)) < 1e-6);
    assert.ok(Math.abs(stl.readFloatLE(84 + 24) - 1) < 1e-6);
    assert.ok(Math.abs(stl.readFloatLE(84 + 40) - 1) < 1e-6);
    assert.equal(stl.readUInt16LE(132), 0);
});

test("the model name is the STL download name", () => {
    assert.equal(stlFilename(undefined), "solid.stl");
    assert.equal(stlFilename("   "), "solid.stl");
    assert.equal(stlFilename("Letter M"), "Letter M.stl");
    assert.equal(stlFilename("Letter M.stl"), "Letter M.stl");
    assert.equal(stlFilename("a/b:c"), "abc.stl");
});

test("a T-junction is split so both sides share the short edges", () => {
    const stl = meshToStl({
        positions: new Float32Array([
            0, 0, 0,
            2, 0, 0,
            1, 1, 0,
            1, 0, 0,
            1, -1, 0
        ]),
        indices: new Uint32Array([
            0, 1, 2,
            0, 3, 4,
            3, 1, 4
        ])
    });
    const counts = edgeCounts(stl);
    let boundary = 0;
    let multi = 0;
    for (const value of counts.values()) {
        if (value === 1) boundary += 1;
        if (value > 2) multi += 1;
    }
    assert.equal(stl.readUInt32LE(80), 4);
    assert.equal(boundary, 4);
    assert.equal(multi, 0);
});

test("nearby open-edge vertices are joined", () => {
    const stl = meshToStl({
        positions: new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,
            0.002, 0, 0,
            1.002, 0, 0,
            0.5, -1, 0
        ]),
        indices: new Uint32Array([
            0, 1, 2,
            3, 4, 5
        ])
    });
    const counts = edgeCounts(stl);
    let boundary = 0;
    let multi = 0;
    for (const value of counts.values()) {
        if (value === 1) boundary += 1;
        if (value > 2) multi += 1;
    }
    assert.equal(stl.readUInt32LE(80), 2);
    assert.equal(boundary, 4);
    assert.equal(multi, 0);
});

test("a collinear triangle is replaced so the STL stays closed", () => {
    const mesh = {
        positions: new Float32Array([
            0, 0, 0,
            2, 0, 0,
            1, 1, 0,
            1, 0, 0,
            1, -1, 0
        ]),
        indices: new Uint32Array([
            0, 1, 2,
            0, 3, 4,
            3, 1, 4,
            0, 3, 1
        ])
    };
    const stl = meshToStl(mesh);
    assert.equal(stl.readUInt32LE(80), 4);
    assert.equal(boundaryEdges(stl), 4);
});

test("a flat or broken triangle is left out", () => {
    const stl = meshToStl({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, Number.NaN, 0, 0]),
        indices: new Uint32Array([0, 1, 2, 0, 1, 3])
    });
    assert.equal(stl.readUInt32LE(80), 0);
    assert.equal(stl.length, 84);
});
