# ParaScript language

This is the language the workspace compiler accepts. Write a script using only the forms on this page. Paste it into the [workspace](/workspace) and press Run solver.

A script builds one closed solid and publishes it as a component. `Sphere`, `Box`, and `Cylinder` are already parts. A cube is not. You write every other face.

The language is functional. A face, a part, and an assembly are functions of the numbers that can change. Call those functions with the sizes at the use site. When the same shape appears again, call the function again. Do not copy its faces.

## How to write a solid

A script describes one closed solid. The workspace compiles that script and draws the solid. Six pictures follow. Each picture is one idea. Read the picture, then the sentences under it.

The examples later on this page are finished scripts. Copy the smallest one that already does what you want, and change the sizes.

### 1. A face is a formula

![Two numbers in. One point out.](/guide/face.svg)

A face takes two numbers, `u` and `v`, and returns one point. That point is a vector, measured from the origin of the part.

![u slides the point along x. v slides it along y.](/guide/face-sweep.svg)

A flat face is the easy one to see. `u` is how far the point has walked along x. `v` is how far it has walked along y. The height is `0`.

```text
Surface2D(
    max_u: width,
    min_v: u => 0.0,
    max_v: u => depth,
    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
)
```

Hold `v` still and let `u` grow. The tip slides along one line. Hold `u` still and let `v` grow. The tip slides along the line that crosses the first. Every pair in the two ranges is a point on the face.

`u` runs from `0` to `max_u`. At each `u`, `v` runs from `min_v(u)` to `max_v(u)`. The flat face uses one pair of limits the whole way across. A sphere lets `u` walk once around and `v` walk from the top pole to the bottom pole. Move `u` and `v` across their ranges and the points make the surface.

A sphere you write yourself is one face. A box is six faces. A cylinder is a round wall and two caps. `Sphere(radius:)`, `Box(width:, depth:, height:)`, and `Cylinder(radius:, height:)` are already parts. Call one, or write the faces yourself.

> Remember: you write the face, or you call a part that already wrote it.

### 2. Write a part once

![One cylinder becomes the handle, the ferrule, and the hole.](/guide/part.svg)

A part is a function of its sizes. Write the shape once. Call it every time that shape appears, and pass the sizes at the call.

```text
Cylinder(radius: 11.0, height: 1000.0)
Cylinder(radius: 16.0, height: 36.0)
```

The broom does this with the built-in cylinder. The handle is a long call. The ferrule is a short call. The hole is a thin call. Same part. Three sizes.

`Box(width: 100.0, depth: 40.0, height: 8.0)` stands on z = 0, from the origin out to those sizes. `Cylinder(radius: 11.0, height: 1000.0)` stands on that same axis. `Sphere(radius: 25.0)` is centered on the origin. A `def` of any of these names replaces the built-in part.

### 3. Keep the sizes in parameters

![The plate reads $plate.size.](/guide/parameters.svg)

The list on the left is the plate's numbers.

```text
parameters {
    plate: {
        size: 100.0,
        thickness: 8.0
    }
}
```

The gold label is the plate reading its width. `$plate.size` means the `size` written under `plate`. Change `100.0` and the plate grows or shrinks. The part the script calls stays that part.

A count, such as how many holes, and a position, such as where a hole sits, are numbers of the same kind. They sit with the part they describe.

### 4. Publish anchors

![The host publishes corner. The seated part publishes bottom.](/guide/anchors.svg)

A part keeps its own coordinates. It publishes the points and directions a mate may use. Those published names are the anchors.

The host publishes `up`, `right`, and `corner`. A part that will be seated publishes `up`, `right`, and `bottom`. The component you export publishes `origin`. That is the point the viewer hangs the model on.

`Box` stands on z = 0. `corner` and `origin` are `(0, 0, 0)`. `bottom` is the center of the face on z = 0, `(width / 2, depth / 2, 0)`. `top` is the center of the top face, `(width / 2, depth / 2, height)`. `up` is `(0, 0, 1)` and `right` is `(1, 0, 0)`. `Cylinder` stands on that axis. `bottom` is `(0, 0, 0)`, `top` is `(0, 0, height)`, and `center` is `(0, 0, height / 2)`. `forward` is `(0, 1, 0)`. `Sphere(radius:)` is centered on the origin. `origin` and `center` are `(0, 0, 0)`. `top` is `(0, 0, radius)` and `bottom` is `(0, 0, 0 - radius)`. A `def` of `Sphere`, `Box`, `Cylinder`, or `fold` replaces that built-in part.

