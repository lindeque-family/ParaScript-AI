// ============================================================================
// PARASCRIPT AI AST NODE DEFINITIONS (v11.2.0)
// ============================================================================

export type NodeType =
    | "Program"
    | "SetupBlock"
    | "ParamDeclaration"
    | "VariableDeclaration"
    | "ExportStatement"
    | "ComponentExpression"
    | "ExposeBlock"
    | "ExposeProperty"
    | "Identifier"
    | "ParameterReference"
    | "FloatLiteral"
    | "BooleanLiteral"
    | "StringLiteral"
    | "VectorLiteral"
    | "ArrayLiteral"
    | "TupleLiteral"
    | "ArrayMatchStatement" // Structured array pattern mapping node
    | "BinaryExpression"
    | "UnaryExpression"
    | "TernaryLayoutExpression"
    | "PipeExpression"
    | "ComposeExpression"
    | "CallExpression"
    | "MethodCallExpression"
    | "MemberExpression"
    | "LambdaExpression"
    | "LetExpression"
    | "TupleLetExpression"
    | "NamedArgument"
    | "JoinDomain"
    | "Curve1DNode"
    | "Surface2DNode"
    | "Solid3DNode";

export interface BaseNode {
    readonly type: NodeType;
    readonly line?: number;
    readonly column?: number;
    readonly startLoc?: number;
    readonly endLoc?: number;
}

export interface Program extends BaseNode {
    readonly type: "Program";
    readonly setup: SetupBlock;
    readonly parameters: ParametersBlock | null;
    readonly body: Array<ASTNode>;
}

/** The file's knobs, immediately after `setup`. A group nests further groups and fields. */
export interface ParametersBlock {
    readonly type: "ParametersBlock";
    readonly entries: Array<ParameterEntry>;
}

export type ParameterEntry = ParameterGroup | ParameterField;

export interface ParameterGroup {
    readonly type: "ParameterGroup";
    readonly name: Identifier;
    readonly entries: Array<ParameterEntry>;
}

export interface ParameterField {
    readonly type: "ParameterField";
    readonly name: Identifier;
    readonly value: ExpressionNode;
}

export interface SetupBlock extends BaseNode {
    readonly type: "SetupBlock";
    readonly units: "mm" | "inch";
    readonly coordinateSystem: "Z-up" | "Y-up" | "X-up";
    /** Model name. Required. The STL download uses it. */
    readonly name: string;
}

export interface ParamDeclaration extends BaseNode {
    readonly type: "ParamDeclaration";
    readonly name: Identifier;
    readonly value: ASTNode;
    readonly signature?: TypeNode;
}

export interface ExportStatement extends BaseNode {
    readonly type: "ExportStatement";
    readonly value: ExpressionNode;
}

export interface VariableDeclaration extends BaseNode {
    readonly type: "VariableDeclaration";
    readonly name: Identifier;
    readonly value: ASTNode;
    readonly signature?: TypeNode;
}

/** A type written on a definition. A repeated name is one type variable. */
export type TypeNode =
    | { readonly type: "TypeName"; readonly name: string }
    | { readonly type: "ListType"; readonly element: TypeNode }
    | { readonly type: "TupleType"; readonly elements: Array<TypeNode> }
    | { readonly type: "NamedParameter"; readonly name: string; readonly parameter: TypeNode }
    | { readonly type: "FunctionType"; readonly paramName: string | null; readonly parameter: TypeNode; readonly returnType: TypeNode };

