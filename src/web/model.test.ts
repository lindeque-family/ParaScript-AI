import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileParaScriptSource } from "../parascript/compile.js";
import { pointInsideMesh } from "./csg.js";
import { collectFaces, evaluateModelModule, modelAnchor, modelMesh, offsetMesh, tessellateFaces, tessellationStepsFor, type SurfaceFace } from "./model.js";

function face(maxU = 1): SurfaceFace {
    return {
        tag: "Surface2D",
        maxU,
        minV: 0,
        maxV: 1,
        formula: (u: number) => (v: number) => ({ x: u, y: v, z: 0 })
    };
}

test("collectFaces returns a single surface", () => {
    const surface = face();
    assert.deepEqual(collectFaces(surface), [surface]);
});

test("collectFaces extracts solid faces and drops non-surfaces", () => {
    const surface = face(2);
    assert.deepEqual(collectFaces({ tag: "Solid3D", faces: [surface, 4] }), [surface]);
});

test("tessellateFaces builds one quad as two triangles", () => {
    const mesh = tessellateFaces([face()], 1);
    assert.deepEqual(Array.from(mesh.positions), [0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0]);
    assert.deepEqual(Array.from(mesh.indices), [0, 1, 2, 1, 3, 2]);
});

test("tessellateFaces samples maxV at each u", () => {
    const surface: SurfaceFace = {
        tag: "Surface2D",
        maxU: 2,
        minV: 0,
        maxV: (u: number) => u,
        formula: (u: number) => (v: number) => ({ x: u, y: v, z: 0 })
    };
    const mesh = tessellateFaces([surface], 1);
    assert.deepEqual(Array.from(mesh.positions), [0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0]);
});

test("tessellateFaces samples from minV to maxV", () => {
    const surface: SurfaceFace = {
        tag: "Surface2D",
        maxU: 2,
        minV: (u: number) => 1,
        maxV: (u: number) => 1 + u,
        formula: (u: number) => (v: number) => ({ x: u, y: v, z: 0 })
    };
    const mesh = tessellateFaces([surface], 1);
    assert.deepEqual(Array.from(mesh.positions), [0, 1, 0, 0, 1, 0, 2, 1, 0, 2, 3, 0]);
});

test("tessellationStepsFor keeps multi-face models interactive", () => {
    assert.equal(tessellationStepsFor(1), 40);
    assert.ok(tessellationStepsFor(16) >= 16);
});

test("Block - Hole cuts a through-hole", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def pi = 3.14159265359
        def size = 40.0
        def height = 10.0
        def Block = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => size, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => size, formula: u => v => Vector(coords: coords, x: u, y: v, z: height)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: size, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: size, y: u, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: size / 2.0, y: size / 2.0, z: height / 2.0)
            }
        )
        def radius = 5.0
        def height = 12.0
        def Hole = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => height,
                    formula: u => v => Vector(coords: coords, 
                        x: radius * cos(rad: u),
                        y: radius * sin(rad: u),
                        z: v
                    )
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => radius,
                    formula: u => v => Vector(coords: coords, 
                        x: v * cos(rad: u),
                        y: v * sin(rad: u),
                        z: 0.0
                    )
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => radius,
                    formula: u => v => Vector(coords: coords, 
                        x: v * cos(rad: u),
                        y: v * sin(rad: u),
                        z: height
                    )
                )
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
            }
        )
        def Cut = Component(
            solid: join(frame: Block, placed: Hole, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.at, placed: placed.at),
                rotation: meet(frame: frame.right, placed: placed.right)
            ), combine: frame => placed => frame - placed),
            expose: coords => {}
        )
        export(Cut)
        def spare = 1.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""), 6);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 80, y: 80, z: 5 }), false);
});

