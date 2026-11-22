// ============================================================================
// PARASCRIPT AI LAZY STREAMING PARSER CORE (v12.8.0)
// ============================================================================

export type TokenType =

    | "SETUP" | "PARAM" | "DEF" | "FN" | "COMPONENT" | "EXPOSE" | "RETURN" | "TRUE" | "FALSE"
    | "MATCH" | "IDENTIFIER" | "FLOAT" | "STRING"
    | "EQUALS" | "PIPE" | "ARROW" | "COLON" | "CONS" | "COMMA"
    | "PLUS" | "MINUS" | "STAR" | "SLASH" | "CARET"
    | "LPAREN" | "RPAREN" | "LBRACE" | "RBRACE" | "LBRACKET" | "RBRACKET"
    | "EOF";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    char: number;
}

// 🚀 FIX: Use 'import type' and remove circular self-import loop
import type {
    ASTNode,
    BaseNode,
    Program,
    SetupBlock,
    ExpressionNode,
    Identifier,
    SmoothOperator,
    NamedArgument,
    ArrayMatchStatement,
    LambdaExpression,
    LetPattern,
    MemberExpression,
    MethodCallExpression,
    ParameterEntry,
    TypeNode
} from "./ast.js";
import { unify } from "./unify.js";
import type { Type } from "./types.js";
import { createFreshVariable, prune, tBool, tConstraintSet, tCoordinateSystem, tCurve1D, tFloat, tMeet, tSeatedSolid3D, tSolid3D, tString, tSurface2D, tVector, TypeEnvironment, TypeSchema } from "./types.js";



export class TypeInferenceEngine {
    private sawExport = false;
    /** Top-level `parameters` groups. `$plate` reads this map, not the script environment. */
    private readonly parameters = new Map<string, TypeSchema>();

    /**
     * Entry hook validating a full parsed Program AST structure.
     * Generates a fully populated TypeEnvironment containing inferred node polytypes.
     */
    public inferProgram(program: Program): TypeEnvironment {
        this.sawExport = false;
        this.parameters.clear();
        const globalEnv = this.createStandardLibraryEnvironment();
        if (program.parameters) this.inferParameters(program.parameters.entries, globalEnv);

        for (const statement of program.body) {
            this.inferStatement(statement, globalEnv);
        }

        if (!this.sawExport) {
            throw new Error("Type Inference Error: A script must export a component.");
        }

        return globalEnv;
    }

    /**
     * Stores each top-level parameter for `$name`. Nested names stay inside their group.
     * Inside a group, an earlier field is a short name. It does not escape the group.
     */
    private inferParameters(entries: Array<ParameterEntry>, scriptEnv: TypeEnvironment): void {
        const seen = new Set<string>();
        for (const entry of entries) {
            const name = entry.name.name;
            if (seen.has(name)) {
                throw this.typeError(entry.name, `'${name}' is already a parameter in this group.`);
            }
            seen.add(name);
            const fieldType = entry.type === "ParameterGroup"
                ? this.parameterRecord(entry.entries, new TypeEnvironment(scriptEnv))
                : prune(this.inferExpression(entry.value, new TypeEnvironment(scriptEnv)));
            this.parameters.set(name, new TypeSchema([], fieldType));
        }
    }

    private parameterRecord(entries: Array<ParameterEntry>, parent: TypeEnvironment): { tag: "Record"; fields: Array<{ name: string; fieldType: Type }> } {
        const local = new TypeEnvironment(parent);
        const seen = new Set<string>();
        const fields: Array<{ name: string; fieldType: Type }> = [];
        for (const entry of entries) {
            const name = entry.name.name;
            if (seen.has(name)) {
                throw this.typeError(entry.name, `'${name}' is already a parameter in this group.`);
            }
            seen.add(name);
            const fieldType: Type = entry.type === "ParameterGroup"
                ? this.parameterRecord(entry.entries, local)
                : prune(this.inferExpression(entry.value, local));
            local.extend(name, new TypeSchema([], fieldType));
            fields.push({ name, fieldType });
        }
        return { tag: "Record", fields };
    }

    /**
     * Infers structural scope boundaries across statements and declarations.
     */
    private inferStatement(node: ASTNode, env: TypeEnvironment): void {
        switch (node.type) {
            case "ParamDeclaration":
            case "VariableDeclaration": {
                // The name is visible while its body is checked, so a def may call itself.
                const recursive = createFreshVariable();
                env.extend(node.name.name, new TypeSchema([], recursive));
                const inferredType = this.inferExpression(node.value as ExpressionNode, env);
                this.unifyAt(recursive, inferredType, node.name);
                if (node.signature) this.unifyWithSignature(node.name.name, inferredType, node.signature, node.name);
                this.rememberComponent(inferredType, node.name.name);
                const schema = this.generalize(prune(inferredType), env);
                env.extend(node.name.name, schema);
                break;
            }
            case "ExportStatement": {
                const exported = this.inferExpression(node.value, env);
                // Open, with no anchors required, so a component that publishes anchors is accepted.
                this.unifyAt(exported, { tag: "Component", anchors: [], open: true }, node.value);
                this.sawExport = true;
                break;
            }
            default:
                this.inferExpression(node as ExpressionNode, env);
        }
    }

