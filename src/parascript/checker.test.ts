// ============================================================================
// PARASCRIPT AI TYPE INFERENCE TEST SUITE (Node.js Native Runner)
// ============================================================================

// @ts-ignore -- Node.js type declarations are optional in this project.
import { test } from "node:test";
// @ts-ignore -- Node.js type declarations are optional in this project.
import assert from "node:assert/strict";
import { Parser } from "./parser.js";
import { TypeInferenceEngine } from "./checker.js";
import { prune } from "./types.js";

// Helper driver to simplify running the parser + type inference engine sequence
const publishedComponent = `
    def published_part = Component(
        solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
        expose: coords => {}
    )
    export(published_part)
`;

function inferSourceEnvironment(source: string) {
    const parser = new Parser(source + publishedComponent);
    const ast = parser.parse();
    const engine = new TypeInferenceEngine();
    return engine.inferProgram(ast);
}

function assertPartialJoin(type: ReturnType<typeof prune>): void {
    assert.equal(type.tag, "Function");
    if (type.tag !== "Function") return;
    assert.equal(type.paramName, "coords");
    assert.equal(prune(type.parameter).tag, "CoordinateSystem");
    assert.equal(prune(type.returnType).tag, "Solid3D");
}

// ----------------------------------------------------------------------------
// 1. Primitive and Solid Overloaded Arithmetic Inference Verification
// ----------------------------------------------------------------------------
test("Infers Primitive Floats and Overloaded Component Arithmetic", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def scalar_a = 40.0
        def scalar_b = 10.0
        def combined_scalar = scalar_a + scalar_b

        def Block = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x:u, y:v, z:0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )

        def instance_a = Block
        def instance_b = Block
        def mate = align(
            planar: meet(frame: Block.up, placed: Block.up),
            translation: meet(frame: Block.at, placed: Block.at),
            rotation: meet(frame: Block.up, placed: Block.up)
        )

        def span = scalar_a - scalar_b
        def subtracted_geometry = join(frame: instance_a, placed: instance_b, using: frame => placed => mate, combine: frame => placed => frame - placed)
    `;
    
    const env = inferSourceEnvironment(source);

    // Verify primitive scalar math paths
    const scalarType = prune(env.lookup("combined_scalar").type);
    assert.equal(scalarType.tag, "Float");

    // Verify uniform operator overloading resolving components cleanly
    const geometryType = prune(env.lookup("subtracted_geometry").type);
    assertPartialJoin(geometryType);
});

// ----------------------------------------------------------------------------
// 2. Curried Named Function Keyword Verification Protection
// ----------------------------------------------------------------------------
test("Successfully Resolves Curried Named Call Expressions", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def MockPart = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x:u, y:v, z:0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )

        def part_frame  = MockPart
        def part_placed = MockPart

        def mock_normal = MockPart.up
        def mock_pos    = MockPart.at
        
        def rigid_constraint = align(
            planar: meet(frame: mock_normal, placed: mock_normal),
            translation: meet(frame: mock_pos, placed: mock_pos),
            rotation: meet(frame: mock_normal, placed: mock_normal)
        )
        
        def completed_assembly = join(
            frame: part_frame,
            placed: part_placed,
            using: frame => placed => rigid_constraint,
            combine: frame => placed => frame + placed
        )
    `;

    const env = inferSourceEnvironment(source);
    const assemblyType = prune(env.lookup("completed_assembly").type);

    assertPartialJoin(assemblyType);
});

