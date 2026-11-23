# ParaScript language

This is the language the workspace compiler accepts. Write a script using only the forms on this page. Paste it into the [workspace](/workspace) and press Run solver. The canonical text for a language model is [https://parascript.lindeque.family/language.md](https://parascript.lindeque.family/language.md).

A script builds one closed solid and publishes it as a component. There is no library of cubes, spheres, or cylinders. You write the faces.

The language is functional. A face, a part, and an assembly are functions of the numbers that can change. Call those functions with the sizes at the use site. When the same shape appears again, call the function again. Do not copy its faces.

## Guidance for a language model

The complete scripts below are the examples. Copy the smallest one that already does the thing you need, and change its parameters. The plate is the form to copy for a grid of features and a circle of features. The screw is the form to copy when a measurement comes from a standard. The broom is the form to copy when one shape is seated several times by `join`.

Build the model in this order.

1. Put the model's parameters in the `parameters` section, immediately after `setup`. A size, a count, and a position are fields there, grouped by the part they describe. When a measurement comes from a standard, put that field in a group named for the standard, as the screw does with `iso_4017` and `iso_68_1`. Read a field with `$`, as in `$plate.size` and `$holes.radius`. A later field in a group may use an earlier field by its short name. Bind `pi` when a curve needs it: `def pi = 3.14159265359`. A top-level number is for a value the whole script shares, such as `pi`. The broom's sizes live in that section, one group per part, and are read with `$handle.radius`. `Cylinder` still receives `radius` and `height` at the call.
2. Name each face for the surface it is. A face is a 2D surface. A cylinder is one `Tube` and two `Disk` calls, named with `let` inside `Cylinder`, as the plate and the broom do. `Tube` is the round wall. `Disk` is a cap. `Cylinder` calls them from `solid: coords =>`: `Tube(coords: coords, radius: radius, height: height)`, `Disk(coords: coords, radius: radius, z: 0.0)`, and `Disk(coords: coords, radius: radius, z: height)`. A box is six faces in `Box`, standing on z = 0, with `corner` at the minimum point. A vector is `Vector(coords: coords, x:, y:, z:)`. `Component` passes one coordinate system into `solid: coords =>` and `expose: coords =>`. A script cannot construct that value. A helper defined outside those callbacks takes `coords` and the call passes it. `join`'s last parameter is that coordinate system, and `join` ignores the value, so a component passes `solid: join(...)`. A component does not expose that system. A direction a mate needs is an anchor on the part. Inside `using`, move a point with `offset(x:, y:, z:)` and combine two vectors with `add(vector:)` or `subtract(vector:)`.
3. Write a shape once, as a function of the sizes that change, and call it. `Box(width:, depth:, height:)` and `Cylinder(radius:, height:)` are those functions. The plate is `Box(width: $plate.size, depth: $plate.size, height: $plate.thickness)`. The host exposes `up`, `right`, and `corner`. A part that will be seated exposes `up`, `right`, and `bottom`. The exported component exposes `origin`, the point the viewer hangs the model on.
4. A function that is not a component uses `snake_case`, and the name says what it returns. `vector_grid` returns the points of a grid. `circular_pattern` returns the points of a circle. `place_components` seats one component at each of those points. A component uses `PascalCase`, such as `Plate`, `Box`, and `Cylinder`.
5. Seat repeated parts with `place_components`, as the plate and the remote do. It folds the point list, and each step is one `join`. The point is added to the host's `corner` and meets the placed part's `bottom`. Pass `combine` at the call. `combine: frame => placed => frame - placed` cuts the placed solid away. `combine: frame => placed => frame + placed` keeps both. The lambda is written at the call, and its parameters are named `frame` and `placed`.
6. `integers(start:, count:)` builds the whole numbers a grid or a circle needs. `map` walks a list, and its parameter is named `item`. `|>` fills the next argument, so a list can be piped into `map`. A list has no length. `fold` on the plate is a right fold the script defines. The language does not provide `fold`.
7. Export one component. The plate exports `Component(solid: coords => PlateWithKnobs(coords: coords), expose: coords => { origin: ... })`. The broom exports the finished `Broom`. A `join` returns a solid without anchors, so wrap it in `Component` and publish the anchors the next mate reads.

`value |> fn` fills `fn`'s next argument. `items |> map(f: item => ...)` is `map(f: ..., list: items)`. `items |> map` is rejected, because `map` is still waiting for `f`. `f >> g` composes two functions and runs `f` first. Both functions must already be waiting for one value. `>>` binds more tightly than `|>`.

A call is a name and its arguments. Bind `def adjust = shift(d: 3.0) >> scale(k: 2.0)`, then call `adjust(x: 4.0)`. `.` reads an anchor. `frame.up` is that anchor.

`map`'s function names its parameter `item`. `filter`'s predicate names its parameter `item` and returns `true` or `false`. A formula has no comparisons, so the predicate is the literal `true` or `false`. `integers(start: 0.0, count: 5.0)` is `[0.0, 1.0, 2.0, 3.0, 4.0]`. `start` is the first whole number and `count` is how many values, including `start`. A list has no length. On this plate, `$holes.columns` has one entry per `$holes.count`, and `$pins.indexes` has one entry per `$pins.count`.

`join`'s last parameter is the coordinate system, and `join` ignores it, so `join(...)` is already a function of that system. Pass the call as `solid`: `Component(solid: join(...), expose: coords => { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top })`. The `solid` argument is that `join`, or `coords =>` a solid or a component. A bare parameter that is not yet a solid or a component is rejected. A component does not expose that system, so `frame.coords` does not typecheck. A script has one coordinate system, so `plate.origin.add(vector: placed.at)` is legal. `setup`'s `coordinate_system` string tells the viewer which axis is up. The `using` parameters are named `frame` and `placed`, in that order. Inside `combine`, `frame - placed` cuts the placed solid away and `frame + placed` keeps both, and `coords` is not visible there. Seat one feature per `join`, then join the next feature onto that result. A `Solid3D` is one closed body.

A `def` is a top-level binding. A reusable function takes what it needs as arguments at the call. The model's parameters belong in the `parameters` section. `vector_grid`, `circular_pattern`, and `place_components` take arguments. `PlateWithHoles` reads `$holes` and `PlateWithKnobs` reads `$pins`. Inside a function, `let name = expression in expression` names a value for the expression after `in`. `Cylinder` binds its two caps that way.

## Lessons

The examples below are the scripts that follow these lessons. Copy the plate for a grid of features on a part, or for a circle of features.

Write a shape once and call it. A cylinder is one `Tube` and two `Disk` calls. `Tube` is the round wall. `Disk` is a cap. A plate is a square box: `Plate` calls `Box(width: $plate.size, depth: $plate.size, height: $plate.thickness)`. The six faces stay in `Box`. That box stands on z = 0 and publishes `corner` at its minimum point. The exported plate publishes `origin` at that same corner, which is the point the viewer hangs the model on. The box example seats a void from `corner` and publishes `origin` at the center.

`vector_grid` returns the points of a grid. `circular_pattern` returns the points of a circle. These are functions, so the names are `snake_case`. `Plate`, `Box`, and `Cylinder` are components, so those names are `PascalCase`. `integers(start: 0.0, count: 5.0)` is `[0.0, 1.0, 2.0, 3.0, 4.0]`. A list has no length. The plate's hole grid is `$holes.count_width` by `$holes.count_depth`. The knob circle has `$pins.count` points, which is 7.

`place_components` seats one `Cylinder` at each point. The same call chooses `radius` and `height`, so the holes and the knobs are two calls. A hole is cut with `combine: frame => placed => frame - placed`. A knob is kept with `combine: frame => placed => frame + placed`. The point meets `corner.add(vector: item)` and `placed.bottom`. A knob is sunk by `$pins.bite`, so its cap is inside the plate and the wall crosses the top face.

The model's parameters belong in the `parameters` section. A size is a parameter of the part. The numbers for the file live there, and the script reads them. `pi` is the value the whole script shares. A vector's first argument is the coordinate system from `solid: coords =>` and `expose: coords =>`. Write `Vector(coords: coords, x:, y:, z:)`. Inside `using`, move a point with `offset(x:, y:, z:)` and combine two vectors with `add(vector:)`. `|>` pipes a value into the next argument. `items |> map(f: item => ...)` fills `list`. `>>` composes two functions and binds more tightly. A call names every argument, in parameter order. A `def` is top-level. One `join` seats one feature. Pass `join(...)` as `solid`. A `Solid3D` is one closed body.

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
- `parameters` sits immediately after `setup`. The model's parameters belong in this section: a size, a count, and a position are fields here. A group is a name and a block. A field is a name and a value. A group may contain groups. When a measurement comes from a standard, that field sits in a group named for the standard. A top-level `def` of a number is for a value the whole script shares, such as `pi`.
- `$plate` reads that parameter. `$plate.size` reads a field. A solid may also be named `plate`; `plate.origin` is then an anchor. Inside the `plate` group, an earlier field is the short name `size`. A later group reads an earlier one with `$plate.size`.
- `.` on `$plate` reads a field. `.` on a component reads an anchor, such as `frame.up`.
- Bind a name with `def name = expression`. `param name = expression` is the same kind of binding. Bind each name once.
- The script ends with `export(...)`. The value must be a component. A sphere supplies its size at the call: `export(Sphere(radius: 25.0))`. A box reads its sizes from `parameters` and exports the finished component: `export(HollowBox)`. A number, a vector, a raw solid, a bare `join`, or a function that still expects arguments is rejected. When several exports appear, the last one is published.
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

A size belongs to the part that uses it. It is a parameter of that part, written in the `parameters` section. The call reads it. Do not also bind `def size = 100.0`. A top-level number is for a value the whole script shares, such as `pi`.

The broom does this. `Cylinder` is defined once. The handle, the ferrule, and the hole through the handle are three calls. The hole is not drawn again on its side. `join` turns that same cylinder until its axis lies across the handle.

A function that is not a component uses `snake_case`, and the name says what it returns. `vector_grid` returns the grid of points. `circular_pattern` returns the points of a circle. `place_components` seats one component at each point. The call chooses `radius` and `height`. The plate is a square `Box`. It exposes `up`, `right`, and `corner`. The model's parameters belong in the `parameters` section. `PlateWithHoles` reads `$holes` and `PlateWithKnobs` reads `$pins`. Export `PlateWithKnobs`.

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

`map` returns a new list. On the plate, `vector_grid` maps index pairs to points, and `circular_pattern` maps `integers` to the points of a circle. `place_components` then seats one cylinder at each point. An empty list returns the host. Each other step joins one cylinder onto the host and passes that host on.

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

Expose `origin` on the exported component as the point the viewer hangs the model on. The box puts that point at the center. The plate puts it at the corner the grid measures from.

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

## Example: a box

`Box` is six faces standing on z = 0, with `corner` at the minimum point. The sizes live in `parameters`. `HollowBox` calls `Box` twice. The inner box is seated one wall thickness in from `corner`, and `frame - placed` cuts it out. The inner box stops one wall thickness short of the top, so the floor remains and the top stays open. `origin` is the center, which is the point the viewer hangs the model on.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    width: 100.0,
    depth: 50.0,
    height: 30.0,
    wall_thickness: 3.0
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
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def HollowBox = 
    let box = Box(
        width: $width,
        depth: $depth,
        height: $height) in 
    let cutout = Box(
        width: $width - 2.0*$wall_thickness,
        depth: $depth - 2.0*$wall_thickness,
        height: $height - $wall_thickness) in 
    Component(
        solid: join(
            frame: box,
            placed: cutout,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.corner.offset(
                        x: $wall_thickness,
                        y: $wall_thickness,
                        z: $wall_thickness),
                    placed: placed.corner),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame - placed
        ),
        expose: coords => {
            origin: Vector(
                coords: coords,
                x: $width / 2.0,
                y: $depth / 2.0,
                z: $height / 2.0)
        }
    )