    /**
     * Processes expressions recursively, enforcing single-input lambdas, 
     * keyword argument checking, and overloaded operator matching.
     */
    private inferExpression(node: ExpressionNode, env: TypeEnvironment): Type {
        switch (node.type) {
            case "Identifier": {
                try {
                    return this.instantiate(env.lookup(node.name));
                } catch (error) {
                    if (!(error instanceof Error) || !error.message.includes("Unbound identifier")) throw error;
                    throw this.typeError(node, `Unbound identifier '${node.name}'.`);
                }
            }
            case "ParameterReference": {
                const schema = this.parameters.get(node.name);
                if (!schema) {
                    throw this.typeError(node, `'$${node.name}' is not a parameter.`);
                }
                return this.instantiate(schema);
            }
            case "MemberExpression": {
                const objectType = prune(this.inferExpression(node.object, env));
                if (objectType.tag === "Record") {
                    const field = objectType.fields.find((item) => item.name === node.property);
                    if (!field) {
                        const owner = this.sourcePath(node.object) ?? "this parameter";
                        const names = objectType.fields.map((item) => item.name);
                        const has = names.length === 0 ? `${owner} has no fields` : `${owner} has ${this.englishList(names)}`;
                        throw this.typeError(node, `'${node.property}' is not a field of ${owner}. ${has}.`);
                    }
                    return field.fieldType;
                }
                if (node.property === "coords") {
                    throw this.typeError(node, "A component does not expose its coordinate system.");
                }
                if (objectType.tag === "Variable") {
                    this.unifyAt(objectType, { tag: "Component", anchors: [node.property], open: true }, node);
                    return tVector;
                }
                if (objectType.tag === "Component") {
                    if (objectType.anchors.includes(node.property)) return tVector;
                    if (objectType.open) {
                        objectType.anchors.push(node.property);
                        return tVector;
                    }
                }
                this.missingMember(node, objectType);
            }
            case "FloatLiteral": return tFloat;
            case "BooleanLiteral": return tBool;
            case "StringLiteral": return tString;

            case "VectorLiteral": {
                const coordsType = prune(this.inferExpression(node.coords, env));
                if (coordsType.tag === "Variable") {
                    this.unifyAt(coordsType, tCoordinateSystem, node.coords);
                } else if (coordsType.tag !== "CoordinateSystem") {
                    throw this.typeError(node.coords, "Vector coords is a coordinate system.");
                }
                this.unifyAt(this.inferExpression(node.x, env), tFloat, node.x);
                this.unifyAt(this.inferExpression(node.y, env), tFloat, node.y);
                this.unifyAt(this.inferExpression(node.z, env), tFloat, node.z);
                return tVector;
            }

            case "ArrayLiteral": {
                const freshElementVar = createFreshVariable();
                for (const element of node.elements) {
                    const eType = this.inferExpression(element, env);
                    this.unifyAt(freshElementVar, eType, element);
                }
                return { tag: "Array", elementType: freshElementVar };
            }

            case "TupleLiteral": {
                return { tag: "Tuple", elements: node.elements.map((element) => this.inferExpression(element, env)) };
            }

            case "BinaryExpression": {
                const left = this.inferExpression(node.left, env);
                const right = this.inferExpression(node.right, env);

                if (node.operator === "::") {
                    // Cons tracking operator validates layout arrays matching right-hand parameters
                    this.unifyAt(right, { tag: "Array", elementType: left }, node);
                    return right;
                }

                if (node.operator === "+" || node.operator === "-") {
                    const leftType = prune(left);
                    const rightType = prune(right);
                    if (leftType.tag === "SeatedSolid3D" && rightType.tag === "SeatedSolid3D") {
                        return tSeatedSolid3D;
                    }
                    if (
                        leftType.tag === "SeatedSolid3D" || rightType.tag === "SeatedSolid3D"
                        || leftType.tag === "Component" || rightType.tag === "Component"
                        || leftType.tag === "Solid3D" || rightType.tag === "Solid3D"
                    ) {
                        throw this.typeError(node, `Operator '${node.operator}' is only defined for SeatedSolid3D.`);
                    }
                    if (leftType.tag === "Vector" || rightType.tag === "Vector") {
                        const method = node.operator === "+" ? "add" : "subtract";
                        throw this.typeError(node, `Operator '${node.operator}' does not combine vectors. Use ${method}(vector:).`);
                    }
                    this.unifyAt(left, tFloat, node.left);
                    this.unifyAt(right, tFloat, node.right);
                    return tFloat;
                }

                this.unifyAt(left, right, node);
                return left;
            }

            case "UnaryExpression": {
                const argType = this.inferExpression(node.argument, env);
                this.unifyAt(argType, tFloat, node);
                return tFloat;
            }

            case "ComposeExpression": {
                const leftType = prune(this.inferExpression(node.left, env));
                const rightType = prune(this.inferExpression(node.right, env));
                if (leftType.tag !== "Function" || rightType.tag !== "Function") {
                    throw this.typeError(node, ">> composes two functions.");
                }
                this.unifyAt(leftType.returnType, rightType.parameter, node);
                return {
                    tag: "Function",
                    paramName: leftType.paramName,
                    parameter: leftType.parameter,
                    returnType: rightType.returnType
                };
            }

            case "PipeExpression": {
                const leftType = this.inferExpression(node.leftHandSide, env);
                const rightType = prune(this.inferExpression(node.rightHandSide, env));
                if (rightType.tag !== "Function") {
                    throw this.typeError(node, "|> pipes a value into a function.");
                }
                this.unifyAt(leftType, rightType.parameter, node);
                return rightType.returnType;
            }

            case "MethodCallExpression": {
                return this.inferVectorMethod(node, env);
            }

            case "CallExpression": {
                const calleeType = this.inferExpression(node.callee, env);
                if (prune(calleeType).tag === "Component") {
                    throw this.typeError(node, "a component is a value.");
                }
                let currentType = calleeType;

                // Process curried evaluations arguments step by step over named slots
                for (const arg of node.arguments) {
                    const expected = prune(currentType);
                    const expectedArg = expected.tag === "Function" ? prune(expected.parameter) : undefined;
                    const argType = arg.value.type === "LambdaExpression" && expectedArg?.tag === "Function"
                        ? this.inferLambdaAgainst(arg.value, expectedArg, env)
                        : this.inferExpression(arg.value, env);
                    const freshReturnVar = createFreshVariable();

                    // Unification forces verification of BOTH type AND keyword name labels!
                    this.unifyAt(currentType, {
                        tag: "Function",
                        paramName: arg.name.name,
                        parameter: argType,
                        returnType: freshReturnVar
                    }, arg.value);
                    currentType = freshReturnVar;
                }
                return currentType;
            }

            case "JoinDomain": {
                const frameType = prune(this.inferExpression(node.frame, env));
                const placedType = prune(this.inferExpression(node.placed, env));
                this.expectJoinMember(frameType, "frame", node.frame);
                this.expectJoinMember(placedType, "placed", node.placed);
                // using is frame => placed => ConstraintSet, so the mate can read these parts' anchors.
                const usingExpected = this.usingOver(frameType, placedType);
                const usingType = node.using.type === "LambdaExpression"
                    ? this.inferLambdaAgainst(node.using, usingExpected, env)
                    : this.inferExpression(node.using, env);
                if (prune(usingType).tag !== "Function") {
                    throw this.typeError(node.using, "using is frame => placed => ConstraintSet.");
                }
                this.unifyAt(usingType, usingExpected, node.using);

                // combine is SeatedSolid3D => SeatedSolid3D => SeatedSolid3D.
                // Without coords, join is that coordinate system => Solid3D. With coords, it is a Solid3D.
                const resultVar = createFreshVariable();
                const combineExpected: Type = {
                    tag: "Function", paramName: "frame", parameter: tSeatedSolid3D, returnType: {
                        tag: "Function", paramName: "placed", parameter: tSeatedSolid3D, returnType: resultVar
                    }
                };
                const combineType = node.combine.type === "LambdaExpression"
                    ? this.inferLambdaAgainst(node.combine, combineExpected, env)
                    : this.inferExpression(node.combine, env);
                const combineSeen = prune(combineType);
                // A parameter is still unknown here. Record the seated operation so the
                // caller's lambda is checked with frame and placed as seated solids.
                if (combineSeen.tag === "Variable") {
                    this.unifyAt(combineType, {
                        tag: "Function", paramName: "frame", parameter: tSeatedSolid3D, returnType: {
                            tag: "Function", paramName: "placed", parameter: tSeatedSolid3D, returnType: tSeatedSolid3D
                        }
                    }, node.combine);
                } else if (combineSeen.tag !== "Function") {
                    throw this.typeError(node.combine, "combine is frame => placed => SeatedSolid3D.");
                } else {
                    this.unifyAt(combineType, combineExpected, node.combine);
                    if (prune(resultVar).tag !== "SeatedSolid3D") {
                        throw this.typeError(node.combine, "combine is frame => placed => SeatedSolid3D.");
                    }
                }
                if (node.coords) {
                    const coordsType = prune(this.inferExpression(node.coords, env));
                    if (coordsType.tag === "Variable") {
                        this.unifyAt(coordsType, tCoordinateSystem, node.coords);
                    } else if (coordsType.tag !== "CoordinateSystem") {
                        throw this.typeError(node.coords, "join coords is a coordinate system.");
                    }
                    return tSolid3D;
                }
                // The coordinate system is the last parameter. Component passes it and join ignores it.
                return {
                    tag: "Function",
                    paramName: "coords",
                    parameter: tCoordinateSystem,
                    returnType: tSolid3D
                };
            }

            case "LambdaExpression": {
                const localEnv = new TypeEnvironment(env);
                const paramFreshVar = createFreshVariable();
                localEnv.extend(node.parameter.name, new TypeSchema([], paramFreshVar));

                const bodyType = this.inferExpression(node.body, localEnv);
                return {
                    tag: "Function",
                    paramName: node.parameter.name,
                    parameter: paramFreshVar,
                    returnType: bodyType
                };
            }

            case "LetExpression": {
                // The value is checked before the name exists, so a let cannot call itself.
                const valueType = prune(this.inferExpression(node.value, env));
                this.rememberComponent(valueType, node.name.name);
                const localEnv = new TypeEnvironment(env);
                localEnv.extend(node.name.name, new TypeSchema([], valueType));
                return this.inferExpression(node.body, localEnv);
            }

            case "TupleLetExpression": {
                const valueType = prune(this.inferExpression(node.value, env));
                const localEnv = new TypeEnvironment(env);
                this.bindTuplePattern(node.pattern, valueType, localEnv);
                return this.inferExpression(node.body, localEnv);
            }

            case "Curve1DNode": {
                this.unifyAt(this.inferExpression(node.maxT, env), tFloat, node.maxT);
                const formulaType = this.inferExpression(node.formula, env);
                // Enforces absolute smoothness contract constraints on trajectories
                this.unifyAt(formulaType, {
                    tag: "Function",
                    paramName: "t",
                    parameter: tFloat,
                    returnType: tVector
                }, node.formula);
                return tCurve1D;
            }

            case "Surface2DNode": {
                this.unifyAt(this.inferExpression(node.maxU, env), tFloat, node.maxU);
                const vBound: Type = {
                    tag: "Function",
                    paramName: "u",
                    parameter: tFloat,
                    returnType: tFloat
                };
                this.unifyAt(this.inferExpression(node.minV, env), vBound, node.minV);
                this.unifyAt(this.inferExpression(node.maxV, env), vBound, node.maxV);

                const formulaType = this.inferExpression(node.formula, env);
                this.unifyAt(formulaType, {
                    tag: "Function",
                    paramName: "u",
                    parameter: tFloat,
                    returnType: {
                        tag: "Function",
                        paramName: "v",
                        parameter: tFloat,
                        returnType: tVector
                    }
                }, node.formula);
                return tSurface2D;
            }

            case "Solid3DNode": {
                const facesType = this.inferExpression(node.faces, env);
                this.unifyAt(facesType, { tag: "Array", elementType: tSurface2D }, node.faces);
                return tSolid3D;
            }

            case "ComponentExpression": {
                if (node.expose.type !== "LambdaExpression") {
                    throw this.typeError(node.expose, "Component expose is coords => { anchors }.");
                }
                this.inferSolid(node.solid, env);
                const exposeType = prune(this.inferCoordsBody(node.expose, env));
                if (exposeType.tag !== "Expose") {
                    throw this.typeError(node.expose, "Component expose is coords => { anchors }.");
                }
                return { tag: "Component", anchors: exposeType.anchors };
            }

            case "ExposeBlock": {
                const anchors: string[] = [];
                const seenAnchors = new Set<string>();
                for (const property of node.properties) {
                    if (property.name.name === "coords") {
                        throw this.typeError(property.name, "Anchor 'coords' is the component's coordinate system.");
                    }
                    if (seenAnchors.has(property.name.name)) {
                        throw this.typeError(property.name, `Anchor '${property.name.name}' is already exposed.`);
                    }
                    seenAnchors.add(property.name.name);
                    anchors.push(property.name.name);
                    const valueType = prune(this.inferExpression(property.value, env));
                    if (valueType.tag === "Function") {
                        this.unifyAt(valueType.returnType, tVector, property.value);
                    } else {
                        this.unifyAt(valueType, tVector, property.value);
                    }
                }
                return { tag: "Expose", anchors };
            }

            case "ArrayMatchStatement": {
                const targetType = this.inferExpression(node.targetArray, env);
                const elementTypeFresh = createFreshVariable();
                this.unifyAt(targetType, { tag: "Array", elementType: elementTypeFresh }, node.targetArray);

                const emptyBranchType = this.inferExpression(node.onEmpty, env);

                const localSplitEnv = new TypeEnvironment(env);
                localSplitEnv.extend(node.headIdentifier.name, new TypeSchema([], elementTypeFresh));
                localSplitEnv.extend(node.tailIdentifier.name, new TypeSchema([], targetType));

                const splitBranchType = this.inferExpression(node.onSplit, localSplitEnv);
                this.unifyAt(emptyBranchType, splitBranchType, node.onSplit);

                return emptyBranchType;
            }
        }
    }
    // ============================================================================
    // SCHEMATIC LET-POLYMORPHISM METHOD IMPLEMENTATIONS
    // ============================================================================
    /** A written signature. A repeated name is one type variable. An omitted parameter name stays the value's name. */
    private unifyWithSignature(name: string, inferred: Type, signature: TypeNode, at: BaseNode): void {
        const variables = new Map<string, Type>();
        try {
            unify(inferred, this.typeFromSignature(signature, variables));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw this.typeError(at, `'${name}' does not match its signature. ${detail}`);
        }
    }

