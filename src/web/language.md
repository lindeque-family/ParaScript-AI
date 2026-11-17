# ParaScript language

This is the language the workspace compiler accepts. Write a script using only the forms on this page. Paste it into the [workspace](/workspace) and press Run solver. The canonical text for a language model is [https://parascript.lindeque.family/language.md](https://parascript.lindeque.family/language.md).

A script builds one closed solid and publishes it as a component. There is no library of cubes, spheres, or cylinders. You write the faces.

The language is functional. A face, a part, and an assembly are functions of the numbers that can change. Call those functions with the sizes at the use site. When the same shape appears again, call the function again. Do not copy its faces.

## Guidance for a language model

Build the model in this order.

1. Bind `pi` when a curve needs it: `def pi = 3.14159265359`. A top-level number is for a value the whole script shares. A part's size is a parameter of that part. The patterned plate is the form to copy. The broom still names some sizes above its parts. Leave that shape there, and pass sizes at the call.
2. Name each face for the surface it is. A face is a 2D surface. A cylinder is one `Tube` and two `Disk` calls. `Tube` is the round wall. `Disk` is a cap. `Cylinder` is the solid that calls them: `Tube(radius: radius, height: height)`, `Disk(radius: radius, z: 0.0)`, and `Disk(radius: radius, z: height)`. The face list is how the solid is composed.
3. Write the base part next, also as a function of its sizes. A plate is a square box, so `Plate` calls `Box(width: size, depth: size, height: thickness)`. `Box` is the rectangular solid, centered on X and Y and standing on z = 0. Expose the anchors a pattern will read. A plate exposes `up`, `right`, `origin`, and `top`. `origin` is the center, and it is the point the viewer hangs the model on. `top` is the center of the top face.
4. A function that is not a component uses `snake_case`, and the name says what it returns. `rectangular_pattern` returns the grid of points. Its parameters are `column_count`, `row_count`, `column_pitch`, `row_pitch`, `columns`, and `rows`. `circular_pattern` returns the points of a circle. Its parameters are `point_count`, `radius`, and `indexes`. `column`, `row`, and each index count from `0`. A component uses `PascalCase`.
5. Map a cylinder function over that grid. The function receives the point, and it chooses `radius` and `height`, so each location can build a different cylinder. `CylinderAt` is that cylinder. It publishes `at`, the point it was built for.
6. Subtract those cylinders from the plate with `subtract_cylinders`. Add the pin cylinders with `add_cylinders`. One `join` cuts or adds one cylinder. The seat reads `plate.origin` or `plate.top`, and `placed.at`. The plate passed in exposes every anchor the function reads.
7. Write the numbers once, in `parameters`, grouped by the part they describe. Read a parameter with `$`, as in `$holes` and `$plate.size`. `plate.origin` is an anchor on the solid. Bind `def patterned_plate = cut_holes >> add_pins`, then export `patterned_plate(plate: Plate(size: $plate.size, thickness: $plate.thickness))`.

`value |> fn` fills `fn`'s next argument. `items |> map(f: item => ...)` is `map(f: ..., list: items)`. `items |> map` is rejected, because `map` is still waiting for `f`. `f >> g` composes two functions and runs `f` first. Both functions must already be waiting for one value. `>>` binds more tightly than `|>`.

A call is a name and its arguments. Bind `def adjust = shift(d: 3.0) >> scale(k: 2.0)`, then call `adjust(x: 4.0)`. `.` reads an anchor. `frame.up` is that anchor.

`map`'s function names its parameter `item`. `filter`'s predicate names its parameter `item` and returns `true` or `false`. A formula has no comparisons, so the predicate is the literal `true` or `false`. There is no `range`, and a list has no length. Pass the index list at the call. On this plate, `$holes.columns` has one entry per `$holes.count`, and `$pins.indexes` has one entry per `$pins.count`.

`join` returns a solid. Publish the anchors the next step needs in the same expression: `Component(solid: join(...), expose: { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top })`. The `solid` argument is that `join`. A function parameter is not yet a solid. The `using` parameters are named `frame` and `placed`, in that order. Inside `combine`, `frame - placed` cuts the placed solid away and `frame + placed` keeps both. Seat one feature per `join`, then join the next feature onto that result. A `Solid3D` is one closed body.

A `def` is a top-level binding. A reusable function takes what it needs as parameters. `rectangular_pattern`, `CylinderAt`, and `subtract_cylinders` do. `cut_holes` and `add_pins` read the file's `parameters` groups. There is no `def` inside a function.

## Lessons

The patterned plate is the script that follows these lessons. Copy that script for a grid of features on a part.

Write a shape once and call it. A cylinder is one `Tube` and two `Disk` calls. `Tube` is the round wall. `Disk` is a cap. A plate is a square box: `Plate` calls `Box(width: size, depth: size, height: thickness)`. The six faces stay in `Box`. That box is centered on X and Y and stands on z = 0. `origin` is the center. `top` is the center of the top face. The cavity example's `Box` publishes `corner` at its minimum point, and the void is seated from that corner.

`rectangular_pattern` returns the grid of points. `circular_pattern` returns the points of a circle. These are functions, so the names are `snake_case`. `CylinderAt`, `Plate`, and `Box` are components, so those names are `PascalCase`. There is no `range`, and a list has no length. `$holes.columns` has one entry per `$holes.count`. On this square plate the same list is the row list. `$pins.indexes` has one entry per pin. The plate's grid list has 5 entries. The pin list has 7. `column` and `row` count from `0`.

Map `CylinderAt` over the points. The function receives the point as `item`, and the call chooses `radius` and `height`. Each location can therefore build its own cylinder. This plate reads `$holes.radius` and `$holes.span` for every hole, and `$pins.radius` and `$pins.height` for every pin. `CylinderAt` publishes `at`, which is that point.

`subtract_cylinders` cuts that list out of the plate. `add_cylinders` unions the pin list onto that plate. `map` builds the list of cylinders. It does not cut them: each result would be a separate copy with one hole. An empty list returns the plate. Otherwise the first cylinder is cut from the plate, and that plate is passed on with the rest of the list. A hole's center meets `plate.origin + placed.at`. A pin's base meets `plate.top + placed.at`. The pin point is sunk by `$pins.bite`.

A size is a parameter of the part. The numbers for the file live in `parameters`, and the script reads them. `pi` is the value the whole script shares. `|>` pipes a value into the next argument. `items |> map(f: item => ...)` fills `list`. `>>` composes two functions and binds more tightly. `patterned_plate` is `cut_holes >> add_pins`. A call names every argument, in parameter order. A `def` is top-level. One `join` seats one feature. A `Solid3D` is one closed body.

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

A name is letters, digits, and underscores. Use `snake_case` for values and `PascalCase` for components. These words are reserved: `setup`, `parameters`, `param`, `def`, `fn`, `export`, `return`, `true`, `false`, `match`.

- Write numbers as decimals: `40.0`.
- There is no unary minus. A negative number is `0.0 - 16.0`.
- `+`, `-`, `*`, and `/` work on two numbers.
- `+` and `-` also work on two vectors, one component at a time.
- Do not multiply or divide a vector by a number. Scale each component: `Vector(x: 2.0 * x, y: 2.0 * y, z: 2.0 * z)`.
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

These names are concrete types: `number`, `vector`, `boolean`, `string`, `component`, `solid`, `surface`. `[T]` is a list of `T`. `=>` is a function and groups to the right, so `T => T => number` is a function that returns a function. Parentheses group the other way: `(T => T) => number`.

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
Tube(radius: radius, height: height)
Disk(radius: radius, z: 0.0)
Disk(radius: radius, z: height)
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
def pad = amount => Vector(x: amount, y: amount, z: 0.0)
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

`map` returns a new list. On the patterned plate that list is one `CylinderAt` per point. `subtract_cylinders` takes the plate and that list. An empty list returns the plate. Each other step cuts one cylinder from the plate and passes that plate on.

## Vectors

A vector is written with the axes in order:

```text
Vector(x: 0.0, y: 0.0, z: 1.0)
```

`up` is the direction the viewer treats as up. For `Z-up` that is `Vector(x: 0.0, y: 0.0, z: 1.0)`. `right` is `Vector(x: 1.0, y: 0.0, z: 0.0)`.

## Faces

A face is a `Surface2D`. `u` runs from `0` to `max_u`. At each `u`, `v` runs from `min_v(u)` to `max_v(u)`. Both bounds are functions of `u`. The formula is two lambdas, `u => v => Vector(...)`, in the part's own coordinates.

```text
Surface2D(
    max_u: width,
    min_v: u => 0.0,
    max_v: u => depth,
    formula: u => v => Vector(x: u, y: v, z: 0.0)
)
```

The viewer samples each face on a grid of 16 to 32 steps. A detail much smaller than its face, such as one turn of a screw thread, needs its own face. Splitting a large smooth face into several faces is how you keep a small feature visible.

## Solids and components

`Solid3D(faces: [ face, face ])` collects the faces. A closed box has six faces: bottom, top, and four walls. The faces must meet at their edges and enclose the volume.

`Component(solid: solid, expose: { name: vector })` wraps that solid and publishes anchors. Every anchor is a vector. Names are unique. `part.anchor` reads an anchor the component exposed. Any other name is an error.

Expose `origin` as the point the viewer hangs the model on. The usual choice is the center of the part.

```text
expose: {
    up: Vector(x: 0.0, y: 0.0, z: 1.0),
    right: Vector(x: 1.0, y: 0.0, z: 0.0),
    origin: Vector(x: width / 2.0, y: depth / 2.0, z: height / 2.0)
}
```

## Joining two components

`join` places one component onto another. Both `frame` and `placed` must already be components. A function may receive a component and read the anchors it uses, as in `plate.origin`. The component passed at the call must expose every anchor that function reads. An inline `using` lambda can read `frame.up` and `placed.up` for the same reason. The result of `join` is a solid with no anchors, so wrap it in `Component` and publish the anchors the next step needs before you export it or join it again.

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

`meet(frame: vector, placed: vector)` pairs one vector from each part. The `planar` vectors must have a direction. `Vector(x: 0.0, y: 0.0, z: 0.0)` is rejected when the join runs.

Inside `combine`, the names `frame` and `placed` are the seated solids, and their anchors are not visible. `frame - placed` keeps the frame and cuts the placed solid away. `frame + placed` keeps both. Those two meanings of `+` and `-` exist only in `combine`.

To leave a wall of material, add the offset to the frame point:

```text
translation: meet(frame: frame.corner + Vector(x: wall, y: wall, z: wall), placed: placed.corner)
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
    solid: Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u, y: v, z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u, y: v, z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u, y: 0.0, z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u, y: depth, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: 0.0, y: u, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: width, y: u, z: v))
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(x: width / 2.0, y: depth / 2.0, z: height / 2.0)
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
    solid: Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u, y: v, z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u, y: v, z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u, y: 0.0, z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u, y: depth, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: 0.0, y: u, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: width, y: u, z: v))
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        corner: Vector(x: 0.0, y: 0.0, z: 0.0)
    }
)

def HollowBox = w => d => h => wall => Component(
    solid: join(
        frame: Box(width: w, depth: d, height: h),
        placed: Box(width: w - (wall * 2.0), depth: d - (wall * 2.0), height: h),
        using: frame => placed => align(
            planar: meet(frame: frame.up, placed: placed.up),
            translation: meet(frame: frame.corner + Vector(x: wall, y: wall, z: wall), placed: placed.corner),
            rotation: meet(frame: frame.right, placed: placed.right)
        ),
        combine: frame => placed => frame - placed
    ),
    expose: {
        origin: Vector(x: w / 2.0, y: d / 2.0, z: h / 2.0)
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
    solid: Solid3D(faces: [
        Surface2D(
            max_u: 2.0 * pi,
            min_v: u => 0.0,
            max_v: u => pi,
            formula: u => v => Vector(
                x: radius * cos(rad: u) * sin(rad: v),
                y: radius * sin(rad: u) * sin(rad: v),
                z: radius * cos(rad: v)
            )
        )
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(x: 0.0, y: 0.0, z: 0.0)
    }
)

export(Sphere(radius: 25.0))
```

## Example: a broom

The handle, the ferrule, and the hanging hole are the same shape. `Cylinder` is that shape, written once, as a function of `radius` and `height`. It is one `Tube` and two calls to `Disk`, at `z: 0.0` and at `z: height`. `Tube` and `Disk` are faces. The handle and the ferrule stand on `up`. The hole is the same call turned by `join`, so its axis lies across the handle, `hang_from_top` below the handle's top. Do not write a second cylinder along that other axis. The head and the bristle skirt are their own parts. Each join seats the next part on the anchors the two parts expose, then adds it or cuts it away. `export(Broom)` publishes the finished component. The sizes named above the parts are the numbers for this one broom. A reusable part takes those sizes as parameters and receives the numbers at the call, as `Sphere` and the patterned plate do.

```parascript
setup {
    units: "mm",
    coordinate_system: "Z-up"
}

// A broom standing on its bristles. Cylinder is written once. The handle,
// the ferrule, and the hanging hole are three calls. The join turns the hole
// so its axis lies across the handle. origin is where the renderer hangs the broom.
def pi = 3.14159265359

def handle_r = 11.0
def handle_len = 1000.0
def hang_r = 4.0
def hang_from_top = 30.0
def hang_span = handle_r * 2.0 + 8.0

def head_w = 240.0
def head_d = 50.0
def head_h = 24.0

def ferrule_r = 16.0
def ferrule_h = 36.0
def ferrule_bite = 1.0
def embed = 14.0

def bristle_h = 90.0
def bristle_bite = 3.0
def top_hw = 110.0
def top_hd = 18.0
def bot_hw = 150.0
def bot_hd = 34.0

// The handle passes through the ferrule and sinks this far into the head.
def socket = ferrule_h - ferrule_bite + embed
def handle_bottom = head_h - embed
def handle_top = handle_bottom + handle_len
def bristle_tip = bristle_bite - bristle_h

// A round cap in the XY plane. The bottom and the top are two calls.
def Disk = radius => z => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => radius,
    formula: u => v => Vector(
        x: v * cos(rad: u),
        y: v * sin(rad: u),
        z: z
    )
)

// The round wall. This is a face, the same kind of 2D surface as Disk.
def Tube = radius => height => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => height,
    formula: u => v => Vector(
        x: radius * cos(rad: u),
        y: radius * sin(rad: u),
        z: v
    )
)

// One round solid: one tube and two disks. up is its axis. bottom, center, and top sit on that axis.
def Cylinder = radius => height => Component(
    solid: Solid3D(faces: [
        Tube(radius: radius, height: height),
        Disk(radius: radius, z: 0.0),
        Disk(radius: radius, z: height)
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        bottom: Vector(x: 0.0, y: 0.0, z: 0.0),
        top: Vector(x: 0.0, y: 0.0, z: height),
        center: Vector(x: 0.0, y: 0.0, z: height / 2.0)
    }
)

def Handle = Cylinder(radius: handle_r, height: handle_len)
def HangHole = Cylinder(radius: hang_r, height: hang_span)
def Ferrule = Cylinder(radius: ferrule_r, height: ferrule_h)

// Turn the hole so its axis lies along Y, centered hang_from_top below the handle top.
def Stick = Component(
    solid: join(frame: Handle, placed: HangHole, using: frame => placed => align(
        planar: meet(frame: Vector(x: 0.0, y: 1.0, z: 0.0), placed: placed.up),
        translation: meet(frame: frame.top + Vector(x: 0.0, y: 0.0, z: 0.0 - hang_from_top), placed: placed.center),
        rotation: meet(frame: frame.right, placed: placed.right)
    ), combine: frame => placed => frame - placed),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        bottom: Vector(x: 0.0, y: 0.0, z: 0.0)
    }
)

def Head = Component(
    solid: Solid3D(faces: [
        Surface2D(max_u: head_w, min_v: u => 0.0, max_v: u => head_d, formula: u => v => Vector(x: u, y: v, z: 0.0)),
        Surface2D(max_u: head_w, min_v: u => 0.0, max_v: u => head_d, formula: u => v => Vector(x: u, y: v, z: head_h)),
        Surface2D(max_u: head_w, min_v: u => 0.0, max_v: u => head_h, formula: u => v => Vector(x: u, y: 0.0, z: v)),
        Surface2D(max_u: head_w, min_v: u => 0.0, max_v: u => head_h, formula: u => v => Vector(x: u, y: head_d, z: v)),
        Surface2D(max_u: head_d, min_v: u => 0.0, max_v: u => head_h, formula: u => v => Vector(x: 0.0, y: u, z: v)),
        Surface2D(max_u: head_d, min_v: u => 0.0, max_v: u => head_h, formula: u => v => Vector(x: head_w, y: u, z: v))
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        top: Vector(x: head_w / 2.0, y: head_d / 2.0, z: head_h)
    }
)

def Collar = Component(
    solid: join(frame: Head, placed: Ferrule, using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.top + Vector(x: 0.0, y: 0.0, z: 0.0 - ferrule_bite), placed: placed.bottom),
        rotation: meet(frame: frame.right, placed: placed.right)
    ), combine: frame => placed => frame + placed),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        top: Vector(x: head_w / 2.0, y: head_d / 2.0, z: head_h - ferrule_bite + ferrule_h)
    }
)

def Headed = Component(
    solid: join(frame: Collar, placed: Stick, using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.top + Vector(x: 0.0, y: 0.0, z: 0.0 - socket), placed: placed.bottom),
        rotation: meet(frame: frame.right, placed: placed.right)
    ), combine: frame => placed => frame + placed),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        seat: Vector(x: head_w / 2.0, y: head_d / 2.0, z: 0.0)
    }
)

// The skirt is narrow where it enters the head and wider at the floor.
def Bristles = Component(
    solid: Solid3D(faces: [
        Surface2D(
            max_u: bot_hw * 2.0,
            min_v: u => 0.0, max_v: u => bot_hd * 2.0,
            formula: u => v => Vector(x: u - bot_hw, y: v - bot_hd, z: 0.0)
        ),
        Surface2D(
            max_u: top_hw * 2.0,
            min_v: u => 0.0, max_v: u => top_hd * 2.0,
            formula: u => v => Vector(x: u - top_hw, y: v - top_hd, z: bristle_h)
        ),
        Surface2D(
            max_u: bristle_h,
            min_v: u => 0.0, max_v: u => 1.0,
            formula: u => v => Vector(
                x: (0.0 - (bot_hw + (top_hw - bot_hw) * (u / bristle_h))) + v * 2.0 * (bot_hw + (top_hw - bot_hw) * (u / bristle_h)),
                y: 0.0 - (bot_hd + (top_hd - bot_hd) * (u / bristle_h)),
                z: u
            )
        ),
        Surface2D(
            max_u: bristle_h,
            min_v: u => 0.0, max_v: u => 1.0,
            formula: u => v => Vector(
                x: (0.0 - (bot_hw + (top_hw - bot_hw) * (u / bristle_h))) + v * 2.0 * (bot_hw + (top_hw - bot_hw) * (u / bristle_h)),
                y: bot_hd + (top_hd - bot_hd) * (u / bristle_h),
                z: u
            )
        ),
        Surface2D(
            max_u: bristle_h,
            min_v: u => 0.0, max_v: u => 1.0,
            formula: u => v => Vector(
                x: 0.0 - (bot_hw + (top_hw - bot_hw) * (u / bristle_h)),
                y: (0.0 - (bot_hd + (top_hd - bot_hd) * (u / bristle_h))) + v * 2.0 * (bot_hd + (top_hd - bot_hd) * (u / bristle_h)),
                z: u
            )
        ),
        Surface2D(
            max_u: bristle_h,
            min_v: u => 0.0, max_v: u => 1.0,
            formula: u => v => Vector(
                x: bot_hw + (top_hw - bot_hw) * (u / bristle_h),
                y: (0.0 - (bot_hd + (top_hd - bot_hd) * (u / bristle_h))) + v * 2.0 * (bot_hd + (top_hd - bot_hd) * (u / bristle_h)),
                z: u
            )
        )
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        top: Vector(x: 0.0, y: 0.0, z: bristle_h)
    }
)

def Broom = Component(
    solid: join(frame: Headed, placed: Bristles, using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.seat + Vector(x: 0.0, y: 0.0, z: bristle_bite), placed: placed.top),
        rotation: meet(frame: frame.right, placed: placed.right)
    ), combine: frame => placed => frame + placed),
    expose: {
        origin: Vector(x: head_w / 2.0, y: head_d / 2.0, z: (handle_top + bristle_tip) / 2.0)
    }
)

export(Broom)
```

## Example: a patterned plate

`pi` is the only number bound for the whole script. `Disk` and `Tube` are the faces. `CylinderAt` is one tube and two disks, and it publishes `at`. `Box` is the rectangular solid: six faces, centered on X and Y, standing on z = 0. `Plate` is a square box, `Box(width: size, depth: size, height: thickness)`. The cavity example's box publishes `corner` at its minimum point, and the void is seated from that corner. This box is centered so `origin` is the center the pattern measures from. `Plate` exposes `up`, `right`, `origin`, and `top`. The numbers live in `parameters`. `cut_holes` reads `$holes`, `add_pins` reads `$pins`, and `patterned_plate` is `cut_holes >> add_pins`. The plate passed to that function is `Plate(size: $plate.size, thickness: $plate.thickness)`. Do not also bind `def size = 100.0` at the top.

`rectangular_pattern` returns the grid of points. `$holes.columns` has one entry per `$holes.count`, and this square plate uses that same list for the rows. `circular_pattern` returns the points of the pin circle. `$pins.indexes` has one entry per pin. There is no way to ask a list for its length, so both lists are fields of those groups. The column list has 5 entries, so the grid is 5 by 5. The pin list has 7 entries.

`map` builds one `CylinderAt` per point. The function names its parameter `item`. `radius` and `height` are arguments of that call, so a point can carry a cylinder of its own size. This plate uses one hole radius and one pin radius. `CylinderAt` keeps the point as `at`. `subtract_cylinders` cuts the hole list out of the one plate. `add_cylinders` unions the pin list onto that drilled solid. Each `join` seats one cylinder: a hole center meets `plate.origin + placed.at`, and a pin base meets `plate.top + placed.at`. The cutter is taller than the plate, so the hole passes through both faces. The pin point is sunk by `$pins.bite`, so the pin overlaps the plate and stands above it.

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
def Disk = radius => z => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => radius,
    formula: u => v => Vector(
        x: v * cos(rad: u),
        y: v * sin(rad: u),
        z: z
    )
)

