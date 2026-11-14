// ============================================================================
// PARASCRIPT AI AST NODE DEFINITIONS (v11.2.0)
// ============================================================================

export type NodeType =
    | "Program"
    | "SetupBlock"
    | "ParamDeclaration"
    | "VariableDeclaration"
    | "ComponentDeclaration"
    | "ExportStatement"
    | "ExposeBlock"
    | "ExposeProperty"
    | "Identifier"
    | "FloatLiteral"
    | "StringLiteral"
    | "VectorLiteral"
    | "ArrayLiteral"
    | "ArrayMatchStatement" // Structured array pattern mapping node
    | "BinaryExpression"
    | "UnaryExpression"
    | "TernaryLayoutExpression"
    | "PipeExpression"
    | "CallExpression"
    | "MemberExpression"
    | "LambdaExpression"
    | "NamedArgument"
    | "JoinDomain"
    | "Curve1DNode"
    | "Surface2DNode"
    | "Solid3DNode";

export interface BaseNode {
    readonly type: NodeType;
    readonly startLoc?: number;
    readonly endLoc?: number;
}

export interface Program extends BaseNode {
    readonly type: "Program";
    readonly setup: SetupBlock;
    readonly body: Array<ASTNode>;
}

export interface SetupBlock extends BaseNode {
    readonly type: "SetupBlock";
    readonly units: "mm" | "inch";
    readonly coordinateSystem: "Z-up" | "Y-up" | "X-up";
}

export interface ParamDeclaration extends BaseNode {
    readonly type: "ParamDeclaration";
    readonly name: Identifier;
    readonly value: ASTNode;
}

export interface ExportStatement extends BaseNode {
    readonly type: "ExportStatement";
    readonly value: ExpressionNode;
}

export interface VariableDeclaration extends BaseNode {
    readonly type: "VariableDeclaration";
    readonly name: Identifier;
    readonly value: ASTNode;
}

export interface ComponentDeclaration extends BaseNode {
    readonly type: "ComponentDeclaration";
    readonly name: Identifier;
    readonly parameters: Array<NamedArgumentDeclaration>;
    readonly body: Array<ASTNode>;
    readonly rootGeometry: ExpressionNode; 
    readonly expose: ExposeBlock;
}

export interface NamedArgumentDeclaration extends BaseNode {
    readonly type: "NamedArgument";
    readonly name: Identifier;
    readonly typeAnnotation: "Float" | "Vector" | "Component" | "Surface2D" | "Curve1D" | "Array";
}

export interface ExposeBlock extends BaseNode {
    readonly type: "ExposeBlock";
    readonly properties: Array<ExposeProperty>;
}

export interface ExposeProperty extends BaseNode {
    readonly type: "ExposeProperty";
    readonly name: Identifier;
    readonly value: ExpressionNode;
}

// ============================================================================
// EXPRESSION NODES
// ============================================================================

export type ExpressionNode =
    | Identifier
    | FloatLiteral
    | StringLiteral
    | VectorLiteral
    | ArrayLiteral
    | ArrayMatchStatement
    | BinaryExpression
    | UnaryExpression
    | PipeExpression
    | CallExpression
    | MemberExpression
    | LambdaExpression
    | JoinDomain
    | Curve1DNode
    | Surface2DNode
    | Solid3DNode;

export interface Identifier extends BaseNode {
    readonly type: "Identifier";
    readonly name: string;
}

export interface FloatLiteral extends BaseNode {
    readonly type: "FloatLiteral";
    readonly value: number;
}

export interface StringLiteral extends BaseNode {
    readonly type: "StringLiteral";
    readonly value: string;
}

export interface VectorLiteral extends BaseNode {
    readonly type: "VectorLiteral";
    readonly x: ExpressionNode;
    readonly y: ExpressionNode;
    readonly z: ExpressionNode;
}

export interface ArrayLiteral extends BaseNode {
    readonly type: "ArrayLiteral";
    readonly elements: Array<ExpressionNode>;
}

/**
 * Type-safe array destructuring layout map.
 * matches target array to either empty or structured head-tail splits.
 */
export interface ArrayMatchStatement extends BaseNode {
    readonly type: "ArrayMatchStatement";
    readonly targetArray: ExpressionNode;
    readonly onEmpty: ExpressionNode;
    readonly headIdentifier: Identifier;
    readonly tailIdentifier: Identifier;
    readonly onSplit: ExpressionNode;
}

export type SmoothOperator = "+" | "-" | "*" | "/" | "^" | "::"; // Added '::' Cons operator

export interface BinaryExpression extends BaseNode {
    readonly type: "BinaryExpression";
    readonly operator: SmoothOperator;
    readonly left: ExpressionNode;
    readonly right: ExpressionNode;
}

export interface UnaryExpression extends BaseNode {
    readonly type: "UnaryExpression";
    readonly operator: "-";
    readonly argument: ExpressionNode;
}

export interface PipeExpression extends BaseNode {
    readonly type: "PipeExpression";
    readonly leftHandSide: ExpressionNode;
    readonly rightHandSide: CallExpression;
}

export interface CallExpression extends BaseNode {
    readonly type: "CallExpression";
    readonly callee: Identifier;
    readonly arguments: Array<NamedArgument>;
}

/** `part.cavity` reads an anchor that component published. */
export interface MemberExpression extends BaseNode {
    readonly type: "MemberExpression";
    readonly object: ExpressionNode;
    readonly property: string;
}

export interface NamedArgument extends BaseNode {
    readonly type: "NamedArgument";
    readonly name: Identifier;
    readonly value: ExpressionNode;
}

export interface LambdaExpression extends BaseNode {
    readonly type: "LambdaExpression";
    readonly parameter: Identifier;
    readonly body: ExpressionNode;
}

/** A join opens a domain. `+` and `-` inside the braces apply to that join's two solids. */
export interface JoinDomain extends BaseNode {
    readonly type: "JoinDomain";
    readonly fixed: ExpressionNode;
    readonly moving: ExpressionNode;
    readonly using: ExpressionNode;
    readonly body: Array<ASTNode>;
    readonly result: ExpressionNode;
}

export interface Curve1DNode extends BaseNode {
    readonly type: "Curve1DNode";
    readonly maxT: ExpressionNode;
    readonly formula: LambdaExpression;
}

export interface Surface2DNode extends BaseNode {
    readonly type: "Surface2DNode";
    readonly maxU: ExpressionNode;
    readonly maxV: LambdaExpression;
    readonly formula: LambdaExpression;
}

export interface Solid3DNode extends BaseNode {
    readonly type: "Solid3DNode";
    readonly faces: ExpressionNode;
}

export type ASTNode =
    | ParamDeclaration
    | VariableDeclaration
    | ComponentDeclaration
    | ExportStatement
    | ExpressionNode;