// ----------------------------------------------------------------------------
// 3. Strict Compile-Time Keyword Catch Protection
// ----------------------------------------------------------------------------
test("Compiler Catches and Rejects Invalid Keyword Arguments", () => {
    const invalidKeywordSource = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def broken_call = align(
            planar: meet(frame: Mark.up, placed: Mark.up),
            slide: meet(frame: Mark.at, placed: Mark.at),
            rotation: meet(frame: Mark.up, placed: Mark.up)
        )
    `;

    assert.throws(() => {
        inferSourceEnvironment(invalidKeywordSource);
    }, /Type Inference Error: Keyword Argument Mismatch/);
});

// ----------------------------------------------------------------------------
// 4. Array Patterns and Structural Cons Operator Matching
// ----------------------------------------------------------------------------
test("Infers Chained Cons Lists and Unifies Destructuring Matches", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def tail_array = [1.0]
        def expanded_array = 10.0 :: tail_array
        
        def matched_output = match expanded_array {
            [] => 0.0,
            head :: tail => head
        }
    `;

    const env = inferSourceEnvironment(source);

    const arrayType = prune(env.lookup("expanded_array").type) as any;
    assert.equal(arrayType.tag, "Array");
    assert.equal(arrayType.elementType.tag, "Float");

    const matchType = prune(env.lookup("matched_output").type);
    assert.equal(matchType.tag, "Float");
});

// ----------------------------------------------------------------------------
// 5. Derivative Smoothness Pipeline Enforcement Guard
// ----------------------------------------------------------------------------
test("Verifies Analytical Derivative Functions Match Smooth Manifolds", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def flat_surface = Surface2D(
            max_u: 10.0,
            min_v: u => 0.0, max_v: u => 10.0,
            formula: u => v => Origin.at
        )
        
        def normal_direction = normal(u: 0.0, v: 0.0, surface: flat_surface)
    `;

    const env = inferSourceEnvironment(source);
    const resolvedNormalType = prune(env.lookup("normal_direction").type);
    
    assert.equal(resolvedNormalType.tag, "Vector");
});

// ----------------------------------------------------------------------------
// 6. Let-Polymorphism Generalisation & Instantiation
// ----------------------------------------------------------------------------
test("Enforces Let-Polymorphism Generalisation and Multiple Instantiation", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        // Generic identity lambda: a => a (Inferred as alpha -> alpha)
        def identity = x => x
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 1.0, y: 2.0, z: 3.0) }
        )

        // Instantiated with a Float
        def float_instance = identity(x: 42.0)

        // Instantiated with a Vector
        def vector_instance = identity(x: Origin.at)
    `;

    const env = inferSourceEnvironment(source);
    
    const floatType = prune(env.lookup("float_instance").type);
    assert.equal(floatType.tag, "Float");

    const vectorType = prune(env.lookup("vector_instance").type);
    assert.equal(vectorType.tag, "Vector");
});

test("a repeated name in a signature is one type variable", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                up: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)
            }
        )
        def same: T => T => number = x => y => 1.0
        def floats = same(x: 1.0, y: 2.0)
        def vectors = same(x: Origin.at, y: Origin.up)
        def different: A => B => number = x => y => 1.0
        def mixed = different(x: 1.0, y: Origin.at)
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("floats").type).tag, "Float");
    assert.equal(prune(env.lookup("vectors").type).tag, "Float");
    assert.equal(prune(env.lookup("mixed").type).tag, "Float");
});

test("a shared signature variable rejects a call with two types", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def same: T => T => number = x => y => 1.0
        def mixed = same(x: 1.0, y: Origin.at)
    `;
    assert.throws(() => inferSourceEnvironment(source), /Structural Unification Mismatch/);
});

test("a signature is checked against the body", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def id: T => number = x => Origin.at
    `;
    assert.throws(() => inferSourceEnvironment(source), /'id' does not match its signature/);
});

test("a named signature parameter must match the value", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def map: (item: T => U) => (list: [T]) => [U] = f => list => match list {
            [] => [],
            head :: tail => f(item: head) :: map(f: f, list: tail)
        }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def numbers = map(f: item => item * 2.0, list: [1.0, 2.0])
        def points = map(f: item => Origin.at, list: [1.0, 2.0])
    `;
    const env = inferSourceEnvironment(source);
    const numbers = prune(env.lookup("numbers").type);
    const points = prune(env.lookup("points").type);
    assert.equal(numbers.tag, "Array");
    assert.equal(points.tag, "Array");
    if (numbers.tag === "Array") assert.equal(prune(numbers.elementType).tag, "Float");
    if (points.tag === "Array") assert.equal(prune(points.elementType).tag, "Vector");

    const mismatch = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def same: a: T => b: T => number = x => y => 1.0
    `;
    assert.throws(() => inferSourceEnvironment(mismatch), /'same' does not match its signature/);
});

