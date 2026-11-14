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
        solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
        expose: {}
    )
    export(published_part)
`;

function inferSourceEnvironment(source: string) {
    const parser = new Parser(source + publishedComponent);
    const ast = parser.parse();
    const engine = new TypeInferenceEngine();
    return engine.inferProgram(ast);
}

// ----------------------------------------------------------------------------
// 1. Primitive and Solid Overloaded Arithmetic Inference Verification
// ----------------------------------------------------------------------------
test("Infers Primitive Floats and Overloaded Component Arithmetic", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def scalar_a = 40.0
        def scalar_b = 10.0
        def combined_scalar = scalar_a + scalar_b
        
        def faces_list = [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x:u, y:v, z:0))]
        def Block = Component(
            solid: Solid3D(faces: faces_list),
            expose: {}
        )
        
        def instance_a = Block
        def instance_b = Block
        def mate = align(
            planar: meet(frame: Vector(x: 0.0, y: 0.0, z: 1.0), placed: Vector(x: 0.0, y: 0.0, z: 1.0)),
            translation: meet(frame: Vector(x: 0.0, y: 0.0, z: 0.0), placed: Vector(x: 0.0, y: 0.0, z: 0.0)),
            rotation: meet(frame: Vector(x: 1.0, y: 0.0, z: 0.0), placed: Vector(x: 1.0, y: 0.0, z: 0.0))
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
    assert.equal(geometryType.tag, "Solid3D");
});

// ----------------------------------------------------------------------------
// 2. Curried Named Function Keyword Verification Protection
// ----------------------------------------------------------------------------
test("Successfully Resolves Curried Named Call Expressions", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def faces_list = [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x:u, y:v, z:0))]
        def MockPart = Component(
            solid: Solid3D(faces: faces_list),
            expose: {}
        )
        
        def part_frame  = MockPart
        def part_placed = MockPart
        
        def mock_normal = Vector(x: 0.0, y: 0.0, z: 1.0)
        def mock_pos    = Vector(x: 0.0, y: 0.0, z: 0.0)
        
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

    assert.equal(assemblyType.tag, "Solid3D");
});

// ----------------------------------------------------------------------------
// 3. Strict Compile-Time Keyword Catch Protection
// ----------------------------------------------------------------------------
test("Compiler Catches and Rejects Invalid Keyword Arguments", () => {
    const invalidKeywordSource = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def broken_call = align(
            planar: meet(frame: Vector(x: 0.0, y: 0.0, z: 1.0), placed: Vector(x: 0.0, y: 0.0, z: 1.0)),
            slide: meet(frame: Vector(x: 0.0, y: 0.0, z: 0.0), placed: Vector(x: 0.0, y: 0.0, z: 0.0)),
            rotation: meet(frame: Vector(x: 1.0, y: 0.0, z: 0.0), placed: Vector(x: 1.0, y: 0.0, z: 0.0))
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
        setup { units: "mm", coordinate_system: "Z-up" }
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
        setup { units: "mm", coordinate_system: "Z-up" }
        
        def flat_surface = Surface2D(
            max_u: 10.0,
            min_v: u => 0.0, max_v: u => 10.0,
            formula: u => v => Vector(x: u, y: v, z: 0.0)
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
        setup { units: "mm", coordinate_system: "Z-up" }
        // Generic identity lambda: a => a (Inferred as alpha -> alpha)
        def identity = x => x
        
        // Instantiated with a Float
        def float_instance = identity(x: 42.0)
        
        // Instantiated with a Vector
        def vector_instance = identity(x: Vector(x: 1.0, y: 2.0, z: 3.0))
    `;

    const env = inferSourceEnvironment(source);
    
    const floatType = prune(env.lookup("float_instance").type);
    assert.equal(floatType.tag, "Float");

    const vectorType = prune(env.lookup("vector_instance").type);
    assert.equal(vectorType.tag, "Vector");
});

// ----------------------------------------------------------------------------
// 7. Polymorphic Array Structure Verification
// ----------------------------------------------------------------------------
test("Infers Types Across Fully Polymorphic Destructuring Blocks", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        // Generic utility returning the first element of an arbitrary array
        def head_extractor = list => match list {
            [] => Vector(x: 0.0, y: 0.0, z: 0.0),
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
        setup { units: "mm", coordinate_system: "Z-up" }
        def invalid_math = 10.0 + "unsupported_string"
    `;

    assert.throws(() => {
        inferSourceEnvironment(invalidUnificationSource);
    }, /Type Inference Error: Structural Unification Mismatch/);
});

test("A script must export a component", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def size = 1.0
    `;
    const engine = new TypeInferenceEngine();
    assert.throws(() => {
        engine.inferProgram(new Parser(source).parse());
    }, /Type Inference Error: A script must export a component/);
});