    private typeFromSignature(node: TypeNode, variables: Map<string, Type>): Type {
        if (node.type === "NamedParameter") {
            throw new Error("Type Inference Error: a signature parameter needs '=>'.");
        }
        if (node.type === "ListType") {
            return { tag: "Array", elementType: this.typeFromSignature(node.element, variables) };
        }
        if (node.type === "TupleType") {
            return { tag: "Tuple", elements: node.elements.map((element) => this.typeFromSignature(element, variables)) };
        }
        if (node.type === "FunctionType") {
            return {
                tag: "Function",
                paramName: node.paramName ?? "",
                parameter: this.typeFromSignature(node.parameter, variables),
                returnType: this.typeFromSignature(node.returnType, variables)
            };
        }
        switch (node.name) {
            case "number": return tFloat;
            case "vector": return tVector;
            case "coordinate_system": return tCoordinateSystem;
            case "boolean": return tBool;
            case "string": return tString;
            case "solid": return tSolid3D;
            case "surface": return tSurface2D;
            case "component": return { tag: "Component", anchors: [], open: true };
            default: {
                const existing = variables.get(node.name);
                if (existing) return existing;
                const fresh = createFreshVariable();
                variables.set(node.name, fresh);
                return fresh;
            }
        }
    }

    private generalize(t: Type, env: TypeEnvironment): TypeSchema {
        const freeInEnv = this.getFreeVariablesInEnv(env);
        const freeInType = this.getFreeVariables(t);
        const boundIds = [...freeInType].filter(id => !freeInEnv.has(id));
        return new TypeSchema(boundIds, t);
    }
    private instantiate(schema: TypeSchema): Type {
        const mapping: Map<number, Type> = new Map();
        for (const id of schema.boundVariables) {
            mapping.set(id, createFreshVariable());
        }
        // A parameter binding is the variable itself. Keep that object so each anchor read
        // updates one set. A use of a finished function copies the set instead.
        const copyOpen = schema.type.tag !== "Variable";
        return this.cloneWithTypeSubstitutions(schema.type, mapping, copyOpen);
    }
    private cloneWithTypeSubstitutions(t: Type, map: Map<number, Type>, copyOpen: boolean): Type {
        if (t.tag === "Variable") {
            const replacement = map.get(t.id);
            if (replacement) return this.cloneWithTypeSubstitutions(replacement, map, copyOpen);
            const resolved = prune(t);
            if (resolved.tag === "Variable") {
                const rebound = map.get(resolved.id);
                if (rebound) return this.cloneWithTypeSubstitutions(rebound, map, copyOpen);
                return resolved;
            }
            if (!copyOpen) return resolved;
            return this.cloneWithTypeSubstitutions(resolved, map, copyOpen);
        }
        const pruned = prune(t);
        if (pruned.tag === "Function") {
            return {
                tag: "Function",
                paramName: pruned.paramName,
                parameter: this.cloneWithTypeSubstitutions(pruned.parameter, map, copyOpen),
                returnType: this.cloneWithTypeSubstitutions(pruned.returnType, map, copyOpen)
            };
        }
        if (pruned.tag === "Array") {
            return {
                tag: "Array",
                elementType: this.cloneWithTypeSubstitutions(pruned.elementType, map, copyOpen)
            };
        }
        if (pruned.tag === "Tuple") {
            return {
                tag: "Tuple",
                elements: pruned.elements.map((element) => this.cloneWithTypeSubstitutions(element, map, copyOpen))
            };
        }
        if (pruned.tag === "Record") {
            return {
                tag: "Record",
                fields: pruned.fields.map((field) => ({
                    name: field.name,
                    fieldType: this.cloneWithTypeSubstitutions(field.fieldType, map, copyOpen)
                }))
            };
        }
        if (pruned.tag === "Component" && pruned.open && copyOpen) {
            return { tag: "Component", anchors: [...pruned.anchors], open: true };
        }
        return pruned;
    }
    private getFreeVariables(t: Type, set: Set<number> = new Set()): Set<number> {
        const pruned = prune(t);
        if (pruned.tag === "Variable") {
            set.add(pruned.id);
        } else if (pruned.tag === "Function") {
            this.getFreeVariables(pruned.parameter, set);
            this.getFreeVariables(pruned.returnType, set);
        } else if (pruned.tag === "Array") {
            this.getFreeVariables(pruned.elementType, set);
        } else if (pruned.tag === "Tuple") {
            for (const element of pruned.elements) this.getFreeVariables(element, set);
        } else if (pruned.tag === "Record") {
            for (const field of pruned.fields) this.getFreeVariables(field.fieldType, set);
        }
        return set;
    }
    private getFreeVariablesInEnv(env: TypeEnvironment): Set<number> {
        const set: Set<number> = new Set();
        // Standard environment collection scraper logic tracking variables goes here
        return set;
    }
    private usingOver(frameType: Type, placedType: Type): Type {
        return {
            tag: "Function", paramName: "frame", parameter: frameType, returnType: {
                tag: "Function", paramName: "placed", parameter: placedType, returnType: tConstraintSet
            }
        };
    }

