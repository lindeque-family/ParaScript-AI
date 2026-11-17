// ============================================================================
// PARASCRIPT AI WEB TRANSPILED CODE GENERATOR KERNEL (v14.0.0)
// ============================================================================

import type { ASTNode, Program, ExpressionNode, Identifier, ParameterEntry } from "./ast.js";

export class WebCodeGenerator {
    private indentLevel = 0;
    private scopeDepth = 0;
    private scopeName = "env";
    private parameterValueId = 0;
    private readonly locals: string[] = [];
    /** Parameter fields in the group being generated. The emitted name is a unique const. */
    private readonly aliases: Array<{ name: string; emitted: string }> = [];

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
        js += this.indent(`};\n`);
        js += this.indent(`const member = (part, name) => {\n`);
        js += this.indent(`    const resolved = typeof part === "function" ? part() : part;\n`);
        js += this.indent(`    if (resolved && resolved.tag === "Record") {\n`);
        js += this.indent(`        if (!Object.prototype.hasOwnProperty.call(resolved.fields, name)) throw new Error("This parameter has no field '" + name + "'.");\n`);
        js += this.indent(`        return resolved.fields[name];\n`);
        js += this.indent(`    }\n`);
        js += this.indent(`    return anchorOf(part, name);\n`);
        js += this.indent(`};\n\n`);

