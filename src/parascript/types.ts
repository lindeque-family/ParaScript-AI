// ============================================================================
// PARASCRIPT AI AST TYPE DEFINITIONS (v13.1.0)
// ============================================================================

export type Type =
    | TypeVariable
    | PrimitiveType
    | ComponentType
    | DomainType
    | ArrayType
    | FunctionType;

export interface TypeVariable {
    readonly tag: "Variable";
    readonly id: number;
    instance: Type | null;
}

export interface PrimitiveType {
    readonly tag: "Float" | "String" | "Vector" | "Curve1D" | "Surface2D" | "Solid3D" | "Axis" | "Meet" | "ConstraintSet";
}

/** A component publishes the anchors in its expose block. Join results carry none. */
export interface ComponentType {
    readonly tag: "Component";
    readonly anchors: readonly string[];
}

/** Solids that belong to one join. Operators on two domains require the same id. */
export interface DomainType {
    readonly tag: "Domain";
    readonly id: number;
}

export interface ArrayType {
    readonly tag: "Array";
    readonly elementType: Type;
}

export interface FunctionType {
    readonly tag: "Function";
    readonly paramName: string; // Enforces named keyword argument contracts
    readonly parameter: Type;
    readonly returnType: Type;
}

export class TypeSchema {
    constructor(
        public readonly boundVariables: Array<number>,
        public readonly type: Type
    ) {}
}

export class TypeEnvironment {
    private registry: Map<string, TypeSchema> = new Map();
    constructor(private readonly parent: TypeEnvironment | null = null) {}

    public extend(name: string, schema: TypeSchema): void {
        this.registry.set(name, schema);
    }

    public lookup(name: string): TypeSchema {
        const local = this.registry.get(name);
        if (local) return local;
        if (this.parent) return this.parent.lookup(name);
        throw new Error(`Type Inference Error: Unbound identifier token tracking fault '${name}'`);
    }
}

let typeVariableCounter = 0;
export function createFreshVariable(): TypeVariable {
    return { tag: "Variable", id: typeVariableCounter++, instance: null };
}

export const tFloat: PrimitiveType = { tag: "Float" };
export const tString: PrimitiveType = { tag: "String" };
export const tVector: PrimitiveType = { tag: "Vector" };
export const tComponent: ComponentType = { tag: "Component", anchors: [] };
export const tCurve1D: PrimitiveType = { tag: "Curve1D" };
export const tSurface2D: PrimitiveType = { tag: "Surface2D" };
export const tSolid3D: PrimitiveType = { tag: "Solid3D" };
export const tAxis: PrimitiveType = { tag: "Axis" };
export const tMeet: PrimitiveType = { tag: "Meet" };
export const tConstraintSet: PrimitiveType = { tag: "ConstraintSet" };

export function prune(t: Type): Type {
    if (t.tag === "Variable" && t.instance) {
        t.instance = prune(t.instance);
        return t.instance;
    }
    return t;
}