    /**
     * `solid` is `coords =>` a solid, or `join(...)`, which is already a function of the coordinate system.
     * `coords => join(...)` is rejected: that coordinate system is not a place to build vectors.
     */
    private inferSolid(solid: ExpressionNode, env: TypeEnvironment): void {
        if (solid.type === "LambdaExpression") {
            const solidType = prune(this.inferCoordsBody(solid, env));
            if (solidType.tag === "Function" && prune(solidType.parameter).tag === "CoordinateSystem") {
                throw this.typeError(solid, "join takes the coordinate system, so solid is join(...).");
            }
            if (solidType.tag !== "Solid3D" && solidType.tag !== "Component") {
                throw this.typeError(solid, "Component solid must be a solid.");
            }
            return;
        }
        const solidType = prune(this.inferExpression(solid, env));
        if (solidType.tag !== "Function") {
            throw this.typeError(solid, "Component solid is coords => solid, or join(...).");
        }
        if (solidType.paramName !== "coords") {
            throw this.typeError(solid, `Keyword Argument Mismatch. Expected named parameter identifier 'coords', but found key name '${solidType.paramName}'.`);
        }
        this.unifyAt(solidType.parameter, tCoordinateSystem, solid);
        const returned = prune(solidType.returnType);
        if (returned.tag !== "Solid3D" && returned.tag !== "Component") {
            throw this.typeError(solid, "Component solid must be a solid.");
        }
    }