test("a parameters group is a record and a later field can read an earlier one", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters {
            plate: {
                size: 100.0,
                thickness: size / 12.0,
                holes: { pitch: size / 8.0 }
            },
            span: $plate.holes.pitch
        }
        def width = $plate.size
        def pitch = $plate.holes.pitch
        def measured = $span
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("width").type).tag, "Float");
    assert.equal(prune(env.lookup("pitch").type).tag, "Float");
    assert.equal(prune(env.lookup("measured").type).tag, "Float");
    assert.throws(() => env.lookup("plate"), /Unbound identifier/);
});

test("a missing parameter field is an error", () => {
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters { plate: { size: 100.0 } }
        def missing = $plate.depth
    `), /'depth' is not a field of \$plate\. \$plate has size\./);
});

test("a parameter name is bound once in its group", () => {
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters { plate: { size: 1.0, size: 2.0 } }
    `), /'size' is already a parameter in this group/);
});

test("a parameter field and a component anchor are different reads", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters { plate: { size: 100.0 } }
        def Mark = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: $plate.size, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def width = $plate.size
        def origin = Mark.origin
        def same_name = plate => $plate.size
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("width").type).tag, "Float");
    assert.equal(prune(env.lookup("origin").type).tag, "Vector");
    const sameName = prune(env.lookup("same_name").type);
    assert.equal(sameName.tag, "Function");
    if (sameName.tag === "Function") assert.equal(prune(sameName.returnType).tag, "Float");
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters { plate: { size: 100.0 } }
        def bare = plate
    `), /Unbound identifier/);
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        parameters { plate: { size: 100.0 } }
        def missing = $holes
    `), /'\$holes' is not a parameter/);
});

// ----------------------------------------------------------------------------
// 7. Polymorphic Array Structure Verification
// ----------------------------------------------------------------------------
test("Infers Types Across Fully Polymorphic Destructuring Blocks", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        // Generic utility returning the first element of an arbitrary array
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def head_extractor = list => match list {
            [] => Origin.at,
            head :: tail => head
        }
    `;

    const env = inferSourceEnvironment(source);
    const fnType = prune(env.lookup("head_extractor").type) as any;

    assert.equal(fnType.tag, "Function");

    const paramType = prune(fnType.parameter) as any;
    assert.equal(paramType.tag, "Array");
    
    const innerElementType = prune(paramType.elementType);
    assert.equal(innerElementType.tag, "Vector");
    
    const returnType = prune(fnType.returnType);
    assert.equal(returnType.tag, "Vector");
});

// ----------------------------------------------------------------------------
// 8. Basic Primitive Unification Firewall Protection
// ----------------------------------------------------------------------------
test("Engine Correctly Rejects Static Primitive Unification Mismatches", () => {
    // Failure Case: Attempting to run uniform math arithmetic over incompatible types
    const invalidUnificationSource = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def invalid_math = 10.0 + "unsupported_string"
    `;

    assert.throws(() => {
        inferSourceEnvironment(invalidUnificationSource);
    }, /Type Inference Error: Structural Unification Mismatch/);
});