/** `Component(solid: coords => ..., expose: coords => { ... })` returns a component. */
export interface ComponentExpression extends BaseNode {
    readonly type: "ComponentExpression";
    readonly solid: ExpressionNode;
    readonly expose: ExpressionNode;
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
    | ParameterReference
    | FloatLiteral
    | BooleanLiteral
    | StringLiteral
    | VectorLiteral
    | ArrayLiteral
    | TupleLiteral
    | ArrayMatchStatement
    | BinaryExpression
    | UnaryExpression
    | PipeExpression
    | ComposeExpression
    | CallExpression
    | MethodCallExpression
    | MemberExpression
    | LambdaExpression
    | LetExpression
    | TupleLetExpression
    | JoinDomain
    | ComponentExpression
    | Curve1DNode
    | Surface2DNode
    | Solid3DNode
    | ExposeBlock;

export interface Identifier extends BaseNode {
    readonly type: "Identifier";
    readonly name: string;
}

/** `$plate` reads the parameter group, even when a solid is also named `plate`. */
export interface ParameterReference extends BaseNode {
    readonly type: "ParameterReference";
    readonly name: string;
}

export interface FloatLiteral extends BaseNode {
    readonly type: "FloatLiteral";
    readonly value: number;
}

export interface BooleanLiteral extends BaseNode {
    readonly type: "BooleanLiteral";
    readonly value: boolean;
}

export interface StringLiteral extends BaseNode {
    readonly type: "StringLiteral";
    readonly value: string;
}

export interface VectorLiteral extends BaseNode {
    readonly type: "VectorLiteral";
    readonly coords: ExpressionNode;
    readonly x: ExpressionNode;
    readonly y: ExpressionNode;
    readonly z: ExpressionNode;
}

export interface ArrayLiteral extends BaseNode {
    readonly type: "ArrayLiteral";
    readonly elements: Array<ExpressionNode>;
}

/** `(a, b)` is two values. A list would force them to share one type. */
export interface TupleLiteral extends BaseNode {
    readonly type: "TupleLiteral";
    readonly elements: Array<ExpressionNode>;
}

/** A name or a nested tuple in `let (x, (y, z)) = pair in`. */
export type LetPattern =
    | { readonly type: "Name"; readonly name: Identifier }
    | { readonly type: "Tuple"; readonly elements: Array<LetPattern>; readonly line?: number; readonly column?: number };

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

/** `value |> fn` fills `fn`'s next argument with `value`. */
export interface PipeExpression extends BaseNode {
    readonly type: "PipeExpression";
    readonly leftHandSide: ExpressionNode;
    readonly rightHandSide: ExpressionNode;
}

/** `f >> g` runs `f` first and passes its result to `g`. The result keeps `f`'s parameter name. */
export interface ComposeExpression extends BaseNode {
    readonly type: "ComposeExpression";
    readonly left: ExpressionNode;
    readonly right: ExpressionNode;
}

/** `let name = value in body`. `name` is visible only in `body`. */
export interface LetExpression extends BaseNode {
    readonly type: "LetExpression";
    readonly name: Identifier;
    readonly value: ExpressionNode;
    readonly body: ExpressionNode;
}

/** `let (x, y) = value in body`. Each name is visible only in `body`. */
export interface TupleLetExpression extends BaseNode {
    readonly type: "TupleLetExpression";
    readonly pattern: LetPattern;
    readonly value: ExpressionNode;
    readonly body: ExpressionNode;
}

export interface CallExpression extends BaseNode {
    readonly type: "CallExpression";
    readonly callee: Identifier;
    readonly arguments: Array<NamedArgument>;
}

/** `point.offset(x:, y:, z:)` and `point.add(vector:)`. The receiver is a vector. */
export interface MethodCallExpression extends BaseNode {
    readonly type: "MethodCallExpression";
    readonly object: ExpressionNode;
    readonly method: Identifier;
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

/** A join seats two components. The coordinate system is the last parameter and is ignored, so `join(...)` is `coords => solid`. */
export interface JoinDomain extends BaseNode {
    readonly type: "JoinDomain";
    readonly frame: ExpressionNode;
    readonly placed: ExpressionNode;
    readonly using: ExpressionNode;
    readonly combine: ExpressionNode;
    readonly coords?: ExpressionNode;
}

export interface Curve1DNode extends BaseNode {
    readonly type: "Curve1DNode";
    readonly maxT: ExpressionNode;
    readonly formula: LambdaExpression;
}

export interface Surface2DNode extends BaseNode {
    readonly type: "Surface2DNode";
    readonly maxU: ExpressionNode;
    readonly minV: LambdaExpression;
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
    | ExportStatement
    | ExpressionNode;
