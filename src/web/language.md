# ParaScript language

This is the language the workspace compiler accepts. Write a script using only the forms on this page. Paste it into the [workspace](/workspace) and press Run solver. The canonical text for a language model is [https://parascript.lindeque.family/language.md](https://parascript.lindeque.family/language.md).

A script builds one closed solid and publishes it as a component. There is no library of cubes, spheres, or cylinders. You write the faces.

The language is functional. A face, a part, and an assembly are functions of the numbers that can change. Call those functions with the sizes at the use site. When the same shape appears again, call the function again. Do not copy its faces.

## Guidance for a language model

Build the model in this order.

1. Bind `pi` when a curve needs it: `def pi = 3.14159265359`. A top-level number is for a value the whole script shares. A part's size is a parameter of that part. The patterned plate is the form to copy. The broom's sizes live in `parameters`, one group per part, and are read with `$handle.radius`. `Cylinder` still receives `radius` and `height` at the call.
2. Name each face for the surface it is. A face is a 2D surface. A cylinder is one `Tube` and two `Disk` calls. `Tube` is the round wall. `Disk` is a cap. `Cylinder` calls them from `solid: coords =>`: `Tube(coords: coords, radius: radius, height: height)`, `Disk(coords: coords, radius: radius, z: 0.0)`, and `Disk(coords: coords, radius: radius, z: height)`. The face list is how the solid is composed. A vector is `Vector(coords: coords, x:, y:, z:)`. `Component` passes one coordinate system into `solid: coords =>` and `expose: coords =>`. A script cannot construct that value. A helper defined outside those callbacks takes `coords` and the call passes it. `join`'s last parameter is that coordinate system, and `join` ignores the value, so a component passes `solid: join(...)`. A component does not expose that system. A direction a mate needs is an anchor on the part. Inside `using`, move a point with `frame.top.offset(x:, y:, z:)`. That result keeps the point's coordinate system. Two existing vectors combine with `add(vector:)` or `subtract(vector:)`, and both must carry that one system.
3. Write the base part next, also as a function of its sizes. A plate is a square box, so `Plate` calls `Box(width: size, depth: size, height: thickness)`. `Box` is the rectangular solid, centered on X and Y and standing on z = 0. Expose the anchors a pattern will read. A plate exposes `up`, `right`, `origin`, and `top`. `origin` is the center, and it is the point the viewer hangs the model on. `top` is the center of the top face.
4. A function that is not a component uses `snake_case`, and the name says what it returns. `rectangular_pattern` returns the grid of points. Its parameters are `column_count`, `row_count`, `column_pitch`, `row_pitch`, `columns`, and `rows`. `circular_pattern` returns the points of a circle. Its parameters are `point_count`, `radius`, and `indexes`. `column`, `row`, and each index count from `0`. A component uses `PascalCase`.
5. Map a cylinder function over that grid. The function receives the point, and it chooses `radius` and `height`, so each location can build a different cylinder. `CylinderAt` is that cylinder. It publishes `at`, the point it was built for.
6. Subtract those cylinders from the plate with `subtract_cylinders`. Add the pin cylinders with `add_cylinders`. One `join` cuts or adds one cylinder. The seat reads `plate.origin` or `plate.top`, and `placed.at`. The plate passed in exposes every anchor the function reads.
7. Write the numbers once, in `parameters`, grouped by the part they describe. Read a parameter with `$`, as in `$holes` and `$plate.size`. `plate.origin` is an anchor on the solid. Bind `def patterned_plate = cut_holes >> add_pins`, then export `patterned_plate(plate: Plate(size: $plate.size, thickness: $plate.thickness))`.

`value |> fn` fills `fn`'s next argument. `items |> map(f: item => ...)` is `map(f: ..., list: items)`. `items |> map` is rejected, because `map` is still waiting for `f`. `f >> g` composes two functions and runs `f` first. Both functions must already be waiting for one value. `>>` binds more tightly than `|>`.

A call is a name and its arguments. Bind `def adjust = shift(d: 3.0) >> scale(k: 2.0)`, then call `adjust(x: 4.0)`. `.` reads an anchor. `frame.up` is that anchor.

`map`'s function names its parameter `item`. `filter`'s predicate names its parameter `item` and returns `true` or `false`. A formula has no comparisons, so the predicate is the literal `true` or `false`. `integers(start: 0.0, count: 5.0)` is `[0.0, 1.0, 2.0, 3.0, 4.0]`. `start` is the first whole number and `count` is how many values, including `start`. A list has no length. On this plate, `$holes.columns` has one entry per `$holes.count`, and `$pins.indexes` has one entry per `$pins.count`.

`join`'s last parameter is the coordinate system, and `join` ignores it, so `join(...)` is already a function of that system. Pass the call as `solid`: `Component(solid: join(...), expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top })`. The `solid` argument is that `join`, or `coords =>` a solid or a component. A bare parameter that is not yet a solid or a component is rejected. A component does not expose that system, so `frame.coords` does not typecheck. A script has one coordinate system, so `plate.origin.add(vector: placed.at)` is legal. `setup`'s `coordinate_system` string tells the viewer which axis is up. The `using` parameters are named `frame` and `placed`, in that order. Inside `combine`, `frame - placed` cuts the placed solid away and `frame + placed` keeps both, and `coords` is not visible there. Seat one feature per `join`, then join the next feature onto that result. A `Solid3D` is one closed body.

A `def` is a top-level binding. A reusable function takes what it needs as parameters. `rectangular_pattern`, `CylinderAt`, and `subtract_cylinders` do. `cut_holes` and `add_pins` read the file's `parameters` groups. Inside a function, `let name = expression in expression` names a value for the expression after `in`. `Cylinder` binds its two caps that way.

## Lessons

The patterned plate is the script that follows these lessons. Copy that script for a grid of features on a part.

Write a shape once and call it. A cylinder is one `Tube` and two `Disk` calls. `Tube` is the round wall. `Disk` is a cap. A plate is a square box: `Plate` calls `Box(width: size, depth: size, height: thickness)`. The six faces stay in `Box`. That box is centered on X and Y and stands on z = 0. `origin` is the center. `top` is the center of the top face. The cavity example's `Box` publishes `corner` at its minimum point, and the void is seated from that corner.

`rectangular_pattern` returns the grid of points. `circular_pattern` returns the points of a circle. These are functions, so the names are `snake_case`. `CylinderAt`, `Plate`, and `Box` are components, so those names are `PascalCase`. `integers(start: 0.0, count: 5.0)` is `[0.0, 1.0, 2.0, 3.0, 4.0]`. A list has no length. `$holes.columns` has one entry per `$holes.count`. On this square plate the same list is the row list. `$pins.indexes` has one entry per pin. The plate's grid list has 5 entries. The pin list has 7. `column` and `row` count from `0`.

Map `CylinderAt` over the points. The function receives the point as `item`, and the call chooses `radius` and `height`. Each location can therefore build its own cylinder. This plate reads `$holes.radius` and `$holes.span` for every hole, and `$pins.radius` and `$pins.height` for every pin. `CylinderAt` publishes `at`, which is that point.

`subtract_cylinders` cuts that list out of the plate. `add_cylinders` unions the pin list onto that plate. `map` builds the list of cylinders. It does not cut them: each result would be a separate copy with one hole. An empty list returns the plate. Otherwise the first cylinder is cut from the plate, and that plate is passed on with the rest of the list. A hole's center meets `plate.origin.add(vector: placed.at)`. A pin's base meets `plate.top.add(vector: placed.at)`. The pin point is sunk by `$pins.bite`.

A size is a parameter of the part. The numbers for the file live in `parameters`, and the script reads them. `pi` is the value the whole script shares. A vector's first argument is the coordinate system from `solid: coords =>` and `expose: coords =>`. Write `Vector(coords: coords, x:, y:, z:)`. Inside `using`, move a point with `offset(x:, y:, z:)` and combine two vectors with `add(vector:)`. `|>` pipes a value into the next argument. `items |> map(f: item => ...)` fills `list`. `>>` composes two functions and binds more tightly. `patterned_plate` is `cut_holes >> add_pins`. A call names every argument, in parameter order. A `def` is top-level. One `join` seats one feature. Pass `join(...)` as `solid`. A `Solid3D` is one closed body.

## Script shape

A script starts with `setup`, then an optional `parameters` block, then bindings, then one export.

```text
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    plate: {
        size: 100.0,
        thickness: 8.0
    },
    holes: {
        radius: 3.0,
        pitch: $plate.size / 8.0
    }
}
```

- `units` is `"mm"` or `"inch"`. The numbers in the script are already in that unit. The compiler does not scale them.
- `coordinate_system` is `"Z-up"`, `"Y-up"`, or `"X-up"`. Write the coordinates in that system. The viewer uses it to decide which axis points up.
- `setup` has those two fields and no others.
- `parameters` sits immediately after `setup`. A group is a name and a block. A field is a name and a value. A group may contain groups.
- `$plate` reads that parameter. `$plate.size` reads a field. A solid may also be named `plate`; `plate.origin` is then an anchor. Inside the `plate` group, an earlier field is the short name `size`. A later group reads an earlier one with `$plate.size`.
- `.` on `$plate` reads a field. `.` on a component reads an anchor, such as `frame.up`.
- Bind a name with `def name = expression`. `param name = expression` is the same kind of binding. Bind each name once.
- The script ends with `export(...)`. The value must be a component, usually a call that supplies the sizes: `export(Brick(width: 40.0, depth: 30.0, height: 20.0))`. A number, a vector, a raw solid, a bare `join`, or a function that still expects arguments is rejected. When several exports appear, the last one is published.
- Comments are `//` to the end of the line. Statements are separated by the words above, not by semicolons.

## Names and arithmetic

A name is letters, digits, and underscores. Use `snake_case` for values and `PascalCase` for components. These words are reserved: `setup`, `parameters`, `param`, `def`, `fn`, `export`, `return`, `true`, `false`, `match`, `let`, `in`.

- Write numbers as decimals: `40.0`.
- There is no unary minus. A negative number is `0.0 - 16.0`.
- `+`, `-`, `*`, and `/` work on two numbers.
- Move a vector with `point.offset(x:, y:, z:)`. Combine two vectors with `point.add(vector:)` and `point.subtract(vector:)`. The result keeps the receiver's coordinate system, and `add` and `subtract` require both vectors to carry that system.
- Inside `combine`, `frame + placed` keeps both seated solids and `frame - placed` cuts the placed solid away.
- Do not multiply or divide a vector by a number. Scale each component: `Vector(coords: coords, x: 2.0 * x, y: 2.0 * y, z: 2.0 * z)`.
- `cos(rad: angle)` and `sin(rad: angle)` take radians. The argument name is `rad`.
- When you need pi, bind it: `def pi = 3.14159265359`.
- A formula has no `if`, no comparisons, and no loops. It is one arithmetic expression.
- `fn` and `return` do not define a function. A function is a binding of a lambda.

## Types

A definition may declare its type before the value.

```text
def same: T => T => number = x => y => 1.0
```

`T` is a type variable. The same name in one signature is the same variable, so both parameters of `same` have one type, and the result is a number. `A => B => number` is two independent variables. A signature is checked against the value. Each use of `same` still chooses its own `T`, so one call can pass two numbers and another call can pass two vectors.

These names are concrete types: `number`, `vector`, `boolean`, `string`, `component`, `solid`, `surface`, and `coordinate_system`. `[T]` is a list of `T`. `(number, vector)` is a tuple: each place keeps its own type, and the length is part of the type. `coordinate_system` is the value `Component` passes into a solid that builds geometry, into `expose`, and into `join`. A component does not expose it. A script cannot build one. `=>` is a function and groups to the right, so `T => T => number` is a function that returns a function. Parentheses group the other way: `(T => T) => number`. A comma inside those parentheses is a tuple type, so `(T => T)` is still grouping.

A parameter in a signature may carry the call name: `a: T => b: T => number`. The value then uses those names. A signature that omits the name keeps the name written on the value.

`map` has this signature. `T` is the element and `U` is the result:

```text
def map: (item: T => U) => (list: [T]) => [U] = f => list => ...
```

## Functions

Write a shape once, as a function, and call it at every place that shape appears. Pass the sizes at the call, including in `export`. A second copy of the same faces is a mistake. A second size is another call.

A size belongs to the part that uses it. It is a parameter of that part. The numbers for this file live in `parameters`, and the call reads them. Do not also bind `def size = 100.0`. A top-level number is for a value the whole script shares, such as `pi`.

The broom does this. `Cylinder` is defined once. The handle, the ferrule, and the hole through the handle are three calls. The hole is not drawn again on its side. `join` turns that same cylinder until its axis lies across the handle.

A function that is not a component uses `snake_case`, and the name says what it returns. `rectangular_pattern` returns the grid of points. `circular_pattern` returns the points of a circle. `map` calls `CylinderAt` once per point. That call chooses `radius` and `height` for the point it receives. `subtract_cylinders` cuts the resulting list out of the plate. The patterned plate is a square `Box`. It exposes `origin` and `top`. The numbers live in `parameters`. `cut_holes` reads `$holes` and `add_pins` reads `$pins`. `patterned_plate` is `cut_holes >> add_pins`. Export that function of the plate.

A face is a function too, and its name says which surface it is. `Tube` is the round wall. `Disk` is the round cap. A cylinder is those three faces:

```text
Tube(coords: coords, radius: radius, height: height)
Disk(coords: coords, radius: radius, z: 0.0)
Disk(coords: coords, radius: radius, z: height)
```

`let` names a value inside a function. The name is in scope after `in`, and it has the type of that value. `let (x, y) = pair in` takes a tuple apart. `Cylinder` uses `let` for the two caps. The anchors stay points: `bottom` in `expose` is `Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)`, and `bottom` the face is the `Disk`.

```text
let bottom = Disk(coords: coords, radius: radius, z: 0.0) in
let top = Disk(coords: coords, radius: radius, z: height) in
```

`.` reads an anchor, as in `frame.up`. Spaces do not change that. `frame . up` is the same as `frame.up`.

`>>` composes two functions, left to right. The left function runs first, and its result is the right function's argument. The composed function keeps the left function's parameter name. Each function must already be waiting for that one value:

```text
def shift = d => x => x + d
def scale = k => x => k * x
def adjust = shift(d: 3.0) >> scale(k: 2.0)
```

`adjust(x: 4.0)` is `scale(k: 2.0, x: shift(d: 3.0, x: 4.0))`, which is `14`. `shift >> scale` is rejected, because `shift` is still waiting for `d`.

`|>` pipes a value into a function, left to right. The value fills the function's next argument. Write the earlier arguments in the call and leave that last one out:

```text
[1.0, 2.0, 3.0] |> map(f: item => item * 2.0)
```

That is `map(f: item => item * 2.0, list: [1.0, 2.0, 3.0])`, which is `[2.0, 4.0, 6.0]`. The same value can continue into the next function:

```text
[1.0, 2.0, 3.0]
    |> map(f: item => item * 2.0)
    |> filter(predicate: item => true)
```

`filter` keeps every element here, so the result is still `[2.0, 4.0, 6.0]`.

`>>` composes functions. `|>` sends a value into a function. `>>` binds more tightly, so this pipes `4.0` into the composed function and the result is `14`:

```text
4.0 |> shift(d: 3.0) >> scale(k: 2.0)
```

The function on the right must already be waiting for the piped value. `map` waits for `f` first and `list` second, so pipe the list: `items |> map(f: item => ...)`. `items |> map` is rejected, because `map` is still waiting for `f`.

A function takes one argument at a time.

```text
def pad = coords => amount => Vector(coords: coords, x: amount, y: amount, z: 0.0)
def Brick = width => depth => height => Component(...)
```

Call it with every argument, in the same order as the parameters, each by name:

```text
export(Brick(width: 40.0, depth: 30.0, height: 20.0))
```

`Brick(40.0, 30.0, 20.0)` is rejected. The names are part of the call. A call that leaves arguments off returns a function, and `export` cannot publish a function. Pass every argument.

## Lists

A list is `[1.0, 2.0]`. `head :: tail` puts `head` at the front. `[]` is the empty list.

`match` takes the empty list, or it splits the first element from the rest:

```text
match items {
    [] => 0.0,
    head :: tail => head
}
```

A `def` may call itself.

`map` and `filter` are built in. `map` calls `f` once per element. That function's parameter is named `item`:

```text
map(f: item => item * 2.0, list: [1.0, 2.0])
```

That is `[2.0, 4.0]`. The same call reads left to right with `|>`, which fills `list`:

```text
[1.0, 2.0] |> map(f: item => item * 2.0)
```

`filter` keeps the elements for which `predicate` returns `true`. `true` and `false` are the boolean values. The predicate's parameter is also named `item`:

```text
filter(predicate: item => true, list: [1.0, 2.0])
```

That keeps both elements. `item => false` keeps none.

`integers` builds whole numbers. `start` is the first value. `count` is how many values, including `start`. The arguments are named, in that order:

```text
integers(start: 0.0, count: 5.0)
```

That is `[0.0, 1.0, 2.0, 3.0, 4.0]`. The last value is `4.0`. `integers(start: 0.0, count: 0.0)` is `[]`. `integers(start: 0.0 - 2.0, count: 3.0)` is `[-2.0, -1.0, 0.0]`. `start` and `count` are whole numbers, and `count` is zero or more. `5.0 |> integers(start: 1.0)` fills `count`, so that list runs from `1.0` through `5.0`.

`map` returns a new list. On the patterned plate that list is one `CylinderAt` per point. `subtract_cylinders` takes the plate and that list. An empty list returns the plate. Each other step cuts one cylinder from the plate and passes that plate on.

## Tuples

A tuple holds a fixed number of values, and each value keeps its own type. A list cannot do that: every element of `[T]` is a `T`.

```text
def pair = (1.0, true)
def nested = (1.0, (2.0, 3.0))
```

`(1.0 + 2.0)` has no comma, so the parentheses only group the sum. A tuple needs at least two elements. Take it apart with `let`. The names are in scope after `in`:

```text
def sum = let (x, (y, z)) = nested in x + y + z
```

That `sum` is `6`. A name in one pattern is bound once. There is no `pair.0` and no `pair.x`. A signature writes the same shape. `T` is one type variable in both places, and `U` is another:

```text
def first: (T, U) => T = pair => let (x, y) = pair in x
```

`first(pair: (1.0, true))` is `1.0`. `first(pair: (Mark.at, 2.0))` is the vector. `(number, number, number)` does not match `(number, number)`.

## Vectors

A vector carries the script's coordinate system, then `x`, `y`, and `z`, in that order:

```text
Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
```

`coords` is required, and that parameter name is `coords`. A script cannot construct a coordinate system. There is no `CoordinateSystem(...)` expression. `Component` creates one system for the script. A solid that builds geometry receives it as `coords =>`. `expose` receives it the same way. A component does not expose that system. `frame.coords` does not typecheck. A direction used by a mate is an anchor, as the broom's cylinder publishes `forward`.

```text
Component(
    solid: coords => Solid3D(faces: [ ... ]),
    expose: coords => {
        up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
    }
)
```

Write a `Vector` inside `solid: coords =>` or `expose: coords =>`, or inside a helper that receives `coords` and is called from there. A face formula is `u => v => Vector(coords: coords, ...)`, and that formula sits in the solid callback so `coords` is in scope. `join` takes the coordinate system last and ignores it, so the solid of a join is the call itself: `solid: join(...)`. Inside `using` there is no outer `coords`. Move a point with `offset`. The result keeps that point's coordinate system:

```text
frame.top.offset(x: 0.0, y: 0.0, z: 0.0 - overlap)
```

Two vectors that already exist combine with `add` and `subtract`. The argument name is `vector`. Both must carry the same coordinate system, and the result keeps the receiver's system:

```text
plate.origin.add(vector: placed.at)
```

`+` and `-` do not combine vectors. `coords` is opaque. It is not an anchor, and an expose block cannot publish a field named `coords`. The `coordinate_system` field in `setup` tells the viewer which axis is up. It is not a value the script can pass to `Vector`. In a signature the type is written `coordinate_system`.

`up` is the direction the viewer treats as up. For `Z-up` that is `Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)`. `right` is `Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0)`.

## Faces

A face is a `Surface2D`. `u` runs from `0` to `max_u`. At each `u`, `v` runs from `min_v(u)` to `max_v(u)`. Both bounds are functions of `u`. The formula is two lambdas, `u => v => Vector(coords: coords, ...)`, in the part's own coordinates.

```text
Surface2D(
    max_u: width,
    min_v: u => 0.0,
    max_v: u => depth,
    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
)
```

The viewer samples each face on a grid of 16 to 32 steps. A detail much smaller than its face, such as one turn of a screw thread, needs its own face. Splitting a large smooth face into several faces is how you keep a small feature visible.

## Solids and components

`Solid3D(faces: [ face, face ])` collects the faces. A closed box has six faces: bottom, top, and four walls. The faces must meet at their edges and enclose the volume.

`Component(solid: coords => solid, expose: coords => { name: vector })` wraps a solid and publishes anchors. `solid` is `coords =>` a solid or a component, or `join(...)`, which is already a function of the coordinate system. `expose` is `coords => { anchors }`, and that parameter is named `coords`. Every anchor is a vector. Names are unique. `part.anchor` reads an anchor the component exposed. `part.coords` does not typecheck, and an expose block cannot publish `coords`. Any other name is an error. An empty publish list is `expose: coords => {}`.

Expose `origin` as the point the viewer hangs the model on. The usual choice is the center of the part.

```text
expose: coords => {
    up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
    right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
    origin: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: height / 2.0)
}
```

## Joining two components

`join` places one component onto another. Both `frame` and `placed` must already be components. A function may receive a component and read the anchors it uses, as in `plate.origin`. The component passed at the call must expose every anchor that function reads. An inline `using` lambda can read `frame.up` and `placed.up` for the same reason. It moves a point with `frame.top.offset(x:, y:, z:)` and combines two vectors with `add(vector:)`. The last parameter is `coords`. `Component` supplies it, and `join` ignores the value, so the call you pass as `solid` omits it. Writing the coordinate system yourself makes the join a solid immediately. A bare `join(...)` is still a function of the coordinate system. The geometry has no anchors, so wrap it in `Component` and publish the anchors the next step needs before you export it or join it again.

```text
join(
    frame: Outer,
    placed: Hole,
    using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.at, placed: placed.at),
        rotation: meet(frame: frame.right, placed: placed.right)
    ),
    combine: frame => placed => frame - placed
)
```

`using` is `frame => placed => align(...)`. The parameter names are `frame` and `placed`. `align` runs three steps, in this order:

1. `planar` turns `placed` until the two direction vectors are parallel.
2. `translation` slides it until the two points meet.
3. `rotation` turns it in that plane until the two direction vectors match.

`meet(frame: vector, placed: vector)` pairs one vector from each part. The `planar` vectors must have a direction. A zero anchor, such as `Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)` published on the part, is rejected when the join runs.

Inside `combine`, the names `frame` and `placed` are the seated solids. Their anchors are not visible, and neither is `coords`. `frame - placed` keeps the frame and cuts the placed solid away. `frame + placed` keeps both. Those two meanings of `+` and `-` exist only in `combine`.

To leave a wall of material, move the frame point:

```text
translation: meet(frame: frame.corner.offset(x: wall, y: wall, z: wall), placed: placed.corner)
```

A part that should keep the orientation it was built with exposes the same `up` and `right` as the frame part. The translation step is then the only one that moves it.

## Example: a closed box

`Brick` is a function of its three sizes. The export call is where those sizes are chosen. Another brick is another call.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

def Brick = width => depth => height => Component(
    solid: coords => Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u, y: v, z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: depth, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: width, y: u, z: v))
    ]),
    expose: coords => {
        up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
        right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: height / 2.0)
    }
)

