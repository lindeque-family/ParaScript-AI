// ============================================================================
// PARASCRIPT AI RECURSIVE STRUCTURAL UNIFICATION HIERARCHY
// ============================================================================

import { prune, type Type, type TypeVariable } from "./types.js";


/**
 * Validates whether a type variable occurs inside a target type tree structure.
 * Prevents compiler infinity loops and un-resolvable type cycles.
 */
function occursInType(v: TypeVariable, t: Type): boolean {
    const pruned = prune(t);
    if (pruned.tag === "Variable") {
        return pruned.id === v.id;
    }
    if (pruned.tag === "Function") {
        return occursInType(v, pruned.parameter) || occursInType(v, pruned.returnType);
    }
    if (pruned.tag === "Array") {
        return occursInType(v, pruned.elementType);
    }
    return false;
}

export function unify(t1: Type, t2: Type): void {
    const p1 = prune(t1);
    const p2 = prune(t2);

    if (p1.tag === "Variable") {
        if (p1.id !== (p2.tag === "Variable" ? p2.id : -1)) {
            if (occursInType(p1, p2)) {
                throw new Error(`Type Inference Error: Occurs Check Validation Fault. Cannot construct infinite cyclic type constraints.`);
            }
            p1.instance = p2;
        }
        return;
    }

    if (p2.tag === "Variable") {
        unify(p2, p1);
        return;
    }

    if (p1.tag === "Function" && p2.tag === "Function") {
        if (p1.paramName !== p2.paramName) {
            throw new Error(`Type Inference Error: Keyword Argument Mismatch. Expected named parameter identifier '${p1.paramName}', but found key name '${p2.paramName}'.`);
        }
        unify(p1.parameter, p2.parameter);
        unify(p1.returnType, p2.returnType);
        return;
    }

    if (p1.tag === "Array" && p2.tag === "Array") {
        unify(p1.elementType, p2.elementType);
        return;
    }

    if (p1.tag === p2.tag) {
        return; // Primitive type matching resolved successfully
    }

    throw new Error(`Type Inference Error: Structural Unification Mismatch. Cannot resolve type structure '${p1.tag}' with target contract type '${p2.tag}'.`);
}
