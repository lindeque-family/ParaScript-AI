# ParaScript AI Language Specification
**Version:** 11.0.0  
**Grammar Paradigm:** Purely Functional, Smooth Parametric, Vector-Driven Assembly Layout Engine.

---

## 1. Syntax & Lexical Grammar

### 1.1 Identifiers & Tokens
*   **Identifiers:** Lowercase snake_case matching the regular expression `[a-z_][a-z0-9_]*`. All variable names, custom properties, and function parameters are strictly lowercase snake_case.
*   **Type Names:** PascalCase matching the regular expression `[A-Z][a-zA-Z0-9]*`.
*   **Reserved Keywords:** `setup`, `param`, `def`, `fn`, `component`, `expose`, `return`, `true`, `false`.
*   **Operators:** `>>` (Pipe-Forward), `=>` (Lambda Mapping), `=` (Assignment).

### 1.2 Smooth Mathematical Operator Matrix
Mathematical expressions inside formula lambdas are strictly continuous. Logical, relational, and conditional operators are entirely prohibited inside formula blocks to preserve analytical differentiability. Only continuous arithmetic operations are valid tokens:
*   `+`  : Addition. `Float + Float` and `Vector + Vector` stay arithmetic, including inside a join. Inside a join domain, `+` is the unordered union of that domain's two solids.
*   `-`  : Subtraction. `Float - Float` and `Vector - Vector` stay arithmetic. Inside a join domain, `-` keeps the solid on the left and removes the solid on the right. Both operators apply to the two solids of that join, and to values built from them in the same braces.
*   `*`  : Multiplication (Overloaded for Float * Float or scalar scaling Float * Vector).
*   `/`  : Division (`Float / Float`).
*   `^`  : Exponentiation / Power (`Float ^ Float`).

---

## 2. Core Language Evaluation Mechanics

### 2.1 Pure Immutability
All variables allocated via `def` or `param` are completely immutable constants. Once initialized, their states cannot be rewritten, mutated, or shadowed within the same lexical scope block. There is no concept of variable re-assignment, global mutations, or imperative loops.

### 2.2 Mandatory Component Export
Every script publishes one component with `export(expression)`. The expression's type is `Component`. A script with no export, or an export of a float, vector, or raw `Solid3D`, is rejected. When several exports appear, the last one is the published component. A join domain produces that component: `+` and `-` inside the braces build the solid, and the value that leaves the braces is a `Component`.

### 2.3 Pipe-Forward Operator (`>>`) & The Target-Last Rule
The pipe operator acts as a left-to-right syntax pipeline processor. It evaluates the expression on its Left-Hand Side (LHS) and injects that evaluated object value as the **absolute final parameter** of the function call on its Right-Hand Side (RHS).

Given a function definition:
```parascript
fn fillet(radius: Float, target: Shape) -> Shape
```

Writing:
```parascript
my_box >> fillet(radius: 4.0)
```

Is syntactically parsed and evaluated by the interpreter exactly as:
```parascript
fillet(radius: 4.0, target: my_box)
```

### 2.4 Partial Function Application (Currying)
Every built-in and user-defined function natively supports partial application. If a function is called with fewer arguments than its signature declares, it does not throw an error; instead, it returns a new, anonymous, partially applied function closing over those captured parameters, waiting for the remaining inputs to be piped into its final slot.

---

## 3. Flat Structural Type System

Every primitive operates entirely within its own relative, floating local tracking framework.

*   **`Vector`** : `{ x: Float, y: Float, z: Float }` — Continuous mathematical coordinate value type. Natively supports vector addition, cross products, dot products, and scalar scaling. Acts as the universal representation for positions, offsets, and directions.
*   **`Point`**  : A zero-dimensional (0D) spatial position marker. Its identity is strictly its runtime object instance reference in memory. It carries no coordinates or sub-properties.
*   **`Curve1D`**: A continuous path record mapping a scalar domain to a local spatial trajectory.
    ```parascript
    interface Curve1D {
        max_t: Float             // The maximum 't' parameter bounding the curve domain
        formula: Float => Vector // Maps t=0 exactly to Vector(0,0,0). Local trajectory lambda.
    }
    ```
*   **`Surface2D`**: An analytical surface sheet bounded by a dynamic parametric function region domain.
    ```parascript
    interface Surface2D {
        max_u: Float                    // Maximum static bound for the primary parameter axis
        max_v: Float => Float           // First-class formula mapping the maximum bound of V based on U
        formula: (Float, Float) => Vector // Maps (0,0) exactly to Vector(0,0,0). Local surface lambda.
    }
    ```
