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
        maxV: (u: number) => u,
        formula: (u: number) => (v: number) => ({ x: u, y: v, z: 0 })
    };
    const mesh = tessellateFaces([surface], 1);
    assert.deepEqual(Array.from(mesh.positions), [0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0]);
});

test("tessellationStepsFor keeps multi-face models interactive", () => {
    assert.equal(tessellationStepsFor(1), 40);
    assert.ok(tessellationStepsFor(16) >= 16);
});

test("Block() - Hole() cuts a through-hole", async () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def pi = 3.14159265359
        component Block() {
            def size = 40.0
            def height = 10.0
            Solid3D(faces: [
                Surface2D(max_u: size, max_v: u => size, formula: u => v => Vector(x: u, y: v, z: 0.0)),
                Surface2D(max_u: size, max_v: u => size, formula: u => v => Vector(x: u, y: v, z: height)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: u, y: 0.0, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: u, y: size, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: 0.0, y: u, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: size, y: u, z: v))
            ])
            expose {}
        }
        component Hole() {
            def radius = 5.0
            def height = 12.0
            Solid3D(faces: [
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => height,
                    formula: u => v => Vector(
                        x: radius * cos(rad: u),
                        y: radius * sin(rad: u),
                        z: v
                    )
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => radius,
                    formula: u => v => Vector(
                        x: v * cos(rad: u),
                        y: v * sin(rad: u),
                        z: 0.0
                    )
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => radius,
                    formula: u => v => Vector(
                        x: v * cos(rad: u),
                        y: v * sin(rad: u),
                        z: height
                    )
                )
            ])
            expose {}
        }
        def cut = join(fixed: Block(), moving: Hole(), using: centred) {
            fixed - moving
        }
        export(cut)
        def spare = 1.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""), 6);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 80, y: 80, z: 5 }), false);
});

test("Block - Hole calls zero-argument components", async () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def pi = 3.14159265359
        component Block() {
            def size = 40.0
            def height = 10.0
            Solid3D(faces: [
                Surface2D(max_u: size, max_v: u => size, formula: u => v => Vector(x: u, y: v, z: 0.0)),
                Surface2D(max_u: size, max_v: u => size, formula: u => v => Vector(x: u, y: v, z: height)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: u, y: 0.0, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: u, y: size, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: 0.0, y: u, z: v)),
                Surface2D(max_u: size, max_v: u => height, formula: u => v => Vector(x: size, y: u, z: v))
            ])
            expose {}
        }
        component Hole() {
            def radius = 5.0
            def height = 12.0
            Solid3D(faces: [
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => height,
                    formula: u => v => Vector(x: radius * cos(rad: u), y: radius * sin(rad: u), z: v)
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => radius,
                    formula: u => v => Vector(x: v * cos(rad: u), y: v * sin(rad: u), z: 0.0)
                ),
                Surface2D(
                    max_u: pi * 2.0,
                    max_v: u => radius,
                    formula: u => v => Vector(x: v * cos(rad: u), y: v * sin(rad: u), z: height)
                )
            ])
            expose {}
        }
        export(join(fixed: Block, moving: Hole, using: centred) {
            fixed - moving
        })
        def spare = 1.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""), 6);
    assert.ok(mesh.indices.length / 3 > 0);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
});

