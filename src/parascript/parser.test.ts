// ============================================================================
// PARASCRIPT AI PARSER TEST SUITE (Node.js Native Runner - v11.3.0)
// ============================================================================

// @ts-ignore -- Node.js type declarations are optional in this project.
import { test } from "node:test";
// @ts-ignore -- Node.js type declarations are optional in this project.
import assert from "node:assert/strict";
import { Parser } from "./parser.js"; 
import type { BinaryExpression, ComponentExpression, JoinDomain, MethodCallExpression, TupleLetExpression, TupleLiteral, VariableDeclaration } from "./ast.js";

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
        def my_trajectory = Curve1D(max_t: 10.0, formula: t => Vector(coords: coords, x: t, y: t * 2.0, z: 0.0))
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

test("a def may declare a signature with a shared type variable", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def same: T => T => number = x => y => 1.0
    `;
    const parser = new Parser(source);
    const decl = parser.parse().body[0] as VariableDeclaration;
    const signature = decl.signature;
    assert.ok(signature);
    assert.equal(signature.type, "FunctionType");
    if (signature.type !== "FunctionType" || signature.returnType.type !== "FunctionType") return;
    assert.equal(signature.paramName, null);
    assert.equal(signature.parameter.type, "TypeName");
    assert.equal(signature.returnType.parameter.type, "TypeName");
    if (signature.parameter.type === "TypeName" && signature.returnType.parameter.type === "TypeName") {
        assert.equal(signature.parameter.name, "T");
        assert.equal(signature.returnType.parameter.name, "T");
    }
    assert.equal(signature.returnType.returnType.type, "TypeName");
});

test("parameters is a hierarchy after setup", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        parameters {
            plate: {
                size: 100.0,
                thickness: size / 12.0
            },
            holes: {
                pitch: $plate.size / 8.0
            }
        }
        def width = $plate.size
    `;
    const ast = new Parser(source).parse();
    assert.ok(ast.parameters);
    assert.equal(ast.parameters.entries.length, 2);
    const plate = ast.parameters.entries[0];
    assert.equal(plate?.type, "ParameterGroup");
    if (plate?.type !== "ParameterGroup") return;
    assert.equal(plate.name.name, "plate");
    assert.equal(plate.entries[1]?.type, "ParameterField");
    assert.equal(ast.body[0]?.type, "VariableDeclaration");
    const width = ast.body[0];
    if (width?.type === "VariableDeclaration" && width.value.type === "MemberExpression") {
        assert.equal(width.value.object.type, "ParameterReference");
    }
});

test("parameters belongs after setup", () => {
    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def pi = 3.0
        parameters { plate: { size: 1.0 } }
    `).parse(), /parameters belongs after setup/);
});

test("component returns a part and publishes its anchors", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def CustomShaft = Component(
            solid: coords => Solid3D(faces: [Cube(size: 1.0)]),
            expose: coords => {
                mating_crosshair: l => Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
            }
        )
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as VariableDeclaration;
    const comp = decl.value as ComponentExpression;

    assert.equal(comp.type, "ComponentExpression");
    assert.equal(comp.solid.type, "LambdaExpression");
    if (comp.solid.type !== "LambdaExpression") return;
    assert.equal(comp.solid.parameter.name, "coords");
    assert.equal(comp.solid.body.type, "Solid3DNode");
    assert.equal(comp.expose.type, "LambdaExpression");
    if (comp.expose.type !== "LambdaExpression" || comp.expose.body.type !== "ExposeBlock") return;
    const firstExpose = comp.expose.body.properties[0];
    assert.ok(firstExpose);
    assert.equal(firstExpose.name.name, "mating_crosshair");
    assert.equal(firstExpose.value.type, "LambdaExpression");
});

test("Expose accepts a vector anchor and member access reads it", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def Outer = Component(
            solid: coords => Solid3D(faces: []),
            expose: coords => { cavity: Vector(coords: coords, x: 3.0, y: 3.0, z: 3.0) }
        )
        def seat = Outer.cavity
    `;
    const ast = new Parser(source).parse();
    const comp = (ast.body[0] as VariableDeclaration).value as ComponentExpression;
    assert.equal(comp.expose.type, "LambdaExpression");
    if (comp.expose.type !== "LambdaExpression" || comp.expose.body.type !== "ExposeBlock") return;
    const exposed = comp.expose.body.properties[0];
    assert.ok(exposed);
    assert.equal(exposed.value.type, "VectorLiteral");
    assert.equal(exposed.value.coords.type, "Identifier");
    const decl = ast.body[1] as VariableDeclaration;
    assert.equal(decl.value.type, "MemberExpression");
    if (decl.value.type === "MemberExpression") {
        assert.equal(decl.value.property, "cavity");
        assert.equal(decl.value.object.type, "Identifier");
    }
});