export(HollowBox)
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

## Example: a plate

The plate is the form to copy for a grid of features and a circle of features. `Box` and `Cylinder` are written once. `vector_grid` returns the points of the hole grid. `circular_pattern` returns the points of the knob circle. `place_components` folds that list. Each step joins one copy of `place` where the host's `corner`, shifted by the point, meets the placed part's `bottom`. `combine: frame => placed => frame - placed` cuts the holes. `combine: frame => placed => frame + placed` keeps the knobs. The lambda is written at the call, and its parameters are named `frame` and `placed`. `fold` is defined in the script. `integers` supplies the counts. A knob is taller than the plate by `$pins.bite` and its base sits that far below the top face, so the cap is inside the plate.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

// The model's sizes, grouped by the part they describe.
// PlateWithHoles reads $holes. PlateWithKnobs reads $pins.
parameters {
    plate: {
        size: 100.0,
        thickness: 8.0
    },
    holes: {
        radius: 3.0,
        count_width: 5.0,
        count_depth: 3.0,
        margin: 25.0
    },
    pins: {
        radius: 3.0,
        count: 7.0,
        ring: 40.0,
        bite: 1.0
    }
}

// pi is a value the whole script shares.
def pi = 3.14159265359

def fold: (item: T => accumulator: A => A) => (initial: A) => (list: [T]) => A = f => initial => list => match list {
    [] => initial,
    head :: tail => f(item: head, accumulator: fold(f: f, initial: initial, list: tail))
}