test("A script must export a component", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def size = 1.0
    `;
    const engine = new TypeInferenceEngine();
    assert.throws(() => {
        engine.inferProgram(new Parser(source).parse());
    }, /Type Inference Error: A script must export a component/);
});

test("Export and geometric operators require components", () => {
    const rawSolid = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        export(Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Origin.at)]))
    `;
    const engine = new TypeInferenceEngine();
    assert.throws(() => {
        engine.inferProgram(new Parser(rawSolid).parse());
    }, /Type Inference Error: Structural Unification Mismatch/);

    const rawDifference = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
            }
        )
        def cut = Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Origin.at)]) - Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Origin.up)])
    `;
    assert.throws(() => {
        inferSourceEnvironment(rawDifference);
    }, /Type Inference Error: Operator '-' is only defined for SeatedSolid3D/);
});

test("Geometric operators exist only inside their join", () => {
    const block = `
        def Block = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
    `;
    const mate = `
        def mate = align(
            planar: meet(frame: Block.up, placed: Block.up),
            translation: meet(frame: Block.at, placed: Block.at),
            rotation: meet(frame: Block.up, placed: Block.up)
        )
    `;
    const outside = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def cut = Block - Block
    `;
    assert.throws(() => {
        inferSourceEnvironment(outside);
    }, /Type Inference Error: Operator '-' is only defined for SeatedSolid3D/);

    const combined = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => (frame + placed) - frame)
    `;
    const env = inferSourceEnvironment(combined);
    assertPartialJoin(prune(env.lookup("cut").type));

    const seatedMember = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => join(
            frame: frame + placed,
            placed: Block,
            using: frame => placed => mate,
            combine: frame => placed => frame - placed
        ))
    `;
    assert.throws(() => {
        inferSourceEnvironment(seatedMember);
    }, /Type Inference Error: join frame must be a component/);

    const crossed = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => join(
            frame: Block,
            placed: Block,
            using: frame => placed => mate,
            combine: frame => placed => frame + placed
        ) - (frame + placed))
    `;
    assert.throws(() => {
        inferSourceEnvironment(crossed);
    }, /Type Inference Error: Operator '-' is only defined for SeatedSolid3D/);

    const numberResult = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => 1.0 - 0.5)
    `;
    assert.throws(() => {
        inferSourceEnvironment(numberResult);
    }, /Type Inference Error: combine is frame => placed => SeatedSolid3D/);

    const passed = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def place = host => placed => combine => join(
            frame: host,
            placed: placed,
            using: frame => placed => mate,
            combine: combine
        )
        def kept = place(host: Block, placed: Block, combine: frame => placed => frame + placed)
        def cut = place(host: Block, placed: Block, combine: frame => placed => frame - placed)
    `;
    const passedEnv = inferSourceEnvironment(passed);
    assertPartialJoin(prune(passedEnv.lookup("kept").type));
    assertPartialJoin(prune(passedEnv.lookup("cut").type));

    const namedOutside = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def place = host => placed => combine => join(
            frame: host,
            placed: placed,
            using: frame => placed => mate,
            combine: combine
        )
        def keep = frame => placed => frame + placed
        def kept = place(host: Block, placed: Block, combine: keep)
    `;
    assert.throws(() => {
        inferSourceEnvironment(namedOutside);
    }, /Type Inference Error: Structural Unification Mismatch. Cannot resolve type structure 'SeatedSolid3D' with target contract type 'Float'/);
});

test("A join seats parts by the anchors they expose", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Outer = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                cavity: Vector(coords: coords, x: 1.0, y: 1.0, z: 1.0),
                mating_crosshair: l => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def Void = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
                seat: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def cut = join(frame: Outer, placed: Void, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.cavity, placed: placed.seat),
            rotation: meet(frame: frame.right, placed: placed.right)
        ), combine: frame => placed => frame - placed)
    `;
    const env = inferSourceEnvironment(source);
    assertPartialJoin(prune(env.lookup("cut").type));
    const outer = prune(env.lookup("Outer").type);
    assert.equal(outer.tag, "Component");
    if (outer.tag === "Component") assert.deepEqual([...outer.anchors], ["up", "right", "cavity", "mating_crosshair"]);
});

test("a function may join the component it receives", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Block = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))
            ]),
            expose: coords => {
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
                at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)
            }
        )
        def cut = host => Component(
            solid: join(frame: host, placed: Block, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.at, placed: placed.at),
                rotation: meet(frame: frame.right, placed: placed.right)
            ), combine: frame => placed => frame - placed),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0) }
        )
        def done = cut(host: Block)
        export(done)
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("done").type).tag, "Component");
});

test("a function may read the anchors of the component it receives", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: [
                Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))
            ]),
            expose: coords => {
                origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                top: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
            }
        )
        def read = part => part.origin.add(vector: part.top)
        def point = read(part: Mark)
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("point").type).tag, "Vector");
    assert.throws(() => {
        inferSourceEnvironment(`
            setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
            def Mark = Component(
                solid: coords => Solid3D(faces: [
                    Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))
                ]),
                expose: coords => { origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
            )
            def read = part => part.origin.add(vector: part.top)
            def point = read(part: Mark)
        `);
    }, /'top' is not an anchor on Mark\. Mark exposes origin\./);
});

test("Member access only reads an exposed anchor", () => {
    const brick = `
        def Brick = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { seat: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
    `;
    assert.throws(() => {
        inferSourceEnvironment(`
            setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
            ${brick}
            def missing = Brick.lip
        `);
    }, /'lip' is not an anchor on Brick\. Brick exposes seat\./);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
            ${brick}
            def mate = align(
                planar: meet(frame: Brick.seat, placed: Brick.seat),
                translation: meet(frame: Brick.seat, placed: Brick.seat),
                rotation: meet(frame: Brick.seat, placed: Brick.seat)
            )
            def cut = join(frame: Brick, placed: Brick, using: frame => placed => mate, combine: frame => placed => frame.seat)
        `);
    }, /'seat' is not an anchor on frame\. frame is a seated solid, so its anchors are not visible\./);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
            def Brick = Component(
                solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
                expose: coords => {
                    seat: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
                    seat: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)
                }
            )
        `);
    }, /Anchor 'seat' is already exposed/);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
            def Brick = Component(
                solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
                expose: coords => { shell: 1.0 }
            )
        `);
    }, /Type Inference Error: Structural Unification Mismatch/);
});