export(Brick(width: 40.0, depth: 30.0, height: 20.0))
```

## Example: a box with a cavity

`Box` is the reusable solid. `HollowBox` is a function of the outer size and the wall thickness. It calls `Box` twice. `align` seats the void inside the outer box, and `frame - placed` cuts it out. The cavity is as tall as the outer box and starts one wall thickness up, so the floor remains and the top stays open. The export call chooses the numbers.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

def Box = width => depth => height => Component(
    solid: coords => Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u, y: v, z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: 0.0, z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u, y: depth, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: 0.0, y: u, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: width, y: u, z: v))
    ]),
    expose: coords => {
        up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
        right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
        corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
    }
)

def HollowBox = w => d => h => wall => Component(
    solid: join(
        frame: Box(width: w, depth: d, height: h),
        placed: Box(width: w - (wall * 2.0), depth: d - (wall * 2.0), height: h),
        using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.corner.offset(x: wall, y: wall, z: wall), placed: placed.corner),
            rotation: meet(frame: frame.right, placed: placed.right)
        ),
        combine: frame => placed => frame - placed
    ),
    expose: coords => {
        origin: Vector(coords: coords, x: w / 2.0, y: d / 2.0, z: h / 2.0)
    }
)

export(HollowBox(w: 100.0, d: 50.0, h: 30.0, wall: 3.0))
```