```text
expose: coords => {
    up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
    right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
    corner: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
}
```

### 5. Seat one feature with join

![frame - placed cuts a hole. frame + placed keeps a knob.](/guide/join.svg)

`join` turns the incoming part until the anchors agree, slides it into place, and then combines the two solids.

Name the two parameters `frame` and `placed`, in that order. `frame - placed` cuts the placed solid away. `frame + placed` keeps both solids. A hole uses the cut. A knob uses the keep.

```text
join(
    frame: Plate,
    placed: Hole,
    using: frame => placed => align(
        planar: meet(frame: frame.up, placed: placed.up),
        translation: meet(frame: frame.corner, placed: placed.bottom),
        rotation: meet(frame: frame.right, placed: placed.right)
    ),
    combine: frame => placed => frame - placed
)
```

Seat one feature per join. A join returns a solid with no anchors, so wrap it in `Component` before the next seat.

### 6. Export one component

![export sends one component to the workspace.](/guide/export.svg)

End the script with one `export`. A sphere passes its radius at the call. A broom exports the finished broom.

```text
export(Sphere(radius: 25.0))
```

Open the [workspace](/workspace), paste the script, and press Run solver.

> Remember: the plate is the script for a grid or a circle. The screw is the script for a standard measurement. The broom is the script for one shape seated several times.

## The shape of a script

![setup, then parameters, then the parts, then one export.](/guide/script.svg)

Four beats, in this order. `setup`, then `parameters`, then the parts, then one `export`.

```text
setup {
    name: "Plate",
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    plate: {
        size: 100.0,
        thickness: 8.0
    }
}
```

- `name` is required. It is the model's name. The downloaded STL file uses it.
- `units` is `"mm"` or `"inch"`. The numbers are already in that unit.
- `coordinate_system` is `"Z-up"`, `"Y-up"`, or `"X-up"`. It tells the viewer which axis is up.
- `setup` requires `name`. It also has `units` and `coordinate_system`.
- `parameters` sits immediately after `setup`. A size, a count, and a position are fields there, grouped by the part.
- A group may contain groups. Inside the group, a later field uses an earlier field by its short name. A later group reads it as `$plate.size`.
- A measurement from a standard sits in a group named for that standard.
- `$plate.size` reads a field. `plate.origin` reads an anchor. The dot does both jobs, on different values.
- `def name = expression` binds a name. `param` is the same binding. Bind each name once.
- `export(...)` publishes one component. A sphere passes its radius at the call. A box exports the finished `HollowBox`. A number, a vector, a raw solid, a bare `join`, or a function that still wants arguments is refused. The last export wins.
- A comment is `//` to the end of the line. The words above separate statements. There are no semicolons.

> Remember: pi belongs to the whole script. `def pi = 3.14159265359`. It is not a field of a part.

## Snake and Pascal

![vector_grid is a function. Plate is a component.](/guide/names.svg)

A name is letters, digits, and underscores. `snake_case` is a value or a function. `PascalCase` is a component. `vector_grid` returns points. `Plate` is a part.

These words are reserved: `setup`, `parameters`, `param`, `def`, `fn`, `export`, `return`, `true`, `false`, `match`, `let`, `in`.

## Arithmetic

![40.0 + 2.0 is numbers. offset moves a point.](/guide/arithmetic.svg)

Numbers are decimals, such as `40.0`. A negative number is `0.0 - 16.0`. There is no unary minus.

`+`, `-`, `*`, and `/` work on two numbers. They do not work on vectors. Scale a vector by writing each axis: `x: 2.0 * x`.

Move a point with `offset(x:, y:, z:)`. Combine two vectors with `add(vector:)` and `subtract(vector:)`. Both vectors share a coordinate system, and the result keeps the receiver's system.

`cos(rad:)` and `sin(rad:)` take radians. The argument is named `rad`.

A formula has no `if`, no comparisons, and no loops. It is one expression. `fn` and `return` do not define a function. A function is a `def` of a lambda.

> Remember: inside `combine` only, `frame + placed` keeps both solids and `frame - placed` cuts the placed solid away.

## Types

![T in, T in, a number out.](/guide/types.svg)

A `def` may announce its type, then give the value.

```text
def same: T => T => number = x => y => 1.0
```

