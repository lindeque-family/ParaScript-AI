// ============================================================================
// PARASCRIPT AI WEB TRANSPILED CODE GENERATOR KERNEL (v14.0.0)
// ============================================================================

import type { ASTNode, Program, ExpressionNode, Identifier } from "./ast.js";

export class WebCodeGenerator {
    private indentLevel = 0;
    private scopeDepth = 0;
    private scopeName = "env";
    private readonly locals: string[] = [];

    public generate(program: Program): string {
        let js = `// ============================================================================\n`;
        js += `// PARASCRIPT AI TRANSPILED INTERPRETER EXECUTION TARGET (AUTO-GENERATED)\n`;
        js += `// ============================================================================\n\n`;
        js += `export function executeModelPipeline() {\n`;
        this.indentLevel++;

        // Pre-seed local execution context maps
        js += this.indent(`const pi = Math.PI;\n`);
        js += this.indent(`const cos = Math.cos;\n`);
        js += this.indent(`const sin = Math.sin;\n`);
        js += this.indent(`const exp = Math.exp;\n`);
        js += this.indent(`const env = {};\n`);
        js += this.indent(`const publishedModel = { current: undefined };\n`);
        js += this.indent(`const asSolid = (value) => {\n`);
        js += this.indent(`    let resolved = typeof value === "function" ? value() : value;\n`);
        js += this.indent(`    while (resolved && resolved.tag === "Part") resolved = resolved.geometry;\n`);
        js += this.indent(`    if (resolved && typeof resolved === "object" && (resolved.tag === "Component" || resolved.tag === "Solid3D")) return resolved;\n`);
        js += this.indent(`    return undefined;\n`);
        js += this.indent(`};\n`);
        js += this.indent(`const anchorOf = (part, name) => {\n`);
        js += this.indent(`    const resolved = typeof part === "function" ? part() : part;\n`);
        js += this.indent(`    const found = resolved && resolved.tag === "Part" && resolved.anchors ? resolved.anchors[name] : undefined;\n`);
        js += this.indent(`    if (!found || typeof found.x !== "number" || typeof found.y !== "number" || typeof found.z !== "number") throw new Error("This part has no anchor '" + name + "'.");\n`);
        js += this.indent(`    return found;\n`);
        js += this.indent(`};\n\n`);

        const directionAxis = program.setup.coordinateSystem === "Y-up"
            ? `{ right: "x", forward: "z", up: "y" }`
            : program.setup.coordinateSystem === "X-up"
                ? `{ right: "y", forward: "z", up: "x" }`
                : `{ right: "x", forward: "y", up: "z" }`;
        js += this.indent(`const directionAxis = ${directionAxis};\n`);
        js += this.indent(`const axisSpec = (fixed, moving, by) => ({ tag: "Axis", fixed, moving, by });\n`);
        js += this.indent(`env.centre = "centre";\n`);
        js += this.indent(`env.center = "centre";\n`);
        js += this.indent(`env.min = "min";\n`);
        js += this.indent(`env.max = "max";\n`);
        js += this.indent(`env.origin = "origin";\n`);
        js += this.indent(`env.anchor = (fixed, moving, by) => axisSpec(fixed, moving, by);\n`);
        js += this.indent(`env.relate = (right, forward, up) => ({ tag: "ConstraintSet", type: "relate", right, forward, up });\n`);
        js += this.indent(`env.centred = env.relate(axisSpec("centre", "centre", 0), axisSpec("centre", "centre", 0), axisSpec("centre", "centre", 0));\n`);
        js += this.indent(`env.inset = (by) => env.relate(axisSpec("min", "min", by), axisSpec("min", "min", by), axisSpec("min", "min", by));\n`);
        js += this.indent(`env.apart = (right, forward, up) => env.relate(axisSpec("centre", "centre", right), axisSpec("centre", "centre", forward), axisSpec("centre", "centre", up));\n`);
        js += this.indent(`env.on_top = (overlap) => env.relate(axisSpec("centre", "centre", 0), axisSpec("centre", "centre", 0), axisSpec("max", "min", 0 - overlap));\n`);
        js += this.indent(`env.below = (overlap) => env.relate(axisSpec("centre", "centre", 0), axisSpec("centre", "centre", 0), axisSpec("min", "max", overlap));\n`);
        js += this.indent(`env.meet = (fixed, moving) => ({ tag: "Meet", fixed, moving });\n`);
        js += this.indent(`env.align = (planar, translation, rotation) => ({ tag: "ConstraintSet", type: "align", planar, translation, rotation });\n`);
        js += this.indent(`env.planar_centred = (tn, sn, tp, sp, tt, st) => ({ tag: "ConstraintSet", type: "planar_centred", tn, sn, tp, sp, tt, st });\n`);
        js += this.indent(`env.normal = (u, v, surface) => { /* calculus forward differentiation proxy step */ return { tag: "Vector", x: 0, y: 0, z: 1 }; };\n`);
        // The fixed solid keeps the join frame. The mate seats only the moving solid.
        js += this.indent(`const placeAgainst = (fixed, moving, constraint) => {\n`);
        js += this.indent(`    const resolve = (item) => (typeof item === "function" ? item() : item);\n`);
        js += this.indent(`    const geometryOf = (item) => {\n`);
        js += this.indent(`        let resolved = resolve(item);\n`);
        js += this.indent(`        while (resolved && resolved.tag === "Part") resolved = resolved.geometry;\n`);
        js += this.indent(`        return resolved;\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const fixedSolid = geometryOf(fixed);\n`);
        js += this.indent(`    const movingSolid = geometryOf(moving);\n`);
        js += this.indent(`    if (!fixedSolid || !movingSolid) throw new Error("A join places two solids.");\n`);
        js += this.indent(`    if (!constraint || constraint.tag !== "ConstraintSet") throw new Error("A join places its moving solid with a relative mate.");\n`);
        js += this.indent(`    const axis = (v, what) => {\n`);
        js += this.indent(`        if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.z !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) throw new Error(what + " needs x, y, and z.");\n`);
        js += this.indent(`        return v;\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const unit = (v, what) => {\n`);
        js += this.indent(`        const n = Math.hypot(v.x, v.y, v.z);\n`);
        js += this.indent(`        if (!(n > 1e-8)) throw new Error(what);\n`);
        js += this.indent(`        return { x: v.x / n, y: v.y / n, z: v.z / n };\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const frame = (normal, twist, which) => {\n`);
        js += this.indent(`        const z = unit(axis(normal, which + " normal"), which + " normal has no direction.");\n`);
        js += this.indent(`        const twistDir = unit(axis(twist, which + " twist"), which + " twist has no direction.");\n`);
        js += this.indent(`        const along = twistDir.x * z.x + twistDir.y * z.y + twistDir.z * z.z;\n`);
        js += this.indent(`        const x = unit({ x: twistDir.x - z.x * along, y: twistDir.y - z.y * along, z: twistDir.z - z.z * along }, which + " twist has no in-plane direction.");\n`);
        js += this.indent(`        return { x, y: { x: z.y * x.z - z.z * x.y, y: z.z * x.x - z.x * x.z, z: z.x * x.y - z.y * x.x }, z };\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const anchorValue = (box, name, axisName) => {\n`);
        js += this.indent(`        const word = name === "center" ? "centre" : name;\n`);
        js += this.indent(`        if (word === "origin") return 0;\n`);
        js += this.indent(`        if (word === "centre") return (box.min[axisName] + box.max[axisName]) / 2;\n`);
        js += this.indent(`        if (word === "min") return box.min[axisName];\n`);
        js += this.indent(`        if (word === "max") return box.max[axisName];\n`);
        js += this.indent(`        throw new Error("An anchor is centre, min, max, or origin.");\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const measure = (value) => {\n`);
        js += this.indent(`        const box = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };\n`);
        js += this.indent(`        const add = (p) => { if (!p || typeof p.x !== "number") return; box.min.x = Math.min(box.min.x, p.x); box.min.y = Math.min(box.min.y, p.y); box.min.z = Math.min(box.min.z, p.z); box.max.x = Math.max(box.max.x, p.x); box.max.y = Math.max(box.max.y, p.y); box.max.z = Math.max(box.max.z, p.z); };\n`);
        js += this.indent(`        const visit = (item) => {\n`);
        js += this.indent(`            const resolved = geometryOf(item);\n`);
        js += this.indent(`            if (!resolved || typeof resolved !== "object") return;\n`);
        js += this.indent(`            if (resolved.tag === "Surface2D" && typeof resolved.formula === "function") {\n`);
        js += this.indent(`                const steps = 16;\n`);
        js += this.indent(`                const maxU = typeof resolved.maxU === "function" ? resolved.maxU(0) : resolved.maxU;\n`);
        js += this.indent(`                for (let i = 0; i <= steps; i++) {\n`);
        js += this.indent(`                    const u = (i / steps) * maxU;\n`);
        js += this.indent(`                    const maxV = typeof resolved.maxV === "function" ? resolved.maxV(u) : resolved.maxV;\n`);
        js += this.indent(`                    for (let j = 0; j <= steps; j++) add(resolved.formula(u)((j / steps) * maxV));\n`);
        js += this.indent(`                }\n`);
        js += this.indent(`                return;\n`);
        js += this.indent(`            }\n`);
        js += this.indent(`            if (resolved.tag === "Solid3D") { if (Array.isArray(resolved.faces)) for (const face of resolved.faces) visit(face); return; }\n`);
        js += this.indent(`            if (resolved.tag === "Component") { visit(resolved.left); if (resolved.op !== "subtract") visit(resolved.right); return; }\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`        visit(value);\n`);
        js += this.indent(`        if (!Number.isFinite(box.min.x)) throw new Error("A join measures the solids it places.");\n`);
        js += this.indent(`        return box;\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    let mapPoint;\n`);
        js += this.indent(`    if (constraint.type === "planar_centred") {\n`);
        js += this.indent(`        const source = frame(constraint.sn, constraint.st, "source");\n`);
        js += this.indent(`        const target = frame(constraint.tn, constraint.tt, "target");\n`);
        js += this.indent(`        const sp = axis(constraint.sp, "source position");\n`);
        js += this.indent(`        const tp = axis(constraint.tp, "target position");\n`);
        js += this.indent(`        mapPoint = (p) => {\n`);
        js += this.indent(`            const point = axis(p, "surface point");\n`);
        js += this.indent(`            const dx = point.x - sp.x, dy = point.y - sp.y, dz = point.z - sp.z;\n`);
        js += this.indent(`            const cx = dx * source.x.x + dy * source.x.y + dz * source.x.z;\n`);
        js += this.indent(`            const cy = dx * source.y.x + dy * source.y.y + dz * source.y.z;\n`);
        js += this.indent(`            const cz = dx * source.z.x + dy * source.z.y + dz * source.z.z;\n`);
        js += this.indent(`            return { tag: "Vector", x: tp.x + cx * target.x.x + cy * target.y.x + cz * target.z.x, y: tp.y + cx * target.x.y + cy * target.y.y + cz * target.z.y, z: tp.z + cx * target.x.z + cy * target.y.z + cz * target.z.z };\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`    } else if (constraint.type === "relate") {\n`);
        js += this.indent(`        const fixedBox = measure(fixedSolid);\n`);
        js += this.indent(`        const movingBox = measure(movingSolid);\n`);
        js += this.indent(`        const delta = { x: 0, y: 0, z: 0 };\n`);
        js += this.indent(`        for (const direction of ["right", "forward", "up"]) {\n`);
        js += this.indent(`            const spec = constraint[direction];\n`);
        js += this.indent(`            if (!spec || spec.tag !== "Axis") throw new Error("relate needs an anchor for " + direction + ".");\n`);
        js += this.indent(`            const axisName = directionAxis[direction];\n`);
        js += this.indent(`            if (typeof spec.by !== "number" || !Number.isFinite(spec.by)) throw new Error("An anchor needs a distance.");\n`);
        js += this.indent(`            delta[axisName] = anchorValue(fixedBox, spec.fixed, axisName) + spec.by - anchorValue(movingBox, spec.moving, axisName);\n`);
        js += this.indent(`        }\n`);
        js += this.indent(`        mapPoint = (p) => { const point = axis(p, "surface point"); return { tag: "Vector", x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z }; };\n`);
        js += this.indent(`    } else if (constraint.type === "align") {\n`);
        js += this.indent(`        const pair = (value, stage) => {\n`);
        js += this.indent(`            if (!value || value.tag !== "Meet") throw new Error("align needs a " + stage + ".");\n`);
        js += this.indent(`            return { fixed: axis(value.fixed, "fixed " + stage), moving: axis(value.moving, "moving " + stage) };\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`        const planar = pair(constraint.planar, "planar");\n`);
        js += this.indent(`        const translation = pair(constraint.translation, "translation");\n`);
        js += this.indent(`        const rotation = pair(constraint.rotation, "rotation");\n`);
        js += this.indent(`        const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;\n`);
        js += this.indent(`        const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });\n`);
        js += this.indent(`        const apply = (m, v) => ({ x: m[0] * v.x + m[1] * v.y + m[2] * v.z, y: m[3] * v.x + m[4] * v.y + m[5] * v.z, z: m[6] * v.x + m[7] * v.y + m[8] * v.z });\n`);
        js += this.indent(`        const mul = (a, b) => [a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8], a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8], a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8]];\n`);
        js += this.indent(`        const about = (axisDir, radians) => {\n`);
        js += this.indent(`            const u = unit(axisDir, "rotation axis has no direction.");\n`);
        js += this.indent(`            const c = Math.cos(radians), s = Math.sin(radians), t = 1 - c;\n`);
        js += this.indent(`            return [t*u.x*u.x + c, t*u.x*u.y - s*u.z, t*u.x*u.z + s*u.y, t*u.x*u.y + s*u.z, t*u.y*u.y + c, t*u.y*u.z - s*u.x, t*u.x*u.z - s*u.y, t*u.y*u.z + s*u.x, t*u.z*u.z + c];\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`        const movingNormal = unit(planar.moving, "moving normal has no direction.");\n`);
        js += this.indent(`        const fixedNormal = unit(planar.fixed, "fixed normal has no direction.");\n`);
        js += this.indent(`        const hinge = cross(movingNormal, fixedNormal);\n`);
        js += this.indent(`        const planarTurn = Math.hypot(hinge.x, hinge.y, hinge.z) < 1e-8\n`);
        js += this.indent(`            ? (dot(movingNormal, fixedNormal) > 0 ? [1,0,0, 0,1,0, 0,0,1] : about(cross(movingNormal, Math.abs(movingNormal.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }), Math.PI))\n`);
        js += this.indent(`            : about(hinge, Math.atan2(Math.hypot(hinge.x, hinge.y, hinge.z), dot(movingNormal, fixedNormal)));\n`);
        js += this.indent(`        const project = (v, n) => { const along = dot(v, n); return { x: v.x - n.x * along, y: v.y - n.y * along, z: v.z - n.z * along }; };\n`);
        js += this.indent(`        const movingAcross = unit(project(apply(planarTurn, rotation.moving), fixedNormal), "moving rotation has no in-plane direction.");\n`);
        js += this.indent(`        const fixedAcross = unit(project(rotation.fixed, fixedNormal), "fixed rotation has no in-plane direction.");\n`);
        js += this.indent(`        const spin = about(fixedNormal, Math.atan2(dot(fixedNormal, cross(movingAcross, fixedAcross)), dot(movingAcross, fixedAcross)));\n`);
        js += this.indent(`        const orient = mul(spin, planarTurn);\n`);
        js += this.indent(`        const sp = translation.moving;\n`);
        js += this.indent(`        const tp = translation.fixed;\n`);
        js += this.indent(`        mapPoint = (p) => {\n`);
        js += this.indent(`            const placed = axis(p, "surface point");\n`);
        js += this.indent(`            const turned = apply(orient, { x: placed.x - sp.x, y: placed.y - sp.y, z: placed.z - sp.z });\n`);
        js += this.indent(`            return { tag: "Vector", x: tp.x + turned.x, y: tp.y + turned.y, z: tp.z + turned.z };\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`    } else throw new Error("A join places its moving solid with a relative mate.");\n`);
        js += this.indent(`    const walk = (item) => {\n`);
        js += this.indent(`        const resolved = geometryOf(item);\n`);
        js += this.indent(`        if (!resolved || typeof resolved !== "object") throw new Error("A join moves a solid or an assembly.");\n`);
        js += this.indent(`        if (resolved.tag === "Surface2D") return { tag: "Surface2D", maxU: resolved.maxU, maxV: resolved.maxV, formula: (u) => (v) => mapPoint(resolved.formula(u)(v)) };\n`);
        js += this.indent(`        if (resolved.tag === "Solid3D") return { tag: "Solid3D", faces: Array.isArray(resolved.faces) ? resolved.faces.map((face) => walk(face)) : [] };\n`);
        js += this.indent(`        if (resolved.tag === "Component") return { tag: "Component", op: resolved.op, left: walk(resolved.left), right: walk(resolved.right) };\n`);
        js += this.indent(`        throw new Error("A join moves a solid or an assembly.");\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    return walk(movingSolid);\n`);
        js += this.indent(`};\n\n`);

        for (const statement of program.body) {
            js += this.generateStatement(statement);
        }

        // Return the final evaluated trailing structural manifold target node expression
        if (program.body.length > 0) {
            js += `\n` + this.indent(`return publishedModel.current !== undefined ? publishedModel.current : env._last_evaluated;\n`);
        }

        this.indentLevel--;
        js += `}\n`;
        return js;
    }

    private generateStatement(node: ASTNode): string {
        switch (node.type) {
            case "ParamDeclaration":
            case "VariableDeclaration": {
                const exprJs = this.generateExpression(node.value as ExpressionNode);
                let out = this.indent(`${this.scopeName}.${node.name.name} = ${exprJs};\n`);
                out += this.indent(`${this.scopeName}._last_evaluated = ${this.scopeName}.${node.name.name};\n`);
                return out;
            }
            case "ExportStatement":
                // The published slot stays outside every component and join scope.
                return this.indent(`publishedModel.current = ${this.generateExpression(node.value)};\n`);
            case "ComponentDeclaration": {
                const parent = this.scopeName;
                const localName = `localEnv${this.scopeDepth++}`;
                let out = this.indent(`${parent}.${node.name.name} = function(`);
                out += node.parameters.map(p => p.name.name).join(", ") + `) {\n`;
                this.indentLevel++;
                out += this.indent(`const ${localName} = Object.create(${parent});\n`);
                this.scopeName = localName;
                try {
                    for (const bodyStmt of node.body) {
                        out += this.generateStatement(bodyStmt);
                    }
                    const geoExpr = this.generateExpression(node.rootGeometry);
                    out += this.indent(`const partGeometry = ${geoExpr};\n`);
                    out += this.indent(`const partAnchors = {};\n`);
                    for (const property of node.expose.properties) {
                        const anchorValue = this.generateExpression(property.value);
                        out += this.indent(`partAnchors[${JSON.stringify(property.name.name)}] = ${anchorValue};\n`);
                    }
                    out += this.indent(`return { tag: "Part", geometry: partGeometry, anchors: partAnchors };\n`);
                } finally {
                    this.indentLevel--;
                    this.scopeName = parent;
                }
                out += this.indent(`};\n`);
                return out;
            }
            default: {
                return this.indent(`${this.scopeName}._last_evaluated = ${this.generateExpression(node as ExpressionNode)};\n`);
            }
        }
    }

    private generateExpression(node: ExpressionNode): string {
        switch (node.type) {
            case "Identifier": {
                if (node.name === "PI") return "Math.PI";
                if (this.locals.includes(node.name)) return node.name;
                return `${this.scopeName}.${node.name}`;
            }
            case "FloatLiteral": {
                return node.value.toString();
            }
            case "StringLiteral": {
                return `"${node.value.replace(/"/g, '\\"')}"`;
            }
            case "VectorLiteral": {
                const x = this.generateExpression(node.x);
                const y = this.generateExpression(node.y);
                const z = this.generateExpression(node.z);
                return `{ tag: "Vector", x: ${x}, y: ${y}, z: ${z} }`;
            }
            case "ArrayLiteral": {
                const elements = node.elements.map(e => this.generateExpression(e)).join(", ");
                return `[${elements}]`;
            }
            case "BinaryExpression": {
                if (node.operator === "::") {
                    const left = this.generateExpression(node.left);
                    const right = this.generateExpression(node.right);
                    return `[${left}, ...${right}]`;
                }

                const left = this.generateExpression(node.left);
                const right = this.generateExpression(node.right);

                if (node.operator === "+") {
                    return `((l, r) => {
                        const leftSolid = asSolid(l);
                        const rightSolid = asSolid(r);
                        if (leftSolid || rightSolid) {
                            if (!leftSolid || !rightSolid) throw new Error("Addition needs two solids.");
                            return { tag: "Component", op: "add", left: leftSolid, right: rightSolid };
                        }
                        if (l && r && l.tag === "Vector" && r.tag === "Vector") return { tag: "Vector", x: l.x + r.x, y: l.y + r.y, z: l.z + r.z };
                        return l + r;
                    })(${left}, ${right})`;
                }

                if (node.operator === "-") {
                    return `((l, r) => {
                        const leftSolid = asSolid(l);
                        const rightSolid = asSolid(r);
                        if (leftSolid || rightSolid) {
                            if (!leftSolid || !rightSolid) throw new Error("Subtraction needs two solids.");
                            return { tag: "Component", op: "subtract", left: leftSolid, right: rightSolid };
                        }
                        if (l && r && l.tag === "Vector" && r.tag === "Vector") return { tag: "Vector", x: l.x - r.x, y: l.y - r.y, z: l.z - r.z };
                        return l - r;
                    })(${left}, ${right})`;
                }

                // Handle basic continuous overloads
                return `(${left} ${node.operator} ${right})`;
            }
            case "UnaryExpression": {
                return `(-${this.generateExpression(node.argument)})`;
            }
            case "LambdaExpression": {
                this.locals.push(node.parameter.name);
                const body = this.generateExpression(node.body);
                this.locals.pop();
                return `(${node.parameter.name}) => (${body})`;
            }
            case "JoinDomain": {
                const parent = this.scopeName;
                const fixed = this.generateExpression(node.fixed);
                const moving = this.generateExpression(node.moving);
                const domainName = `domainEnv${this.scopeDepth++}`;
                this.scopeName = domainName;
                try {
                    // The mate is generated in the domain so fixed.cavity sees the two parts.
                    const using = this.generateExpression(node.using);
                    let inner = "";
                    for (const statement of node.body) inner += this.generateStatement(statement);
                    const result = this.generateExpression(node.result);
                    return `(() => {\nconst ${domainName} = Object.create(${parent});\n${domainName}.fixed = ${fixed};\n${domainName}.moving = ${moving};\n${domainName}.using = ${using};\n${domainName}.moving = placeAgainst(${domainName}.fixed, ${domainName}.moving, ${domainName}.using);\n${domainName}.fixed = asSolid(${domainName}.fixed);\n${inner}return ${result};\n})()`;
                } finally {
                    this.scopeName = parent;
                }
            }
            case "MemberExpression": {
                const object = this.generateExpression(node.object);
                return `anchorOf(${object}, ${JSON.stringify(node.property)})`;
            }
            case "CallExpression": {
                const calleeName = node.callee.name;
                if (["cos", "sin", "exp", "tan", "sqrt"].includes(calleeName)) {
                    const argsArray = node.arguments;
                    const firstArg = Array.isArray(argsArray) ? argsArray[0] : argsArray;
                    const argVal = firstArg ? this.generateExpression(firstArg.value) : "0";
                    return `Math.${calleeName}(${argVal})`;
                }

                const callee = this.generateExpression(node.callee);
                const args = node.arguments.map(arg => this.generateExpression(arg.value)).join(", ");
                return `${callee}(${args})`;
            }

            case "PipeExpression": {
                const left = this.generateExpression(node.leftHandSide);
                const rhsCall = node.rightHandSide;
                const callee = this.generateExpression(rhsCall.callee);
                const explicitArgs = rhsCall.arguments.map(arg => this.generateExpression(arg.value));
                // Pipeline operator appends the piped object straight as the trailing parameter input
                const combinedArgs = [...explicitArgs, left].join(", ");
                return `${callee}(${combinedArgs})`;
            }
            case "Curve1DNode": {
                const maxT = this.generateExpression(node.maxT);
                const formula = this.generateExpression(node.formula);
                return `{ tag: "Curve1D", maxT: ${maxT}, formula: ${formula} }`;
            }
            case "Surface2DNode": {
                const maxU = this.generateExpression(node.maxU);
                const maxV = this.generateExpression(node.maxV);
                const formula = this.generateExpression(node.formula);
                return `{ tag: "Surface2D", maxU: ${maxU}, maxV: ${maxV}, formula: ${formula} }`;
            }
            case "Solid3DNode": {
                const faces = this.generateExpression(node.faces);
                return `{ tag: "Solid3D", faces: ${faces} }`;
            }
            case "ArrayMatchStatement": {
                const target = this.generateExpression(node.targetArray);
                const onEmpty = this.generateExpression(node.onEmpty);
                const onSplit = this.generateExpression(node.onSplit);
                
                // Transpiles pattern match logic into a lightning fast JavaScript ternary closure evaluation
                return `((() => { const _t = ${target}; if (_t.length === 0) return ${onEmpty}; const ${node.headIdentifier.name} = _t[0]; const ${node.tailIdentifier.name} = _t.slice(1); return ${onSplit}; })())`;
            }
        }
    }

    private indent(text: string): string {
        return "    ".repeat(this.indentLevel) + text;
    }
}