## Example: a sphere

There is no sphere primitive. `Sphere` is a function of `radius`, and the export call is where the radius is chosen. One face covers the surface. `u` runs from `0` to `2.0 * pi`, once around. `v` runs from `0` to `pi`, from the top pole to the bottom pole. At both poles `sin(rad: v)` is `0`, so that row of samples meets at one point and the face closes.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

def pi = 3.14159265359

def Sphere = radius => Component(
    solid: coords => Solid3D(faces: [
        Surface2D(
            max_u: 2.0 * pi,
            min_v: u => 0.0,
            max_v: u => pi,
            formula: u => v => Vector(coords: coords, 
                x: radius * cos(rad: u) * sin(rad: v),
                y: radius * sin(rad: u) * sin(rad: v),
                z: radius * cos(rad: v)
            )
        )
    ]),
    expose: coords => {
        up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
        right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
    }
)

export(Sphere(radius: 25.0))
```

## Example: a broom

The handle, the ferrule, and the hanging hole are the same shape. `Cylinder` is that shape, written once, as a function of `radius` and `height`. It names its wall and its two caps with `let`: one `Tube`, and `Disk` at `z: 0.0` and at `z: height`. `Tube` and `Disk` are faces. The handle and the ferrule stand on `up`. The hole is the same call turned by `join`, so its axis lies across the handle, `$hang.from_top` below the handle's top. That axis meets `forward`, the anchor `Cylinder` publishes as `(0, 1, 0)`. Do not write a second cylinder along that other axis. Do not build that direction with `Vector(coords: frame.coords, ...)`. The head and the bristle skirt name their faces with `let`. Each join seats the next part on the anchors the two parts expose, then adds it or cuts it away. `export(Broom)` publishes the finished component. The sizes for this broom live in `parameters`, grouped by part, and the parts read them with `$handle.radius`. `pi` is the number the whole script shares. `Cylinder` receives `radius` and `height` at each call.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    handle: {
        radius: 11.0,
        length: 1000.0,
        embed: 14.0
    },
    hang: {
        radius: 4.0,
        from_top: 30.0
    },
    head: {
        width: 240.0,
        depth: 50.0,
        height: 24.0
    },
    ferrule: {
        radius: 16.0,
        height: 36.0,
        bite: 1.0
    },
    bristles: {
        height: 90.0,
        bite: 3.0,
        top: {
            width: 220.0,
            depth: 36.0
        },
        bottom: {
            width: 300.0,
            depth: 68.0
        }
    }
}

def pi = 3.14159265359

def Cylinder = radius => height =>
    Component(
        solid: coords =>
            let Disk = z => Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, 
                    x: v * cos(rad: u),
                    y: v * sin(rad: u),
                    z: z)) in
            let wall = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, 
                    x: radius * cos(rad: u),
                    y: radius * sin(rad: u),
                    z: v)) in
            let bottom = Disk(z: 0.0) in
            let top = Disk(z: height) in
            Solid3D(faces: [
                    wall,
                    bottom,
                    top
                ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            forward: Vector(coords: coords, x: 0.0, y: 1.0, z: 0.0),
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: height),
            center: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
        }
    )

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
                formula: u => v => Vector(coords: coords, x: 0, y: u, z: v)) in
            let right = Surface2D(
                max_u: depth,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: width, y: u, z: v)) in
            Solid3D(faces: [
                    top,
                    bottom,
                    front,
                    back,
                    left,
                    right
                ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: width/2.0, y: depth/2.0, z: height)
        }
    )

def Bristles =
    Component(
        solid: coords =>
            let bottom = Surface2D(
                max_u: $bristles.bottom.width,
                min_v: u => 0.0,
                max_v: u => $bristles.bottom.depth,
                formula: u => v => Vector(coords: coords, 
                    x: u - ($bristles.bottom.width / 2.0),
                    y: v - ($bristles.bottom.depth / 2.0),
                    z: 0.0)) in
            let top = Surface2D(
                max_u: $bristles.top.width,
                min_v: u => 0.0,
                max_v: u => $bristles.top.depth,
                formula: u => v => Vector(coords: coords, 
                    x: u - ($bristles.top.width / 2.0),
                    y: v - ($bristles.top.depth / 2.0),
                    z: $bristles.height)) in

            let f = t => b => u => 
                0.5*(($bristles.height-u)*b / $bristles.height) + 0.5*(u*t / $bristles.height) in

            let face = bottom => top => x_projection => y_projection =>
                let max_v = f(t: top, b: bottom) in
                Surface2D(
                    max_u: $bristles.height,
                    min_v: u => 0.0-max_v(u: u),
                    max_v: max_v,
                    formula: u => v => Vector(coords: coords, 
                        x: x_projection(u: u, v: v),
                        y: y_projection(u: u, v: v),
                        z: u
                    )
                ) in
                
            let front = face(
                bottom: $bristles.bottom.width,
                top: $bristles.top.width, 
                x_projection: u=>v=>v, 
                y_projection: u=>v=>f(
                    t: $bristles.top.depth, 
                    b: $bristles.bottom.depth, 
                    u: u)) in
            let back = face(
                bottom: $bristles.bottom.width,
                top: $bristles.top.width, 
                x_projection: u=>v=>v, 
                y_projection: u=>v=>0.0-f(
                    t: $bristles.top.depth,
                    b: $bristles.bottom.depth,
                    u: u)) in
            let left = face(
                bottom: $bristles.bottom.depth,
                top: $bristles.top.depth,
                x_projection: u=>v=>0.0-f(
                    t: $bristles.top.width,
                    b: $bristles.bottom.width,
                    u: u),
                y_projection:u=>v=>v) in
            let right = face(
                bottom: $bristles.bottom.depth,
                top: $bristles.top.depth,
                x_projection: u=>v=>f(
                    t: $bristles.top.width,
                    b: $bristles.bottom.width,
                    u: u),
                y_projection:u=>v=>v) in
            Solid3D(faces: [
                    bottom,
                    top,
                    back,
                    front,
                    left,
                    right
                ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: $bristles.height)
        }
    )

def Broom =
    let handle = Cylinder(
        radius: $handle.radius,
        height: $handle.length) in
    let hang_hole = Cylinder(
        radius: $hang.radius,
        height: $handle.radius * 2.0 + 8.0) in
    let socket = $ferrule.height - $ferrule.bite + $handle.embed in
    let handle_bottom = $head.height - $handle.embed in
    let handle_top = handle_bottom + $handle.length in
    let bristle_tip = $bristles.bite - $bristles.height in
    let stick = Component(
        solid: join(
            frame: handle,
            placed: hang_hole,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.forward,
                    placed: placed.up),
                translation: meet(
                    frame: frame.top.offset(x: 0.0,
                        y: 0.0,
                        z: 0.0 - $hang.from_top),
                    placed: placed.center),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame - placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    let collar = Component(
        solid: join(
            frame: Box(
                width: $head.width,
                depth: $head.depth,
                height: $head.height),
            placed: Cylinder(
                radius: $ferrule.radius,
                height: $ferrule.height)
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.top.offset(x: 0.0,
                        y: 0.0,
                        z: 0.0 - $ferrule.bite),
                    placed: placed.bottom),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, 
                x: $head.width / 2.0,
                y: $head.depth / 2.0,
                z: $head.height - $ferrule.bite + $ferrule.height)
        }
    ) in
    let headed = Component(
        solid: join(
            frame: collar,
            placed: stick,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.top.offset(x: 0.0,
                        y: 0.0,
                        z: 0.0 - socket),
                    placed: placed.bottom),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            seat: Vector(coords: coords, x: $head.width / 2.0, y: $head.depth / 2.0, z: 0.0)
        }
    ) in
    Component(
        solid: join(
            frame: headed,
            placed: Bristles,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.seat.offset(x: 0.0,
                        y: 0.0,
                        z: $bristles.bite),
                    placed: placed.top),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            origin: Vector(coords: coords, 
                x: $head.width / 2.0,
                y: $head.depth / 2.0,
                z: (handle_top + bristle_tip) / 2.0)
        }
    )

export(Broom)
```