test("let names a value for the following expression", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Origin = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def wider = radius => let doubled = radius * 2.0 in doubled
        def width = wider(radius: 3.0)
        def face = radius => let cap = Surface2D(max_u: radius, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Origin.at) in cap
        def disk = face(radius: 4.0)
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("width").type).tag, "Float");
    assert.equal(prune(env.lookup("disk").type).tag, "Surface2D");
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def loop = let f = x => f(x: x) in f(x: 1.0)
    `), /Unbound identifier/);
});

test("an anchor error names the component, the read, and the source location", () => {
    const source = [
        'setup { name: "Model", units: "mm", coordinate_system: "Z-up" }',
        "def Box = Component(",
        "    solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),",
        "    expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0), corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }",
        ")",
        "def missing = Box.top"
    ].join("\n");
    const lines = source.split("\n");
    const line = lines.findIndex((item) => item.includes("Box.top")) + 1;
    const column = (lines[line - 1] ?? "").indexOf(".top") + 2;
    assert.throws(
        () => inferSourceEnvironment(source),
        new RegExp(`'top' is not an anchor on Box\\. Box exposes up and corner\\. at line ${line}, col ${column}\\.`)
    );

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Box = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0), corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def Hole = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0), bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0), right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0) }
        )
        def collar = join(frame: Box, placed: Hole, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.top, placed: placed.bottom),
            rotation: meet(frame: frame.right, placed: placed.right)
        ), combine: frame => placed => frame + placed)
    `), /'top' is not an anchor on Box, read from frame\.top\. Box exposes up and corner\./);
});

test("a component receives one coordinate system named coords", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0) }
        )
        def direction = Mark.up
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("direction").type).tag, "Vector");
});

test("a vector outside a component cannot see coords", () => {
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def up = Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
    `), /Unbound identifier 'coords'/);
});

test("solid and expose are coords functions", () => {
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: Solid3D(faces: []),
            expose: coords => {}
        )
    `), /Component solid is coords => solid/);
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: []),
            expose: {}
        )
    `), /Component expose is coords => \{ anchors \}/);
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: system => Solid3D(faces: []),
            expose: coords => {}
        )
    `), /Expected named parameter identifier 'coords', but found key name 'system'/);
});

test("vector coords is a coordinate system", () => {
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def Mark = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: 1.0, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => {}
        )
    `), /Vector coords is a coordinate system/);

    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def offset: coordinate_system => vector = coords => Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)
        def Mark = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => offset(coords: coords))]),
            expose: coords => {}
        )
    `;
    const offset = prune(inferSourceEnvironment(source).lookup("offset").type);
    assert.equal(offset.tag, "Function");
    if (offset.tag === "Function") assert.equal(prune(offset.parameter).tag, "CoordinateSystem");
});