test("a component value seats in a join", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def pi = 3.14159265359
        def size = 40.0
        def height = 10.0
        def Block = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => size, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => size, formula: u => v => Vector(coords: coords, x: u, y: v, z: height)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: size, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)),
                Surface2D(max_u: size, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: size, y: u, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: size / 2.0, y: size / 2.0, z: height / 2.0)
            }
        )
        def radius = 5.0
        def height = 12.0
        def Hole = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => height,
                    formula: u => v => Vector(coords: coords, x: radius * cos(rad: u), y: radius * sin(rad: u), z: v)
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => radius,
                    formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: v * sin(rad: u), z: 0.0)
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    min_v: u => 0.0, max_v: u => radius,
                    formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: v * sin(rad: u), z: height)
                )
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
            }
        )
        def Drilled = Component(
            solid: join(frame: Block, placed: Hole, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.at, placed: placed.at),
                rotation: meet(frame: frame.right, placed: placed.right)
            ), combine: frame => placed => frame - placed),
            expose: coords => {}
        )
        export(Drilled)
        def spare = 1.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""), 6);
    assert.ok(mesh.indices.length / 3 > 0);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
});

test("export is kept when a later value is a number", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Face = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 8.0, min_v: u => 0.0, max_v: u => 8.0, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0))
            ]),
            expose: coords => {}
        )
        export(Face)
        def spare = 2.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
    assert.ok(mesh.indices.length / 3 > 0);
});

function solidBox(name: string, sx: string, sy: string, sz: string): string {
    return `
        def ${name} = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: ${sx}, min_v: u => 0.0, max_v: u => ${sy}, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)),
                Surface2D(max_u: ${sx}, min_v: u => 0.0, max_v: u => ${sy}, formula: u => v => Vector(coords: coords, x: u, y: v, z: ${sz})),
                Surface2D(max_u: ${sx}, min_v: u => 0.0, max_v: u => ${sz}, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)),
                Surface2D(max_u: ${sx}, min_v: u => 0.0, max_v: u => ${sz}, formula: u => v => Vector(coords: coords, x: u, y: ${sy}, z: v)),
                Surface2D(max_u: ${sy}, min_v: u => 0.0, max_v: u => ${sz}, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)),
                Surface2D(max_u: ${sy}, min_v: u => 0.0, max_v: u => ${sz}, formula: u => v => Vector(coords: coords, x: ${sx}, y: u, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: ${sx} / 2.0, y: ${sy} / 2.0, z: ${sz} / 2.0)
            }
        )
    `;
}

const keptParallel = `frame => placed => align(
    planar: meet(frame: frame.up, placed: placed.up),
    translation: meet(frame: frame.at, placed: placed.at),
    rotation: meet(frame: frame.right, placed: placed.right)
)`;

const apartByRight = `frame => placed => align(
    planar: meet(frame: frame.up, placed: placed.up),
    translation: meet(frame: frame.at.offset(x: 20.0, y: 0.0, z: 0.0), placed: placed.at),
    rotation: meet(frame: frame.right, placed: placed.right)
)`;