## Example: a patterned plate

`pi` is the only number bound for the whole script. `Disk` and `Tube` are the faces. `Cylinder` names the two caps with `let` and calls `Tube` once. `CylinderAt` calls that cylinder and publishes `at`. `Box` is the rectangular solid: six faces, centered on X and Y, standing on z = 0. `Plate` is a square box, `Box(width: size, depth: size, height: thickness)`. The cavity example's box publishes `corner` at its minimum point, and the void is seated from that corner. This box is centered so `origin` is the center the pattern measures from. `Plate` exposes `up`, `right`, `origin`, and `top`. The numbers live in `parameters`. `cut_holes` reads `$holes`, `add_pins` reads `$pins`, and `patterned_plate` is `cut_holes >> add_pins`. The plate passed to that function is `Plate(size: $plate.size, thickness: $plate.thickness)`. Do not also bind `def size = 100.0` at the top.

`rectangular_pattern` returns the grid of points. `$holes.columns` has one entry per `$holes.count`, and this square plate uses that same list for the rows. Those five columns are also `integers(start: 0.0, count: 5.0)`. `circular_pattern` returns the points of the pin circle. `$pins.indexes` has one entry per pin. There is no way to ask a list for its length, so both lists are fields of those groups. The column list has 5 entries, so the grid is 5 by 5. The pin list has 7 entries.

