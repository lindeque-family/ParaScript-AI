import assert from "node:assert/strict";
import { test } from "node:test";
import { ManifoldViewport, PERSPECTIVE_EYE, SHAPE_EDGE } from "./render.js";

interface DrawSegment {
    color: string;
    length: number;
}

interface CanvasListener {
    type: string;
    listener: (event: Event) => void;
    passive: boolean | undefined;
}

interface PixelBuffer {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

interface DrawLog {
    fills: number[];
    wireStrokes: number;
    solidStrokes: number;
    labels: string[];
    colors: string[];
    segments: DrawSegment[];
    listeners: CanvasListener[];
    image: PixelBuffer | null;
}

function recordingCanvas(): { canvas: HTMLCanvasElement; log: DrawLog } {
    const log: DrawLog = {
        fills: [], wireStrokes: 0, solidStrokes: 0, labels: [], colors: [], segments: [], listeners: [], image: null
    };
    const ctx = {
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        lineCap: "",
        penX: 0,
        penY: 0,
        clearRect(): void {},
        beginPath(): void {},
        moveTo(x: number, y: number): void {
            this.penX = x;
            this.penY = y;
        },
        lineTo(x: number, y: number): void {
            log.segments.push({ color: this.strokeStyle, length: Math.hypot(x - this.penX, y - this.penY) });
            this.penX = x;
            this.penY = y;
        },
        closePath(): void {},
        save(): void {},
        restore(): void {},
        fill(): void {
            log.fills.push(this.globalAlpha);
            log.colors.push(this.fillStyle);
        },
        fillText(text: string): void {
            log.labels.push(text);
        },
        stroke(): void {
            if (this.strokeStyle === "#9cdcfe") log.wireStrokes += 1;
            if (this.strokeStyle.startsWith("rgb(")) log.solidStrokes += 1;
        },
        getImageData(_x: number, _y: number, w: number, h: number): PixelBuffer {
            const image = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
            log.image = image;
            return image;
        },
        putImageData(image: PixelBuffer): void {
            log.image = image;
        }
    };
    const canvas = {
        width: 0,
        height: 0,
        parentElement: { clientWidth: 400, clientHeight: 300 },
        getContext(): typeof ctx {
            return ctx;
        },
        addEventListener(type: string, listener: (event: Event) => void, options?: boolean | { passive?: boolean }): void {
            const passive = typeof options === "object" && options !== null ? options.passive : undefined;
            log.listeners.push({ type, listener, passive });
        }
    };
    return { canvas: canvas as unknown as HTMLCanvasElement, log };
}

function longest(log: DrawLog, color: string): number {
    let max = 0;
    for (const segment of log.segments) {
        if (segment.color === color) max = Math.max(max, segment.length);
    }
    return max;
}

function countColor(log: DrawLog, color: string): number {
    let count = 0;
    for (const segment of log.segments) {
        if (segment.color === color) count += 1;
    }
    return count;
}

function installViewportGlobals(listeners: Map<string, () => void>): void {
    Object.assign(globalThis, {
        window: {
            addEventListener(type: string, listener: () => void): void {
                listeners.set(type, listener);
            }
        },
        requestAnimationFrame(callback: (time: number) => void): number {
            callback(0);
            return 1;
        }
    });
}

function filledAt(values: readonly number[], alpha: number): boolean {
    return values.length > 0 && values.every((value) => value === alpha);
}

function coverage(log: DrawLog): { count: number; mean: number; spread: number; translucent: number } {
    const data = log.image?.data;
    if (!data) return { count: 0, mean: 0, spread: 0, translucent: 0 };
    let count = 0;
    let sum = 0;
    let min = Infinity;
    let max = 0;
    let translucent = 0;
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 0;
        if (alpha === 0) continue;
        if (alpha !== 255) translucent += 1;
        const value = (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
        count += 1;
        sum += value;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    return { count, mean: count > 0 ? sum / count : 0, spread: count > 0 ? max - min : 0, translucent };
}

test("solid sides fills the faces and hides the triangle lines", () => {
    const listeners = new Map<string, () => void>();
    installViewportGlobals(listeners);
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 2, 1])
    });

    assert.equal(filledAt(log.fills, 0.45), true);
    assert.ok(log.wireStrokes > 0);
    assert.equal(log.solidStrokes, 0);

    log.fills.length = 0;
    log.wireStrokes = 0;
    log.segments.length = 0;
    viewport.setSolid(true);

    const solid = coverage(log);
    assert.ok(solid.count > 30);
    assert.equal(solid.translucent, 0);
    assert.equal(log.fills.length, 0);
    assert.equal(log.wireStrokes, 0);
    assert.equal(log.solidStrokes, 0);
    assert.equal(countColor(log, "#d5dee8"), 0);
    assert.equal(countColor(log, "#9cdcfe"), 0);
    assert.ok(countColor(log, SHAPE_EDGE) > 0);

    log.fills.length = 0;
    log.solidStrokes = 0;
    viewport.setSolid(false);

    assert.equal(filledAt(log.fills, 0.45), true);
    assert.ok(log.wireStrokes > 0);
    assert.equal(log.solidStrokes, 0);
    assert.equal(listeners.has("mouseup"), true);
    assert.equal(listeners.has("resize"), true);
});