def vector_grid = start_u => end_u => count_u => start_v => end_v => count_v => point =>
    let grid = u_count => v_count =>
        let us = integers(start: 0.0, count: u_count) in
        let vs = integers(start: 0.0, count: v_count) in
        let row_onto = v => points => fold(
            f: item => accumulator => (item, v) :: accumulator,
            initial: points,
            list: us
        ) in
        fold(
            f: item => accumulator => row_onto(v: item, points: accumulator),
            initial: [],
            list: vs
        ) in
    let step_u = (end_u - start_u) / (count_u - 1.0) in
    let step_v = (end_v - start_v) / (count_v - 1.0) in
    grid(u_count: count_u, v_count: count_v)
    |> map(f: item => let (u, v) = item in point(
        u: start_u + (u * step_u),
        v: start_v + (v * step_v)
    ))

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
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: height),
            center: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
        }
    )

def place_components = host => points => place => combine => fold(
    f: item => accumulator => Component(
        solid: join(
            frame: accumulator,
            placed: place,
            using: frame => placed => align(
                planar: meet(frame: accumulator.up, placed: placed.up),
                translation: meet(frame: accumulator.corner.add(vector: item), placed: placed.bottom),
                rotation: meet(frame: accumulator.right, placed: placed.right)
            ),
            combine: combine
        ),
        expose: coords => { up: accumulator.up, right: accumulator.right, corner: accumulator.corner }
    ),
    initial: host,
    list: points
)

// A square box. size is the width and the depth.
def Plate = Box(width: $plate.size, depth: $plate.size, height: $plate.thickness)

def circular_pattern = coords => count => radius =>
    integers(start: 0.0, count: count)
    |> map(f: item => Vector(coords: coords,
        x: ($plate.size / 2.0) + (radius * cos(rad: item * (2.0 * pi / count))),
        y: ($plate.size / 2.0) + (radius * sin(rad: item * (2.0 * pi / count))),
        z: $plate.thickness - $pins.bite
    ))

def PlateWithHoles = coords => place_components(
    host: Plate,
    points: vector_grid(
        start_u: $holes.margin + $holes.radius,
        end_u: $plate.size - $holes.margin - $holes.radius,
        count_u: $holes.count_width,
        start_v: $holes.margin + $holes.radius,
        end_v: $plate.size - $holes.margin - $holes.radius,
        count_v: $holes.count_depth,
        point: u=>v=>Vector(coords: coords, x: u, y: v, z: 0.0)),
    place: Cylinder(radius: $holes.radius, height: $plate.thickness),
    combine: frame => placed => frame - placed
)