`map` builds one `CylinderAt` per point. The function names its parameter `item`. `radius` and `height` are arguments of that call, so a point can carry a cylinder of its own size. This plate uses one hole radius and one pin radius. `CylinderAt` keeps the point as `at`. `subtract_cylinders` cuts the hole list out of the one plate. `add_cylinders` unions the pin list onto that drilled solid. Each `join` seats one cylinder: a hole center meets `plate.origin.add(vector: placed.at)`, and a pin base meets `plate.top.add(vector: placed.at)`. The cutter is taller than the plate, so the hole passes through both faces. The pin point is sunk by `$pins.bite`, so the pin overlaps the plate and stands above it.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

// The model's sizes, grouped by the part they describe.
// cut_holes reads $holes. add_pins reads $pins. patterned_plate is cut_holes >> add_pins.
parameters {
    plate: {
        size: 100.0,
        thickness: 8.0
    },
    holes: {
        radius: 3.0,
        span: 16.0,
        count: 5.0,
        pitch: 12.0,
        columns: [0.0, 1.0, 2.0, 3.0, 4.0]
    },
    pins: {
        radius: 3.0,
        height: 12.0,
        count: 7.0,
        bite: 1.0,
        ring: 40.0,
        indexes: [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    }
}

// pi is a value the whole script shares.
def pi = 3.14159265359

// A round cap. A cylinder calls this twice, at the bottom and at the top.
def Disk = coords => radius => z => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => radius,
    formula: u => v => Vector(coords: coords, 
        x: v * cos(rad: u),
        y: v * sin(rad: u),
        z: z
    )
)

