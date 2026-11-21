// ============================================================================
// PARASCRIPT AI CODE GENERATOR COMPILER TEST SUITE (Node.js Native Runner)
// ============================================================================

// @ts-ignore -- Node.js type declarations are optional in this project.
import { test } from "node:test";
// @ts-ignore -- Node.js type declarations are optional in this project.
import assert from "node:assert/strict";
import { Parser } from "./parser.js";
import { WebCodeGenerator } from "./codegen.js";
import type { TypeEnvironment } from "./types.js";
import { TypeInferenceEngine } from "./checker.js";
import { vectorOps } from "./vector-ops.js";

function inferSourceEnvironment(source: string): TypeEnvironment {
    // 1. Initialize the lazy streaming Lexer and Recursive Descent Parser
    const parser = new Parser(source);
    
    // 2. Transpile the string stream into a structured Abstract Syntax Tree (AST) node tree
    const ast = parser.parse();
    
    // 3. Instantiate a fresh, clean Algorithm W Hindley-Milner type inference checking engine
    const engine = new TypeInferenceEngine();
    
    // 4. Trace and unify variable constraint polytype schemas across all statement scopes
    return engine.inferProgram(ast);
}

test("Code Generator Compiles AST into Live Executable JavaScript", () => {
    // Enforces the strict named parameter keys required by the parser grammar
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def initial_radius = 25.0
        def custom_surface = Surface2D(
            max_u: 6.28,
            min_v: u => 0.0, max_v: u => 3.14,
            formula: u => v => Vector(coords: coords, x: initial_radius * cos(rad: u), y: initial_radius * sin(rad: v), z: 0.0)
        )
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    
    const generator = new WebCodeGenerator();
    const generatedJs = generator.generate(ast);

    // Verify structural invariants exist within the transpiled output script target string
    assert.ok(generatedJs.includes("export function executeModelPipeline()"));
    assert.equal(generatedJs.includes("THREE"), false);
    assert.ok(generatedJs.includes("Math.cos"));
    assert.equal(generatedJs.includes("env.u"), false);
    assert.equal(generatedJs.includes("env.v"), false);
    const surface = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    const point = surface.formula(0)(1.5708);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
    assert.ok(Math.abs(point.x - 25) < 0.01);
    assert.ok(generatedJs.includes("Math.sin"));
    assert.ok(generatedJs.includes("tag: \"Surface2D\""));
    assert.ok(generatedJs.includes("=> ({ tag: \"Vector\""));
    assert.doesNotThrow(() => {
        new Function(generatedJs.replace("export function", "function"));
    });
});

test(">> runs the left function first and keeps its parameter name", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def shift = d => x => x + d
        def scale = k => x => k * x
        def adjust = shift(d: 3.0) >> scale(k: 2.0)
        def Mark = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: adjust(x: 4.0),
                    min_v: u => 0.0, max_v: u => 1.0,
                    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
                )
            ]),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Mark)
    `;
    inferSourceEnvironment(source);
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(mark.geometry.faces[0].maxU, 14);

    assert.throws(() => inferSourceEnvironment(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def shift = d => x => x + d
        def bad = shift(d: 1.0) >> 2.0
        export(Mark)
    `), />> composes two functions/);
});

test("|> fills the function's next argument", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def sum = list => match list {
            [] => 0.0,
            head :: tail => head + sum(list: tail)
        }
        def shift = d => x => x + d
        def scale = k => x => k * x
        def numbers = [1.0, 2.0, 3.0]
            |> map(f: item => item * 2.0)
            |> filter(predicate: item => true)
        def Mark = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: sum(list: numbers) + (4.0 |> shift(d: 3.0) >> scale(k: 2.0)),
                    min_v: u => 0.0, max_v: u => 1.0,
                    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
                )
            ]),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Mark)
    `;
    inferSourceEnvironment(source);
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(mark.geometry.faces[0].maxU, 26);
    assert.throws(() => inferSourceEnvironment(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def bad = 1.0 |> 2.0
        export(Mark)
    `), /\|> pipes a value into a function/);
});