test("a join union keeps both solids, and a nested subtract cuts the fused solid", async () => {
    const parts = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${solidBox("Left", "10.0", "10.0", "10.0")}
        ${solidBox("Right", "10.0", "10.0", "10.0")}
        ${solidBox("Slab", "40.0", "10.0", "2.0")}
    `;
    const fused = compileParaScriptSource(`${parts}
        def Fused = Component(
            solid: join(frame: Left, placed: Right, using: ${apartByRight}, combine: frame => placed => placed + frame),
            expose: coords => {}
        )
        export(Fused)
    `);
    const cutFused = compileParaScriptSource(`${parts}
        def Pair = Component(
            solid: join(frame: Left, placed: Right, using: ${apartByRight}, combine: frame => placed => frame + placed),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 15.0, y: 5.0, z: 5.0)
            }
        )
        def Cut = Component(
            solid: join(frame: Pair, placed: Slab, using: ${keptParallel}, combine: frame => placed => frame - placed),
            expose: coords => {}
        )
        export(Cut)
    `);
    const cutRight = compileParaScriptSource(`${parts}
        def CutRight = Component(
            solid: join(frame: Right, placed: Slab, using: ${keptParallel}, combine: frame => placed => frame - placed),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 5.0, y: 5.0, z: 5.0)
            }
        )
        def Kept = Component(
            solid: join(frame: Left, placed: CutRight, using: ${apartByRight}, combine: frame => placed => frame + placed),
            expose: coords => {}
        )
        export(Kept)
    `);
    assert.equal(fused.success, true, fused.errorMessage ?? "");
    assert.equal(cutFused.success, true, cutFused.errorMessage ?? "");
    assert.equal(cutRight.success, true, cutRight.errorMessage ?? "");
    const fusedMesh = modelMesh(await evaluateModelModule(fused.javascriptCode ?? ""), 4);
    const cutBoth = modelMesh(await evaluateModelModule(cutFused.javascriptCode ?? ""), 4);
    const onlyRight = modelMesh(await evaluateModelModule(cutRight.javascriptCode ?? ""), 4);
    assert.equal(pointInsideMesh(fusedMesh, { x: 5, y: 5, z: 5 }), true);
    assert.equal(pointInsideMesh(fusedMesh, { x: 25, y: 5, z: 5 }), true);
    assert.equal(pointInsideMesh(fusedMesh, { x: 15, y: 5, z: 5 }), false);
    assert.equal(pointInsideMesh(cutBoth, { x: 5, y: 5, z: 5 }), false);
    assert.equal(pointInsideMesh(cutBoth, { x: 25, y: 5, z: 5 }), false);
    assert.equal(pointInsideMesh(cutBoth, { x: 5, y: 5, z: 1 }), true);
    assert.equal(pointInsideMesh(onlyRight, { x: 5, y: 5, z: 5 }), true);
    assert.equal(pointInsideMesh(onlyRight, { x: 25, y: 5, z: 5 }), false);
    assert.equal(pointInsideMesh(onlyRight, { x: 5, y: 5, z: 1 }), true);
});

test("a component can be the join of two components", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${solidBox("Left", "10.0", "10.0", "10.0")}
        ${solidBox("Right", "10.0", "10.0", "10.0")}
        def Pair = Component(
            solid: join(frame: Left, placed: Right, using: ${apartByRight}, combine: frame => placed => frame + placed),
            expose: coords => {}
        )
        export(Pair)
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""), 4);
    assert.equal(pointInsideMesh(mesh, { x: 5, y: 5, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 25, y: 5, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 15, y: 5, z: 5 }), false);
});

test("workspace sample meshes through the portal loader", async () => {
    const htmlPath = fileURLToPath(new URL("../../src/web/index.html", import.meta.url));
    const html = readFileSync(htmlPath, "utf8");
    const source = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
    assert.ok(source);
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
    assert.ok(mesh.indices.length / 3 > 100);
});

test("a join rejects a normal with no direction", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Brick = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0))
            ]),
            expose: coords => {
                flat: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)
            }
        )
        def Fused = Component(
            solid: join(
                frame: Brick,
                placed: Brick,
                using: frame => placed => align(
                    planar: meet(frame: frame.flat, placed: placed.up),
                    translation: meet(frame: frame.at, placed: placed.at),
                    rotation: meet(frame: frame.right, placed: placed.right)
                ),
                combine: frame => placed => frame + placed
            ),
            expose: coords => {}
        )
        export(Fused)
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    await assert.rejects(
        () => evaluateModelModule(compiled.javascriptCode ?? ""),
        /frame normal has no direction/
    );
});

test("a meet reads only an anchor the part exposes", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Brick = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0))
            ]),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0) }
        )
        export(join(frame: Brick, placed: Brick, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.at, placed: placed.at),
            rotation: meet(frame: frame.right, placed: placed.right)
        ), combine: frame => placed => frame + placed))
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, false);
    assert.match(compiled.errorMessage ?? "", /'at' is not an anchor on Brick, read from frame\.at\. Brick exposes up\./);
});

test("collectFaces ignores values with no geometry", () => {
    assert.deepEqual(collectFaces(25), []);
    assert.deepEqual(collectFaces(null), []);
    assert.deepEqual(collectFaces({ tag: "Vector", x: 1, y: 2, z: 3 }), []);
});

test("offsetMesh moves the anchor to the origin", () => {
    const mesh = tessellateFaces([face()], 1);
    const framed = offsetMesh(mesh, { x: 1, y: 0, z: 0 });
    assert.deepEqual(Array.from(framed.positions), [-1, 0, 0, -1, 1, 0, 0, 0, 0, 0, 1, 0]);
    assert.equal(modelAnchor({ tag: "Part", geometry: null, anchors: {} }), null);
    assert.deepEqual(modelAnchor({ tag: "Part", geometry: null, anchors: { origin: { x: 50, y: 25, z: 15 } } }), { x: 50, y: 25, z: 15 });
});

test("exposed anchors seat the void and publish the render origin", async () => {
    const source = readFileSync(new URL("../../examples/box.psai", import.meta.url), "utf8");
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const value = await evaluateModelModule(compiled.javascriptCode ?? "");
    const anchor = modelAnchor(value);
    assert.deepEqual(anchor, { x: 50, y: 25, z: 15 });
    const mesh = modelMesh(value, 6);
    assert.equal(pointInsideMesh(mesh, { x: 1.5, y: 25, z: 15 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 1.5, y: 25, z: 28.5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 1.5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 15 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 28.5 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 31.5 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 200, y: 25, z: 15 }), false);
    const framed = offsetMesh(mesh, anchor ?? { x: 0, y: 0, z: 0 });
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < framed.positions.length; i += 3) {
        const x = framed.positions[i] ?? 0;
        const y = framed.positions[i + 1] ?? 0;
        const z = framed.positions[i + 2] ?? 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }
    assert.ok(Math.abs(minX + 50) < 1e-6 && Math.abs(maxX - 50) < 1e-6);
    assert.ok(Math.abs(minY + 25) < 1e-6 && Math.abs(maxY - 25) < 1e-6);
    assert.ok(Math.abs(minZ + 15) < 1e-6 && Math.abs(maxZ - 15) < 1e-6);
});

test("align rotates around the meeting point in the plane", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def FramePart = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 10.0, y: 0.0, z: 0.0)
            }
        )
        def PlacedPart = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 2.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 0.0, y: 1.0, z: 0.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def Turned = Component(
            solid: join(frame: FramePart, placed: PlacedPart, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.at, placed: placed.at),
                rotation: meet(frame: frame.right, placed: placed.right)
            ), combine: frame => placed => frame + placed),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Turned)
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const value = await evaluateModelModule(compiled.javascriptCode ?? "");
    assert.equal(isRecord(value) && value.tag, "Part");
    const geometry = isRecord(value) ? value.geometry : undefined;
    assert.equal(isRecord(geometry) && geometry.op, "add");
    const moved = isRecord(geometry) ? geometry.right : undefined;
    assert.equal(isRecord(moved) && moved.tag, "Solid3D");
    const faces = isRecord(moved) && Array.isArray(moved.faces) ? moved.faces : [];
    const face = faces[0];
    assert.equal(isSurface(face), true);
    if (!isSurface(face)) return;
    const alongRight = face.formula(2)(0);
    const alongUp = face.formula(0)(1);
    assert.ok(Math.abs(alongRight.x - 12) < 1e-6 && Math.abs(alongRight.y) < 1e-6 && Math.abs(alongRight.z) < 1e-6);
    assert.ok(Math.abs(alongUp.x - 10) < 1e-6 && Math.abs(alongUp.y) < 1e-6 && Math.abs(alongUp.z - 1) < 1e-6);
});

test("align makes the planes parallel before it translates", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def FramePart = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 1.0, z: 0.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 4.0, y: 0.0, z: 0.0)
            }
        )
        def PlacedPart = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def Turned = Component(
            solid: join(frame: FramePart, placed: PlacedPart, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.at, placed: placed.at),
                rotation: meet(frame: frame.right, placed: placed.right)
            ), combine: frame => placed => frame + placed),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Turned)
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const value = await evaluateModelModule(compiled.javascriptCode ?? "");
    const geometry = isRecord(value) ? value.geometry : undefined;
    const moved = isRecord(geometry) ? geometry.right : undefined;
    const faces = isRecord(moved) && Array.isArray(moved.faces) ? moved.faces : [];
    const face = faces[0];
    assert.equal(isSurface(face), true);
    if (!isSurface(face)) return;
    const alongNormal = face.formula(0)(1);
    const alongRight = face.formula(1)(0);
    assert.ok(Math.abs(alongNormal.x - 4) < 1e-6 && Math.abs(alongNormal.y - 1) < 1e-6 && Math.abs(alongNormal.z) < 1e-6);
    assert.ok(Math.abs(alongRight.x - 5) < 1e-6 && Math.abs(alongRight.y) < 1e-6 && Math.abs(alongRight.z) < 1e-6);
});

test("M3 screw has a 0.5 mm thread and a hexagon head", async () => {
    const source = readFileSync(fileURLToPath(new URL("../../examples/screw.psai", import.meta.url)), "utf8");
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: -8 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: 1 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 3, z: 1 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 3, y: 0, z: 1 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: 4 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: -17 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 1.8, y: 0, z: -8 }), false);

    let maxAbsX = 0;
    let maxAbsY = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i] ?? 0;
        const y = mesh.positions[i + 1] ?? 0;
        const z = mesh.positions[i + 2] ?? 0;
        if (z < 0.2 || z > 1.8) continue;
        maxAbsX = Math.max(maxAbsX, Math.abs(x));
        maxAbsY = Math.max(maxAbsY, Math.abs(y));
    }
    // Flats are 5.5 mm apart. Corners sit on the Y axis, 6.35 mm apart.
    assert.ok(Math.abs(maxAbsX - 2.75) < 0.02, `across-flats half ${maxAbsX}`);
    assert.ok(Math.abs(maxAbsY - 3.1754) < 0.02, `across-corners half ${maxAbsY}`);

    let sideOut = 0;
    let sideIn = 0;
    let topUp = 0;
    let bottomDown = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const ai = mesh.indices[i] ?? 0;
        const bi = mesh.indices[i + 1] ?? 0;
        const ci = mesh.indices[i + 2] ?? 0;
        const ax = mesh.positions[ai * 3] ?? 0;
        const ay = mesh.positions[ai * 3 + 1] ?? 0;
        const az = mesh.positions[ai * 3 + 2] ?? 0;
        const bx = mesh.positions[bi * 3] ?? 0;
        const by = mesh.positions[bi * 3 + 1] ?? 0;
        const bz = mesh.positions[bi * 3 + 2] ?? 0;
        const cx = mesh.positions[ci * 3] ?? 0;
        const cy = mesh.positions[ci * 3 + 1] ?? 0;
        const cz = mesh.positions[ci * 3 + 2] ?? 0;
        const x = (ax + bx + cx) / 3;
        const y = (ay + by + cy) / 3;
        const z = (az + bz + cz) / 3;
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (z > 0.3 && z < 1.7 && Math.hypot(x, y) > 2.6) {
            if (nx * x + ny * y > 0) sideOut += 1;
            else sideIn += 1;
        } else if (z > 1.95) {
            if (nz > 0) topUp += 1;
        } else if (Math.abs(z) < 0.02 && Math.hypot(x, y) > 1.7) {
            if (nz < 0) bottomDown += 1;
        }
    }
    assert.equal(sideIn, 0);
    assert.ok(sideOut > 1000);
    assert.ok(topUp > 1000);
    assert.ok(bottomDown > 500);

    let minRadius = Infinity;
    let maxRadius = 0;
    const alongX: { z: number; radius: number }[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i] ?? 0;
        const y = mesh.positions[i + 1] ?? 0;
        const z = mesh.positions[i + 2] ?? 0;
        const radius = Math.hypot(x, y);
        if (z > -0.2 || z < -15.8 || radius < 1) continue;
        minRadius = Math.min(minRadius, radius);
        maxRadius = Math.max(maxRadius, radius);
        // A helix is at the crest somewhere on every slice, so follow one generator line.
        if (Math.abs(y) < 1e-4 && x > 1) alongX.push({ z, radius });
    }
    // ISO minor radius is 1.229 mm and the crest is the 1.5 mm major radius.
    assert.ok(minRadius < 1.32, `root radius ${minRadius}`);
    assert.ok(maxRadius > 1.46, `crest radius ${maxRadius}`);

    alongX.sort((a, b) => a.z - b.z);
    let peaks = 0;
    let rising = false;
    for (const sample of alongX) {
        if (!rising && sample.radius > 1.46) {
            peaks += 1;
            rising = true;
        } else if (sample.radius < 1.38) {
            rising = false;
        }
    }
    assert.ok(peaks >= 28 && peaks <= 36, `thread crests ${peaks}`);

    let outward = 0;
    let inward = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const ai = mesh.indices[i] ?? 0;
        const bi = mesh.indices[i + 1] ?? 0;
        const ci = mesh.indices[i + 2] ?? 0;
        const ax = mesh.positions[ai * 3] ?? 0;
        const ay = mesh.positions[ai * 3 + 1] ?? 0;
        const az = mesh.positions[ai * 3 + 2] ?? 0;
        const bx = mesh.positions[bi * 3] ?? 0;
        const by = mesh.positions[bi * 3 + 1] ?? 0;
        const bz = mesh.positions[bi * 3 + 2] ?? 0;
        const cx = mesh.positions[ci * 3] ?? 0;
        const cy = mesh.positions[ci * 3 + 1] ?? 0;
        const cz = mesh.positions[ci * 3 + 2] ?? 0;
        const z = (az + bz + cz) / 3;
        const x = (ax + bx + cx) / 3;
        const y = (ay + by + cy) / 3;
        const radius = Math.hypot(x, y);
        if (z > -0.2 || z < -15.8 || radius < 1.1) continue;
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (nx * x + ny * y > 0) outward += 1;
        else inward += 1;
    }
    assert.ok(outward > inward * 20, `outward ${outward} inward ${inward}`);
});

test("a flat face in a boolean is two triangles and a round wall keeps the curve", () => {
    const flat = tessellateFaces([face()], 12, true);
    assert.equal(flat.indices.length, 6);
    const dense = tessellateFaces([face()], 12);
    assert.equal(dense.indices.length, 12 * 12 * 6);
    const wall: SurfaceFace = {
        tag: "Surface2D",
        maxU: Math.PI * 2,
        minV: 0,
        maxV: 8,
        formula: (u: number) => (v: number) => ({ x: Math.cos(u), y: Math.sin(u), z: v })
    };
    const round = tessellateFaces([wall], 12, true);
    assert.equal(round.indices.length, 12 * 6);
    const sphere: SurfaceFace = {
        tag: "Surface2D",
        maxU: Math.PI * 2,
        minV: 0,
        maxV: Math.PI,
        formula: (u: number) => (v: number) => ({
            x: Math.cos(u) * Math.sin(v),
            y: Math.sin(u) * Math.sin(v),
            z: Math.cos(v)
        })
    };
    const curved = tessellateFaces([sphere], 4, true);
    assert.equal(curved.indices.length, 4 * 4 * 6);
});

test("Box is twelve triangles and a taller Cylinder cuts a hole through it", async () => {
    const boxSource = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        export(Box(width: 10.0, depth: 20.0, height: 30.0))
    `;
    const boxCompiled = compileParaScriptSource(boxSource);
    assert.equal(boxCompiled.success, true, boxCompiled.errorMessage ?? "");
    const boxPart = await evaluateModelModule(boxCompiled.javascriptCode ?? "");
    assert.deepEqual(anchorPoint(boxPart, "bottom"), { x: 5, y: 10, z: 0 });
    assert.deepEqual(anchorPoint(boxPart, "top"), { x: 5, y: 10, z: 30 });
    assert.deepEqual(anchorPoint(boxPart, "corner"), { x: 0, y: 0, z: 0 });
    assert.deepEqual(anchorPoint(boxPart, "origin"), { x: 0, y: 0, z: 0 });
    const box = modelMesh(boxPart);
    assert.equal(box.indices.length / 3, 12);
    assert.equal(pointInsideMesh(box, { x: 1, y: 2, z: 3 }), true);
    assert.equal(pointInsideMesh(box, { x: -1, y: 2, z: 3 }), false);

    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Cut = Component(
            solid: join(
                frame: Box(width: 40.0, depth: 40.0, height: 10.0),
                placed: Cylinder(radius: 5.0, height: 12.0),
                using: frame => placed => align(
                    planar: meet(frame: frame.up, placed: placed.up),
                    translation: meet(frame: frame.corner.offset(x: 20.0, y: 20.0, z: 0.0 - 1.0), placed: placed.bottom),
                    rotation: meet(frame: frame.right, placed: placed.right)
                ),
                combine: frame => placed => frame - placed
            ),
            expose: coords => {}
        )
        export(Cut)
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
    assert.ok(mesh.indices.length / 3 < 500);
});