// The round wall. This is a face, the same kind of 2D surface as Disk.
def Tube = coords => radius => height => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => height,
    formula: u => v => Vector(coords: coords, 
        x: radius * cos(rad: u),
        y: radius * sin(rad: u),
        z: v
    )
)

// The rectangular solid: six faces. Centered on X and Y, standing on z = 0.
// origin is the center. top is the center of the top face.
def Box = width => depth => height => Component(
    solid: coords => Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u - (width / 2.0), y: v - (depth / 2.0), z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(coords: coords, x: u - (width / 2.0), y: v - (depth / 2.0), z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u - (width / 2.0), y: 0.0 - (depth / 2.0), z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: u - (width / 2.0), y: depth / 2.0, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: 0.0 - (width / 2.0), y: u - (depth / 2.0), z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(coords: coords, x: width / 2.0, y: u - (depth / 2.0), z: v))
    ]),
    expose: coords => {
        up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
        right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0),
        top: Vector(coords: coords, x: 0.0, y: 0.0, z: height)
    }
)

// A square box. size is the width and the depth.
def Plate = size => thickness => Box(width: size, depth: size, height: thickness)

// One centered grid point. column and row count from 0.
def grid_point = coords => column_count => row_count => column_pitch => row_pitch => column => row => Vector(coords: coords, 
    x: (column - ((column_count - 1.0) / 2.0)) * column_pitch,
    y: (row - ((row_count - 1.0) / 2.0)) * row_pitch,
    z: 0.0
)