def PlateWithKnobs = coords => place_components(
    host: PlateWithHoles(coords: coords),
    points: circular_pattern(coords: coords, count: $pins.count, radius: $pins.ring),
    place: Cylinder(radius: $pins.radius, height: $plate.thickness + $pins.bite),
    combine: frame => placed => frame + placed
)

export(Component(
    solid: coords => PlateWithKnobs(coords: coords)
    expose: coords => {
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
    }
))
```

## Example: a screw

A measurement from a standard sits in the group named for that standard. `head.iso_4017` holds the across-flats width, the head height, and the nominal length. `thread.iso_68_1` holds the pitch. `flat`, `corner`, and `tip` are derived from those fields. The cosine series follows the ISO 68-1 basic profile. Each turn of the thread is its own face. One face for the whole shank would be sampled too coarsely to show the pitch. `pi` is the number the whole script shares.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

// M3x16 hexagon-head screw. A measurement from a standard sits in the group
// named for that standard. The head is an ISO 4017 hexagon with a vertex on
// the Y axis. The shank follows the ISO 68-1 M3 coarse basic profile:
// 60 degrees, major diameter 3 mm, minor diameter 2.459 mm.
// The head sits on z = 0 and the tip is one length below it.
// Each turn is its own face. One face for the whole shank would be sampled
// too coarsely to show the pitch.
parameters {
    head: {
        iso_4017: {
            across_flats: 5.5,
            height: 2.0,
            length: 16.0
        },
        flat: iso_4017.across_flats / 2.0,
        // Distance from the axis to a vertex. The angle is pi / 6, with the pi bound below.
        corner: flat / cos(rad: 3.14159265359 / 6.0)
    },
    thread: {
        iso_68_1: {
            pitch: 0.5
        },
        tip: 0.0 - $head.iso_4017.length,
        // Closure of the shank inside the head, so the hex underside stays a solid face.
        bury: 0.05,
        // Cosine series of the ISO 68-1 external basic profile.
        // Phase 0 is the crest. The series stays within 0.01 mm of that profile.
        c0: 1.347769,
        c1: 0.143114,
        c2: 0.015512,
        c3: 0.0 - 0.003163,
        c4: 0.005484,
        c5: 0.0 - 0.003825
    }
}

// pi is a value the whole script shares.
def pi = 3.14159265359

// Radius at a seam, where the helical phase collapses to the angle around the shank.
def end_radius = u => $thread.c0 + $thread.c1 * cos(rad: u) + $thread.c2 * cos(rad: 2.0 * u) + $thread.c3 * cos(rad: 3.0 * u) + $thread.c4 * cos(rad: 4.0 * u) + $thread.c5 * cos(rad: 5.0 * u)

// One pitch of the helix. Clockwise in u so the wall faces outward.
def wall = coords => index => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => $thread.tip + index * $thread.iso_68_1.pitch,
    max_v: u => $thread.tip + index * $thread.iso_68_1.pitch + $thread.iso_68_1.pitch,
    formula: u => v => Vector(coords: coords, 
        x: ($thread.c0 + $thread.c1 * cos(rad: 1.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c2 * cos(rad: 2.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c3 * cos(rad: 3.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c4 * cos(rad: 4.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c5 * cos(rad: 5.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u))) * cos(rad: u),
        y: ($thread.c0 + $thread.c1 * cos(rad: 1.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c2 * cos(rad: 2.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c3 * cos(rad: 3.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c4 * cos(rad: 4.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c5 * cos(rad: 5.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u))) * (0.0 - sin(rad: u)),
        z: v
    )
)

def tip_cap = coords => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: end_radius,
    formula: u => v => Vector(coords: coords, 
        x: v * cos(rad: u),
        y: v * (0.0 - sin(rad: u)),
        z: $thread.tip
    )
)

// Short collar and cap buried in the head. They close the shank without showing.
def collar = coords => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => $thread.bury,
    formula: u => v => Vector(coords: coords, 
        x: ($thread.c0 + $thread.c1 * cos(rad: 1.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c2 * cos(rad: 2.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c3 * cos(rad: 3.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c4 * cos(rad: 4.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c5 * cos(rad: 5.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u))) * cos(rad: u),
        y: ($thread.c0 + $thread.c1 * cos(rad: 1.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c2 * cos(rad: 2.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c3 * cos(rad: 3.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c4 * cos(rad: 4.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u)) + $thread.c5 * cos(rad: 5.0 * (2.0 * pi * v / $thread.iso_68_1.pitch - u))) * (0.0 - sin(rad: u)),
        z: v
    )
)

def shank_cap = coords => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0,
    max_v: u => $thread.c0 + $thread.c1 * cos(rad: 1.0 * (2.0 * pi * $thread.bury / $thread.iso_68_1.pitch - u)) + $thread.c2 * cos(rad: 2.0 * (2.0 * pi * $thread.bury / $thread.iso_68_1.pitch - u)) + $thread.c3 * cos(rad: 3.0 * (2.0 * pi * $thread.bury / $thread.iso_68_1.pitch - u)) + $thread.c4 * cos(rad: 4.0 * (2.0 * pi * $thread.bury / $thread.iso_68_1.pitch - u)) + $thread.c5 * cos(rad: 5.0 * (2.0 * pi * $thread.bury / $thread.iso_68_1.pitch - u)),
    formula: u => v => Vector(coords: coords, 
        x: v * cos(rad: u),
        y: v * sin(rad: u),
        z: $thread.bury
    )
)

// One flat of the hexagon. index 0 starts at 30 degrees and each step is 60 degrees.
// u runs from the higher-angle vertex back to this one so the flat faces outward.
def side = coords => index => Surface2D(
    max_u: 1.0,
    min_v: u => 0.0, max_v: u => $head.iso_4017.height,
    formula: u => v => Vector(coords: coords, 
        x: (1.0 - u) * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0) + u * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0),
        y: (1.0 - u) * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0) + u * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0),
        z: v
    )
)

def head_top = coords => index => Surface2D(
    max_u: 1.0,
    min_v: u => 0.0, max_v: u => 1.0,
    formula: u => v => Vector(coords: coords, 
        x: u * ((1.0 - v) * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0) + v * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0)),
        y: u * ((1.0 - v) * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0) + v * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0)),
        z: $head.iso_4017.height
    )
)

def head_bottom = coords => index => Surface2D(
    max_u: 1.0,
    min_v: u => 0.0, max_v: u => 1.0,
    formula: u => v => Vector(coords: coords, 
        x: u * ((1.0 - v) * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0) + v * $head.corner * cos(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0)),
        y: u * ((1.0 - v) * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0) + v * $head.corner * sin(rad: index * pi / 3.0 + pi / 6.0 + pi / 3.0)),
        z: 0.0
    )
)

def M3Screw = Component(
    solid: coords => Solid3D(faces: [
        tip_cap(coords: coords),
        collar(coords: coords),
        shank_cap(coords: coords),
        side(coords: coords, index: 0.0),
        side(coords: coords, index: 1.0),
        side(coords: coords, index: 2.0),
        side(coords: coords, index: 3.0),
        side(coords: coords, index: 4.0),
        side(coords: coords, index: 5.0),
        head_top(coords: coords, index: 0.0),
        head_top(coords: coords, index: 1.0),
        head_top(coords: coords, index: 2.0),
        head_top(coords: coords, index: 3.0),
        head_top(coords: coords, index: 4.0),
        head_top(coords: coords, index: 5.0),
        head_bottom(coords: coords, index: 0.0),
        head_bottom(coords: coords, index: 1.0),
        head_bottom(coords: coords, index: 2.0),
        head_bottom(coords: coords, index: 3.0),
        head_bottom(coords: coords, index: 4.0),
        head_bottom(coords: coords, index: 5.0),
        wall(coords: coords, index: 0.0),
        wall(coords: coords, index: 1.0),
        wall(coords: coords, index: 2.0),
        wall(coords: coords, index: 3.0),
        wall(coords: coords, index: 4.0),
        wall(coords: coords, index: 5.0),
        wall(coords: coords, index: 6.0),
        wall(coords: coords, index: 7.0),
        wall(coords: coords, index: 8.0),
        wall(coords: coords, index: 9.0),
        wall(coords: coords, index: 10.0),
        wall(coords: coords, index: 11.0),
        wall(coords: coords, index: 12.0),
        wall(coords: coords, index: 13.0),
        wall(coords: coords, index: 14.0),
        wall(coords: coords, index: 15.0),
        wall(coords: coords, index: 16.0),
        wall(coords: coords, index: 17.0),
        wall(coords: coords, index: 18.0),
        wall(coords: coords, index: 19.0),
        wall(coords: coords, index: 20.0),
        wall(coords: coords, index: 21.0),
        wall(coords: coords, index: 22.0),
        wall(coords: coords, index: 23.0),
        wall(coords: coords, index: 24.0),
        wall(coords: coords, index: 25.0),
        wall(coords: coords, index: 26.0),
        wall(coords: coords, index: 27.0),
        wall(coords: coords, index: 28.0),
        wall(coords: coords, index: 29.0),
        wall(coords: coords, index: 30.0),
        wall(coords: coords, index: 31.0)
    ]),
    expose: coords => {}
)

export(M3Screw)
```

