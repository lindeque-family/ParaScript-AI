# ParaScript AI Language Specification
**Version:** 11.0.0  
**Grammar Paradigm:** Purely Functional, Smooth Parametric, Vector-Driven Assembly Layout Engine.

---

## 1. Syntax & Lexical Grammar

### 1.1 Identifiers & Tokens
*   **Identifiers:** Lowercase snake_case matching the regular expression `[a-z_][a-z0-9_]*`. All variable names, custom properties, and function parameters are strictly lowercase snake_case.
*   **Type Names:** PascalCase matching the regular expression `[A-Z][a-zA-Z0-9]*`.
*   **Reserved Keywords:** `setup`, `param`, `def`, `fn`, `export`, `return`, `true`, `false`.
*   **Operators:** `>>` (Pipe-Forward), `=>` (Lambda Mapping), `=` (Assignment).

### 1.2 Smooth Mathematical Operator Matrix
Mathematical expressions inside formula lambdas are strictly continuous. Logical, relational, and conditional operators are entirely prohibited inside formula blocks to preserve analytical differentiability. Only continuous arithmetic operations are valid tokens:
*   `+`  : Addition. `Float + Float` and `Vector + Vector` stay arithmetic, including inside `combine`. For `SeatedSolid3D + SeatedSolid3D`, `+` is the unordered union of those two solids.
*   `-`  : Subtraction. `Float - Float` and `Vector - Vector` stay arithmetic. For `SeatedSolid3D - SeatedSolid3D`, `-` keeps the solid on the left and removes the solid on the right. Both operators are defined only for `SeatedSolid3D`, which exists only as the arguments and result of `combine`.
*   `*`  : Multiplication (Overloaded for Float * Float or scalar scaling Float * Vector).
*   `/`  : Division (`Float / Float`).
*   `^`  : Exponentiation / Power (`Float ^ Float`).

---

## 2. Core Language Evaluation Mechanics

### 2.1 Pure Immutability
All variables allocated via `def` or `param` are completely immutable constants. Once initialized, their states cannot be rewritten, mutated, or shadowed within the same lexical scope block. There is no concept of variable re-assignment, global mutations, or imperative loops.

### 2.2 Mandatory Component Export
Every script publishes one component with `export(expression)`. The expression's type is `Component`. A script with no export, or an export of a float, vector, raw `Solid3D`, or `join`, is rejected. When several exports appear, the last one is the published component. `Component(solid:, expose:)` builds that component from a `Solid3D` and the anchors in `expose`. A `join` returns a `Solid3D`, so it can be the `solid` argument.

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
        max_u: Float                    // u runs from 0 to this bound
        min_v: Float => Float           // Lower v bound at this u
        max_v: Float => Float           // Upper v bound at this u
        formula: (Float, Float) => Vector // Local surface lambda. The patch is v from min_v(u) to max_v(u).
    }
    ```
*   **`Solid3D`**: A watertight volumetric collection composed by joining discrete or chained `Surface2D` elements together at their shared boundary regions. A `join` returns this type.
*   **`SeatedSolid3D`**: The type of both solids inside `combine`. `+` and `-` are defined only for this type, and only there. It does not escape the function.
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

The core standard library packages primitive solids as first-class component blocks. `Component` is a function. `solid` is a `Solid3D`, and `expose` publishes that component's anchors, each a `Vector`. A `join` returns a `Solid3D`, so an assembly passes a join as `solid` the same way a simple part passes its faces. Each solid is written in its own frame. A join seats the placed part with one mate. `align` makes the planes parallel, then translates the points together, then rotates around that point in the plane. `meet` pairs one vector from each part for one of those steps. A surface formula's `Vector` labels are that part's own axes.

```parascript
def outer_shell = Surface2D(
    max_u: 2.0 * PI,
    min_v: u => 0.0, max_v: u => PI,
    formula: (u, v) => Vector(
        x: radius * cos(u) * sin(v),
        y: radius * sin(u) * sin(v),
        z: radius * cos(v)
    )
)

def Sphere = Component(
    solid: Solid3D(faces: Array(outer_shell)),
    expose: {
        center: Vector(x: 0.0, y: 0.0, z: 0.0),
        shell:  outer_shell
    }
)

fn build_face(offset: Vector, orientation: (Float, Float) => Vector) -> Surface2D {
    return Surface2D(
        max_u: size,
        min_v: u => 0.0, max_v: u => size,
        formula: (u, v) => orientation(u, v) + offset
    )
}