// The round wall. This is a face, the same kind of 2D surface as Disk.
def Tube = radius => height => Surface2D(
    max_u: 2.0 * pi,
    min_v: u => 0.0, max_v: u => height,
    formula: u => v => Vector(
        x: radius * cos(rad: u),
        y: radius * sin(rad: u),
        z: v
    )
)

// The rectangular solid: six faces. Centered on X and Y, standing on z = 0.
// origin is the center. top is the center of the top face.
def Box = width => depth => height => Component(
    solid: Solid3D(faces: [
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u - (width / 2.0), y: v - (depth / 2.0), z: 0.0)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => depth, formula: u => v => Vector(x: u - (width / 2.0), y: v - (depth / 2.0), z: height)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u - (width / 2.0), y: 0.0 - (depth / 2.0), z: v)),
        Surface2D(max_u: width, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: u - (width / 2.0), y: depth / 2.0, z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: 0.0 - (width / 2.0), y: u - (depth / 2.0), z: v)),
        Surface2D(max_u: depth, min_v: u => 0.0, max_v: u => height, formula: u => v => Vector(x: width / 2.0, y: u - (depth / 2.0), z: v))
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        origin: Vector(x: 0.0, y: 0.0, z: height / 2.0),
        top: Vector(x: 0.0, y: 0.0, z: height)
    }
)