    /** `solid` and `expose` both receive the coordinate system Component supplies. */
    private inferCoordsBody(lambda: LambdaExpression, env: TypeEnvironment): Type {
        if (lambda.parameter.name !== "coords") {
            throw this.typeError(lambda, `Keyword Argument Mismatch. Expected named parameter identifier 'coords', but found key name '${lambda.parameter.name}'.`);
        }
        const localEnv = new TypeEnvironment(env);
        localEnv.extend("coords", new TypeSchema([], tCoordinateSystem));
        return this.inferExpression(lambda.body, localEnv);
    }

    // A lambda passed where a function is expected is checked with that parameter type,
    // so using: frame => placed => meet(frame: frame.up, ...) can see each part's anchors.
    private inferLambdaAgainst(lambda: LambdaExpression, expected: Type, env: TypeEnvironment): Type {
        if (expected.tag !== "Function") return this.inferExpression(lambda, env);
        if (lambda.parameter.name !== expected.paramName) {
            throw this.typeError(lambda, `Keyword Argument Mismatch. Expected named parameter identifier '${expected.paramName}', but found key name '${lambda.parameter.name}'.`);
        }
        const localEnv = new TypeEnvironment(env);
        localEnv.extend(lambda.parameter.name, new TypeSchema([], expected.parameter));
        const expectedReturn = prune(expected.returnType);
        const bodyType = lambda.body.type === "LambdaExpression" && expectedReturn.tag === "Function"
            ? this.inferLambdaAgainst(lambda.body, expectedReturn, localEnv)
            : this.inferExpression(lambda.body, localEnv);
        this.unifyAt(bodyType, expected.returnType, lambda);
        return {
            tag: "Function",
            paramName: lambda.parameter.name,
            parameter: expected.parameter,
            returnType: bodyType
        };
    }