test("map and filter are standard list functions", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def sum = list => match list {
            [] => 0.0,
            head :: tail => head + sum(list: tail)
        }
        def doubled = map(f: item => item * 2.0, list: [1.0, 2.0, 3.0])
        def kept = filter(predicate: item => true, list: [10.0])
        def dropped = filter(predicate: item => false, list: [100.0])
        def Mark = Component(
            solid: coords => let shifted = map(f: item => Vector(coords: coords, x: item, y: 0.0, z: 0.0), list: [4.0, 5.0]) in Solid3D(faces: [
                Surface2D(
                    max_u: sum(list: doubled) + sum(list: kept) + sum(list: dropped),
                    min_v: u => 0.0, max_v: u => 1.0,
                    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
                )
            ]),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Mark)
    `;
    inferSourceEnvironment(source);
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(mark.geometry.faces[0].maxU, 22);
    const rejected = `
        def Mark = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))
            ]),
            expose: coords => {}
        )
        export(Mark)
    `;
    assert.throws(() => inferSourceEnvironment(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def bad = map(f: value => value, list: [1.0])
        ${rejected}
    `), /Keyword Argument Mismatch/);
    assert.throws(() => inferSourceEnvironment(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def bad = filter(predicate: item => item, list: [1.0])
        ${rejected}
    `), /Structural Unification Mismatch/);
});

test("a call applies each argument of a curried function", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def box = width => depth => height => width + depth + height
        def sum = box(width: 10.0, depth: 4.0, height: 7.0)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const generatedJs = new WebCodeGenerator().generate(ast);
    assert.match(generatedJs, /env\.box\(10\)\(4\)\(7\)/);
    const sum = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(sum, 21);
});

test("a parameter field is the value the script reads", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        parameters {
            plate: {
                size: 100.0,
                thickness: size / 10.0,
                holes: {
                    pitch: size / 8.0,
                    size: size / 2.0
                }
            }
        }
        def Mark = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: $plate.thickness + $plate.holes.pitch + $plate.holes.size,
                    min_v: u => 0.0, max_v: u => 1.0,
                    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
                )
            ]),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Mark)
    `;
    inferSourceEnvironment(source);
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(mark.geometry.faces[0].maxU, 72.5);
});

test("Code Generator Handles Overloaded Geometric Composition and Mating Operators", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Bracket = Component(
            solid: coords => Solid3D(faces: Array()),
            expose: coords => {}
        )
        def part_a = Bracket
        def part_b = Bracket
        def combined_manifold = join(frame: part_a, placed: part_b, using: frame => placed => mate, combine: frame => placed => frame - placed)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    
    const generator = new WebCodeGenerator();
    const generatedJs = generator.generate(ast);

    assert.match(generatedJs, /\(__psJoinCoords\) =>/);
    assert.ok(generatedJs.includes('op: "subtract"'));
    assert.ok(generatedJs.includes('tag: "Component"'));
    assert.ok(generatedJs.includes('tag: "Part"'));
    assert.match(generatedJs, /domainEnv\d+\.frame = env\.part_a/);
    assert.match(generatedJs, /domainEnv\d+\.placed = env\.part_b/);
    assert.match(generatedJs, /domainEnv\d+\.using = applyMate\(\(frame\) => \(\(placed\) => \(domainEnv\d+\.mate\)\), domainEnv\d+\.frame, domainEnv\d+\.placed\)/);
    assert.match(generatedJs, /domainEnv\d+\.placed = placeAgainst\(domainEnv\d+\.frame, domainEnv\d+\.placed, domainEnv\d+\.using\)/);
    assert.match(generatedJs, /domainEnv\d+\.frame = asSolid\(domainEnv\d+\.frame\)/);
    assert.match(generatedJs, /domainEnv\d+\.frame, domainEnv\d+\.placed/);
});

