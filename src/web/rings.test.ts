import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileParaScriptSource } from "../parascript/compile.js";
import { pointInsideMesh } from "./csg.js";
import { evaluateModelModule, modelMesh, type Mesh } from "./model.js";
import { meshToStl } from "./stl.js";

const letterM = `setup {
    name: "Letter M",
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    script: {
        stroke_radius: 1.8,
        extrude_height: 4.0,
        base_thickness: 2.0,
        total_width: 56.0,
        total_depth: 58.0
    }
}

def pi = 3.14159265359

def fold: (item: T => accumulator: A => A) => (initial: A) => (list: [T]) => A = f => initial => list => match list {
    [] => initial,
    head :: tail => f(item: head, accumulator: fold(f: f, initial: initial, list: tail))
}

def Box = width => depth => height =>
    Component(
        solid: coords =>
            let top = Surface2D(
                max_u: width,
                min_v: u => 0.0,
                max_v: u => depth,
                formula: u => v => Vector(coords: coords, x: u, y: v, z: height)) in
            let bottom = Surface2D(
                max_u: width,
                min_v: u => 0.0,
                max_v: u => depth,
                formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)) in
            let front = Surface2D(
                max_u: width,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: u, y: depth, z: v)) in
            let back = Surface2D(
                max_u: width,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)) in
            let left = Surface2D(
                max_u: depth,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)) in
            let right = Surface2D(
                max_u: depth,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: width, y: u, z: v)) in
            Solid3D(faces: [ top, bottom, front, back, left, right ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def Cylinder = radius => height =>
    let Disk = coords => radius => z => Surface2D(
        max_u: 2.0 * pi,
        min_v: u => 0.0, max_v: u => radius,
        formula: u => v => Vector(coords: coords,
            x: v * cos(rad: u),
            y: v * sin(rad: u),
            z: z
        )
    ) in
    let Tube = coords => radius => height => Surface2D(
        max_u: 2.0 * pi,
        min_v: u => 0.0, max_v: u => height,
        formula: u => v => Vector(coords: coords,
            x: radius * cos(rad: u),
            y: radius * sin(rad: u),
            z: v
        )
    ) in
    Component(
        solid: coords =>
            let bottom = Disk(coords: coords, radius: radius, z: 0.0) in
            let top = Disk(coords: coords, radius: radius, z: height) in
            Solid3D(faces: [
                Tube(coords: coords, radius: radius, height: height),
                bottom,
                top
            ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def place_beads = host => points => bead => fold(
    f: item => accumulator => Component(
        solid: join(
            frame: accumulator,
            placed: bead,
            using: frame => placed => align(
                planar: meet(frame: accumulator.up, placed: placed.up),
                translation: meet(frame: accumulator.corner.add(vector: item), placed: placed.bottom),
                rotation: meet(frame: accumulator.right, placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => { up: accumulator.up, right: accumulator.right, corner: accumulator.corner }
    ),
    initial: host,
    list: points
)

def sample_segment = coords => x0 => y0 => x1 => y1 => steps =>
    integers(start: 0.0, count: steps + 1.0)
    |> map(f: item =>
        let t = item / steps in
        Vector(
            coords: coords,
            x: x0 + ((x1 - x0) * t),
            y: y0 + ((y1 - y0) * t),
            z: $script.base_thickness - 0.4
        )
    )

def sample_arc = coords => cx => cy => rx => ry => start_deg => end_deg => steps =>
    integers(start: 0.0, count: steps + 1.0)
    |> map(f: item =>
        let t = item / steps in
        let ang = (start_deg + ((end_deg - start_deg) * t)) * (pi / 180.0) in
        Vector(
            coords: coords,
            x: cx + (rx * cos(rad: ang)),
            y: cy + (ry * sin(rad: ang)),
            z: $script.base_thickness - 0.4
        )
    )

def append_lists = a => b => fold(f: item => accumulator => item :: accumulator, initial: b, list: a)

def concat_all = lists => fold(f: item => accumulator => append_lists(a: item, b: accumulator), initial: [], list: lists)

def letter_m_points = coords => concat_all(lists: [
    sample_arc(coords: coords, cx: 14.0, cy: 14.0, rx: 4.5, ry: 4.0, start_deg: 230.0, end_deg: 30.0, steps: 10.0),
    sample_segment(coords: coords, x0: 17.9, y0: 16.0, x1: 23.0, y1: 43.0, steps: 14.0),
    sample_arc(coords: coords, cx: 24.2, cy: 43.0, rx: 1.2, ry: 1.5, start_deg: 160.0, end_deg: 10.0, steps: 5.0),
    sample_segment(coords: coords, x0: 25.4, y0: 42.8, x1: 29.0, y1: 23.0, steps: 11.0),
    sample_arc(coords: coords, cx: 30.2, cy: 23.0, rx: 1.2, ry: 1.5, start_deg: 190.0, end_deg: 350.0, steps: 5.0),
    sample_segment(coords: coords, x0: 31.4, y0: 23.0, x1: 35.5, y1: 43.0, steps: 11.0),
    sample_arc(coords: coords, cx: 36.7, cy: 43.0, rx: 1.2, ry: 1.5, start_deg: 170.0, end_deg: 10.0, steps: 5.0),
    sample_segment(coords: coords, x0: 37.9, y0: 42.8, x1: 41.0, y1: 15.0, steps: 14.0),
    sample_arc(coords: coords, cx: 45.5, cy: 15.0, rx: 4.5, ry: 3.5, start_deg: 180.0, end_deg: 345.0, steps: 10.0)
])

def BasePlate = Box(
    width: $script.total_width,
    depth: $script.total_depth,
    height: $script.base_thickness
)

def StrokeBead = Cylinder(
    radius: $script.stroke_radius,
    height: $script.extrude_height
)

def LetterMSign = coords => place_beads(
    host: BasePlate,
    points: letter_m_points(coords: coords),
    bead: StrokeBead
)

export(Component(
    solid: coords => LetterMSign(coords: coords),
    expose: coords => {
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
    }
))
`;