test("axes name x, y, and z and mark the up direction", () => {
    installViewportGlobals(new Map());
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2])
    });
    assert.deepEqual(log.labels, ["X", "Y", "Z up"]);

    log.labels.length = 0;
    viewport.setUpAxis("Y-up");
    assert.deepEqual(log.labels, ["X", "Y up", "Z"]);

    log.labels.length = 0;
    viewport.setUpAxis("X-up");
    assert.deepEqual(log.labels, ["X up", "Y", "Z"]);
});

test("axis arrows shrink as they point away from the camera", () => {
    installViewportGlobals(new Map());
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2])
    });
    const radius = 1;
    const length = radius * 1.2;
    const eye = radius * PERSPECTIVE_EYE;
    const scale = (Math.min(400, 300) * 0.42) / radius;
    const angleX = 0.6;
    const angleY = 0.7;
    const project = (x: number, y: number, z: number): { x: number; y: number } => {
        const x1 = x * Math.cos(angleY) - z * Math.sin(angleY);
        const z1 = x * Math.sin(angleY) + z * Math.cos(angleY);
        const depth = y * Math.sin(angleX) + z1 * Math.cos(angleX);
        const perspective = eye / (depth + eye);
        return {
            x: 200 + x1 * scale * perspective,
            y: 150 - (y * Math.cos(angleX) - z1 * Math.sin(angleX)) * scale * perspective
        };
    };
    const origin = project(0, 0, 0);
    const xTip = project(length, 0, 0);
    const zTip = project(0, 0, length);
    const xShaft = Math.hypot(xTip.x - origin.x, xTip.y - origin.y);
    const zShaft = Math.hypot(zTip.x - origin.x, zTip.y - origin.y);
    const orthoTip = {
        x: 200 + length * Math.cos(angleY) * scale,
        y: 150 - (0 - length * Math.sin(angleY) * Math.sin(angleX)) * scale
    };
    const orthoShaft = Math.hypot(orthoTip.x - 200, orthoTip.y - 150);
    assert.ok(Math.abs(longest(log, "#f14c4c") - xShaft) < 1);
    assert.ok(xShaft < orthoShaft * 0.9);
    assert.ok(longest(log, "#4aa3ff") < longest(log, "#f14c4c"));
    assert.ok(Math.abs(longest(log, "#4aa3ff") - zShaft) < 1);
});

test("the mouse wheel zooms the model in and out", () => {
    installViewportGlobals(new Map());
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2])
    });
    const wheel = log.listeners.find((entry) => entry.type === "wheel");
    assert.ok(wheel);
    assert.equal(wheel.passive, false);
    const fitted = longest(log, "#9cdcfe");
    assert.ok(fitted > 0);

    const turn = (deltaY: number): number => {
        log.segments.length = 0;
        let prevented = false;
        wheel.listener({
            deltaY,
            deltaMode: 0,
            preventDefault(): void {
                prevented = true;
            }
        } as unknown as Event);
        assert.equal(prevented, true);
        return longest(log, "#9cdcfe");
    };

    const closer = turn(-200);
    assert.ok(closer > fitted * 1.1);
    const farther = turn(800);
    assert.ok(farther < fitted);
});