test("join is a function of the coordinate system, and a component does not expose it", () => {
    const block = `
        def Block = Component(
            solid: coords => Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0))]),
            expose: coords => { up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0) }
        )
    `;
    const joined = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def Pair = Component(
            solid: join(frame: Block, placed: Block, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.up.offset(x: 0.0, y: 0.0, z: 1.0), placed: placed.up),
                rotation: meet(frame: frame.up, placed: placed.up)
            ), combine: frame => placed => frame + placed),
            expose: coords => { up: Block.up }
        )
    `;
    const env = inferSourceEnvironment(joined);
    const pair = prune(env.lookup("Pair").type);
    assert.equal(pair.tag, "Component");
    if (pair.tag === "Component") assert.deepEqual([...pair.anchors], ["up"]);
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def system = Block.coords
    `), /A component does not expose its coordinate system/);

    const applied = prune(inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def cut = coords => join(frame: Block, placed: Block, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.up, placed: placed.up),
            rotation: meet(frame: frame.up, placed: placed.up)
        ), combine: frame => placed => frame - placed, coords: coords)
    `).lookup("cut").type);
    assert.equal(applied.tag, "Function");
    if (applied.tag === "Function") assert.equal(prune(applied.returnType).tag, "Solid3D");

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def Wrapped = Component(
            solid: coords => join(frame: Block, placed: Block, using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.up, placed: placed.up),
                rotation: meet(frame: frame.up, placed: placed.up)
            ), combine: frame => placed => frame - placed),
            expose: coords => {}
        )
    `), /join takes the coordinate system, so solid is join\(\.\.\.\)/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def Named = Component(
            solid: coords => Solid3D(faces: []),
            expose: coords => { coords: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
    `), /Anchor 'coords' is the component's coordinate system/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def cut = join(frame: Block, placed: Block, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.up, placed: placed.up),
            rotation: meet(frame: frame.up, placed: placed.up)
        ), combine: frame => placed => frame - placed, coords: 1.0)
    `), /join coords is a coordinate system/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def cut = join(frame: Block, placed: Block, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.up, placed: placed.up),
            rotation: meet(frame: frame.up, placed: placed.up)
        ), combine: frame => placed => frame.coords)
    `), /A component does not expose its coordinate system/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def read = part => part.coords
        def system = read(part: Block)
    `), /A component does not expose its coordinate system/);
});