test("|> pipes a value into the next argument, left to right", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def drilled = grid |> map(f: item => item) |> chain(start: plate)
        def adjusted = 4.0 |> shift(d: 3.0) >> scale(k: 2.0)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const drilled = (ast.body[0] as any).value;
    assert.equal(drilled.type, "PipeExpression");
    assert.equal(drilled.leftHandSide.type, "PipeExpression");
    assert.equal(drilled.leftHandSide.leftHandSide.name, "grid");
    assert.equal(drilled.rightHandSide.callee.name, "chain");

    const adjusted = (ast.body[1] as any).value;
    assert.equal(adjusted.type, "PipeExpression");
    assert.equal(adjusted.leftHandSide.type, "FloatLiteral");
    assert.equal(adjusted.rightHandSide.type, "ComposeExpression");
});

test(">> composes the left function before the right", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def adjust = shift(d: 3.0) >> scale(k: 2.0) >> round(step: 1.0)
    `;
    const parser = new Parser(source);
    const ast = parser.parse();
    const decl = ast.body[0] as any;

    assert.equal(decl.value.type, "ComposeExpression");
    assert.equal(decl.value.left.type, "ComposeExpression");
    assert.equal(decl.value.left.left.type, "CallExpression");
    assert.equal(decl.value.right.type, "CallExpression");
    assert.equal(decl.value.right.callee.name, "round");
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
    const call = (ast.body[0] as any).value.right;
    const selector = call.arguments[1].value;
    assert.equal(selector.type, "LambdaExpression");
    assert.equal(selector.parameter.name, "faces");
    assert.equal(selector.body.type, "ComposeExpression");
    assert.equal(selector.body.right.arguments[0].value.type, "LambdaExpression");
    assert.equal(selector.body.right.arguments[0].value.parameter.name, "f");
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
        def Left = Component(solid: coords => Solid3D(faces: []), expose: coords => {})
        def Pair = Component(
            solid: join(frame: Left, placed: Left, using: frame => placed => mate, combine: frame => placed => frame + placed),
            expose: coords => {}
        )
    `;
    const ast = new Parser(source).parse();
    const pair = (ast.body[1] as VariableDeclaration).value as ComponentExpression;
    assert.equal(pair.type, "ComponentExpression");
    assert.equal(pair.solid.type, "JoinDomain");
    if (pair.solid.type !== "JoinDomain") return;
    const joined = pair.solid;
    assert.equal(joined.coords, undefined);
    if (joined.combine.type !== "LambdaExpression" || joined.combine.body.type !== "LambdaExpression" || joined.combine.body.body.type !== "BinaryExpression") {
        assert.fail("pair solid is a join of the two parts");
    }
    assert.equal(joined.combine.body.body.operator, "+");
    if (pair.expose.type !== "LambdaExpression" || pair.expose.body.type !== "ExposeBlock") {
        assert.fail("pair expose is coords => {}");
    }
    assert.equal(pair.expose.body.properties.length, 0);
});

test("Join domain binds two solids and a result", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(frame: Block(), placed: Hole(), using: frame => placed => mate, combine: frame => placed => frame - placed)
    `;
    const ast = new Parser(source).parse();
    const join = (ast.body[0] as any).value;
    assert.equal(join.type, "JoinDomain");
    assert.equal(join.frame.type, "CallExpression");
    assert.equal(join.placed.callee.name, "Hole");
    assert.equal(join.using.type, "LambdaExpression");
    assert.equal(join.using.parameter.name, "frame");
    assert.equal(join.using.body.parameter.name, "placed");
    assert.equal(join.using.body.body.name, "mate");
    assert.equal(join.combine.type, "LambdaExpression");
    assert.equal(join.combine.parameter.name, "frame");
    assert.equal(join.combine.body.parameter.name, "placed");
    assert.equal(join.combine.body.body.type, "BinaryExpression");
    assert.equal(join.combine.body.body.operator, "-");
    assert.equal(join.combine.body.body.left.name, "frame");
    assert.equal(join.combine.body.body.right.name, "placed");
    assert.equal(join.coords, undefined);
});

test("join takes the coordinate system last", () => {
    const withCoords = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(frame: Block(), placed: Hole(), using: frame => placed => mate, combine: frame => placed => frame - placed, coords: frame.coords)
    `;
    const join = (new Parser(withCoords).parse().body[0] as VariableDeclaration).value as JoinDomain;
    assert.equal(join.type, "JoinDomain");
    assert.equal(join.coords?.type, "MemberExpression");

    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(frame: Block(), placed: Hole(), using: frame => placed => mate, combine: frame => placed => frame - placed, coords: frame.coords, frame: Block())
    `).parse(), /Parser Error: join takes the coordinate system last/);

    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(frame: Block(), placed: Hole(), using: frame => placed => mate, combine: frame => placed => frame - placed, seat: frame.at)
    `).parse(), /Parser Error: join accepts frame, placed, using, combine, and coords/);
});