test("export inside a component is kept when a later value is a number", async () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        component Plate() {
            component Face() {
                Solid3D(faces: [
                    Surface2D(max_u: 8.0, max_v: u => 8.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
                ])
                expose {}
            }
            export(Face())
            Solid3D(faces: [
                Surface2D(max_u: 8.0, max_v: u => 8.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
            ])
            expose {}
        }
        def shown = Plate()
        def spare = 2.0
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const mesh = modelMesh(await evaluateModelModule(compiled.javascriptCode ?? ""));
    assert.ok(mesh.indices.length / 3 > 0);
});

function solidBox(name: string, sx: string, sy: string, sz: string): string {
    return `
        component ${name}() {
            Solid3D(faces: [
                Surface2D(max_u: ${sx}, max_v: u => ${sy}, formula: u => v => Vector(x: u, y: v, z: 0.0)),
                Surface2D(max_u: ${sx}, max_v: u => ${sy}, formula: u => v => Vector(x: u, y: v, z: ${sz})),
                Surface2D(max_u: ${sx}, max_v: u => ${sz}, formula: u => v => Vector(x: u, y: 0.0, z: v)),
                Surface2D(max_u: ${sx}, max_v: u => ${sz}, formula: u => v => Vector(x: u, y: ${sy}, z: v)),
                Surface2D(max_u: ${sy}, max_v: u => ${sz}, formula: u => v => Vector(x: 0.0, y: u, z: v)),
                Surface2D(max_u: ${sy}, max_v: u => ${sz}, formula: u => v => Vector(x: ${sx}, y: u, z: v))
            ])
            expose {}
        }
    `;
}

test("a join union keeps both solids, and a nested subtract cuts the fused solid", async () => {
    const parts = `
        setup { units: "mm", coordinate_system: "Z-up" }
        ${solidBox("Left", "10.0", "10.0", "10.0")}
        ${solidBox("Right", "10.0", "10.0", "10.0")}
        ${solidBox("Slab", "40.0", "10.0", "2.0")}
    `;
    const fused = compileParaScriptSource(`${parts}
        export(join(fixed: Left(), moving: Right(), using: apart(right: 20.0, forward: 0.0, up: 0.0)) {
            moving + fixed
        })
    `);
    const cutFused = compileParaScriptSource(`${parts}
        export(join(fixed: Left(), moving: Right(), using: apart(right: 20.0, forward: 0.0, up: 0.0)) {
            def fused = fixed + moving
            join(fixed: fused, moving: Slab(), using: centred) {
                fixed - moving
            }
        })
    `);
    const cutRight = compileParaScriptSource(`${parts}
        export(join(fixed: Right(), moving: Slab(), using: centred) {
            def cut = fixed - moving
            join(fixed: Left(), moving: cut, using: apart(right: 20.0, forward: 0.0, up: 0.0)) {
                fixed + moving
            }
        })
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
        setup { units: "mm", coordinate_system: "Z-up" }
        ${solidBox("Left", "10.0", "10.0", "10.0")}
        ${solidBox("Right", "10.0", "10.0", "10.0")}
        component Pair() {
            join(fixed: Left(), moving: Right(), using: apart(right: 20.0, forward: 0.0, up: 0.0)) {
                fixed + moving
            }
            expose {}
        }
        export(Pair())
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
        setup { units: "mm", coordinate_system: "Z-up" }
        component Brick() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
            ])
            expose {}
        }
        def mate = planar_centred(
            target_normal: Vector(x: 0.0, y: 0.0, z: 0.0),
            source_normal: Vector(x: 0.0, y: 0.0, z: 1.0),
            target_pos: Vector(x: 0.0, y: 0.0, z: 0.0),
            source_pos: Vector(x: 0.0, y: 0.0, z: 0.0),
            target_twist: Vector(x: 1.0, y: 0.0, z: 0.0),
            source_twist: Vector(x: 1.0, y: 0.0, z: 0.0)
        )
        export(join(fixed: Brick(), moving: Brick(), using: mate) {
            fixed + moving
        })
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    await assert.rejects(
        () => evaluateModelModule(compiled.javascriptCode ?? ""),
        /target normal has no direction/
    );
});

test("an anchor name must be centre, min, or max", async () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        component Brick() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
            ])
            expose {}
        }
        def mate = relate(
            right: anchor(fixed: centre, moving: "middle", by: 0.0),
            forward: anchor(fixed: centre, moving: centre, by: 0.0),
            up: anchor(fixed: centre, moving: centre, by: 0.0)
        )
        export(join(fixed: Brick(), moving: Brick(), using: mate) {
            fixed + moving
        })
    `;
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    await assert.rejects(
        () => evaluateModelModule(compiled.javascriptCode ?? ""),
        /An anchor is centre, min, max, or origin/
    );
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
        setup { units: "mm", coordinate_system: "Z-up" }
        component Fixed() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: v, z: 0.0))
            ])
            expose {
                up: Vector(x: 0.0, y: 0.0, z: 1.0),
                right: Vector(x: 1.0, y: 0.0, z: 0.0),
                at: Vector(x: 10.0, y: 0.0, z: 0.0)
            }
        }
        component Moving() {
            Solid3D(faces: [
                Surface2D(max_u: 2.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: u, z: v))
            ])
            expose {
                up: Vector(x: 0.0, y: 0.0, z: 1.0),
                right: Vector(x: 0.0, y: 1.0, z: 0.0),
                at: Vector(x: 0.0, y: 0.0, z: 0.0)
            }
        }
        component Turned() {
            join(fixed: Fixed(), moving: Moving(), using: align(
                planar: meet(fixed: fixed.up, moving: moving.up),
                translation: meet(fixed: fixed.at, moving: moving.at),
                rotation: meet(fixed: fixed.right, moving: moving.right)
            )) {
                fixed + moving
            }
            expose { origin: Vector(x: 0.0, y: 0.0, z: 0.0) }
        }
        export(Turned())
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
        setup { units: "mm", coordinate_system: "Z-up" }
        component Fixed() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: 0.0, z: v))
            ])
            expose {
                up: Vector(x: 0.0, y: 1.0, z: 0.0),
                right: Vector(x: 1.0, y: 0.0, z: 0.0),
                at: Vector(x: 4.0, y: 0.0, z: 0.0)
            }
        }
        component Moving() {
            Solid3D(faces: [
                Surface2D(max_u: 1.0, max_v: u => 1.0, formula: u => v => Vector(x: u, y: 0.0, z: v))
            ])
            expose {
                up: Vector(x: 0.0, y: 0.0, z: 1.0),
                right: Vector(x: 1.0, y: 0.0, z: 0.0),
                at: Vector(x: 0.0, y: 0.0, z: 0.0)
            }
        }
        component Turned() {
            join(fixed: Fixed(), moving: Moving(), using: align(
                planar: meet(fixed: fixed.up, moving: moving.up),
                translation: meet(fixed: fixed.at, moving: moving.at),
                rotation: meet(fixed: fixed.right, moving: moving.right)
            )) {
                fixed + moving
            }
            expose { origin: Vector(x: 0.0, y: 0.0, z: 0.0) }
        }
        export(Turned())
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isSurface(value: unknown): value is SurfaceFace {
    return isRecord(value) && typeof value.formula === "function";
}