## Example: a remote

The remote seats many parts on one body with `place_components`. The keys share one `Cylinder`. The rockers share one `Stadium`. The ring is a cylinder with a smaller cylinder cut out of it. The groove is a `Box` cut from the body, and the badge is a `Box` added to it. Positions live in `layout`. Raised parts sit at `$body.rise`, which is `thick - bite`.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

// Samsung remote. The body is a rounded slab. Keys, the ring, the rockers,
// and the badge sit on that slab. The groove is cut into it.
// Sizes are grouped by the part they describe.
parameters {
    body: {
        radius: 21.0,
        straight: 134.0,
        thick: 14.0,
        bite: 1.0,
        // Raised parts sit this far below the top face, so the cap is not flush.
        rise: thick - bite
    },
    keys: {
        radius: 4.5,
        height: 2.0
    },
    ring: {
        radius: 15.0,
        height: 2.2,
        bore: 7.6,
        bore_height: 4.2
    },
    select: {
        radius: 5.2,
        height: 2.6
    },
    rocker: {
        radius: 4.0,
        straight: 9.0,
        height: 2.0
    },
    groove: {
        width: 28.0,
        depth: 2.0,
        height: 3.0,
        sink: 1.2
    },
    badge: {
        width: 24.0,
        depth: 3.6,
        height: 1.4
    },
    layout: {
        power: { x: 0.0 - 9.0, y: 72.0 },
        mic: { x: 9.0, y: 72.0 },
        numbers: { x: 0.0 - 12.0, y: 58.0 },
        back: { x: 0.0 - 13.0, y: 9.0 },
        home: { x: 0.0, y: 9.0 },
        play: { x: 13.0, y: 9.0 },
        volume: { x: 0.0 - 12.0, y: 0.0 - 10.0 },
        channel: { x: 12.0, y: 0.0 - 10.0 },
        netflix: { x: 0.0 - 12.0, y: 0.0 - 35.0 },
        tv: { x: 10.0, y: 0.0 - 33.0 },
        disney: { x: 0.0 - 5.0, y: 0.0 - 49.0 },
        prime: { x: 12.0, y: 0.0 - 49.0 },
        ring: { x: 0.0, y: 33.0 },
        groove: { x: 0.0, y: 0.0 - 24.0 },
        badge: { x: 0.0, y: 0.0 - 74.0 }
    }
}