def row_points = coords => column_count => row_count => column_pitch => row_pitch => columns => row => columns
    |> map(f: item => grid_point(coords: coords, column_count: column_count, row_count: row_count, column_pitch: column_pitch, row_pitch: row_pitch, column: item, row: row))

def append_points = left => right => match left {
    [] => right,
    head :: tail => head :: append_points(left: tail, right: right)
}

def flatten_rows = rows => match rows {
    [] => [],
    head :: tail => append_points(left: head, right: flatten_rows(rows: tail))
}

// The grid of points. columns and rows each have one entry per count, from 0.
def rectangular_pattern = coords => column_count => row_count => column_pitch => row_pitch => columns => rows => rows
    |> map(f: item => row_points(coords: coords, column_count: column_count, row_count: row_count, column_pitch: column_pitch, row_pitch: row_pitch, columns: columns, row: item))
    |> flatten_rows

// The points of a circle in the plate's plane. indexes has one entry per point, from 0.
def circular_pattern = coords => point_count => radius => indexes => indexes
    |> map(f: item => Vector(coords: coords, 
        x: radius * cos(rad: item * (2.0 * pi / point_count)),
        y: radius * sin(rad: item * (2.0 * pi / point_count)),
        z: 0.0
    ))

// The cylinder. bottom and top name the caps. The anchors are the points a join meets.
def Cylinder = radius => height =>
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
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: height),
            center: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
        }
    )