        js += this.indent(`env.map = (f) => (list) => {\n`);
        js += this.indent(`    if (typeof f !== "function") throw new Error("map needs a function.");\n`);
        js += this.indent(`    if (!Array.isArray(list)) throw new Error("map needs a list.");\n`);
        js += this.indent(`    return list.map((item) => f(item));\n`);
        js += this.indent(`};\n`);
        js += this.indent(`env.filter = (predicate) => (list) => {\n`);
        js += this.indent(`    if (typeof predicate !== "function") throw new Error("filter needs a function.");\n`);
        js += this.indent(`    if (!Array.isArray(list)) throw new Error("filter needs a list.");\n`);
        js += this.indent(`    return list.filter((item) => {\n`);
        js += this.indent(`        const keep = predicate(item);\n`);
        js += this.indent(`        if (keep !== true && keep !== false) throw new Error("filter predicate needs true or false.");\n`);
        js += this.indent(`        return keep;\n`);
        js += this.indent(`    });\n`);
        js += this.indent(`};\n`);
        js += this.indent(`env.meet = (frame) => (placed) => ({ tag: "Meet", frame, placed });\n`);
        js += this.indent(`env.align = (planar) => (translation) => (rotation) => ({ tag: "ConstraintSet", type: "align", planar, translation, rotation });\n`);
        js += this.indent(`const applyMate = (fn, framePart, placedPart) => {\n`);
        js += this.indent(`    const resolve = (item) => (typeof item === "function" ? item() : item);\n`);
        js += this.indent(`    if (typeof fn !== "function") throw new Error("using needs frame => placed => ConstraintSet.");\n`);
        js += this.indent(`    const step = fn(resolve(framePart));\n`);
        js += this.indent(`    if (typeof step !== "function") throw new Error("using needs frame => placed => ConstraintSet.");\n`);
        js += this.indent(`    const mate = step(resolve(placedPart));\n`);
        js += this.indent(`    if (!mate || mate.tag !== "ConstraintSet") throw new Error("A join places the placed part with a relative mate.");\n`);
        js += this.indent(`    return mate;\n`);
        js += this.indent(`};\n`);
        js += this.indent(`env.normal = (u) => (v) => (surface) => { /* calculus forward differentiation proxy step */ return { tag: "Vector", x: 0, y: 0, z: 1 }; };\n`);
        // The frame part keeps the join's frame. The mate poses only the placed part.
        js += this.indent(`const placeAgainst = (framePart, placedPart, constraint) => {\n`);
        js += this.indent(`    const resolve = (item) => (typeof item === "function" ? item() : item);\n`);
        js += this.indent(`    const geometryOf = (item) => {\n`);
        js += this.indent(`        let resolved = resolve(item);\n`);
        js += this.indent(`        while (resolved && resolved.tag === "Part") resolved = resolved.geometry;\n`);
        js += this.indent(`        return resolved;\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const frameSolid = geometryOf(framePart);\n`);
        js += this.indent(`    const placedSolid = geometryOf(placedPart);\n`);
        js += this.indent(`    if (!frameSolid || !placedSolid) throw new Error("A join places two solids.");\n`);
        js += this.indent(`    if (!constraint || constraint.tag !== "ConstraintSet") throw new Error("A join places the placed part with a relative mate.");\n`);
        js += this.indent(`    const axis = (v, what) => {\n`);
        js += this.indent(`        if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.z !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) throw new Error(what + " needs x, y, and z.");\n`);
        js += this.indent(`        return v;\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    const unit = (v, what) => {\n`);
        js += this.indent(`        const n = Math.hypot(v.x, v.y, v.z);\n`);
        js += this.indent(`        if (!(n > 1e-8)) throw new Error(what);\n`);
        js += this.indent(`        return { x: v.x / n, y: v.y / n, z: v.z / n };\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    let mapPoint;\n`);
        js += this.indent(`    if (constraint.type === "align") {\n`);
        js += this.indent(`        const pair = (value, stage) => {\n`);
        js += this.indent(`            if (!value || value.tag !== "Meet") throw new Error("align needs a " + stage + ".");\n`);
        js += this.indent(`            return { frame: axis(value.frame, "frame " + stage), placed: axis(value.placed, "placed " + stage) };\n`);
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
        js += this.indent(`        const placedNormal = unit(planar.placed, "placed normal has no direction.");\n`);
        js += this.indent(`        const frameNormal = unit(planar.frame, "frame normal has no direction.");\n`);
        js += this.indent(`        const hinge = cross(placedNormal, frameNormal);\n`);
        js += this.indent(`        const planarTurn = Math.hypot(hinge.x, hinge.y, hinge.z) < 1e-8\n`);
        js += this.indent(`            ? (dot(placedNormal, frameNormal) > 0 ? [1,0,0, 0,1,0, 0,0,1] : about(cross(placedNormal, Math.abs(placedNormal.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }), Math.PI))\n`);
        js += this.indent(`            : about(hinge, Math.atan2(Math.hypot(hinge.x, hinge.y, hinge.z), dot(placedNormal, frameNormal)));\n`);
        js += this.indent(`        const project = (v, n) => { const along = dot(v, n); return { x: v.x - n.x * along, y: v.y - n.y * along, z: v.z - n.z * along }; };\n`);
        js += this.indent(`        const placedAcross = unit(project(apply(planarTurn, rotation.placed), frameNormal), "placed rotation has no in-plane direction.");\n`);
        js += this.indent(`        const frameAcross = unit(project(rotation.frame, frameNormal), "frame rotation has no in-plane direction.");\n`);
        js += this.indent(`        const spin = about(frameNormal, Math.atan2(dot(frameNormal, cross(placedAcross, frameAcross)), dot(placedAcross, frameAcross)));\n`);
        js += this.indent(`        const orient = mul(spin, planarTurn);\n`);
        js += this.indent(`        const sp = translation.placed;\n`);
        js += this.indent(`        const tp = translation.frame;\n`);
        js += this.indent(`        mapPoint = (p) => {\n`);
        js += this.indent(`            const point = axis(p, "surface point");\n`);
        js += this.indent(`            const turned = apply(orient, { x: point.x - sp.x, y: point.y - sp.y, z: point.z - sp.z });\n`);
        js += this.indent(`            return { tag: "Vector", x: tp.x + turned.x, y: tp.y + turned.y, z: tp.z + turned.z };\n`);
        js += this.indent(`        };\n`);
        js += this.indent(`    } else throw new Error("A join places the placed part with a relative mate.");\n`);
        js += this.indent(`    const walk = (item) => {\n`);
        js += this.indent(`        const resolved = geometryOf(item);\n`);
        js += this.indent(`        if (!resolved || typeof resolved !== "object") throw new Error("A join places a solid or an assembly.");\n`);
        js += this.indent(`        if (resolved.tag === "Surface2D") return { tag: "Surface2D", maxU: resolved.maxU, minV: resolved.minV, maxV: resolved.maxV, formula: (u) => (v) => mapPoint(resolved.formula(u)(v)) };\n`);
        js += this.indent(`        if (resolved.tag === "Solid3D") return { tag: "Solid3D", faces: Array.isArray(resolved.faces) ? resolved.faces.map((face) => walk(face)) : [] };\n`);
        js += this.indent(`        if (resolved.tag === "Component") return { tag: "Component", op: resolved.op, left: walk(resolved.left), right: walk(resolved.right) };\n`);
        js += this.indent(`        throw new Error("A join places a solid or an assembly.");\n`);
        js += this.indent(`    };\n`);
        js += this.indent(`    return walk(placedSolid);\n`);
        js += this.indent(`};\n\n`);