*   **`Solid3D`**: A watertight volumetric collection composed by joining discrete or chained `Surface2D` elements together at their shared boundary regions.
*   **`Component`**: A first-class user-defined geometric node wrapping an internal solid structure tree alongside an explicitly published property schema (`expose`).

---

## 4. Built-In First-Class Core Libraries

### 4.1 Composition Utilities
To build sharp features, steps, and patterns without conditional math equations, the language uses explicit functional composition functions. Collection loops are entirely forbidden, relying instead on higher-order primitives.
```parascript
// Fuses an array of continuous curves end-to-start into a single compound path
fn Curve1D.Chain(curves: Array(Curve1D)) -> Curve1D

// Stitches an array of smooth surfaces together at matching region boundaries
fn Surface2D.Chain(surfaces: Array(Surface2D)) -> Surface2D

// Natively combines solid bodies into boolean volumetric topologies
fn Modifier.Add(tool: Solid3D, target: Solid3D) -> Solid3D
fn Modifier.Subtract(tool: Solid3D, target: Solid3D) -> Solid3D

// High-Order Array Tools
fn map(f: From => To, list: Array(From)) -> Array(To)
fn filter(predicate: T => Boolean, list: Array(T)) -> Array(T)
```

### 4.2 Analytical Evaluation Primitives
```parascript
// Evaluates the exact normal vector at a given coordinate by checking formula derivatives
fn normal_at(u: Float, v: Float, target_surface: Surface2D) -> Vector

// Evaluates the exact tangent directional vector at a given t parameter step
fn tangent_at(t: Float, target_curve: Curve1D) -> Vector
```

### 4.3 Mathematical Functions
The global namespace maps the following core continuous mathematical primitives natively. These functions are fully typed and differentiable by the compiler kernel via automatic differentiation:
*   **Trigonometry:** `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan2(y, x)`
*   **Hyperbolic:** `sinh(x)`, `cosh(x)`, `tanh(x)`
*   **Exponential & Logarithmic:** `sqrt(x)`, `cbrt(x)`, `ln(x)`, `log(x)`, `exp(x)`
*   **Constants:** `PI` (evaluates to `3.14159265359`), `E` (evaluates to `2.71828182846`)

---

## 5. Standard Primitive Component Declarations

The core standard library packages primitive solids as first-class component blocks. The root-level statement inside a component defines its physical solid representation, evaluated cleanly inside a local lexical closure context. That root is a `Solid3D` or a `join` of components. The join leaves a component, so the new component is the assembly of those parts. Each solid is written in its own frame. A component publishes anchors in `expose`, each a `Vector` in that frame. A join seats the moving part with one mate. `align` makes the planes parallel, then translates the points together, then rotates around that point in the plane. `centred`, `inset`, `apart`, `on_top`, `below`, and `relate` translate without turning. A surface formula's `Vector` labels are that part's own axes.

```parascript
component Sphere(radius: Float) {
    def outer_shell = Surface2D(
        max_u: 2.0 * PI,
        max_v: u => PI,
        formula: (u, v) => Vector(
            x: radius * cos(u) * sin(v),
            y: radius * sin(u) * sin(v),
            z: radius * cos(v)
        )
    )

    Solid3D(faces: Array(outer_shell))

    expose {
        center: Vector(x: 0.0, y: 0.0, z: 0.0),
        shell:  outer_shell
    }
}

component Cube(size: Float) {
    fn build_face(offset: Vector, orientation: (Float, Float) => Vector) -> Surface2D {
        return Surface2D(
            max_u: size,
            max_v: u => size,
            formula: (u, v) => orientation(u, v) + offset
        )
    }

    def f_bottom = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: u, y: v, z: 0.0))
    def f_top    = build_face(Vector(x: 0.0, y: 0.0, z: size), (u, v) => Vector(x: u, y: v, z: 0.0))
    def f_front  = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: u, y: 0.0, z: v))
    def f_back   = build_face(Vector(x: 0.0, y: size, z: 0.0), (u, v) => Vector(x: u, y: 0.0, z: v))
    def f_left   = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: 0.0, y: u, z: v))
    def f_right  = build_face(Vector(x: size,  y: 0.0, z: 0.0),  (u, v) => Vector(x: 0.0, y: u, z: v))

    Solid3D(faces: Array(f_bottom, f_top, f_front, f_back, f_left, f_right))

    expose {
        center:      Vector(x: size / 2.0, y: size / 2.0, z: size / 2.0),
        bottom_face: f_bottom,
        top_face:    f_top,
        front_face:  f_front,
        back_face:   f_back,
        left_face:   f_left,
        right_face:  f_right
    }
}
```

