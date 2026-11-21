// ============================================================================
// PARASCRIPT AI AST TYPE DEFINITIONS (v13.1.0)
// ============================================================================

export type Type =
    | TypeVariable
    | PrimitiveType
    | ComponentType
    | SeatedSolid3DType
    | ArrayType
    | TupleType
    | FunctionType
    | RecordType
    | ExposeType;

export interface TypeVariable {
    readonly tag: "Variable";
    readonly id: number;
    instance: Type | null;
}

export interface PrimitiveType {
    readonly tag: "Float" | "String" | "Boolean" | "Vector" | "CoordinateSystem" | "Curve1D" | "Surface2D" | "Solid3D" | "Meet" | "ConstraintSet";
}

/** The anchor block returned by `expose: coords => { ... }`. */
export interface ExposeType {
    readonly tag: "Expose";
    anchors: string[];
}

/**
 * A component publishes the anchors in its expose block. A join is a solid and carries none.
 * `open` means this is a component received as an argument: `anchors` is the set read so far,
 * and the value passed in must expose every one of them.
 */
export interface ComponentType {
    readonly tag: "Component";
    anchors: string[];
    readonly open?: boolean;
    /** The definition or let that built this component, when it has one. */
    name?: string;
}

/** The two solids inside `combine`. `+` and `-` are defined only for this type. */
export interface SeatedSolid3DType {
    readonly tag: "SeatedSolid3D";
}

export interface ArrayType {
    readonly tag: "Array";
    readonly elementType: Type;
}

/** `(a, b)` keeps each value's own type. The length is part of the type. */
export interface TupleType {
    readonly tag: "Tuple";
    readonly elements: Array<Type>;
}

export interface FunctionType {
    readonly tag: "Function";
    readonly paramName: string; // Enforces named keyword argument contracts
    readonly parameter: Type;
    readonly returnType: Type;
}

/** A `parameters` group. `.` reads a field by name. */
export interface RecordType {
    readonly tag: "Record";
    readonly fields: Array<{ readonly name: string; readonly fieldType: Type }>;
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
export const tBool: PrimitiveType = { tag: "Boolean" };
export const tVector: PrimitiveType = { tag: "Vector" };
export const tCoordinateSystem: PrimitiveType = { tag: "CoordinateSystem" };
export const tComponent: ComponentType = { tag: "Component", anchors: [] };
export const tCurve1D: PrimitiveType = { tag: "Curve1D" };
export const tSurface2D: PrimitiveType = { tag: "Surface2D" };
export const tSolid3D: PrimitiveType = { tag: "Solid3D" };
export const tSeatedSolid3D: SeatedSolid3DType = { tag: "SeatedSolid3D" };
export const tMeet: PrimitiveType = { tag: "Meet" };
export const tConstraintSet: PrimitiveType = { tag: "ConstraintSet" };

export function prune(t: Type): Type {
    if (t.tag === "Variable" && t.instance) {
        t.instance = prune(t.instance);
        return t.instance;
    }
    return t;
}