    private inferVectorMethod(node: MethodCallExpression, env: TypeEnvironment): Type {
        const objectType = prune(this.inferExpression(node.object, env));
        if (objectType.tag === "Variable") {
            this.unifyAt(objectType, tVector, node.object);
        } else if (objectType.tag !== "Vector") {
            throw this.typeError(node.method, `'${node.method.name}' is a method on a vector.`);
        }
        const method = node.method.name;
        const parameters = method === "offset" ? ["x", "y", "z"]
            : method === "add" || method === "subtract" ? ["vector"]
            : undefined;
        if (!parameters) {
            throw this.typeError(node.method, `'${method}' is not a vector method. A vector has offset, add, and subtract.`);
        }
        const listed = parameters.length === 1 ? parameters[0] : `${parameters.slice(0, -1).join(", ")}, and ${parameters[parameters.length - 1]}`;
        if (node.arguments.length !== parameters.length) {
            throw this.typeError(node.method, `${method} takes ${listed}.`);
        }
        for (let index = 0; index < parameters.length; index++) {
            const arg = node.arguments[index];
            const expectedName = parameters[index];
            if (!arg || arg.name.name !== expectedName) {
                const found = arg?.name.name ?? "";
                throw this.typeError(arg?.name ?? node.method, `Keyword Argument Mismatch. Expected named parameter identifier '${expectedName}', but found key name '${found}'.`);
            }
            const expectedType = expectedName === "vector" ? tVector : tFloat;
            this.unifyAt(this.inferExpression(arg.value, env), expectedType, arg.value);
        }
        return tVector;
    }