test("Sphere is centered on the origin and cuts a cavity out of a box", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        export(Sphere(radius: 10.0))
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const part = await evaluateModelModule(compiled.javascriptCode ?? "");
    assert.deepEqual(anchorPoint(part, "origin"), { x: 0, y: 0, z: 0 });
    assert.deepEqual(anchorPoint(part, "center"), { x: 0, y: 0, z: 0 });
    assert.deepEqual(anchorPoint(part, "top"), { x: 0, y: 0, z: 10 });
    assert.deepEqual(anchorPoint(part, "bottom"), { x: 0, y: 0, z: -10 });
    const mesh = modelMesh(part);
    assert.equal(mesh.indices.length / 3, 528);
    assert.equal(normalsPointOutward(mesh), true);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: 0 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: 9 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 0, y: 0, z: 11 }), false);

    const cutSource = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Cut = Component(
            solid: join(
                frame: Box(width: 40.0, depth: 40.0, height: 40.0),
                placed: Sphere(radius: 10.0),
                using: frame => placed => align(
                    planar: meet(frame: frame.up, placed: placed.up),
                    translation: meet(frame: frame.corner.offset(x: 20.0, y: 20.0, z: 20.0), placed: placed.origin),
                    rotation: meet(frame: frame.right, placed: placed.right)
                ),
                combine: frame => placed => frame - placed
            ),
            expose: coords => {}
        )
        export(Cut)
    `;
    const cutCompiled = compileParaScriptSource(cutSource);
    assert.equal(cutCompiled.success, true, cutCompiled.errorMessage ?? "");
    const cut = modelMesh(await evaluateModelModule(cutCompiled.javascriptCode ?? ""));
    assert.equal(pointInsideMesh(cut, { x: 2, y: 2, z: 2 }), true);
    assert.equal(pointInsideMesh(cut, { x: 20, y: 20, z: 20 }), false);
});

function normalsPointOutward(mesh: { positions: ArrayLike<number>; indices: ArrayLike<number> }): boolean {
    const positions = mesh.positions;
    const indices = mesh.indices;
    for (let index = 0; index < indices.length; index += 3) {
        const a = (indices[index] ?? 0) * 3;
        const b = (indices[index + 1] ?? 0) * 3;
        const c = (indices[index + 2] ?? 0) * 3;
        const ax = positions[a] ?? 0;
        const ay = positions[a + 1] ?? 0;
        const az = positions[a + 2] ?? 0;
        const e1x = (positions[b] ?? 0) - ax;
        const e1y = (positions[b + 1] ?? 0) - ay;
        const e1z = (positions[b + 2] ?? 0) - az;
        const e2x = (positions[c] ?? 0) - ax;
        const e2y = (positions[c + 1] ?? 0) - ay;
        const e2z = (positions[c + 2] ?? 0) - az;
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const cx = (ax + (positions[b] ?? 0) + (positions[c] ?? 0)) / 3;
        const cy = (ay + (positions[b + 1] ?? 0) + (positions[c + 1] ?? 0)) / 3;
        const cz = (az + (positions[b + 2] ?? 0) + (positions[c + 2] ?? 0)) / 3;
        if (nx * cx + ny * cy + nz * cz <= 0) return false;
    }
    return true;
}

function anchorPoint(part: unknown, name: string): { x: number; y: number; z: number } {
    assert.ok(isRecord(part) && isRecord(part.anchors));
    const vector = part.anchors[name];
    assert.ok(isRecord(vector) && typeof vector.x === "number" && typeof vector.y === "number" && typeof vector.z === "number");
    return { x: vector.x, y: vector.y, z: vector.z };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isSurface(value: unknown): value is SurfaceFace {
    return isRecord(value) && typeof value.formula === "function";
}