        if (program.parameters) js += this.generateParameters(program.parameters.entries);

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
                // The published slot stays outside every join scope.
                return this.indent(`publishedModel.current = ${this.generateExpression(node.value)};\n`);
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
                for (let index = this.aliases.length - 1; index >= 0; index--) {
                    const alias = this.aliases[index];
                    if (alias && alias.name === node.name) return alias.emitted;
                }
                return `${this.scopeName}.${node.name}`;
            }
            case "ParameterReference": {
                return `env.${node.name}`;
            }
            case "FloatLiteral": {
                return node.value.toString();
            }
            case "BooleanLiteral": {
                return node.value ? "true" : "false";
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
                const frame = this.generateExpression(node.frame);
                const placed = this.generateExpression(node.placed);
                const domainName = `domainEnv${this.scopeDepth++}`;
                this.scopeName = domainName;
                try {
                    // using and combine close over this domain. applyMate runs before the placed part moves.
                    const using = this.generateExpression(node.using);
                    const combine = this.generateExpression(node.combine);
                    return `(() => {\nconst ${domainName} = Object.create(${parent});\n${domainName}.frame = ${frame};\n${domainName}.placed = ${placed};\n${domainName}.using = applyMate(${using}, ${domainName}.frame, ${domainName}.placed);\n${domainName}.placed = placeAgainst(${domainName}.frame, ${domainName}.placed, ${domainName}.using);\n${domainName}.frame = asSolid(${domainName}.frame);\nreturn (${combine})(${domainName}.frame)(${domainName}.placed);\n})()`;
                } finally {
                    this.scopeName = parent;
                }
            }
            case "MemberExpression": {
                const object = this.generateExpression(node.object);
                return `member(${object}, ${JSON.stringify(node.property)})`;
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
                const args = node.arguments.map(arg => this.generateExpression(arg.value));
                return this.applyCall(callee, args);
            }

            case "ComposeExpression": {
                const left = this.generateExpression(node.left);
                const right = this.generateExpression(node.right);
                return `((__composed) => (${right})((${left})(__composed)))`;
            }
            case "PipeExpression": {
                const left = this.generateExpression(node.leftHandSide);
                const right = this.generateExpression(node.rightHandSide);
                return `(${right})(${left})`;
            }
            case "Curve1DNode": {
                const maxT = this.generateExpression(node.maxT);
                const formula = this.generateExpression(node.formula);
                return `{ tag: "Curve1D", maxT: ${maxT}, formula: ${formula} }`;
            }
            case "Surface2DNode": {
                const maxU = this.generateExpression(node.maxU);
                const minV = this.generateExpression(node.minV);
                const maxV = this.generateExpression(node.maxV);
                const formula = this.generateExpression(node.formula);
                return `{ tag: "Surface2D", maxU: ${maxU}, minV: ${minV}, maxV: ${maxV}, formula: ${formula} }`;
            }
            case "Solid3DNode": {
                const faces = this.generateExpression(node.faces);
                return `{ tag: "Solid3D", faces: ${faces} }`;
            }
            case "ComponentExpression": {
                const solid = this.generateExpression(node.solid);
                const anchors = node.expose.properties.map((property) =>
                    `partAnchors[${JSON.stringify(property.name.name)}] = ${this.generateExpression(property.value)};`
                ).join(" ");
                return `(() => { const partGeometry = ${solid}; const partAnchors = {}; ${anchors} return { tag: "Part", geometry: partGeometry, anchors: partAnchors }; })()`;
            }
            case "ArrayMatchStatement": {
                const target = this.generateExpression(node.targetArray);
                const onEmpty = this.generateExpression(node.onEmpty);
                this.locals.push(node.headIdentifier.name, node.tailIdentifier.name);
                let onSplit: string;
                try {
                    onSplit = this.generateExpression(node.onSplit);
                } finally {
                    this.locals.pop();
                    this.locals.pop();
                }
                return `((() => { const _t = ${target}; if (_t.length === 0) return ${onEmpty}; const ${node.headIdentifier.name} = _t[0]; const ${node.tailIdentifier.name} = _t.slice(1); return ${onSplit}; })())`;
            }
        }
    }

    // User functions are one argument at a time: width => depth => height => body.
    private applyCall(callee: string, args: string[]): string {
        if (args.length === 0) return `${callee}()`;
        return args.reduce((fn, arg) => `${fn}(${arg})`, callee);
    }

    /** Top-level names are assigned on `env`. A group is a record, and its short names stay inside it. */
    private generateParameters(entries: Array<ParameterEntry>): string {
        let js = "";
        for (const entry of entries) {
            if (entry.type === "ParameterField") {
                js += this.indent(`${this.scopeName}.${entry.name.name} = ${this.generateExpression(entry.value)};\n`);
            } else {
                js += this.indent(`${this.scopeName}.${entry.name.name} = ${this.generateGroup(entry.entries)};\n`);
            }
        }
        return js;
    }

    private generateGroup(entries: Array<ParameterEntry>): string {
        let js = `(() => {\n`;
        this.indentLevel++;
        const fields: string[] = [];
        for (const entry of entries) {
            const emitted = `__parameterValue${this.parameterValueId++}`;
            const value = entry.type === "ParameterField"
                ? this.generateExpression(entry.value)
                : this.generateGroup(entry.entries);
            js += this.indent(`const ${emitted} = ${value};\n`);
            this.aliases.push({ name: entry.name.name, emitted });
            fields.push(`${JSON.stringify(entry.name.name)}: ${emitted}`);
        }
        js += this.indent(`return { tag: "Record", fields: { ${fields.join(", ")} } };\n`);
        for (let index = 0; index < fields.length; index++) this.aliases.pop();
        this.indentLevel--;
        js += this.indent(`})()`);
        return js;
    }

    private indent(text: string): string {
        return "    ".repeat(this.indentLevel) + text;
    }
}
