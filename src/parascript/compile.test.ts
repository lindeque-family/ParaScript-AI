import assert from "node:assert/strict";
import { test } from "node:test";
import { compileParaScriptSource } from "./compile.js";

test("compilation reports which axis is up", () => {
    const source = (up: string) => `
        setup { units: "mm", coordinate_system: "${up}" }
        component Mark() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
            ])
            expose {}
        }
        export(Mark())
    `;
    const yUp = compileParaScriptSource(source("Y-up"));
    assert.equal(yUp.success, true, yUp.errorMessage ?? "");
    assert.equal(yUp.coordinateSystem, "Y-up");
    const xUp = compileParaScriptSource(source("X-up"));
    assert.equal(xUp.success, true, xUp.errorMessage ?? "");
    assert.equal(xUp.coordinateSystem, "X-up");
});
