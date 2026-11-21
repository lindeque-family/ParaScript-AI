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
    if (pruned.tag === "Tuple") {
        return pruned.elements.some((element) => occursInType(v, element));
    }
    if (pruned.tag === "Record") {
        return pruned.fields.some((field) => occursInType(v, field.fieldType));
    }
    return false;
}

export function formatList(items: string[]): string {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** `'top' is not an anchor on Box. Box exposes up, right, and corner.` */
export function missingAnchorDetail(anchor: string, componentName: string | undefined, exposed: string[]): string {
    const who = componentName ?? "this component";
    const anchors = exposed.length === 0
        ? `${who} exposes no anchors`
        : `${who} exposes ${formatList(exposed)}`;
    return `'${anchor}' is not an anchor on ${who}. ${anchors}.`;
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
        // An empty name is a signature that did not name the parameter.
        if (p1.paramName !== "" && p2.paramName !== "" && p1.paramName !== p2.paramName) {
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

    if (p1.tag === "Tuple" && p2.tag === "Tuple") {
        if (p1.elements.length !== p2.elements.length) {
            throw new Error(`Type Inference Error: A tuple of ${p1.elements.length} values does not match a tuple of ${p2.elements.length} values.`);
        }
        for (let index = 0; index < p1.elements.length; index++) {
            const left = p1.elements[index];
            const right = p2.elements[index];
            if (left && right) unify(left, right);
        }
        return;
    }

    if (p1.tag === "Record" && p2.tag === "Record") {
        if (p1.fields.length !== p2.fields.length || p1.fields.some((field) => !p2.fields.some((other) => other.name === field.name))) {
            throw new Error(`Type Inference Error: Structural Unification Mismatch. Cannot resolve type structure '${p1.tag}' with target contract type '${p2.tag}'.`);
        }
        for (const field of p1.fields) {
            const other = p2.fields.find((item) => item.name === field.name);
            if (other) unify(field.fieldType, other.fieldType);
        }
        return;
    }

    if (p1.tag === "Component" && p2.tag === "Component") {
        if (p1.open && p2.open) {
            for (const name of p2.anchors) {
                if (!p1.anchors.includes(name)) p1.anchors.push(name);
            }
            for (const name of p1.anchors) {
                if (!p2.anchors.includes(name)) p2.anchors.push(name);
            }
            return;
        }
        const required = p1.open ? p1 : p2.open ? p2 : null;
        const actual = required === p1 ? p2 : required === p2 ? p1 : null;
        if (required && actual) {
            const missing = required.anchors.find((name) => !actual.anchors.includes(name));
            if (missing !== undefined) {
                throw new Error(`Type Inference Error: ${missingAnchorDetail(missing, actual.name, actual.anchors)}`);
            }
        }
        return;
    }

    if (p1.tag === p2.tag) {
        return; // Primitive type matching resolved successfully
    }

    throw new Error(`Type Inference Error: Structural Unification Mismatch. Cannot resolve type structure '${p1.tag}' with target contract type '${p2.tag}'.`);
}