def f_bottom = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: u, y: v, z: 0.0))
def f_top    = build_face(Vector(x: 0.0, y: 0.0, z: size), (u, v) => Vector(x: u, y: v, z: 0.0))
def f_front  = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: u, y: 0.0, z: v))
def f_back   = build_face(Vector(x: 0.0, y: size, z: 0.0), (u, v) => Vector(x: u, y: 0.0, z: v))
def f_left   = build_face(Vector(x: 0.0, y: 0.0, z: 0.0),  (u, v) => Vector(x: 0.0, y: u, z: v))
def f_right  = build_face(Vector(x: size,  y: 0.0, z: 0.0),  (u, v) => Vector(x: 0.0, y: u, z: v))

def Cube = Component(
    solid: Solid3D(faces: Array(f_bottom, f_top, f_front, f_back, f_left, f_right)),
    expose: {
        center:      Vector(x: size / 2.0, y: size / 2.0, z: size / 2.0),
        bottom_face: f_bottom,
        top_face:    f_top,
        front_face:  f_front,
        back_face:   f_back,
        left_face:   f_left,
        right_face:  f_right
    }
)
```

---

## 2. Dynamic Assembly Layout Solver

`frame` and `placed` are components. `combine` is `(frame: SeatedSolid3D) => (placed: SeatedSolid3D) => SeatedSolid3D`. Inside that function, `+` unions the two seated solids in either order, and `-` keeps the solid on the left. Those operators exist only for `SeatedSolid3D`. The join expression is a `Solid3D`, so the seated type does not escape. The solid it returns has no anchors. The next mate reads anchors from a component, so that solid is passed through `Component(solid:, expose:)`.

```parascript
join(
    frame: Component,
    placed: Component,
    using: frame => placed => ConstraintSet,
    combine: (frame: SeatedSolid3D) => (placed: SeatedSolid3D) => SeatedSolid3D
) -> Solid3D
```

### 6.1 Mates

`using` is `frame => placed => ConstraintSet`. That function poses `placed` into the frame of `frame`. `combine` runs after that placement. A component publishes the vectors in `expose`. Inside `using`, `frame.up` and `placed.seat` read those anchors. Inside `combine`, those names are `SeatedSolid3D`, so `+` and `-` apply and the anchors are not visible. A name the component did not expose is rejected. The assembly publishes its own anchors. The renderer hangs the model on `origin`.

`align` is the rigid placement. It runs three alignments, in order. `planar` turns `placed` until the normals match, so the planes are parallel. `translation` then slides it until the points meet. `rotation` then turns it around that point, in the plane, until the in-plane directions match. `meet(frame: Vector, placed: Vector)` pairs one vector from each part for one of those alignments.

```parascript
def Outer = Component(
    solid: Solid3D(faces: [/* the enclosure, in its own frame */]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        cavity: Vector(x: wall, y: wall, z: wall)
    }
)

def Void = Component(
    solid: Solid3D(faces: [/* the cavity solid, in its own frame */]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        seat: Vector(x: 0.0, y: 0.0, z: 0.0)
    }
)

def HollowBox = Component(
    solid: join(frame: Outer, placed: Void, using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.cavity, placed: placed.seat),
        rotation: meet(frame: frame.right, placed: placed.right)
    ), combine: frame => placed => frame - placed),
    expose: { origin: Vector(x: w / 2.0, y: d / 2.0, z: h / 2.0) }
)
```

A part that keeps the orientation it was built with exposes the same `up` and `right` as the frame part. The translation `meet` is then the only step that moves it. An overlap is a vector added to the frame point, so the two exposed points still meet.

```parascript
join(frame: Block, placed: Hole, using: frame => placed => align(
    planar: meet(frame: frame.up, placed: placed.up),
    translation: meet(frame: frame.at, placed: placed.at),
    rotation: meet(frame: frame.right, placed: placed.right)
), combine: frame => placed => frame - placed)
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

// The assembly constraint solver evaluates a pure matrix equation using vector derivatives.
// The join is a solid. Component() is what the script exports.
def BearingSeat = Component(
    solid: join(
        frame: structural_cube,
        placed: rolling_bearing,
        using: frame => placed => align(
            planar: meet(frame: frame.top_face, placed: placed.shell),
            translation: meet(frame: frame.center, placed: placed.center),
            rotation: meet(frame: Vector(x: 1.0, y: 0.0, z: 0.0), placed: Vector(x: 0.0, y: 1.0, z: 0.0))
        ),
        combine: frame => placed => frame + placed
    ),
    expose: {}
)
export(BearingSeat)