// A cylinder for one point. at is the point, kept so the plate can seat it.
def CylinderAt = radius => height => at =>
    let part = Cylinder(radius: radius, height: height) in
    Component(
        solid: coords => part,
        expose: coords => {
            up: part.up,
            right: part.right,
            bottom: part.bottom,
            top: part.top,
            center: part.center,
            at: at
        }
    )

// Cut one cylinder from the plate. The result is that plate, and it still exposes origin and top.
// The center meets the plate's center, shifted by the point.
def subtract_cylinder = plate => placed => Component(
    solid: join(
        frame: plate,
        placed: placed,
        using: frame => placed => align(
            planar: meet(frame: plate.up, placed: placed.up),
            translation: meet(frame: plate.origin.add(vector: placed.at), placed: placed.center),
            rotation: meet(frame: plate.right, placed: placed.right)
        ),
        combine: frame => placed => frame - placed
    ),
    expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
)

// map builds the cylinders. It cannot cut them, because each cut needs the plate the previous cut returned.
def subtract_cylinders = plate => cylinders => match cylinders {
    [] => plate,
    head :: tail => subtract_cylinders(
        plate: subtract_cylinder(plate: plate, placed: head),
        cylinders: tail
    )
}

// Add one cylinder to the plate. Its base meets the plate's top, shifted by the point.
def add_cylinder = plate => placed => Component(
    solid: join(
        frame: plate,
        placed: placed,
        using: frame => placed => align(
            planar: meet(frame: plate.up, placed: placed.up),
            translation: meet(frame: plate.top.add(vector: placed.at), placed: placed.bottom),
            rotation: meet(frame: plate.right, placed: placed.right)
        ),
        combine: frame => placed => frame + placed
    ),
    expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
)

def add_cylinders = plate => cylinders => match cylinders {
    [] => plate,
    head :: tail => add_cylinders(
        plate: add_cylinder(plate: plate, placed: head),
        cylinders: tail
    )
}

// The grid, then one cylinder per point, then those cylinders cut out of this plate.
def cut_holes = plate => Component(
    solid: coords =>
        let drilled = rectangular_pattern(
            coords: coords,
            column_count: $holes.count,
            row_count: $holes.count,
            column_pitch: $holes.pitch,
            row_pitch: $holes.pitch,
            columns: $holes.columns,
            rows: $holes.columns
        )
            |> map(f: item => CylinderAt(radius: $holes.radius, height: $holes.span, at: item))
            |> subtract_cylinders(plate: plate) in
        drilled,
    expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
)

// The circle, sunk by $pins.bite, then one pin per point, added to the plate.
def add_pins = plate => Component(
    solid: coords =>
        let pinned = circular_pattern(
            coords: coords,
            point_count: $pins.count,
            radius: $pins.ring,
            indexes: $pins.indexes
        )
            |> map(f: item => item.offset(x: 0.0, y: 0.0, z: 0.0 - $pins.bite))
            |> map(f: item => CylinderAt(radius: $pins.radius, height: $pins.height, at: item))
            |> add_cylinders(plate: plate) in
        pinned,
    expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
)

def patterned_plate = cut_holes >> add_pins

export(patterned_plate(
    plate: Plate(size: $plate.size, thickness: $plate.thickness)
))
```

## Forms the compiler rejects

- A built-in `Cube`, `Sphere`, or `Cylinder`. Those names exist only when the script defines them.
- `if`, `for`, `while`, comparisons, and asking a list for its length. Whole numbers are `integers(start:, count:)`.
- A unary minus, as in `-16.0`. Write `0.0 - 16.0`.
- Multiplying or dividing a vector by a number.
- `^`. It is not power.
- `fn name(...)`, `return`, and a `def` inside a function. Name an inner value with `let name = expression in expression`.
- A positional call, such as `Brick(40.0, 30.0, 20.0)`. The parameter names are part of the call, in order.
- A signature that disagrees with the value, such as a `number` result whose value is a vector.
- `export` of a number, a vector, a raw solid, a bare `join`, or a function that still expects arguments.
- A `join` whose `frame` or `placed` is a raw solid instead of a component.
- `Component(solid: coords => ...)` whose value is neither a solid nor a component. Pass `join(...)` as `solid`. A component uses that component's geometry. `solid: coords => join(...)` is rejected, because that coordinate system is `join`'s last parameter.
- A `parameters` block anywhere except immediately after `setup`.
- A field the parameter group does not have, and a bare `plate` where the script means `$plate`.
- Reading an anchor the component did not expose, and reading `vector.x`. Member access reads a field of a parameter group, or an anchor on a component. A tuple has no `pair.0` and no `pair.x`. Take it apart with `let (x, y) = pair in`.
- A tuple of one value. Parentheses without a comma group an expression: `(1.0 + 2.0)` is the sum.
- `.` used as composition, and `items |> map` while `map` is still waiting for `f`.
- `Curve1D`. It does not become a solid, and the workspace does not draw it.
- `Vector(x:, y:, z:)` without `coords` first, and any expression that tries to construct a coordinate system.
- `+` or `-` between vectors. Move a point with `offset(x:, y:, z:)`. Combine two vectors with `add(vector:)` or `subtract(vector:)`.
- An anchor named `coords`. That name is the component's coordinate system.
- `solid:` written as a value other than `coords =>` a solid or `join(...)`, and `expose:` written as a value instead of `coords =>`.