test("let binds a name for the expression after in", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cap = radius =>
            let bottom = Disk(radius: radius, z: 0.0) in
            let top = Disk(radius: radius, z: radius) in
            bottom
    `;
    const decl = new Parser(source).parse().body[0] as VariableDeclaration;
    const outer = decl.value;
    assert.equal(outer.type, "LambdaExpression");
    if (outer.type !== "LambdaExpression") return;
    assert.equal(outer.body.type, "LetExpression");
    if (outer.body.type !== "LetExpression") return;
    assert.equal(outer.body.name.name, "bottom");
    assert.equal(outer.body.body.type, "LetExpression");
    if (outer.body.body.type !== "LetExpression") return;
    assert.equal(outer.body.body.name.name, "top");
    assert.equal(outer.body.body.body.type, "Identifier");

    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def bad = let bottom = 1.0 bottom
    `).parse(), /Expected 'in' after the let binding/);
});

test("Join needs a combine", () => {
    const missingCombine = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def cut = join(frame: Block(), placed: Hole(), using: frame => placed => mate)
    `;
    assert.throws(() => new Parser(missingCombine).parse(), /Parser Error: join needs frame, placed, using, and combine/);
});

test("a vector method is a named call on the vector", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def moved = Mark.at.offset(x: 1.0, y: 0.0, z: 0.0)
        def sum = Mark.at.add(vector: Mark.up)
    `;
    const body = new Parser(source).parse().body;
    const moved = (body[0] as VariableDeclaration).value as MethodCallExpression;
    assert.equal(moved.type, "MethodCallExpression");
    assert.equal(moved.method.name, "offset");
    assert.equal(moved.object.type, "MemberExpression");
    assert.deepEqual(moved.arguments.map((arg) => arg.name.name), ["x", "y", "z"]);
    const sum = (body[1] as VariableDeclaration).value as MethodCallExpression;
    assert.equal(sum.method.name, "add");
    assert.equal(sum.arguments[0]?.name.name, "vector");
});

test("a tuple keeps each value and parentheses without a comma group", () => {
    const source = `
        setup { units: "mm", coordinate_system: "Z-up" }
        def pair = (1.0, 2.0 + 3.0)
        def grouped = (1.0 + 2.0)
        def swap = pair => let (x, (y, z)) = pair in (z, y, x)
    `;
    const body = new Parser(source).parse().body;
    const pair = (body[0] as VariableDeclaration).value as TupleLiteral;
    assert.equal(pair.type, "TupleLiteral");
    assert.equal(pair.elements.length, 2);
    assert.equal(pair.elements[1]?.type, "BinaryExpression");
    const grouped = (body[1] as VariableDeclaration).value as BinaryExpression;
    assert.equal(grouped.type, "BinaryExpression");
    const swap = (body[2] as VariableDeclaration).value;
    assert.equal(swap.type, "LambdaExpression");
    if (swap.type !== "LambdaExpression") return;
    const taken = swap.body as TupleLetExpression;
    assert.equal(taken.type, "TupleLetExpression");
    assert.equal(taken.pattern.type, "Tuple");
    if (taken.pattern.type !== "Tuple") return;
    assert.equal(taken.pattern.elements[1]?.type, "Tuple");
    assert.equal(taken.body.type, "TupleLiteral");

    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def one = (1.0,)
    `).parse(), /A tuple needs at least two elements/);
    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def none = ()
    `).parse(), /A tuple needs at least two elements/);
    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def bad: (item: number, vector) = (1.0, 2.0)
    `).parse(), /A tuple type is \(number, vector\)/);
});

test("Vector takes a coordinate system before the axes", () => {
    assert.throws(() => new Parser(`
        setup { units: "mm", coordinate_system: "Z-up" }
        def up = Vector(x: 0.0, y: 0.0, z: 1.0)
    `).parse(), /Parser Error: Vector needs a coordinate system first\. \(Found 'x'/);
});