async function compiledMesh(source: string): Promise<{ mesh: Mesh; elapsed: number }> {
    const compiled = compileParaScriptSource(source);
    assert.equal(compiled.success, true, compiled.errorMessage ?? "");
    const value = await evaluateModelModule(compiled.javascriptCode ?? "");
    const started = Date.now();
    const mesh = modelMesh(value);
    return { mesh, elapsed: Date.now() - started };
}

function triangles(mesh: Mesh): number {
    return mesh.indices.length / 3;
}

function meshVolume(mesh: Mesh): number {
    let volume = 0;
    for (let index = 0; index < mesh.indices.length; index += 3) {
        const a = (mesh.indices[index] ?? 0) * 3;
        const b = (mesh.indices[index + 1] ?? 0) * 3;
        const c = (mesh.indices[index + 2] ?? 0) * 3;
        const ax = mesh.positions[a] ?? 0;
        const ay = mesh.positions[a + 1] ?? 0;
        const az = mesh.positions[a + 2] ?? 0;
        const bx = mesh.positions[b] ?? 0;
        const by = mesh.positions[b + 1] ?? 0;
        const bz = mesh.positions[b + 2] ?? 0;
        const cx = mesh.positions[c] ?? 0;
        const cy = mesh.positions[c + 1] ?? 0;
        const cz = mesh.positions[c + 2] ?? 0;
        volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    return Math.abs(volume) / 6;
}

function openEdges(mesh: Mesh): number {
    const counts = new Map<string, number>();
    const key = (index: number): string => {
        const offset = index * 3;
        return `${mesh.positions[offset]},${mesh.positions[offset + 1]},${mesh.positions[offset + 2]}`;
    };
    for (let index = 0; index < mesh.indices.length; index += 3) {
        const ids = [mesh.indices[index] ?? 0, mesh.indices[index + 1] ?? 0, mesh.indices[index + 2] ?? 0];
        for (let edge = 0; edge < 3; edge++) {
            const left = key(ids[edge] ?? 0);
            const right = key(ids[(edge + 1) % 3] ?? 0);
            const name = left < right ? `${left}|${right}` : `${right}|${left}`;
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    let open = 0;
    for (const count of counts.values()) if (count !== 2) open += 1;
    return open;
}

function upward(mesh: Mesh): number {
    let count = 0;
    for (let index = 0; index < mesh.indices.length; index += 3) {
        const normal = faceNormal(mesh, index);
        if (normal === undefined) continue;
        if (normal.z > 0.9 * normal.length) count += 1;
    }
    return count;
}

function faceNormal(mesh: Mesh, index: number): { x: number; y: number; z: number; length: number } | undefined {
    const a = (mesh.indices[index] ?? 0) * 3;
    const b = (mesh.indices[index + 1] ?? 0) * 3;
    const c = (mesh.indices[index + 2] ?? 0) * 3;
    const ax = mesh.positions[a] ?? 0;
    const ay = mesh.positions[a + 1] ?? 0;
    const az = mesh.positions[a + 2] ?? 0;
    const e1x = (mesh.positions[b] ?? 0) - ax;
    const e1y = (mesh.positions[b + 1] ?? 0) - ay;
    const e1z = (mesh.positions[b + 2] ?? 0) - az;
    const e2x = (mesh.positions[c] ?? 0) - ax;
    const e2y = (mesh.positions[c + 1] ?? 0) - ay;
    const e2z = (mesh.positions[c + 2] ?? 0) - az;
    const x = e1y * e2z - e1z * e2y;
    const y = e1z * e2x - e1x * e2z;
    const z = e1x * e2y - e1y * e2x;
    const length = Math.hypot(x, y, z);
    if (length < 1e-8) return undefined;
    return { x, y, z, length };
}

function normalFault(mesh: Mesh, step: number): string | undefined {
    for (let index = 0; index < mesh.indices.length; index += 3) {
        const normal = faceNormal(mesh, index);
        // A hairline union sliver can sit inside the stroke. Real faces are much larger.
        if (normal === undefined || normal.length < 0.02) continue;
        const a = (mesh.indices[index] ?? 0) * 3;
        const b = (mesh.indices[index + 1] ?? 0) * 3;
        const c = (mesh.indices[index + 2] ?? 0) * 3;
        const x = ((mesh.positions[a] ?? 0) + (mesh.positions[b] ?? 0) + (mesh.positions[c] ?? 0)) / 3;
        const y = ((mesh.positions[a + 1] ?? 0) + (mesh.positions[b + 1] ?? 0) + (mesh.positions[c + 1] ?? 0)) / 3;
        const z = ((mesh.positions[a + 2] ?? 0) + (mesh.positions[b + 2] ?? 0) + (mesh.positions[c + 2] ?? 0)) / 3;
        const ux = x + normal.x / normal.length * step;
        const uy = y + normal.y / normal.length * step;
        const uz = z + normal.z / normal.length * step;
        const ix = x - normal.x / normal.length * step;
        const iy = y - normal.y / normal.length * step;
        const iz = z - normal.z / normal.length * step;
        if (pointInsideMesh(mesh, { x: ux, y: uy, z: uz })) return `triangle ${index / 3} points into the solid`;
        if (!pointInsideMesh(mesh, { x: ix, y: iy, z: iz })) return `triangle ${index / 3} leaves the solid`;
    }
    return undefined;
}

function stlMesh(stl: Buffer): Mesh {
    const count = stl.readUInt32LE(80);
    const positions: number[] = [];
    const indices: number[] = [];
    let offset = 84;
    for (let triangle = 0; triangle < count; triangle += 1) {
        offset += 12;
        const base = positions.length / 3;
        for (let corner = 0; corner < 3; corner += 1) {
            positions.push(stl.readFloatLE(offset), stl.readFloatLE(offset + 4), stl.readFloatLE(offset + 8));
            offset += 12;
        }
        offset += 2;
        indices.push(base, base + 1, base + 2);
    }
    return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

function example(name: string): string {
    return readFileSync(fileURLToPath(new URL(`../../examples/${name}.psai`, import.meta.url)), "utf8");
}

test("a vertical cylinder cuts a fenced hole through a plate", async () => {
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
    const { mesh } = await compiledMesh(source);
    assert.equal(triangles(mesh), 184);
    assert.equal(upward(mesh), 64);
    assert.equal(openEdges(mesh), 0);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 5 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 5 }), false);
    assert.equal(normalFault(mesh, 0.4), undefined);
});

test("a blind hole stays on the general boolean", async () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Cut = Component(
            solid: join(
                frame: Box(width: 40.0, depth: 40.0, height: 10.0),
                placed: Cylinder(radius: 5.0, height: 6.0),
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
    const { mesh } = await compiledMesh(source);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 2 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 20, y: 20, z: 8 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 2 }), true);
});