`T` is one type variable, so both arguments share it and the result is a number. `A => B => number` is two different variables. The signature has to agree with the value. Each call of `same` picks its own `T`.

Concrete types: `number`, `vector`, `boolean`, `string`, `component`, `solid`, `surface`, `coordinate_system`. `[T]` is a list. `(number, vector)` is a tuple, and the length is part of the type.

`=>` groups to the right, so `T => T => number` means a function that returns a function. Parentheses group the other way: `(T => T) => number`. A comma in those parentheses makes a tuple type.

A signature may name the arguments: `a: T => b: T => number`. The value then uses `a` and `b`.

```text
def map: (item: T => U) => (list: [T]) => [U] = f => list => ...
```

## Write it once

A second copy of the same faces is a mistake. Write the shape once. Call it every time it appears, and pass the sizes at the call, including at `export`.

The sizes live in `parameters`. The call reads them. A top-level `def` of a number is for a value the whole script shares, such as pi.

![One cylinder becomes the handle, the ferrule, and the hole.](/guide/part.svg)

The broom is the picture. One `Cylinder`. The handle, the ferrule, and the hole are three calls. `join` turns the hole until its axis lies across the handle.

`vector_grid` returns a grid of points. `circular_pattern` returns the points of a circle. `place_components` seats one component at each point. `PlateWithHoles` reads `$holes`. `PlateWithKnobs` reads `$pins`.

The built-in `Cylinder` is the round part. Write the faces when the solid is a different shape. A hand-written round solid is a wall and two caps.

```text
Tube(coords: coords, radius: radius, height: height)
Disk(coords: coords, radius: radius, z: 0.0)
Disk(coords: coords, radius: radius, z: height)
```

`let` names a value inside a function. The name exists after `in`. `let (x, y) = pair in` opens a tuple. The anchor `bottom` is a point. A face you name `bottom` is a cap. Same word, two jobs, two places.

`frame.up` reads an anchor. `frame . up` is the same read.

## The pipe and the compose

![1, 2, 3 go in. 2, 4, 6 come out.](/guide/pipe.svg)

`|>` feeds a value into the next argument of a function.

```text
[1.0, 2.0, 3.0] |> map(f: item => item * 2.0)
```

That is `map(f: item => item * 2.0, list: [1.0, 2.0, 3.0])`, which is `[2.0, 4.0, 6.0]`. The list can keep going:

```text
[1.0, 2.0, 3.0]
    |> map(f: item => item * 2.0)
    |> filter(predicate: item => true)
```

`>>` glues two functions. The left one runs first. Each one must already be waiting for a single value.

```text
def shift = d => x => x + d
def scale = k => x => k * x
def adjust = shift(d: 3.0) >> scale(k: 2.0)
```

`adjust(x: 4.0)` is `14`. `shift >> scale` is refused, because `shift` is still waiting for `d`. `>>` binds tighter than `|>`, so `4.0 |> shift(d: 3.0) >> scale(k: 2.0)` is also `14`.

`map` waits for `f` first. Pipe the list: `items |> map(f: item => ...)`. `items |> map` is refused.

A function takes one argument at a time. Name every argument, in order.

```text
export(Brick(width: 40.0, depth: 30.0, height: 20.0))
```

`Brick(40.0, 30.0, 20.0)` is refused. Leave an argument off and you still have a function. `export` cannot publish a function.

## Lists

![The first value is the head. The rest is the tail.](/guide/lists.svg)

A list is `[1.0, 2.0]`. `head :: tail` puts one value at the front. `[]` is empty.

```text
match items {
    [] => 0.0,
    head :: tail => head
}
```

A `def` may call itself. `map` and `filter` are built in, and their function argument is named `item`.

```text
map(f: item => item * 2.0, list: [1.0, 2.0])
filter(predicate: item => true, list: [1.0, 2.0])
```

`item => true` keeps every element. `item => false` keeps none. A formula cannot compare, so the predicate is the literal `true` or `false`.

`integers(start:, count:)` builds whole numbers. `start` is the first. `count` is how many, including the first.

```text
integers(start: 0.0, count: 5.0)
```

That is `[0.0, 1.0, 2.0, 3.0, 4.0]`. `integers(start: 0.0, count: 0.0)` is `[]`. `integers(start: 0.0 - 2.0, count: 3.0)` is `[-2.0, -1.0, 0.0]`. `5.0 |> integers(start: 1.0)` fills `count`, so the list runs from `1.0` through `5.0`.