// A square box. size is the width and the depth.
def Plate = size => thickness => Box(width: size, depth: size, height: thickness)

// One centered grid point. column and row count from 0.
def grid_point = column_count => row_count => column_pitch => row_pitch => column => row => Vector(
    x: (column - ((column_count - 1.0) / 2.0)) * column_pitch,
    y: (row - ((row_count - 1.0) / 2.0)) * row_pitch,
    z: 0.0
)

def row_points = column_count => row_count => column_pitch => row_pitch => columns => row => columns
    |> map(f: item => grid_point(column_count: column_count, row_count: row_count, column_pitch: column_pitch, row_pitch: row_pitch, column: item, row: row))

def append_points = left => right => match left {
    [] => right,
    head :: tail => head :: append_points(left: tail, right: right)
}

def flatten_rows = rows => match rows {
    [] => [],
    head :: tail => append_points(left: head, right: flatten_rows(rows: tail))
}

// The grid of points. columns and rows each have one entry per count, from 0.
def rectangular_pattern = column_count => row_count => column_pitch => row_pitch => columns => rows => rows
    |> map(f: item => row_points(column_count: column_count, row_count: row_count, column_pitch: column_pitch, row_pitch: row_pitch, columns: columns, row: item))
    |> flatten_rows

// The points of a circle in the plate's plane. indexes has one entry per point, from 0.
def circular_pattern = point_count => radius => indexes => indexes
    |> map(f: item => Vector(
        x: radius * cos(rad: item * (2.0 * pi / point_count)),
        y: radius * sin(rad: item * (2.0 * pi / point_count)),
        z: 0.0
    ))