    private expectJoinMember(value: Type, role: string, at: BaseNode): void {
        const pruned = prune(value);
        if (pruned.tag === "Component") return;
        // A function may join a component it receives. Anchors it later reads are checked at the call.
        if (pruned.tag === "Variable") {
            this.unifyAt(pruned, { tag: "Component", anchors: [], open: true }, at);
            return;
        }
        throw this.typeError(at, `join ${role} must be a component.`);
    }

    /** `let (x, y) = value in` binds each name to one element. A repeated name is an error. */
    private bindTuplePattern(pattern: LetPattern, valueType: Type, env: TypeEnvironment): void {
        const seen = new Set<string>();
        const note = (name: Identifier): void => {
            if (seen.has(name.name)) throw this.typeError(name, `'${name.name}' is already bound in this tuple.`);
            seen.add(name.name);
        };
        this.eachPatternName(pattern, note);
        this.bindPatternElement(pattern, valueType, env);
    }

    private eachPatternName(pattern: LetPattern, note: (name: Identifier) => void): void {
        if (pattern.type === "Name") {
            note(pattern.name);
            return;
        }
        for (const element of pattern.elements) this.eachPatternName(element, note);
    }

    private bindPatternElement(pattern: LetPattern, valueType: Type, env: TypeEnvironment): void {
        if (pattern.type === "Name") {
            const bound = prune(valueType);
            this.rememberComponent(bound, pattern.name.name);
            env.extend(pattern.name.name, new TypeSchema([], bound));
            return;
        }
        const pruned = prune(valueType);
        const expected = pattern.elements.length;
        if (pruned.tag === "Variable") {
            const elements = pattern.elements.map(() => createFreshVariable());
            this.unifyAt(pruned, { tag: "Tuple", elements }, pattern);
            for (let index = 0; index < pattern.elements.length; index++) {
                const element = pattern.elements[index];
                const elementType = elements[index];
                if (element && elementType) this.bindPatternElement(element, elementType, env);
            }
            return;
        }
        if (pruned.tag !== "Tuple") {
            throw this.typeError(pattern, "let takes a tuple apart with (x, y).");
        }
        if (pruned.elements.length !== expected) {
            throw this.typeError(pattern, `This tuple has ${pruned.elements.length} values. The pattern has ${expected}.`);
        }
        for (let index = 0; index < pattern.elements.length; index++) {
            const element = pattern.elements[index];
            const elementType = pruned.elements[index];
            if (element && elementType) this.bindPatternElement(element, elementType, env);
        }
    }

    private typeError(node: { line?: number; column?: number } | undefined, detail: string): Error {
        const where = node?.line !== undefined && node.column !== undefined
            ? ` at line ${node.line}, col ${node.column}.`
            : "";
        return new Error(`Type Inference Error: ${detail}${where}`);
    }

    private unifyAt(left: Type, right: Type, node: { line?: number; column?: number }): void {
        try {
            unify(left, right);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const prefix = "Type Inference Error: ";
            const detail = message.startsWith(prefix) ? message.slice(prefix.length) : message;
            throw this.typeError(node, detail);
        }
    }

    /** Stamp the component a definition returns, so a later anchor error can name it. */
    private rememberComponent(type: Type, name: string): void {
        const pruned = prune(type);
        if (pruned.tag === "Component") {
            if (pruned.name === undefined) pruned.name = name;
            return;
        }
        if (pruned.tag === "Function") this.rememberComponent(pruned.returnType, name);
    }

    private sourcePath(node: ExpressionNode): string | undefined {
        if (node.type === "Identifier") return node.name;
        if (node.type === "ParameterReference") return `$${node.name}`;
        if (node.type === "MemberExpression") {
            const owner = this.sourcePath(node.object);
            return owner === undefined ? node.property : `${owner}.${node.property}`;
        }
        return undefined;
    }

    private englishList(items: string[]): string {
        if (items.length <= 1) return items.join("");
        if (items.length === 2) return `${items[0]} and ${items[1]}`;
        return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
    }

