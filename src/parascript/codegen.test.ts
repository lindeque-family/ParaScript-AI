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
            formula: u => v => Vector(x: initial_radius * cos(rad: u), y: initial_radius * sin(rad: v), z: 0.0)
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

test("Code Generator Handles Overloaded Geometric Composition and Mating Operators", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Bracket = Component(
            solid: Solid3D(faces: Array()),
            expose: {}
        )
        def part_a = Bracket
        def part_b = Bracket
        def combined_manifold = join(frame: part_a, placed: part_b, using: frame => placed => mate, combine: frame => placed => frame - placed)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    
    const generator = new WebCodeGenerator();
    const generatedJs = generator.generate(ast);

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

// ----------------------------------------------------------------------------
// 9. Keyword Argument Mismatch Boundary Protection
// ----------------------------------------------------------------------------
test("Type Inference Engine Catches and Rejects Mathematical Keyword Mismatches", () => {
    // Failure Case: 'sin' expects 'rad:', but the script incorrectly supplies 'v:'
    const invalidMathKeywordSource = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def sphere_radius = 25.0
        
        Surface2D(
            max_u: 6.28,
            min_v: u => 0.0, max_v: u => 3.14,
            formula: u => v => Vector(
                x: sphere_radius * cos(rad: u) * sin(rad: v),
                y: sphere_radius * sin(rad: u) * sin(v: v),
                z: sphere_radius * cos(rad: v)
            )
        )
    `;

    // Assert that Algorithm W intercepts the structural fault and throws the expected contract error
    assert.throws(() => {
        inferSourceEnvironment(invalidMathKeywordSource);
    }, /Type Inference Error: Keyword Argument Mismatch\. Expected named parameter identifier 'rad', but found key name 'v'/);
});
