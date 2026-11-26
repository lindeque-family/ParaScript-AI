import { test } from "node:test";
import assert from "node:assert/strict";
import { meshToStl } from "./stl.js";

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

test("a flat or broken triangle is left out", () => {
    const stl = meshToStl({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, Number.NaN, 0, 0]),
        indices: new Uint32Array([0, 1, 2, 0, 1, 3])
    });
    assert.equal(stl.readUInt32LE(80), 0);
    assert.equal(stl.length, 84);
});