// pi is a value the whole script shares.
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
            // Center of the face on z = 0, so a placed box sits on the point.
            bottom: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: 0.0)
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
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: height),
            center: Vector(coords: coords, x: 0.0, y: 0.0, z: height / 2.0)
        }
    )

// A slab with semicircular caps on the long axis. straight is the length between the caps.
def Stadium = radius => straight => height =>
    Component(
        solid: coords =>
            let half = straight / 2.0 in
            let top = Surface2D(
                max_u: radius * 2.0,
                min_v: u => 0.0,
                max_v: u => straight,
                formula: u => v => Vector(coords: coords, x: u - radius, y: v - half, z: height)) in
            let bottom = Surface2D(
                max_u: radius * 2.0,
                min_v: u => 0.0,
                max_v: u => straight,
                formula: u => v => Vector(coords: coords, x: u - radius, y: v - half, z: 0.0)) in
            let cap_top = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: half + (v * sin(rad: u)), z: height)) in
            let cap_bottom = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: 0.0 - half - (v * sin(rad: u)), z: height)) in
            let sole_top = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: half + (v * sin(rad: u)), z: 0.0)) in
            let sole_bottom = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, x: v * cos(rad: u), y: 0.0 - half - (v * sin(rad: u)), z: 0.0)) in
            let side_right = Surface2D(
                max_u: straight,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: radius, y: u - half, z: v)) in
            let side_left = Surface2D(
                max_u: straight,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: 0.0 - radius, y: u - half, z: v)) in
            let rim_top = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: radius * cos(rad: u), y: half + (radius * sin(rad: u)), z: v)) in
            let rim_bottom = Surface2D(
                max_u: pi,
                min_v: u => 0.0,
                max_v: u => height,
                formula: u => v => Vector(coords: coords, x: radius * cos(rad: u), y: 0.0 - half - (radius * sin(rad: u)), z: v)) in
            Solid3D(faces: [
                top,
                bottom,
                cap_top,
                cap_bottom,
                sole_top,
                sole_bottom,
                side_right,
                side_left,
                rim_top,
                rim_bottom
            ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def place_components = host => points => place => combine => fold(
    f: item => accumulator => Component(
        solid: join(
            frame: accumulator,
            placed: place,
            using: frame => placed => align(
                planar: meet(frame: accumulator.up, placed: placed.up),
                translation: meet(frame: accumulator.corner.add(vector: item), placed: placed.bottom),
                rotation: meet(frame: accumulator.right, placed: placed.right)
            ),
            combine: combine
        ),
        expose: coords => { up: accumulator.up, right: accumulator.right, corner: accumulator.corner }
    ),
    initial: host,
    list: points
)

def Ring =
    Component(
        solid: join(
            frame: Cylinder(radius: $ring.radius, height: $ring.height),
            placed: Cylinder(radius: $ring.bore, height: $ring.bore_height),
            using: frame => placed => align(
                planar: meet(frame: frame.up, placed: placed.up),
                translation: meet(frame: frame.center, placed: placed.center),
                rotation: meet(frame: frame.right, placed: placed.right)
            ),
            combine: frame => placed => frame - placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def Body = Stadium(radius: $body.radius, straight: $body.straight, height: $body.thick)

def key_points = coords => [
    Vector(coords: coords, x: $layout.power.x, y: $layout.power.y, z: $body.rise),
    Vector(coords: coords, x: $layout.mic.x, y: $layout.mic.y, z: $body.rise),
    Vector(coords: coords, x: $layout.numbers.x, y: $layout.numbers.y, z: $body.rise),
    Vector(coords: coords, x: $layout.back.x, y: $layout.back.y, z: $body.rise),
    Vector(coords: coords, x: $layout.home.x, y: $layout.home.y, z: $body.rise),
    Vector(coords: coords, x: $layout.play.x, y: $layout.play.y, z: $body.rise),
    Vector(coords: coords, x: $layout.netflix.x, y: $layout.netflix.y, z: $body.rise),
    Vector(coords: coords, x: $layout.tv.x, y: $layout.tv.y, z: $body.rise),
    Vector(coords: coords, x: $layout.disney.x, y: $layout.disney.y, z: $body.rise),
    Vector(coords: coords, x: $layout.prime.x, y: $layout.prime.y, z: $body.rise)
]

def BodyWithGroove = coords => place_components(
    host: Body,
    points: [Vector(coords: coords, x: $layout.groove.x, y: $layout.groove.y, z: $body.thick - $groove.sink)],
    place: Box(width: $groove.width, depth: $groove.depth, height: $groove.height),
    combine: frame => placed => frame - placed
)

def BodyWithKeys = coords => place_components(
    host: BodyWithGroove(coords: coords),
    points: key_points(coords: coords),
    place: Cylinder(radius: $keys.radius, height: $keys.height),
    combine: frame => placed => frame + placed
)

def BodyWithRing = coords => place_components(
    host: BodyWithKeys(coords: coords),
    points: [Vector(coords: coords, x: $layout.ring.x, y: $layout.ring.y, z: $body.rise)],
    place: Ring,
    combine: frame => placed => frame + placed
)

def BodyWithSelect = coords => place_components(
    host: BodyWithRing(coords: coords),
    points: [Vector(coords: coords, x: $layout.ring.x, y: $layout.ring.y, z: $body.rise)],
    place: Cylinder(radius: $select.radius, height: $select.height),
    combine: frame => placed => frame + placed
)

def BodyWithRockers = coords => place_components(
    host: BodyWithSelect(coords: coords),
    points: [
        Vector(coords: coords, x: $layout.volume.x, y: $layout.volume.y, z: $body.rise),
        Vector(coords: coords, x: $layout.channel.x, y: $layout.channel.y, z: $body.rise)
    ],
    place: Stadium(radius: $rocker.radius, straight: $rocker.straight, height: $rocker.height),
    combine: frame => placed => frame + placed
)

def Remote = coords => place_components(
    host: BodyWithRockers(coords: coords),
    points: [Vector(coords: coords, x: $layout.badge.x, y: $layout.badge.y, z: $body.rise)],
    place: Box(width: $badge.width, depth: $badge.depth, height: $badge.height),
    combine: frame => placed => frame + placed
)

export(Component(
    solid: coords => Remote(coords: coords)
    expose: coords => {
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: $body.thick / 2.0)
    }
))
```

## Example: a car

The car calls `Box` for the body and the cabin, and `Wheel` for every wheel. `Axle` joins two wheels. The cabin sits on the body's `top` and overlaps it by `$cabin.overlap`. Two axles are seated a wheelbase apart. Sizes are grouped by part in `parameters`. Each `join` is wrapped in `Component` so the next mate can read `up`, `right`, and `at`.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    body: {
        width: 100.0,
        depth: 200.0,
        height: 20.0
    },
    cabin: {
        width: 80.0,
        depth: 70.0,
        height: 32.0,
        overlap: 8.0
    },
    wheel: {
        radius: 12.0,
        width: 14.0,
        ride: 8.0
    },
    axle: {
        nose: 42.0,
        wheelbase: 120.0
    }
}

def pi = 3.14159265359

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
            bottom: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: 0.0),
            top: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: height)
        }
    )

def Wheel = radius => width =>
    Component(
        solid: coords =>
            let half = width / 2.0 in
            let wall = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => width,
                formula: u => v => Vector(coords: coords, 
                    x: 0.0 - half + v,
                    y: radius * cos(rad: u),
                    z: radius * sin(rad: u))) in
            let left = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, 
                    x: 0.0 - half,
                    y: v * cos(rad: u),
                    z: v * sin(rad: u))) in
            let right = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => radius,
                formula: u => v => Vector(coords: coords, 
                    x: half,
                    y: v * cos(rad: u),
                    z: v * sin(rad: u))) in
            Solid3D(faces: [
                    wall,
                    left,
                    right
                ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def Axle =
    let track = $body.width - $wheel.width in
    let left = Wheel(
        radius: $wheel.radius,
        width: $wheel.width) in
    let right = Wheel(
        radius: $wheel.radius,
        width: $wheel.width) in
    Component(
        solid: join(
            frame: left,
            placed: right,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(x: track,
                        y: 0.0,
                        z: 0.0),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def Car =
    let body = Box(
        width: $body.width,
        depth: $body.depth,
        height: $body.height) in
    let cabin = Box(
        width: $cabin.width,
        depth: $cabin.depth,
        height: $cabin.height) in
    let hull = Component(
        solid: join(
            frame: body,
            placed: cabin,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.top.offset(x: 0.0,
                        y: 0.0,
                        z: 0.0 - $cabin.overlap),
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
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    let with_front = Component(
        solid: join(
            frame: hull,
            placed: Axle,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(
                        x: $wheel.width / 2.0,
                        y: $body.depth - $axle.nose,
                        z: $wheel.radius - $wheel.ride),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    Component(
        solid: join(
            frame: with_front,
            placed: Axle,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(
                        x: $wheel.width / 2.0,
                        y: $body.depth - $axle.nose - $axle.wheelbase,
                        z: $wheel.radius - $wheel.ride),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {}
    )

export(Car)
```

## Example: a desk set

The desk set is a base, three clips, and a shaker. `Box` and `Cylinder` are written once. The clip row is built by seating one `Clip` onto the next at `$clip.pitch`. The shaker is a cup, a bore, a cap, and a ring of vents, and its sizes are nested groups under `shaker`. The shaker stands beside the base, `$shaker.clearance` past the base's edge.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    base: {
        width: 80.0,
        depth: 40.0,
        height: 8.0
    },
    clip: {
        width: 14.0,
        depth: 30.0,
        height: 9.0,
        pitch: 20.0,
        bite: 1.0
    },
    cable: {
        radius: 2.5,
        span: 32.0
    },
    shaker: {
        clearance: 60.0,
        cup: {
            radius: 16.0,
            height: 55.0,
            bore: 13.0,
            bore_height: 54.0,
            floor: 2.0
        },
        cap: {
            radius: 17.0,
            height: 10.0,
            lip: 3.0
        },
        vent: {
            radius: 1.3,
            height: 6.0,
            from_bottom: 6.0,
            pitch: 6.0
        }
    }
}

def pi = 3.14159265359

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
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            bottom: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: 0.0),
            top: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: height)
        }
    )

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
            bottom: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: height)
        }
    )