test("overlapping vertical beads stay a small closed mesh", async () => {
    const points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0].map((index) =>
        `Vector(coords: coords, x: ${10 + index * 6}.0, y: 30.0, z: 2.0)`
    ).join(",\n                    ");
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def place = host => points => fold(
            f: item => accumulator => Component(
                solid: join(
                    frame: accumulator,
                    placed: Cylinder(radius: 4.0, height: 6.0),
                    using: frame => placed => align(
                        planar: meet(frame: accumulator.up, placed: placed.up),
                        translation: meet(frame: accumulator.corner.add(vector: item), placed: placed.bottom),
                        rotation: meet(frame: accumulator.right, placed: placed.right)
                    ),
                    combine: frame => placed => frame + placed
                ),
                expose: coords => { up: accumulator.up, right: accumulator.right, corner: accumulator.corner }
            ),
            initial: host,
            list: points
        )
        export(Component(
            solid: coords => place(
                host: Box(width: 100.0, depth: 60.0, height: 4.0),
                points: [
                    ${points}
                ]
            ),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        ))
    `;
    const { mesh, elapsed } = await compiledMesh(source);
    const count = triangles(mesh);
    assert.ok(count < 3000, `${count} triangles in ${elapsed} ms`);
    assert.ok(upward(mesh) < 1500, `${upward(mesh)} upward triangles`);
    assert.ok(elapsed < 1000, `${elapsed} ms, ${count} triangles`);
    assert.equal(openEdges(mesh), 0);
    assert.equal(pointInsideMesh(mesh, { x: 5, y: 5, z: 2 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 5, y: 5, z: 6 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 10, y: 30, z: 6 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 13, y: 30, z: 6 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 10, y: 40, z: 6 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 10, y: 30, z: 9 }), false);
    assert.equal(normalFault(mesh, 0.25), undefined);
});

test("a letter M of surface cylinders stays small, closed, and solid", async () => {
    const { mesh, elapsed } = await compiledMesh(letterM);
    const count = triangles(mesh);
    assert.ok(count > 100 && count < 8000, `${count} triangles in ${elapsed} ms`);
    assert.ok(upward(mesh) < 4000, `${upward(mesh)} upward triangles`);
    assert.ok(elapsed < 2000, `${elapsed} ms, ${count} triangles`);
    assert.equal(openEdges(mesh), 0);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 1 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 2, y: 2, z: 3 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 11.1, y: 10.9, z: 3 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 11.1, y: 10.9, z: 1 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 11.1, y: 10.9, z: 6 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 10.6, y: 11.5, z: 3 }), true);
    assert.equal(normalFault(mesh, 0.02), undefined);
});

test("the letter M download has no open edges", async () => {
    const { mesh } = await compiledMesh(example("m"));
    const stl = meshToStl(mesh);
    assert.equal(stl.readUInt32LE(80), triangles(mesh));
    assert.equal(openEdges(stlMesh(stl)), 0);
});

test("the M3 screw download has no open edges", async () => {
    const { mesh } = await compiledMesh(example("screw"));
    const downloaded = stlMesh(meshToStl(mesh));
    assert.equal(openEdges(downloaded), 0);
    assert.ok(Math.abs(meshVolume(downloaded) - 142.08) < 1, `${meshVolume(downloaded)}`);
});

test("the hollow box download has no open edges", async () => {
    const { mesh } = await compiledMesh(example("box"));
    const stl = meshToStl(mesh);
    const downloaded = stlMesh(stl);
    assert.equal(openEdges(downloaded), 0);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 1 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 1, y: 25, z: 15 }), true);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 20 }), false);
    assert.equal(pointInsideMesh(mesh, { x: 50, y: 25, z: 31 }), false);
    assert.ok(Math.abs(meshVolume(downloaded) - 38328) < 1, `${meshVolume(downloaded)}`);
});

test("the plate example and the car keep their solids", async () => {
    const plate = await compiledMesh(example("plate"));
    assert.equal(pointInsideMesh(plate.mesh, { x: 10, y: 10, z: 4 }), true);
    assert.equal(pointInsideMesh(plate.mesh, { x: 28, y: 28, z: 4 }), false);
    assert.equal(pointInsideMesh(plate.mesh, { x: 90, y: 50, z: 12 }), true);
    assert.equal(pointInsideMesh(plate.mesh, { x: 90, y: 50, z: 20 }), false);
    const plateStl = stlMesh(meshToStl(plate.mesh));
    assert.equal(openEdges(plateStl), 0);
    assert.ok(Math.abs(meshVolume(plateStl) - 78211) < 1, `${meshVolume(plateStl)}`);

    const car = await compiledMesh(example("car"));
    const inside = (x: number, y: number, z: number): boolean => pointInsideMesh(car.mesh, { x, y, z });
    assert.equal(inside(50, 100, 10), true);
    assert.equal(inside(20, 70, 30), true);
    assert.equal(inside(7, 158, -6), true);
    assert.equal(inside(93, 158, -6), true);
    assert.equal(inside(7, 38, -6), true);
    assert.equal(inside(93, 38, -6), true);
    assert.equal(inside(7, 168, -2), true);
    assert.equal(inside(17, 158, -2), false);
    assert.equal(inside(7, 158, -20), false);
    assert.equal(inside(-20, 0, 10), false);
    assert.equal(openEdges(stlMesh(meshToStl(car.mesh))), 0);
});