---

## 2. Dynamic Assembly Layout Solver

Each `join` opens a domain. `fixed` and `moving` are the two solids of that domain. Inside the braces, `+` unions them in either order, and `-` keeps the solid on the left. When the braces end, those operators end, and the join expression is a `Component`. A nested `join` is its own domain. Combining the result with a third solid is a new join.

```parascript
join(
    fixed: Component,
    moving: Component,
    using: ConstraintSet
) {
    fixed - moving
} -> Component
```

### 6.1 Mates

`using` takes one mate. The mates are different placements of `moving` onto `fixed`. `fixed` stays put. The boolean inside the braces runs after that placement. A component publishes the vectors in `expose`, and the mate reads them as `fixed.up` or `moving.seat`. A name the component did not expose is rejected. The assembly publishes its own anchors. The renderer hangs the model on `origin`.

`align` is the rigid placement. It runs three alignments, in order. `planar` turns `moving` until the normals match, so the planes are parallel. `translation` then slides it until the points meet. `rotation` then turns it around that point, in the plane, until the in-plane directions match. `meet(fixed: Vector, moving: Vector)` pairs the vector on `fixed` with the vector on `moving` for one of those alignments.

```parascript
component Outer() {
    Solid3D(faces: [/* the enclosure, in its own frame */])
    expose {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        cavity: Vector(x: wall, y: wall, z: wall)
    }
}

component Void() {
    Solid3D(faces: [/* the cavity solid, in its own frame */])
    expose {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        seat: Vector(x: 0.0, y: 0.0, z: 0.0)
    }
}

component HollowBox() {
    join(fixed: Outer(), moving: Void(), using: align(
        planar: meet(fixed: fixed.up, moving: moving.up),
        translation: meet(fixed: fixed.cavity, moving: moving.seat),
        rotation: meet(fixed: fixed.right, moving: moving.right)
    )) {
        fixed - moving
    }
    expose { origin: Vector(x: w / 2.0, y: d / 2.0, z: h / 2.0) }
}
```

`planar_centred(target_normal:, source_normal:, target_pos:, source_pos:, target_twist:, source_twist:)` runs those same three alignments. The normals are the planar step, the positions are the translation, and the twists are the in-plane rotation. `target` is the fixed part and `source` is the moving part.

The other mates only translate, and both parts keep the orientation they were built with. Distances run along the setup's right, forward, and up. With `Z-up`, those are the positive x, y, and z axes of the fixed part.

`centre` (or `center`), `min`, `max`, and `origin` name a point on a part. `centre` is the middle of its bounds. `min` and `max` are the low and high ends along one direction. `origin` is the part's own frame origin, which stays on the fixed part when several parts have already been joined.

* `centred` puts the two centres on the same point.
* `inset(by: Float)` sets the moving part's minimum corner inside the fixed part by that distance on right, forward, and up.
* `apart(right: Float, forward: Float, up: Float)` holds the centres apart by those distances.
* `on_top(overlap: Float)` centres the moving part over the fixed part and sinks it into the top by `overlap`.
* `below(overlap: Float)` centres the moving part and lifts its top to `overlap` above the fixed part's bottom.
* `relate(right: Axis, forward: Axis, up: Axis)` is the general mate. Each direction is `anchor(fixed: Anchor, moving: Anchor, by: Float)`. The named point on the moving part meets the named point on the fixed part, then shifts by `by` along that direction.

```parascript
join(fixed: Block(), moving: Hole(), using: centred) {
    fixed - moving
}
```

---

## 7. Reference Verification Script

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up",
    tolerances: 0.01
}

param box_dimension = 80.0
param bearing_size  = 15.0

def structural_cube = Cube(size: box_dimension)
def rolling_bearing = Sphere(radius: bearing_size)

// The assembly constraint solver evaluates a pure matrix equation using vector derivatives
def sub_assembly = join(
    fixed: structural_cube,
    moving: rolling_bearing,
    using: ConstraintSet.PlanarCentred(
        // We calculate normal vectors dynamically by evaluating the surface at any known parameter point!
        target_normal: fixed => fixed.top_face >> normal_at(0.0, 0.0),
        source_normal: moving => moving.shell >> normal_at(0.0, 0.0),
        target_pos:    fixed => fixed.center,
        source_pos:    moving => moving.center,
        target_twist:  fixed => Vector(x: 1.0, y: 0.0, z: 0.0),
        source_twist:  moving => Vector(x: 0.0, y: 1.0, z: 0.0)
    )
) {
    fixed + moving
}
export(sub_assembly)