    private missingMember(node: MemberExpression, objectType: Type): never {
        const owner = this.sourcePath(node.object);
        const path = this.sourcePath(node);
        if (objectType.tag === "Component") {
            const who = objectType.name ?? owner ?? "this component";
            const read = path !== undefined && owner !== undefined && objectType.name !== undefined && owner !== objectType.name
                ? `, read from ${path}`
                : "";
            const exposes = objectType.anchors.length === 0
                ? `${who} exposes no anchors`
                : `${who} exposes ${this.englishList(objectType.anchors)}`;
            throw this.typeError(node, `'${node.property}' is not an anchor on ${who}${read}. ${exposes}.`);
        }
        const subject = owner ?? "this value";
        const kind = objectType.tag === "SeatedSolid3D"
            ? `${subject} is a seated solid, so its anchors are not visible`
            : `${subject} is ${this.typeWord(objectType.tag)}, not a component`;
        throw this.typeError(node, `'${node.property}' is not an anchor on ${subject}. ${kind}.`);
    }

    private typeWord(tag: Type["tag"]): string {
        switch (tag) {
            case "Float": return "a number";
            case "Vector": return "a vector";
            case "CoordinateSystem": return "a coordinate system";
            case "Expose": return "an anchor block";
            case "Boolean": return "a boolean";
            case "String": return "a string";
            case "Surface2D": return "a surface";
            case "Solid3D": return "a solid";
            case "Curve1D": return "a curve";
            case "Function": return "a function";
            case "Array": return "a list";
            case "Tuple": return "a tuple";
            case "Record": return "a parameter group";
            case "SeatedSolid3D": return "a seated solid";
            case "Component": return "a component";
            case "Variable": return "an unknown value";
            default: return "another kind of value";
        }
    }
    /**
    * Seeds the global environment scope with clean, keyword-labelled, un-prefixed
    * core mathematical calculus and assembly mating primitives.
    */
    private createStandardLibraryEnvironment(): TypeEnvironment {
        const env = new TypeEnvironment(null);
        // normal(u: Float, v: Float, surface: Surface2D) -> Vector
        env.extend("normal", new TypeSchema([], {
            tag: "Function", paramName: "u", parameter: tFloat, returnType: {
                tag: "Function", paramName: "v", parameter: tFloat, returnType: {
                    tag: "Function", paramName: "surface", parameter: tSurface2D, returnType: tVector
                }
            }
        }));
        // align: planar (normals), then translation (points), then rotation in that plane.
        env.extend("meet", new TypeSchema([], {
            tag: "Function", paramName: "frame", parameter: tVector, returnType: {
                tag: "Function", paramName: "placed", parameter: tVector, returnType: tMeet
            }
        }));
        env.extend("align", new TypeSchema([], {
            tag: "Function", paramName: "planar", parameter: tMeet, returnType: {
                tag: "Function", paramName: "translation", parameter: tMeet, returnType: {
                    tag: "Function", paramName: "rotation", parameter: tMeet, returnType: tConstraintSet
                }
            }
        }));

        // cos(rad: Float) -> Float
        env.extend("cos", new TypeSchema([], {
            tag: "Function", paramName: "rad", parameter: tFloat, returnType: tFloat
        }));

        // sin(rad: Float) -> Float
        env.extend("sin", new TypeSchema([], {
            tag: "Function", paramName: "rad", parameter: tFloat, returnType: tFloat
        }));

        // map(f: item => result, list: items) -> results. The parameter name is item.
        const mapItem = createFreshVariable();
        const mapResult = createFreshVariable();
        env.extend("map", new TypeSchema([mapItem.id, mapResult.id], {
            tag: "Function", paramName: "f", parameter: {
                tag: "Function", paramName: "item", parameter: mapItem, returnType: mapResult
            }, returnType: {
                tag: "Function", paramName: "list", parameter: { tag: "Array", elementType: mapItem }, returnType: {
                    tag: "Array", elementType: mapResult
                }
            }
        }));

        // filter(predicate: item => true or false, list: items) -> kept items.
        const filterItem = createFreshVariable();
        env.extend("filter", new TypeSchema([filterItem.id], {
            tag: "Function", paramName: "predicate", parameter: {
                tag: "Function", paramName: "item", parameter: filterItem, returnType: tBool
            }, returnType: {
                tag: "Function", paramName: "list", parameter: { tag: "Array", elementType: filterItem }, returnType: {
                    tag: "Array", elementType: filterItem
                }
            }
        }));

        // integers(start: 0.0, count: 5.0) -> [0.0, 1.0, 2.0, 3.0, 4.0]
        env.extend("integers", new TypeSchema([], {
            tag: "Function", paramName: "start", parameter: tFloat, returnType: {
                tag: "Function", paramName: "count", parameter: tFloat, returnType: {
                    tag: "Array", elementType: tFloat
                }
            }
        }));

        return env;
    }
}