# ParaScript language

This is the language the workspace compiler accepts. Write a script using only the forms on this page. Paste it into the [workspace](/workspace) and press Run solver. The canonical text for a language model is [https://parascript.lindeque.family/language.md](https://parascript.lindeque.family/language.md).

A script builds one closed solid and publishes it as a component. There is no library of cubes, spheres, or cylinders. You write the faces.

The language is functional. A face, a part, and an assembly are functions of the numbers that can change. Call those functions with the sizes at the use site. `export` is one of those sites. When the same shape appears again, call the function again. Do not copy its faces.

## Script shape

A script starts with `setup`, then bindings, then one export.

```text
setup {
    units: "mm",
    coordinate_system: "Z-up"
}
```

- `units` is `"mm"` or `"inch"`. The numbers in the script are already in that unit. The compiler does not scale them.
- `coordinate_system` is `"Z-up"`, `"Y-up"`, or `"X-up"`. Write the coordinates in that system. The viewer uses it to decide which axis points up.
- `setup` has those two fields and no others.
- Bind a name with `def name = expression`. `param name = expression` is the same kind of binding. Bind each name once.
- The script ends with `export(...)`. The value must be a component, usually a call that supplies the sizes: `export(Brick(width: 40.0, depth: 30.0, height: 20.0))`. A number, a vector, a raw solid, a bare `join`, or a function that still expects arguments is rejected. When several exports appear, the last one is published.
- Comments are `//` to the end of the line. Statements are separated by the words above, not by semicolons.

## Names and arithmetic

A name is letters, digits, and underscores. Use `snake_case` for values and `PascalCase` for components. These words are reserved: `setup`, `param`, `def`, `fn`, `export`, `return`, `true`, `false`, `match`.

- Write numbers as decimals: `40.0`.
- There is no unary minus. A negative number is `0.0 - 16.0`.
- `+`, `-`, `*`, and `/` work on two numbers.
- `+` and `-` also work on two vectors, one component at a time.
- Do not multiply or divide a vector by a number. Scale each component: `Vector(x: 2.0 * x, y: 2.0 * y, z: 2.0 * z)`.
- `cos(rad: angle)` and `sin(rad: angle)` take radians. The argument name is `rad`.
- When you need pi, bind it: `def pi = 3.14159265359`.
- A formula has no `if`, no comparisons, no booleans, and no loops. It is one arithmetic expression.
- `fn` and `return` do not define a function. A function is a binding of a lambda.

## Functions

Write a shape once, as a function, and call it at every place that shape appears. Pass the sizes at the call, including in `export`. A second copy of the same faces is a mistake. A second size is another call.

The broom does this. `Cylinder` is defined once. The handle, the ferrule, and the hole through the handle are three calls. The hole is not drawn again on its side. `join` turns that same cylinder until its axis lies across the handle.

A face is a function too. `Disk` is the round cap. The bottom and the top are `Disk(radius: radius, z: 0.0)` and `Disk(radius: radius, z: height)`.

`.` reads an anchor, as in `frame.up`. Spaces do not change that. `frame . up` is the same as `frame.up`.

`>>` composes two functions, left to right. The left function runs first, and its result is the right function's argument. The composed function keeps the left function's parameter name. Each function must already be waiting for that one value:

```text
def shift = d => x => x + d
def scale = k => x => k * x
def adjust = shift(d: 3.0) >> scale(k: 2.0)
```

`adjust(x: 4.0)` is `scale(k: 2.0, x: shift(d: 3.0, x: 4.0))`, which is `14`. `shift >> scale` is rejected, because `shift` is still waiting for `d`.

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

`join` places one component onto another. Both `frame` and `placed` must already be components. The result is a solid with no anchors, so wrap it in `Component` before you export it or join it again.

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

The handle, the ferrule, and the hanging hole are the same shape. `Cylinder` is that shape, written once, as a function of `radius` and `height`. Its two caps are one `Disk`, called at `z: 0.0` and at `z: height`. The handle and the ferrule stand on `up`. The hole is the same call turned by `join`, so its axis lies across the handle, `hang_from_top` below the handle's top. Do not write a second cylinder along that other axis. The head and the bristle skirt are their own parts. Each join seats the next part on the anchors the two parts expose, then adds it or cuts it away. Sizes that several parts share are bound once at the top. `export(Broom)` publishes the finished component.

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

// One round solid. up is its axis. bottom, center, and top sit on that axis.
def Cylinder = radius => height => Component(
    solid: Solid3D(faces: [
        Surface2D(
            max_u: 2.0 * pi,
            min_v: u => 0.0, max_v: u => height,
            formula: u => v => Vector(
                x: radius * cos(rad: u),
                y: radius * sin(rad: u),
                z: v
            )
        ),
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

## Forms the compiler rejects

- A built-in `Cube`, `Sphere`, or `Cylinder`. Those names exist only when the script defines them.
- `if`, `for`, `while`, comparisons, and booleans inside a formula.
- A unary minus, as in `-16.0`.
- Multiplying a vector by a number.
- `fn name(...)` and `return`.
- `export` of anything other than a component.
- A `join` whose `frame` or `placed` is a raw solid instead of a component.
- Reading an anchor the component did not expose.
- `Curve1D`. It does not become a solid, and the workspace does not draw it.