// A cylinder for one point. radius and height belong to this call, so each point can differ.
// at is the point, kept on the cylinder so the plate can seat it.
def CylinderAt = radius => height => at => Component(
    solid: Solid3D(faces: [
        Tube(radius: radius, height: height),
        Disk(radius: radius, z: 0.0),
        Disk(radius: radius, z: height)
    ]),
    expose: {
        up: Vector(x: 0.0, y: 0.0, z: 1.0),
        right: Vector(x: 1.0, y: 0.0, z: 0.0),
        bottom: Vector(x: 0.0, y: 0.0, z: 0.0),
        top: Vector(x: 0.0, y: 0.0, z: height),
        center: Vector(x: 0.0, y: 0.0, z: height / 2.0),
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
            translation: meet(frame: plate.origin + placed.at, placed: placed.center),
            rotation: meet(frame: plate.right, placed: placed.right)
        ),
        combine: frame => placed => frame - placed
    ),
    expose: { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
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
            translation: meet(frame: plate.top + placed.at, placed: placed.bottom),
            rotation: meet(frame: plate.right, placed: placed.right)
        ),
        combine: frame => placed => frame + placed
    ),
    expose: { up: plate.up, right: plate.right, origin: plate.origin, top: plate.top }
)

def add_cylinders = plate => cylinders => match cylinders {
    [] => plate,
    head :: tail => add_cylinders(
        plate: add_cylinder(plate: plate, placed: head),
        cylinders: tail
    )
}