test("vector methods keep one coordinate system and operators stay numeric", () => {
    const block = `
        def Block = Component(
            solid: coords => Solid3D(faces: []),
            expose: coords => {
                at: Vector(coords: coords, x: 1.0, y: 2.0, z: 3.0),
                up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
            }
        )
    `;
    const env = inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def moved = Block.at.offset(x: 10.0, y: 0.0, z: 0.0 - 1.0)
        def sum = Block.at.add(vector: Block.up)
        def gap = Block.at.subtract(vector: Block.up)
        def shift = point => point.offset(x: 1.0, y: 0.0, z: 0.0)
    `);
    assert.equal(prune(env.lookup("moved").type).tag, "Vector");
    assert.equal(prune(env.lookup("sum").type).tag, "Vector");
    assert.equal(prune(env.lookup("gap").type).tag, "Vector");
    const shift = prune(env.lookup("shift").type);
    assert.equal(shift.tag, "Function");
    if (shift.tag === "Function") {
        assert.equal(prune(shift.parameter).tag, "Vector");
        assert.equal(prune(shift.returnType).tag, "Vector");
    }

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.at + Block.up
    `), /Operator '\+' does not combine vectors\. Use add\(vector:\)/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.at - Block.up
    `), /Operator '-' does not combine vectors\. Use subtract\(vector:\)/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.offset(x: 1.0, y: 0.0, z: 0.0)
    `), /'offset' is a method on a vector/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.at.scale(x: 1.0, y: 0.0, z: 0.0)
    `), /'scale' is not a vector method/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.at.offset(y: 1.0, x: 0.0, z: 0.0)
    `), /Expected named parameter identifier 'x'/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        ${block}
        def bad = Block.at.add(right: Block.up)
    `), /Expected named parameter identifier 'vector'/);
});

test("integers is a list of numbers from a start and a count", () => {
    const source = `
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def indexes = integers(start: 0.0, count: 5.0)
        def waiting = integers(start: 0.0)
    `;
    const env = inferSourceEnvironment(source);
    const indexes = prune(env.lookup("indexes").type);
    const waiting = prune(env.lookup("waiting").type);
    assert.equal(indexes.tag, "Array");
    if (indexes.tag === "Array") assert.equal(prune(indexes.elementType).tag, "Float");
    assert.equal(waiting.tag, "Function");
    if (waiting.tag === "Function") {
        assert.equal(waiting.paramName, "count");
        assert.equal(prune(waiting.returnType).tag, "Array");
    }
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def bad = integers(from: 0.0, count: 1.0)
    `), /Expected named parameter identifier 'start'/);
    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def bad = integers(start: true, count: 1.0)
    `), /Structural Unification Mismatch/);
});

test("a tuple keeps each value's type and let takes it apart", () => {
    const env = inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def pair: (number, boolean) = (1.0, true)
        def nested = (1.0, (2.0, 3.0))
        def sum = let (x, (y, z)) = nested in x + y + z
        def first: (T, U) => T = pair => let (x, y) = pair in x
        def same: (T, T) => T = pair => let (x, y) = pair in x
    `);
    const pair = prune(env.lookup("pair").type);
    assert.equal(pair.tag, "Tuple");
    if (pair.tag === "Tuple") {
        assert.equal(prune(pair.elements[0] ?? pair).tag, "Float");
        assert.equal(prune(pair.elements[1] ?? pair).tag, "Boolean");
    }
    assert.equal(prune(env.lookup("sum").type).tag, "Float");
    const first = prune(env.lookup("first").type);
    assert.equal(first.tag, "Function");
    if (first.tag === "Function") {
        assert.equal(prune(first.parameter).tag, "Tuple");
        assert.equal(prune(first.returnType).tag, "Variable");
    }
    inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def first = pair => let (x, y) = pair in x
        def n = first(pair: (1.0, true))
        def Mark = Component(
            solid: coords => Solid3D(faces: []),
            expose: coords => { at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0) }
        )
        def point = first(pair: (Mark.at, 2.0))
    `);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def same: (T, T) => T = pair => let (x, y) = pair in x
        def bad = same(pair: (1.0, true))
    `), /does not match its signature|Structural Unification Mismatch|A tuple of/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def bad = let (x, y) = 1.0 in x
    `), /let takes a tuple apart with \(x, y\)/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def bad = let (x, y) = (1.0, 2.0, 3.0) in x
    `), /This tuple has 3 values\. The pattern has 2\./);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def bad = let (x, x) = (1.0, 2.0) in x
    `), /'x' is already bound in this tuple/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def wide: (number, number, number) = (1.0, 2.0)
    `), /A tuple of 2 values does not match a tuple of 3 values/);
});

test("Box, Cylinder, Sphere, and fold are in the standard library", () => {
    inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def brick = Box(width: 10.0, depth: 20.0, height: 30.0)
        def top = brick.top
        def rod = Cylinder(radius: 4.0, height: 12.0)
        def forward = rod.forward
        def ball = Sphere(radius: 8.0)
        def pole = ball.top
        def total = fold(f: item => accumulator => accumulator + item, initial: 0.0, list: [1.0, 2.0])
    `);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def ball = Sphere(radius: 8.0)
        def missing = ball.corner
    `), /'corner' is not an anchor/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def brick = Box(width: 10.0, depth: 20.0, height: 30.0)
        def missing = brick.forward
    `), /'forward' is not an anchor/);

    assert.throws(() => inferSourceEnvironment(`
        setup { name: "Model", units: "mm", coordinate_system: "Z-up" }
        def total = fold(f: head => accumulator => head, initial: 0.0, list: [1.0])
    `), /Expected named parameter identifier 'item'/);
});
