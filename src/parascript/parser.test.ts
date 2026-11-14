// ============================================================================
// PARASCRIPT AI PARSER TEST SUITE (Node.js Native Runner - v11.3.0)
// ============================================================================

// @ts-ignore -- Node.js type declarations are optional in this project.
import { test } from "node:test";
// @ts-ignore -- Node.js type declarations are optional in this project.
import assert from "node:assert/strict";
import { Parser } from "./parser.js"; 
import type { ComponentDeclaration, VariableDeclaration } from "./ast.js";

test("Global Setup Block Parsing", () => {
    const source = `
        setup {
            units: "mm",
            coordinate_system: "Z-up"
        }
    `;
    const parser = new Parser(source);
    const ast = parser.parse();

    assert.deepEqual(ast.setup, {
        type: "SetupBlock",
        units: "mm",
        coordinateSystem: "Z-up"
    });
});

test("Variable Declaration and Curried Lambda Trajectories", () => {
    const source = `
        setup { units: "inch", coordinate_system: "Y-up" }
        def my_trajectory = Curve1D(max_t: 10.0, formula: t => Vector(x: t, y: t * 2.0, z: 0.0))
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as any;

    assert.equal(decl.type, "VariableDeclaration");
    assert.equal(decl.name.name, "my_trajectory");
    assert.equal(decl.value.type, "Curve1DNode");
    
    // Verifies the strict single-argument lambda contract
    assert.equal(decl.value.formula.type, "LambdaExpression");
    assert.equal(decl.value.formula.parameter.type, "Identifier");
    assert.equal(decl.value.formula.parameter.name, "t");
});

test("Component Type Blueprint Construction and Interface Exposure", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        component CustomShaft(length: Float) {
            def profile_radius = 5.0
            Solid3D(faces: [Cube(size: 1.0)])
            expose {
                mating_crosshair: l => Vector(x: 0.0, y: 0.0, z: 0.0)
            }
        }
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const comp = ast.body[0] as ComponentDeclaration;

    assert.equal(comp.type, "ComponentDeclaration");
    assert.equal(comp.name.name, "CustomShaft");
    
    const firstParam = comp.parameters[0];
    assert.ok(firstParam);
    assert.equal(firstParam.name.name, "length");

    const firstExpose = comp.expose.properties[0];
    assert.ok(firstExpose);
    assert.equal(firstExpose.name.name, "mating_crosshair");
    assert.equal(firstExpose.value.type, "LambdaExpression");
});

test("Expose accepts a vector anchor and member access reads it", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        component Outer() {
            Solid3D(faces: [])
            expose { cavity: Vector(x: 3.0, y: 3.0, z: 3.0) }
        }
        def seat = Outer().cavity
    `;
    const ast = new Parser(source).parse();
    const comp = ast.body[0] as ComponentDeclaration;
    const exposed = comp.expose.properties[0];
    assert.ok(exposed);
    assert.equal(exposed.value.type, "VectorLiteral");
    const decl = ast.body[1] as VariableDeclaration;
    assert.equal(decl.value.type, "MemberExpression");
    if (decl.value.type === "MemberExpression") {
        assert.equal(decl.value.property, "cavity");
        assert.equal(decl.value.object.type, "CallExpression");
    }
});

test("Left-to-Right Chaining Expression Pipeline", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def finished_cube = Cube(size: 20.0) >> fillet(radius: 2.0)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as any;

    assert.equal(decl.value.type, "PipeExpression");
    assert.equal(decl.value.leftHandSide.type, "CallExpression");
    assert.equal(decl.value.rightHandSide.type, "CallExpression");
});

test("Array Primitives and Cons Operator Structural Chaining", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def geometry_list = [Sphere(radius: 5.0)]
        def expanded_list = Cube(size: 20.0) :: geometry_list
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    
    const arrayDecl = ast.body[0] as any;
    assert.equal(arrayDecl.value.type, "ArrayLiteral");
    assert.equal(arrayDecl.value.elements[0].type, "CallExpression");

    const consDecl = ast.body[1] as any;
    assert.equal(consDecl.value.type, "BinaryExpression");
    assert.equal(consDecl.value.operator, "::");
});

test("Structured Array Pattern Match Destructuring", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def resolved_form = match shapes_list {
            [] => Cube(size: 1.0),
            head :: tail => head
        }
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const matchDecl = ast.body[0] as any;

    assert.equal(matchDecl.value.type, "ArrayMatchStatement");
    assert.equal(matchDecl.value.headIdentifier.name, "head");
    assert.equal(matchDecl.value.tailIdentifier.name, "tail");
    assert.equal(matchDecl.value.onEmpty.type, "CallExpression");
    assert.equal(matchDecl.value.onSplit.type, "Identifier");
});

test("Export statement names the published solid", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = Block() - Hole()
        export(cut)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const exported = ast.body[1] as any;
    assert.equal(exported.type, "ExportStatement");
    assert.equal(exported.value.type, "Identifier");
    assert.equal(exported.value.name, "cut");
});