test("vector add and subtract require one coordinate system", () => {
    const ops = vectorOps();
    const here = { tag: "CoordinateSystem" };
    const there = { tag: "CoordinateSystem" };
    const left = { tag: "Vector", coords: here, x: 1, y: 2, z: 3 };
    const right = { tag: "Vector", coords: here, x: 4, y: 0, z: 1 };
    const other = { tag: "Vector", coords: there, x: 4, y: 0, z: 1 };
    assert.deepEqual(ops.offsetVector(left, 10, 0, -1), { tag: "Vector", coords: here, x: 11, y: 2, z: 2 });
    assert.deepEqual(ops.addVectors(left, right), { tag: "Vector", coords: here, x: 5, y: 2, z: 4 });
    assert.deepEqual(ops.subtractVectors(left, right), { tag: "Vector", coords: here, x: -3, y: 2, z: 2 });
    assert.throws(() => ops.addVectors(left, other), /Vector add needs one coordinate system/);
    assert.throws(() => ops.subtractVectors(left, other), /Vector subtract needs one coordinate system/);

    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: []),
            expose: coords => {
                at: Vector(coords: coords, x: 1.0, y: 2.0, z: 3.0).offset(x: 10.0, y: 0.0, z: 0.0 - 1.0),
                sum: Vector(coords: coords, x: 1.0, y: 2.0, z: 3.0).add(vector: Vector(coords: coords, x: 4.0, y: 0.0, z: 1.0))
            }
        )
        export(Mark)
    `;
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    assert.match(generatedJs, /offsetVector\(/);
    assert.match(generatedJs, /addVectors\(/);
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)() as {
        anchors: { at: { x: number; y: number; z: number }; sum: { x: number; y: number; z: number } };
    };
    assert.deepEqual([mark.anchors.at.x, mark.anchors.at.y, mark.anchors.at.z], [11, 2, 2]);
    assert.deepEqual([mark.anchors.sum.x, mark.anchors.sum.y, mark.anchors.sum.z], [5, 2, 4]);
});

test("let names a value and a component can be published again", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Cap = radius =>
            let span = radius * 2.0 in
            Component(
                solid: coords => Solid3D(faces: [
                    Surface2D(max_u: span, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0))
                ]),
                expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
            )
        def Again = let part = Cap(radius: 5.0) in Component(
            solid: coords => part,
            expose: coords => { origin: part.origin }
        )
        export(Again)
    `;
    inferSourceEnvironment(source);
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const mark = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(mark.geometry.faces[0].maxU, 10);
});

// ----------------------------------------------------------------------------
// 9. Keyword Argument Mismatch Boundary Protection
// ----------------------------------------------------------------------------
test("Type Inference Engine Catches and Rejects Mathematical Keyword Mismatches", () => {
    // Failure Case: 'sin' expects 'rad:', but the script incorrectly supplies 'v:'
    const invalidMathKeywordSource = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def sphere_radius = 25.0
        def Bad = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(
                    max_u: 6.28,
                    min_v: u => 0.0, max_v: u => 3.14,
                    formula: u => v => Vector(coords: coords,
                        x: sphere_radius * cos(rad: u) * sin(rad: v),
                        y: sphere_radius * sin(rad: u) * sin(v: v),
                        z: sphere_radius * cos(rad: v)
                    )
                )
            ]),
            expose: coords => {}
        )
    `;

    // Assert that Algorithm W intercepts the structural fault and throws the expected contract error
    assert.throws(() => {
        inferSourceEnvironment(invalidMathKeywordSource);
    }, /Type Inference Error: Keyword Argument Mismatch\. Expected named parameter identifier 'rad', but found key name 'v'/);
});

test("integers lists whole numbers from a start and a count", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def samples = (
            integers(start: 0.0, count: 5.0),
            integers(start: 0.0 - 2.0, count: 3.0),
            integers(start: 4.0, count: 0.0),
            5.0 |> integers(start: 1.0)
        )
    `;
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const samples = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.deepEqual(samples.elements, [
        [0, 1, 2, 3, 4],
        [-2, -1, 0],
        [],
        [1, 2, 3, 4, 5],
    ]);

    const fractional = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def values = integers(start: 1.5, count: 2.0)
    `;
    const fractionalJs = new WebCodeGenerator().generate(new Parser(fractional).parse());
    assert.throws(() => {
        new Function(`${fractionalJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    }, /integers start is a whole number/);

    const negative = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def values = integers(start: 0.0, count: 0.0 - 1.0)
    `;
    const negativeJs = new WebCodeGenerator().generate(new Parser(negative).parse());
    assert.throws(() => {
        new Function(`${negativeJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    }, /integers count is a whole number, zero or more/);
});

test("a tuple evaluates to its elements", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def nested = (1.0, (2.0, 3.0))
        def sum = let (x, (y, z)) = nested in x + y + z
    `;
    const generatedJs = new WebCodeGenerator().generate(new Parser(source).parse());
    const sum = new Function(`${generatedJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    assert.equal(sum, 6);

    const broken = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def sum = let (x, y) = 1.0 in x
    `;
    const brokenJs = new WebCodeGenerator().generate(new Parser(broken).parse());
    assert.throws(() => {
        new Function(`${brokenJs.replace("export function", "function")}\nreturn executeModelPipeline();`)();
    }, /This value is not a tuple of 2 values/);
});