def Clip =
    let block = Box(
        width: $clip.width,
        depth: $clip.depth,
        height: $clip.height) in
    let half = $cable.span / 2.0 in
    let cable = Component(
        solid: coords =>
            let wall = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => $cable.span,
                formula: u => v => Vector(coords: coords,
                    x: $cable.radius * cos(rad: u),
                    y: 0.0 - half + v,
                    z: $cable.radius * sin(rad: u))) in
            let back = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => $cable.radius,
                formula: u => v => Vector(coords: coords,
                    x: v * cos(rad: u),
                    y: 0.0 - half,
                    z: v * sin(rad: u))) in
            let front = Surface2D(
                max_u: 2.0 * pi,
                min_v: u => 0.0,
                max_v: u => $cable.radius,
                formula: u => v => Vector(coords: coords,
                    x: v * cos(rad: u),
                    y: half,
                    z: v * sin(rad: u))) in
            Solid3D(faces: [
                    wall,
                    back,
                    front
                ]),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    Component(
        solid: join(
            frame: block,
            placed: cable,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.corner.offset(
                        x: $clip.width / 2.0,
                        y: $clip.depth / 2.0,
                        z: $clip.height / 2.0),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame - placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0),
            at: Vector(coords: coords,
                x: $clip.width / 2.0,
                y: $clip.depth / 2.0,
                z: $clip.height / 2.0)
        }
    )