test("Call arguments accept selector lambdas", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def rounded = raw >> fillet(
            radius: 10.0,
            selector: faces => faces >> flat_map(f => f)
        )
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const call = (ast.body[0] as any).value.rightHandSide;
    const selector = call.arguments[1].value;
    assert.equal(selector.type, "LambdaExpression");
    assert.equal(selector.parameter.name, "faces");
    assert.equal(selector.body.rightHandSide.arguments[0].value.type, "LambdaExpression");
    assert.equal(selector.body.rightHandSide.arguments[0].value.parameter.name, "f");
});

test("Compiler Protection Blocks Discontinuity Leaks (Question Mark Parser Defeat)", () => {
    const invalidMathSource = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def broken_curve = Cube(size: 1.0) ? Sphere(radius: 2.0) : Cube(size: 2.0)
    `;
    
    assert.throws(() => {
        const parser = new Parser(invalidMathSource);
        parser.parse();
    }, /Lexer Error:/);
});

// ============================================================================
// CONTINUOUS MATH PRECEDENCE & ASSOCIATIVITY VERIFICATION TESTS
// ============================================================================

test("Mathematical Operator Precedence Ladder Rules", () => {
    // Expected mathematical tree transformation:
    // a + b * c ^ d  ===>  a + (b * (c ^ d))
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def complex_math = 1.0 + 2.0 * 3.0 ^ 4.0
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as any;

    // The root of the math expression must be the lowest priority operator (+)
    assert.equal(decl.value.type, "BinaryExpression");
    assert.equal(decl.value.operator, "+");
    assert.equal(decl.value.left.type, "FloatLiteral"); // 1.0

    // The right-hand side branch must contain the multiplicative expression (*)
    const rhsMult = decl.value.right;
    assert.equal(rhsMult.type, "BinaryExpression");
    assert.equal(rhsMult.operator, "*");
    assert.equal(rhsMult.left.type, "FloatLiteral"); // 2.0

    // The highest priority exponential branch must be nested deepest inside the tree (3.0 ^ 4.0)
    const deepCaret = rhsMult.right;
    assert.equal(deepCaret.type, "BinaryExpression");
    assert.equal(deepCaret.operator, "^");
    assert.equal(deepCaret.left.value, 3.0);
    assert.equal(deepCaret.right.value, 4.0);
});

test("Cons Operator Right-Associativity Structural Nesting", () => {
    // Cons operations must build a right-branching spine:
    // item_a :: item_b :: empty_tail  ===>  item_a :: (item_b :: empty_tail)
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def right_spine = 1.0 :: 2.0 :: []
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as any;

    // The root operator must capture the first element sequence
    assert.equal(decl.value.type, "BinaryExpression");
    assert.equal(decl.value.operator, "::");
    assert.equal(decl.value.left.value, 1.0);

    // The right-hand branch must contain the rest of the list nested inside another BinaryExpression
    const nestedCons = decl.value.right;
    assert.equal(nestedCons.type, "BinaryExpression");
    assert.equal(nestedCons.operator, "::");
    assert.equal(nestedCons.left.value, 2.0);
    assert.equal(nestedCons.right.type, "ArrayLiteral"); // []
});

test("A component root can be a join of components", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        component Left() {
            Solid3D(faces: [])
            expose {}
        }
        component Pair() {
            join(fixed: Left(), moving: Left(), using: mate) {
                fixed + moving
            }
            expose {}
        }
    `;
    const ast = new Parser(source).parse();
    const pair = ast.body[1] as any;
    assert.equal(pair.type, "ComponentDeclaration");
    assert.equal(pair.rootGeometry.type, "JoinDomain");
    assert.equal(pair.rootGeometry.result.operator, "+");
    assert.equal(pair.expose.properties.length, 0);
});

test("Join domain binds two solids and a result", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(fixed: Block(), moving: Hole(), using: mate) {
            def span = 1.0 - 0.5
            fixed - moving
        }
    `;
    const ast = new Parser(source).parse();
    const join = (ast.body[0] as any).value;
    assert.equal(join.type, "JoinDomain");
    assert.equal(join.fixed.type, "CallExpression");
    assert.equal(join.moving.callee.name, "Hole");
    assert.equal(join.using.name, "mate");
    assert.equal(join.body.length, 1);
    assert.equal(join.body[0].name.name, "span");
    assert.equal(join.result.type, "BinaryExpression");
    assert.equal(join.result.operator, "-");
    assert.equal(join.result.left.name, "fixed");
    assert.equal(join.result.right.name, "moving");
});

test("Join without a body is rejected", () => {
    const missingBody = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(fixed: Block(), moving: Hole(), using: mate)
    `;
    assert.throws(() => new Parser(missingBody).parse(), /Parser Error: join domain needs a body/);

    const emptyBody = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(fixed: Block(), moving: Hole(), using: mate) {}
    `;
    assert.throws(() => new Parser(emptyBody).parse(), /Parser Error: join domain needs a body/);
});