`fold(f:, initial:, list:)` walks the list from the last item back to the first. `f` is `item => accumulator =>`. An empty list returns `initial`. A `def fold` replaces that walk.

`map` returns a new list. On the plate, `vector_grid` and `circular_pattern` build the points, and `place_components` seats a cylinder at each one. An empty list returns the host unchanged.

## Tuples

![A tuple keeps each value's own type.](/guide/tuple.svg)

A tuple holds a fixed count, and each place keeps its own type. A list cannot do that: every element of `[T]` is a `T`.

```text
def pair = (1.0, true)
def nested = (1.0, (2.0, 3.0))
```

`(1.0 + 2.0)` has no comma, so the parentheses only group the sum. A tuple needs at least two values. Open it with `let`. The names exist after `in`.

```text
def sum = let (x, (y, z)) = nested in x + y + z
```

That sum is `6`. There is no `pair.0` and no `pair.x`.

```text
def first: (T, U) => T = pair => let (x, y) = pair in x
```

`first(pair: (1.0, true))` is `1.0`. `(number, number, number)` does not match `(number, number)`.

## Vectors

![x to the right, y along the depth, z up.](/guide/vector.svg)

A vector is the coordinate system, then `x`, `y`, and `z`, in that order.

```text
Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0)
```

The parameter is named `coords`. A script cannot build a coordinate system. There is no `CoordinateSystem(...)`. `Component` creates the one system and hands it to `solid: coords =>` and `expose: coords =>`. A component does not publish it. `frame.coords` does not typecheck. A direction a mate needs is an anchor. The broom's cylinder publishes `forward`.

Write a `Vector` inside those callbacks, or inside a helper that receives `coords` and is called from there. A face formula is `u => v => Vector(...)`, and that formula sits where `coords` is in scope.

`join` takes the coordinate system last and ignores it, so the solid is the call: `solid: join(...)`. Inside `using` there is no `coords`. Move a point with `offset`.

```text
frame.top.offset(x: 0.0, y: 0.0, z: 0.0 - overlap)
plate.origin.add(vector: placed.at)
```

`+` and `-` do not combine vectors. An expose block cannot publish a field named `coords`. The `coordinate_system` string in `setup` is for the viewer. It is not a value you can pass to `Vector`.

For `"Z-up"`, `up` is `(0, 0, 1)` and `right` is `(1, 0, 0)`.

## A face

![Two numbers in. One point out.](/guide/face.svg)

A face is a `Surface2D`. `u` runs from `0` to `max_u`. At each `u`, `v` runs from `min_v(u)` to `max_v(u)`. The formula is `u => v => Vector(...)`, in the part's own coordinates.

```text
Surface2D(
    max_u: width,
    min_v: u => 0.0,
    max_v: u => depth,
    formula: u => v => Vector(coords: coords, x: u, y: v, z: 0.0)
)
```

The viewer samples a face on 16 to 32 steps. A detail smaller than that grid, such as one turn of a screw thread, needs its own face.

## A component

![The exported component publishes origin.](/guide/origin.svg)

`Solid3D(faces: [ ... ])` collects the faces. A closed box has six, and they meet at the edges.

`Component` wraps a solid and publishes anchors. `solid` is `coords =>` a solid or a component, or `join(...)`. `expose` is `coords => { anchors }`. Every anchor is a vector. Names are unique. `part.anchor` reads one. An empty list is `expose: coords => {}`.

The component you export publishes `origin`. That is the point the viewer hangs the model on. The box puts it at the center. The plate puts it at the corner the grid measures from.

```text
expose: coords => {
    up: Vector(coords: coords, x: 0.0, y: 0.0, z: 1.0),
    right: Vector(coords: coords, x: 1.0, y: 0.0, z: 0.0),
    origin: Vector(coords: coords, x: width / 2.0, y: depth / 2.0, z: height / 2.0)
}
```

## A join

![frame - placed cuts a hole. frame + placed keeps a knob.](/guide/join.svg)

`join` seats one component on another. Both are already components. The parameters are named `frame` and `placed`.

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

`align` does three things, in order. `planar` turns `placed` until the directions are parallel. `translation` slides it until the points meet. `rotation` turns it in that plane until the other directions match.

`meet(frame:, placed:)` pairs one vector from each part. A planar direction cannot be the zero vector.

Inside `combine`, the anchors are gone and so is `coords`. `frame - placed` cuts. `frame + placed` keeps both. Those meanings exist only here.

A join returns a solid with no anchors. Wrap it in `Component` and publish the anchors the next seat needs. One feature per join.

To leave a wall of material, move the frame point: `frame.corner.offset(x: wall, y: wall, z: wall)`. A part that should keep the orientation it was built with publishes the same `up` and `right` as the host. Translation is then the only move.

The plate is the script for a grid or a circle of these seats. Copy it.

## The compiler says no

![Cube, a bare minus, a positional call, and a bare number.](/guide/refused.svg)

Each line is one refusal.

- A built-in `Cube`. `Sphere`, `Box`, `Cylinder`, and `fold` are already in the language. A script may define the same name, and that definition is the one it calls.
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

## Example: a sphere

`Sphere(radius:)` is centered on the origin. The radius is chosen at the call. `origin` is that center.

```parascript
setup {
    name: "Sphere",
    units: "mm",
    coordinate_system: "Z-up"
}

export(Sphere(radius: 25.0))
```

## Example: a box

`HollowBox` calls `Box` twice. The outer box stands on z = 0, with `corner` at the low corner. The void is seated from that corner, cut with `frame - placed`, and the top stays open. `origin` is the center of the hollow box.

```parascript
setup {
    name: "Hollow box",
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    width: 100.0,
    depth: 50.0,
    height: 30.0,
    wall_thickness: 3.0
}

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

One cylinder, three jobs. The handle, the ferrule, and the hole through the handle are three calls. `join` turns the hole so it lies across the handle.

```parascript
setup {
    name: "Broom",
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
    let socket = $ferrule.height - $ferrule.bite + $handle.embed in
    let handle_bottom = $head.height - $handle.embed in
    let handle_top = handle_bottom + $handle.length in
    let bristle_tip = $bristles.bite - $bristles.height in
    let stick = Component(
        solid: join(
            frame: Cylinder(
                    radius: $handle.radius,
                    height: $handle.length),
            placed: Cylinder(
                    radius: $hang.radius,
                    height: $handle.radius * 2.0 + 8.0),
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

The plate is the form to copy for a grid of features and a circle of features. Holes use `frame - placed`. Knobs use `frame + placed`.

```parascript
setup {
    name: "Plate",
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

A standard measurement sits in a group named for that standard. The head is `iso_4017`. The thread is `iso_68_1`. Each turn of the thread is its own face, so the pitch stays visible.

```parascript
setup {
    name: "M3 screw",
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

Many parts, one body. The keys share one cylinder. The rockers share one stadium. Positions live in `layout`.

```parascript
setup {
    name: "Remote",
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

A body, a cabin, and two axles. Each wheel is a `Cylinder(radius:, height:)` seated on the hull. That `join` turns the cylinder so its axis lies along the body's `right`. The cabin sits on the body's `top`. Each `join` is wrapped so the next mate can still read the anchors.

```parascript
setup {
    name: "Car",
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

def Axle = host => y =>
    let track = $body.width - $wheel.width in
    let with_left = Component(
        solid: join(
            frame: host,
            placed: Cylinder(radius: $wheel.radius, height: $wheel.width),
            using: frame => placed => align(
                planar: meet(
                    frame: frame.right,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(
                        x: $wheel.width / 2.0,
                        y: y,
                        z: $wheel.radius - $wheel.ride),
                    placed: placed.center),
                rotation: meet(
                    frame: frame.up,
                    placed: placed.forward)
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
            frame: with_left,
            placed: Cylinder(radius: $wheel.radius, height: $wheel.width),
            using: frame => placed => align(
                planar: meet(
                    frame: frame.right,
                    placed: placed.up),
                translation: meet(
                    frame: frame.at.offset(
                        x: $wheel.width / 2.0 + track,
                        y: y,
                        z: $wheel.radius - $wheel.ride),
                    placed: placed.center),
                rotation: meet(
                    frame: frame.up,
                    placed: placed.forward)
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
    let with_front = Axle(
        host: hull,
        y: $body.depth - $axle.nose) in
    Axle(
        host: with_front,
        y: $body.depth - $axle.nose - $axle.wheelbase)

export(Car)
```

## Example: a desk set

A base, three clips, and a shaker. The clips are one `Clip` seated again at `$clip.pitch`. The shaker's sizes are nested under `shaker`.

```parascript
setup {
    name: "Desk set",
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

## Example: M

A plate with the letter M on it. The stroke is cylinders seated along straight runs and arcs. The sizes sit in `script`.

```parascript
setup {
    name: "Letter M",
    units: "mm",
    coordinate_system: "Z-up"
}

parameters {
    script: {
        stroke_radius: 1.8,
        extrude_height: 4.0,
        base_thickness: 2.0,
        total_width: 56.0,
        total_depth: 58.0
    }
}

def pi = 3.14159265359

def place_beads = host => points => bead => fold(
    f: item => accumulator => Component(
        solid: join(
            frame: accumulator,
            placed: bead,
            using: frame => placed => align(
                planar: meet(frame: accumulator.up, placed: placed.up),
                translation: meet(frame: accumulator.corner.add(vector: item), placed: placed.bottom),
                rotation: meet(frame: accumulator.right, placed: placed.right)
            ),
            combine: frame => placed => frame + placed
        ),
        expose: coords => { up: accumulator.up, right: accumulator.right, corner: accumulator.corner }
    ),
    initial: host,
    list: points
)

def sample_segment = coords => x0 => y0 => x1 => y1 => steps =>
    integers(start: 0.0, count: steps + 1.0)
    |> map(f: item =>
        let t = item / steps in
        Vector(
            coords: coords,
            x: x0 + ((x1 - x0) * t),
            y: y0 + ((y1 - y0) * t),
            z: $script.base_thickness - 0.4
        )
    )

def sample_arc = coords => cx => cy => rx => ry => start_deg => end_deg => steps =>
    integers(start: 0.0, count: steps + 1.0)
    |> map(f: item =>
        let t = item / steps in
        let ang = (start_deg + ((end_deg - start_deg) * t)) * (pi / 180.0) in
        Vector(
            coords: coords,
            x: cx + (rx * cos(rad: ang)),
            y: cy + (ry * sin(rad: ang)),
            z: $script.base_thickness - 0.4
        )
    )

def append_lists = a => b => fold(f: item => accumulator => item :: accumulator, initial: b, list: a)

def concat_all = lists => fold(f: item => accumulator => append_lists(a: item, b: accumulator), initial: [], list: lists)

def letter_m_points = coords => concat_all(lists: [
    sample_arc(coords: coords, cx: 14.0, cy: 14.0, rx: 4.5, ry: 4.0, start_deg: 230.0, end_deg: 30.0, steps: 10.0),
    sample_segment(coords: coords, x0: 17.9, y0: 16.0, x1: 23.0, y1: 43.0, steps: 14.0),
    sample_arc(coords: coords, cx: 24.2, cy: 43.0, rx: 1.2, ry: 1.5, start_deg: 160.0, end_deg: 10.0, steps: 5.0),
    sample_segment(coords: coords, x0: 25.4, y0: 42.8, x1: 29.0, y1: 23.0, steps: 11.0),
    sample_arc(coords: coords, cx: 30.2, cy: 23.0, rx: 1.2, ry: 1.5, start_deg: 190.0, end_deg: 350.0, steps: 5.0),
    sample_segment(coords: coords, x0: 31.4, y0: 23.0, x1: 35.5, y1: 43.0, steps: 11.0),
    sample_arc(coords: coords, cx: 36.7, cy: 43.0, rx: 1.2, ry: 1.5, start_deg: 170.0, end_deg: 10.0, steps: 5.0),
    sample_segment(coords: coords, x0: 37.9, y0: 42.8, x1: 41.0, y1: 15.0, steps: 14.0),
    sample_arc(coords: coords, cx: 45.5, cy: 15.0, rx: 4.5, ry: 3.5, start_deg: 180.0, end_deg: 345.0, steps: 10.0)
])

def BasePlate = Box(
    width: $script.total_width,
    depth: $script.total_depth,
    height: $script.base_thickness
)

def StrokeBead = Cylinder(
    radius: $script.stroke_radius,
    height: $script.extrude_height
)

def LetterMSign = coords => place_beads(
    host: BasePlate,
    points: letter_m_points(coords: coords),
    bead: StrokeBead
)

export(Component(
    solid: coords => LetterMSign(coords: coords),
    expose: coords => {
        origin: Vector(coords: coords, x: 0.0, y: 0.0, z: 0.0)
    }
))
```