test("Export and geometric operators require components", () => {
    const rawSolid = `
        setup { units: "mm", coordinate_system: "Z-up" }
        export(Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]))
    `;
    const engine = new TypeInferenceEngine();
    assert.throws(() => {
        engine.inferProgram(new Parser(rawSolid).parse());
    }, /Type Inference Error: Structural Unification Mismatch/);

    const rawDifference = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]) - Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 1.0))])
    `;
    assert.throws(() => {
        inferSourceEnvironment(rawDifference);
    }, /Type Inference Error: Operator '-' is only defined for SeatedSolid3D/);
});

test("Geometric operators exist only inside their join", () => {
    const block = `
        def Block = Component(
            solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
            expose: {}
        )
    `;
    const mate = `
        def mate = align(
            planar: meet(frame: Vector(x: 0.0, y: 0.0, z: 1.0), placed: Vector(x: 0.0, y: 0.0, z: 1.0)),
            translation: meet(frame: Vector(x: 0.0, y: 0.0, z: 0.0), placed: Vector(x: 0.0, y: 0.0, z: 0.0)),
            rotation: meet(frame: Vector(x: 1.0, y: 0.0, z: 0.0), placed: Vector(x: 1.0, y: 0.0, z: 0.0))
        )
    `;
    const outside = `
        setup { units: "mm", coordinate_system: "Z-up" }
        ${block}
        def cut = Block - Block
    `;
    assert.throws(() => {
        inferSourceEnvironment(outside);
    }, /Type Inference Error: Operator '-' is only defined for SeatedSolid3D/);

    const combined = `
        setup { units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => (frame + placed) - frame)
    `;
    const env = inferSourceEnvironment(combined);
    assert.equal(prune(env.lookup("cut").type).tag, "Solid3D");

    const seatedMember = `
        setup { units: "mm", coordinate_system: "Z-up" }
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
        setup { units: "mm", coordinate_system: "Z-up" }
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
        setup { units: "mm", coordinate_system: "Z-up" }
        ${block}
        ${mate}
        def cut = join(frame: Block, placed: Block, using: frame => placed => mate, combine: frame => placed => 1.0 - 0.5)
    `;
    assert.throws(() => {
        inferSourceEnvironment(numberResult);
    }, /Type Inference Error: combine is frame => placed => SeatedSolid3D/);
});

test("A join seats parts by the anchors they expose", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Outer = Component(
            solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
            expose: {
                up: Vector(x: 0.0, y: 0.0, z: 1.0),
                right: Vector(x: 1.0, y: 0.0, z: 0.0),
                cavity: Vector(x: 1.0, y: 1.0, z: 1.0),
                mating_crosshair: l => Vector(x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def Void = Component(
            solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
            expose: {
                up: Vector(x: 0.0, y: 0.0, z: 1.0),
                right: Vector(x: 1.0, y: 0.0, z: 0.0),
                seat: Vector(x: 0.0, y: 0.0, z: 0.0)
            }
        )
        def cut = join(frame: Outer, placed: Void, using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.cavity, placed: placed.seat),
            rotation: meet(frame: frame.right, placed: placed.right)
        ), combine: frame => placed => frame - placed)
    `;
    const env = inferSourceEnvironment(source);
    assert.equal(prune(env.lookup("cut").type).tag, "Solid3D");
    const outer = prune(env.lookup("Outer").type);
    assert.equal(outer.tag, "Component");
    if (outer.tag === "Component") assert.deepEqual([...outer.anchors], ["up", "right", "cavity", "mating_crosshair"]);
});

test("Member access only reads an exposed anchor", () => {
    const brick = `
        def Brick = Component(
            solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
            expose: { seat: Vector(x: 0.0, y: 0.0, z: 0.0) }
        )
    `;
    assert.throws(() => {
        inferSourceEnvironment(`
            setup { units: "mm", coordinate_system: "Z-up" }
            ${brick}
            def missing = Brick.lip
        `);
    }, /lip is not an anchor on this component/);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { units: "mm", coordinate_system: "Z-up" }
            ${brick}
            def mate = align(
                planar: meet(frame: Vector(x: 0.0, y: 0.0, z: 1.0), placed: Vector(x: 0.0, y: 0.0, z: 1.0)),
                translation: meet(frame: Vector(x: 0.0, y: 0.0, z: 0.0), placed: Vector(x: 0.0, y: 0.0, z: 0.0)),
                rotation: meet(frame: Vector(x: 1.0, y: 0.0, z: 0.0), placed: Vector(x: 1.0, y: 0.0, z: 0.0))
            )
            def cut = join(frame: Brick, placed: Brick, using: frame => placed => mate, combine: frame => placed => frame.seat)
        `);
    }, /seat is not an anchor on this component/);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { units: "mm", coordinate_system: "Z-up" }
            def Brick = Component(
                solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
                expose: {
                    seat: Vector(x: 0.0, y: 0.0, z: 0.0),
                    seat: Vector(x: 1.0, y: 0.0, z: 0.0)
                }
            )
        `);
    }, /Anchor 'seat' is already exposed/);

    assert.throws(() => {
        inferSourceEnvironment(`
            setup { units: "mm", coordinate_system: "Z-up" }
            def Brick = Component(
                solid: Solid3D(faces: [Surface2D(max_u: 1.0, min_v: u => 0.0, max_v: u => 1.0, formula: u => v => Vector(x: 0.0, y: 0.0, z: 0.0))]),
                expose: { shell: 1.0 }
            )
        `);
    }, /Type Inference Error: Structural Unification Mismatch/);
});
