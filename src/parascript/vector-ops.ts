// Vector methods. The generated script embeds this source, and tests call the same functions.

export const vectorRuntimeSource = `
const vectorValue = (value) => {
    if (!value || value.tag !== "Vector" || typeof value.x !== "number" || typeof value.y !== "number" || typeof value.z !== "number") {
        throw new Error("A vector method needs a vector.");
    }
    if (!value.coords || value.coords.tag !== "CoordinateSystem") throw new Error("This vector has no coordinate system.");
    return value;
};
const offsetVector = (point, x, y, z) => {
    const v = vectorValue(point);
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") throw new Error("offset needs numbers for x, y, and z.");
    return { tag: "Vector", coords: v.coords, x: v.x + x, y: v.y + y, z: v.z + z };
};
const addVectors = (left, right) => {
    const l = vectorValue(left);
    const r = vectorValue(right);
    if (l.coords !== r.coords) throw new Error("Vector add needs one coordinate system.");
    return { tag: "Vector", coords: l.coords, x: l.x + r.x, y: l.y + r.y, z: l.z + r.z };
};
const subtractVectors = (left, right) => {
    const l = vectorValue(left);
    const r = vectorValue(right);
    if (l.coords !== r.coords) throw new Error("Vector subtract needs one coordinate system.");
    return { tag: "Vector", coords: l.coords, x: l.x - r.x, y: l.y - r.y, z: l.z - r.z };
};
`;

export interface VectorOps {
    offsetVector(point: unknown, x: unknown, y: unknown, z: unknown): unknown;
    addVectors(left: unknown, right: unknown): unknown;
    subtractVectors(left: unknown, right: unknown): unknown;
}

export function vectorOps(): VectorOps {
    return new Function(`${vectorRuntimeSource} return { offsetVector, addVectors, subtractVectors };`)() as VectorOps;
}