test("solid shading keeps every side and separates adjacent faces", () => {
    installViewportGlobals(new Map());
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setSolid(true);
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    viewport.setMesh({ positions, indices: new Uint32Array([0, 1, 2]) });
    const upward = coverage(log);
    assert.ok(upward.count > 30);
    assert.equal(upward.translucent, 0);
    assert.ok(upward.mean > 200);

    viewport.setMesh({ positions, indices: new Uint32Array([0, 2, 1]) });
    const downward = coverage(log);
    assert.ok(upward.mean > downward.mean + 80);

    log.segments.length = 0;
    viewport.setMesh({
        positions: new Float32Array([
            0, 0, 0, 0, 1, 0, 1, 0, 0,
            0, 0, 0, 0, 0, 1, 0, 1, 0
        ]),
        indices: new Uint32Array([0, 1, 2, 3, 4, 5])
    });
    assert.ok(coverage(log).spread > 60);
    assert.equal(countColor(log, SHAPE_EDGE), 5);

    log.segments.length = 0;
    viewport.setMesh({
        positions: new Float32Array([
            0, 0, 0, 0, 1, 0, 1, 0, 0,
            0, 0, 0, 0, 1, 0, 1, 1, 0
        ]),
        indices: new Uint32Array([0, 1, 2, 3, 4, 5])
    });
    assert.ok(coverage(log).spread < 80);
    assert.equal(countColor(log, SHAPE_EDGE), 4);

    viewport.setUpAxis("Y-up");
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0]),
        indices: new Uint32Array([0, 1, 2])
    });
    const yUp = coverage(log).mean;
    viewport.setMesh({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2])
    });
    assert.ok(yUp > coverage(log).mean + 80);
});

test("solid faces hide whatever is behind them", () => {
    installViewportGlobals(new Map());
    const { canvas, log } = recordingCanvas();
    const viewport = new ManifoldViewport(canvas);
    viewport.setSolid(true);
    const angleX = 0.6;
    const angleY = 0.7;
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const dz = 2;
    const dx = dz * Math.tan(angleY);
    const dy = Math.tan(angleX) * (dx * sinY + dz * cosY);
    const front = [0, 0, 0, 2, 0, 0, 0, 2, 0];
    const positions = new Float32Array(18);
    for (let i = 0; i < 9; i++) {
        const axis = i % 3;
        const shift = axis === 0 ? dx : axis === 1 ? dy : dz;
        positions[i] = front[i] ?? 0;
        positions[i + 9] = (front[i] ?? 0) + shift;
    }
    let radius = 1;
    for (let i = 0; i < positions.length; i += 3) {
        radius = Math.max(radius, Math.hypot(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0));
    }
    const eye = radius * PERSPECTIVE_EYE;
    const project = (x: number, y: number, z: number): { x: number; y: number; depth: number } => {
        const scale = (Math.min(400, 300) * 0.42) / radius;
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const depth = y * sinX + z1 * cosX;
        const perspective = eye / (depth + eye);
        return {
            x: 400 / 2 + x1 * scale * perspective,
            y: 300 / 2 - (y * cosX - z1 * sinX) * scale * perspective,
            depth
        };
    };
    for (let i = 0; i < 3; i++) {
        const near = project(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0);
        const far = project(positions[9 + i * 3] ?? 0, positions[10 + i * 3] ?? 0, positions[11 + i * 3] ?? 0);
        assert.ok(far.depth > near.depth + 1);
        const nearRadius = Math.hypot(near.x - 200, near.y - 150);
        const farRadius = Math.hypot(far.x - 200, far.y - 150);
        if (nearRadius > 1) assert.ok(farRadius < nearRadius * 0.92);
    }
    viewport.setMesh({
        positions,
        indices: new Uint32Array([0, 1, 2, 9, 11, 10])
    });
    const painted = coverage(log);
    assert.ok(painted.count > 30);
    assert.equal(painted.translucent, 0);
    assert.ok(painted.mean > 480);
    assert.ok(countColor(log, SHAPE_EDGE) <= 4);
});