def Shaker =
    let outer = Cylinder(
        radius: $shaker.cup.radius,
        height: $shaker.cup.height) in
    let bore = Cylinder(
        radius: $shaker.cup.bore,
        height: $shaker.cup.bore_height) in
    let cup = Component(
        solid: join(
            frame: outer,
            placed: bore,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.bottom.offset(
                        x: 0.0,
                        y: 0.0,
                        z: $shaker.cup.floor),
                    placed: placed.bottom),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame - placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            top: Vector(coords: coords, x: 0.0, y: 0.0, z: $shaker.cup.height)
        }
    ) in
    let shell = Cylinder(
        radius: $shaker.cap.radius,
        height: $shaker.cap.height) in
    let vent = Cylinder(
        radius: $shaker.vent.radius,
        height: $shaker.vent.height) in
    let vents = Component(
        solid: join(
            frame: vent,
            placed: vent,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.bottom.offset(
                        x: $shaker.vent.pitch,
                        y: 0.0,
                        z: 0.0),
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
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    let cap = Component(
        solid: join(
            frame: shell,
            placed: vents,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.bottom.offset(
                        x: 0.0,
                        y: 0.0,
                        z: $shaker.vent.from_bottom),
                    placed: placed.at),
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
    Component(
        solid: join(
            frame: cup,
            placed: cap,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.top.offset(
                        x: 0.0,
                        y: 0.0,
                        z: 0.0 - $shaker.cap.lip),
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
            at: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    )

def DeskSet =
    let gap = $clip.pitch - $clip.width in
    let row = $clip.width * 3.0 + gap * 2.0 in
    let margin = ($base.width - row) / 2.0 in
    let base = Box(
        width: $base.width,
        depth: $base.depth,
        height: $base.height) in
    let pair = Component(
        solid: join(
            frame: Clip,
            placed: Clip,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(
                        x: $clip.pitch,
                        y: 0.0,
                        z: 0.0),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    let clips = Component(
        solid: join(
            frame: pair,
            placed: Clip,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.corner.offset(
                        x: $clip.pitch * 2.0,
                        y: 0.0,
                        z: 0.0),
                    placed: placed.corner),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    let organizer = Component(
        solid: join(
            frame: base,
            placed: clips,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.corner.offset(
                        x: margin,
                        y: $base.depth / 2.0,
                        z: $base.height - $clip.bite),
                    placed: placed.corner.offset(
                        x: 0.0,
                        y: $clip.depth / 2.0,
                        z: 0.0)),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {
            up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
            right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
            corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
        }
    ) in
    Component(
        solid: join(
            frame: organizer,
            placed: Shaker,
            using: frame => placed => align(
                planar: meet(
                    frame: frame.up,
                    placed: placed.up),
                translation: meet(
                    frame: frame.corner.offset(
                        x: $base.width + $shaker.cup.radius + $shaker.clearance,
                        y: $base.depth / 2.0,
                        z: 0.0),
                    placed: placed.at),
                rotation: meet(
                    frame: frame.right,
                    placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => {}
    )

export(DeskSet)
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
