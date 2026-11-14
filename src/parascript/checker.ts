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
    LambdaExpression
} from "./ast.js";
import { unify } from "./unify.js";
import type { Type } from "./types.js";
import { createFreshVariable, prune, tComponent, tConstraintSet, tCurve1D, tFloat, tMeet, tSeatedSolid3D, tSolid3D, tString, tSurface2D, tVector, TypeEnvironment, TypeSchema } from "./types.js";



export class TypeInferenceEngine {
    private sawExport = false;

    /**
     * Entry hook validating a full parsed Program AST structure.
     * Generates a fully populated TypeEnvironment containing inferred node polytypes.
     */
    public inferProgram(program: Program): TypeEnvironment {
        this.sawExport = false;
        const globalEnv = this.createStandardLibraryEnvironment();

        for (const statement of program.body) {
            this.inferStatement(statement, globalEnv);
        }

        if (!this.sawExport) {
            throw new Error("Type Inference Error: A script must export a component.");
        }

        return globalEnv;
    }

    /**
     * Infers structural scope boundaries across statements and declarations.
     */
    private inferStatement(node: ASTNode, env: TypeEnvironment): void {
        switch (node.type) {
            case "ParamDeclaration":
            case "VariableDeclaration": {
                const inferredType = this.inferExpression(node.value as ExpressionNode, env);
                const schema = this.generalize(inferredType, env);
                env.extend(node.name.name, schema);
                break;
            }
            case "ExportStatement": {
                const exported = this.inferExpression(node.value, env);
                unify(exported, tComponent);
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
            case "MemberExpression": {
                const objectType = prune(this.inferExpression(node.object, env));
                const anchors = objectType.tag === "Component" ? objectType.anchors : [];
                if (!anchors.includes(node.property)) {
                    throw new Error(`Type Inference Error: ${node.property} is not an anchor on this component.`);
                }
                return tVector;
            }
            case "FloatLiteral": return tFloat;
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

            case "PipeExpression": {
                const leftType = this.inferExpression(node.leftHandSide, env);
                const functionType = this.inferExpression(node.rightHandSide, env);
                const freshReturnVar = createFreshVariable();

                // Intercepts left-to-right pipe chains and matches target functions.
                // The right-hand side function's *final* parameter name configuration is verified 
                // dynamically by analyzing the targeted CallExpression AST properties downstream.
                const rhsCall = node.rightHandSide;
                const inferredParamName = rhsCall.arguments.length > 0
                    ? rhsCall.callee.name + "_pipe_in"
                    : "target";

                unify(functionType, {
                    tag: "Function",
                    paramName: inferredParamName,
                    parameter: leftType,
                    returnType: freshReturnVar
                });
                return freshReturnVar;
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
        return this.cloneWithTypeSubstitutions(schema.type, mapping);
    }
    private cloneWithTypeSubstitutions(t: Type, map: Map<number, Type>): Type {
        const pruned = prune(t);
        if (pruned.tag === "Variable") {
            return map.get(pruned.id) || pruned;
        }
        if (pruned.tag === "Function") {
            return {
                tag: "Function",
                paramName: pruned.paramName,
                parameter: this.cloneWithTypeSubstitutions(pruned.parameter, map),
                returnType: this.cloneWithTypeSubstitutions(pruned.returnType, map)
            };
        }
        if (pruned.tag === "Array") {
            return {
                tag: "Array",
                elementType: this.cloneWithTypeSubstitutions(pruned.elementType, map)
            };
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
        const tag = prune(value).tag;
        if (tag === "Component") return;
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

        return env;
    }
}