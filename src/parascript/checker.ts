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
    Program,
    SetupBlock,
    ExpressionNode,
    Identifier,
    SmoothOperator,
    NamedArgument,
    ArrayMatchStatement,
    LambdaExpression,
    ParameterEntry,
    TypeNode
} from "./ast.js";
import { unify } from "./unify.js";
import type { Type } from "./types.js";
import { createFreshVariable, prune, tBool, tConstraintSet, tCurve1D, tFloat, tMeet, tSeatedSolid3D, tSolid3D, tString, tSurface2D, tVector, TypeEnvironment, TypeSchema } from "./types.js";



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
                throw new Error(`Type Inference Error: '${name}' is already a parameter in this group.`);
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
                throw new Error(`Type Inference Error: '${name}' is already a parameter in this group.`);
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
                unify(recursive, inferredType);
                if (node.signature) this.unifyWithSignature(node.name.name, inferredType, node.signature);
                const schema = this.generalize(prune(inferredType), env);
                env.extend(node.name.name, schema);
                break;
            }
            case "ExportStatement": {
                const exported = this.inferExpression(node.value, env);
                // Open, with no anchors required, so a component that publishes anchors is accepted.
                unify(exported, { tag: "Component", anchors: [], open: true });
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
                return this.instantiate(env.lookup(node.name));
            }
            case "ParameterReference": {
                const schema = this.parameters.get(node.name);
                if (!schema) {
                    throw new Error(`Type Inference Error: '$${node.name}' is not a parameter.`);
                }
                return this.instantiate(schema);
            }
            case "MemberExpression": {
                const objectType = prune(this.inferExpression(node.object, env));
                if (objectType.tag === "Record") {
                    const field = objectType.fields.find((item) => item.name === node.property);
                    if (!field) {
                        throw new Error(`Type Inference Error: ${node.property} is not a field of this parameter.`);
                    }
                    return field.fieldType;
                }
                if (objectType.tag === "Variable") {
                    unify(objectType, { tag: "Component", anchors: [node.property], open: true });
                    return tVector;
                }
                if (objectType.tag === "Component") {
                    if (objectType.anchors.includes(node.property)) return tVector;
                    if (objectType.open) {
                        objectType.anchors.push(node.property);
                        return tVector;
                    }
                }
                throw new Error(`Type Inference Error: ${node.property} is not an anchor on this component.`);
            }
            case "FloatLiteral": return tFloat;
            case "BooleanLiteral": return tBool;
            case "StringLiteral": return tString;

            case "VectorLiteral": {
                unify(this.inferExpression(node.x, env), tFloat);
                unify(this.inferExpression(node.y, env), tFloat);
                unify(this.inferExpression(node.z, env), tFloat);
                return tVector;
            }

            case "ArrayLiteral": {
                const freshElementVar = createFreshVariable();
                for (const element of node.elements) {
                    const eType = this.inferExpression(element, env);
                    unify(freshElementVar, eType);
                }
                return { tag: "Array", elementType: freshElementVar };
            }

            case "BinaryExpression": {
                const left = this.inferExpression(node.left, env);
                const right = this.inferExpression(node.right, env);

                if (node.operator === "::") {
                    // Cons tracking operator validates layout arrays matching right-hand parameters
                    unify(right, { tag: "Array", elementType: left });
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
                        throw new Error(`Type Inference Error: Operator '${node.operator}' is only defined for SeatedSolid3D.`);
                    }
                }

                unify(left, right);
                return left;
            }

            case "UnaryExpression": {
                const argType = this.inferExpression(node.argument, env);
                unify(argType, tFloat);
                return tFloat;
            }

            case "ComposeExpression": {
                const leftType = prune(this.inferExpression(node.left, env));
                const rightType = prune(this.inferExpression(node.right, env));
                if (leftType.tag !== "Function" || rightType.tag !== "Function") {
                    throw new Error("Type Inference Error: >> composes two functions.");
                }
                unify(leftType.returnType, rightType.parameter);
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
                    throw new Error("Type Inference Error: |> pipes a value into a function.");
                }
                unify(leftType, rightType.parameter);
                return rightType.returnType;
            }

            case "CallExpression": {
                const calleeType = this.inferExpression(node.callee, env);
                if (prune(calleeType).tag === "Component") {
                    throw new Error("Type Inference Error: a component is a value.");
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
                    unify(currentType, {
                        tag: "Function",
                        paramName: arg.name.name,
                        parameter: argType,
                        returnType: freshReturnVar
                    });
                    currentType = freshReturnVar;
                }
                return currentType;
            }

            case "JoinDomain": {
                const frameType = prune(this.inferExpression(node.frame, env));
                const placedType = prune(this.inferExpression(node.placed, env));
                this.expectJoinMember(frameType, "frame");
                this.expectJoinMember(placedType, "placed");
                // using is frame => placed => ConstraintSet, so the mate can read these parts' anchors.
                const usingExpected = this.usingOver(frameType, placedType);
                const usingType = node.using.type === "LambdaExpression"
                    ? this.inferLambdaAgainst(node.using, usingExpected, env)
                    : this.inferExpression(node.using, env);
                if (prune(usingType).tag !== "Function") {
                    throw new Error("Type Inference Error: using is frame => placed => ConstraintSet.");
                }
                unify(usingType, usingExpected);

                // combine is SeatedSolid3D => SeatedSolid3D => SeatedSolid3D. The join itself is a Solid3D.
                const resultVar = createFreshVariable();
                const combineExpected: Type = {
                    tag: "Function", paramName: "frame", parameter: tSeatedSolid3D, returnType: {
                        tag: "Function", paramName: "placed", parameter: tSeatedSolid3D, returnType: resultVar
                    }
                };
                const combineType = node.combine.type === "LambdaExpression"
                    ? this.inferLambdaAgainst(node.combine, combineExpected, env)
                    : this.inferExpression(node.combine, env);
                if (prune(combineType).tag !== "Function") {
                    throw new Error("Type Inference Error: combine is frame => placed => SeatedSolid3D.");
                }
                unify(combineType, combineExpected);
                if (prune(resultVar).tag !== "SeatedSolid3D") {
                    throw new Error("Type Inference Error: combine is frame => placed => SeatedSolid3D.");
                }
                return tSolid3D;
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

            case "Curve1DNode": {
                unify(this.inferExpression(node.maxT, env), tFloat);
                const formulaType = this.inferExpression(node.formula, env);
                // Enforces absolute smoothness contract constraints on trajectories
                unify(formulaType, {
                    tag: "Function",
                    paramName: "t",
                    parameter: tFloat,
                    returnType: tVector
                });
                return tCurve1D;
            }

            case "Surface2DNode": {
                unify(this.inferExpression(node.maxU, env), tFloat);
                const vBound: Type = {
                    tag: "Function",
                    paramName: "u",
                    parameter: tFloat,
                    returnType: tFloat
                };
                unify(this.inferExpression(node.minV, env), vBound);
                unify(this.inferExpression(node.maxV, env), vBound);

                const formulaType = this.inferExpression(node.formula, env);
                unify(formulaType, {
                    tag: "Function",
                    paramName: "u",
                    parameter: tFloat,
                    returnType: {
                        tag: "Function",
                        paramName: "v",
                        parameter: tFloat,
                        returnType: tVector
                    }
                });
                return tSurface2D;
            }

            case "Solid3DNode": {
                const facesType = this.inferExpression(node.faces, env);
                unify(facesType, { tag: "Array", elementType: tSurface2D });
                return tSolid3D;
            }

            case "ComponentExpression": {
                const solidType = prune(this.inferExpression(node.solid, env));
                if (solidType.tag !== "Solid3D") {
                    throw new Error("Type Inference Error: Component solid must be a solid.");
                }
                const anchors: string[] = [];
                const seenAnchors = new Set<string>();
                for (const property of node.expose.properties) {
                    if (seenAnchors.has(property.name.name)) {
                        throw new Error(`Type Inference Error: Anchor '${property.name.name}' is already exposed.`);
                    }
                    seenAnchors.add(property.name.name);
                    anchors.push(property.name.name);
                    const valueType = prune(this.inferExpression(property.value, env));
                    if (valueType.tag === "Function") {
                        unify(valueType.returnType, tVector);
                    } else {
                        unify(valueType, tVector);
                    }
                }
                return { tag: "Component", anchors };
            }

            case "ArrayMatchStatement": {
                const targetType = this.inferExpression(node.targetArray, env);
                const elementTypeFresh = createFreshVariable();
                unify(targetType, { tag: "Array", elementType: elementTypeFresh });

                const emptyBranchType = this.inferExpression(node.onEmpty, env);

                const localSplitEnv = new TypeEnvironment(env);
                localSplitEnv.extend(node.headIdentifier.name, new TypeSchema([], elementTypeFresh));
                localSplitEnv.extend(node.tailIdentifier.name, new TypeSchema([], targetType));

                const splitBranchType = this.inferExpression(node.onSplit, localSplitEnv);
                unify(emptyBranchType, splitBranchType); // Branch options returns must match exactly

                return emptyBranchType;
            }
        }
    }
    // ============================================================================
    // SCHEMATIC LET-POLYMORPHISM METHOD IMPLEMENTATIONS
    // ============================================================================
    /** A written signature. A repeated name is one type variable. An omitted parameter name stays the value's name. */
    private unifyWithSignature(name: string, inferred: Type, signature: TypeNode): void {
        const variables = new Map<string, Type>();
        try {
            unify(inferred, this.typeFromSignature(signature, variables));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Type Inference Error: '${name}' does not match its signature. ${detail}`);
        }
    }

    private typeFromSignature(node: TypeNode, variables: Map<string, Type>): Type {
        if (node.type === "NamedParameter") {
            throw new Error("Type Inference Error: a signature parameter needs '=>'.");
        }
        if (node.type === "ListType") {
            return { tag: "Array", elementType: this.typeFromSignature(node.element, variables) };
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

    // A lambda passed where a function is expected is checked with that parameter type,
    // so using: frame => placed => meet(frame: frame.up, ...) can see each part's anchors.
    private inferLambdaAgainst(lambda: LambdaExpression, expected: Type, env: TypeEnvironment): Type {
        if (expected.tag !== "Function") return this.inferExpression(lambda, env);
        if (lambda.parameter.name !== expected.paramName) {
            throw new Error(`Type Inference Error: Keyword Argument Mismatch. Expected named parameter identifier '${expected.paramName}', but found key name '${lambda.parameter.name}'.`);
        }
        const localEnv = new TypeEnvironment(env);
        localEnv.extend(lambda.parameter.name, new TypeSchema([], expected.parameter));
        const expectedReturn = prune(expected.returnType);
        const bodyType = lambda.body.type === "LambdaExpression" && expectedReturn.tag === "Function"
            ? this.inferLambdaAgainst(lambda.body, expectedReturn, localEnv)
            : this.inferExpression(lambda.body, localEnv);
        unify(bodyType, expected.returnType);
        return {
            tag: "Function",
            paramName: lambda.parameter.name,
            parameter: expected.parameter,
            returnType: bodyType
        };
    }

    private expectJoinMember(value: Type, role: string): void {
        const pruned = prune(value);
        if (pruned.tag === "Component") return;
        // A function may join a component it receives. Anchors it later reads are checked at the call.
        if (pruned.tag === "Variable") {
            unify(pruned, { tag: "Component", anchors: [], open: true });
            return;
        }
        throw new Error(`Type Inference Error: join ${role} must be a component.`);
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

        return env;
    }
}