// The grid, then one cylinder per point, then those cylinders cut out of this plate.
def cut_holes = plate => rectangular_pattern(
    column_count: $holes.count,
    row_count: $holes.count,
    column_pitch: $holes.pitch,
    row_pitch: $holes.pitch,
    columns: $holes.columns,
    rows: $holes.columns
)
    |> map(f: item => CylinderAt(radius: $holes.radius, height: $holes.span, at: item))
    |> subtract_cylinders(plate: plate)

// The circle, sunk by $pins.bite, then one pin per point, added to the plate.
def add_pins = plate => circular_pattern(
    point_count: $pins.count,
    radius: $pins.ring,
    indexes: $pins.indexes
)
    |> map(f: item => item + Vector(x: 0.0, y: 0.0, z: 0.0 - $pins.bite))
    |> map(f: item => CylinderAt(radius: $pins.radius, height: $pins.height, at: item))
    |> add_cylinders(plate: plate)

def patterned_plate = cut_holes >> add_pins

export(patterned_plate(
    plate: Plate(size: $plate.size, thickness: $plate.thickness)
))
```

## Forms the compiler rejects

- A built-in `Cube`, `Sphere`, or `Cylinder`. Those names exist only when the script defines them.
- `if`, `for`, `while`, comparisons, `range`, and asking a list for its length.
- A unary minus, as in `-16.0`. Write `0.0 - 16.0`.
- Multiplying or dividing a vector by a number.
- `^`. It is not power.
- `fn name(...)`, `return`, and a `def` inside a function.
- A positional call, such as `Brick(40.0, 30.0, 20.0)`. The parameter names are part of the call, in order.
- A signature that disagrees with the value, such as a `number` result whose value is a vector.
- `export` of a number, a vector, a raw solid, a bare `join`, or a function that still expects arguments.
- A `join` whose `frame` or `placed` is a raw solid instead of a component.
- `Component(solid: parameter, ...)`. The solid has to be a solid expression, usually the `join` written in that argument.
- A `parameters` block anywhere except immediately after `setup`.
- A field the parameter group does not have, and a bare `plate` where the script means `$plate`.
- Reading an anchor the component did not expose, and reading `vector.x`. Member access reads a field of a parameter group, or an anchor on a component.
- `.` used as composition, and `items |> map` while `map` is still waiting for `f`.
- `Curve1D`. It does not become a solid, and the workspace does not draw it.
