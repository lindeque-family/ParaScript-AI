import type { Mesh } from "./model.js";

interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

interface CameraPoint {
    readonly x: number;
    readonly y: number;
    readonly depth: number;
}

interface MeshCorner {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly sx: number;
    readonly sy: number;
    readonly depth: number;
}

interface ScreenTriangle {
    readonly depth: number;
    readonly shade: readonly [number, number, number];
    readonly normal: Vec3;
    readonly facesCamera: boolean;
    readonly corners: readonly [MeshCorner, MeshCorner, MeshCorner];
}

export const SHAPE_EDGE = "#16202b";

type ViewName = "top" | "bottom" | "front" | "back" | "left" | "right";

interface ViewFace {
    readonly name: ViewName;
    readonly normal: Vec3;
    readonly corners: readonly [Vec3, Vec3, Vec3, Vec3];
}
// The eye sits this many model-radii back. Near axis tips grow and far ones shrink.
export const PERSPECTIVE_EYE = 2.75;
// A nearer surface hides an edge. The bias keeps the crease on the front face.
const EDGE_DEPTH_BIAS = 0.45;

export class ManifoldViewport {
    private readonly ctx: CanvasRenderingContext2D;
    private mesh: Mesh = { positions: new Float32Array(), indices: new Uint32Array() };
    private coveredEdges: ReadonlySet<string> = new Set();
    private angleX = 0.6;
    private angleY = 0.7;
    private dragging = false;
    private panning = false;
    private panX = 0;
    private panY = 0;
    private hoverView: ViewName | null = null;
    private previousX = 0;
    private previousY = 0;
    private camRight: Vec3 = { x: 1, y: 0, z: 0 };
    private camUp: Vec3 = { x: 0, y: 1, z: 0 };
    private camForward: Vec3 = { x: 0, y: 0, z: 1 };
    private radius = 1;
    private scale = 1;
    private solid = false;
    private zoom = 1;
    private upAxis: "Z-up" | "Y-up" | "X-up" = "Z-up";
    private pixelRatio = 1;
    private eyeDistance = PERSPECTIVE_EYE;
    private depth: Float32Array = new Float32Array(0);
    private drawScheduled = false;

    constructor(private readonly canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("2D canvas context unavailable.");
        }
        this.ctx = ctx;
        this.orientFromAngles();
        canvas.addEventListener("mousedown", (event) => {
            this.previousX = event.clientX;
            this.previousY = event.clientY;
            if (event.button === 1) {
                this.panning = true;
                this.setCursor("grabbing");
                event.preventDefault();
                return;
            }
            if (event.button !== 0) return;
            const face = this.hitViewCube(this.pointer(event));
            if (face) {
                this.snapView(face.name);
                return;
            }
            this.dragging = true;
            this.setCursor("grabbing");
        });
        window.addEventListener("mouseup", () => {
            this.dragging = false;
            this.panning = false;
            this.setCursor(this.hoverView ? "pointer" : "default");
        });
        canvas.addEventListener("mousemove", (event) => {
            if (this.panning) {
                const scale = this.pointerScale();
                this.panX += (event.clientX - this.previousX) * scale.x;
                this.panY += (event.clientY - this.previousY) * scale.y;
                this.previousX = event.clientX;
                this.previousY = event.clientY;
                this.scheduleDraw();
                return;
            }
            if (this.dragging) {
                const dx = event.clientX - this.previousX;
                const dy = event.clientY - this.previousY;
                this.previousX = event.clientX;
                this.previousY = event.clientY;
                this.orbit(dx, dy);
                this.scheduleDraw();
                return;
            }
            const face = this.hitViewCube(this.pointer(event));
            const next = face?.name ?? null;
            if (next !== this.hoverView) {
                this.hoverView = next;
                this.setCursor(next ? "pointer" : "default");
                this.scheduleDraw();
            }
        });
        canvas.addEventListener("wheel", (event) => {
            event.preventDefault();
            let delta = event.deltaY;
            if (event.deltaMode === 1) delta *= 16;
            else if (event.deltaMode === 2) delta *= canvas.height || 400;
            if (!Number.isFinite(delta) || delta === 0) return;
            // A notch of about 100 pixels changes the zoom by roughly ten percent.
            const next = this.zoom * Math.exp(-delta * 0.0012);
            this.zoom = Math.min(16, Math.max(0.15, next));
            this.scheduleDraw();
        }, { passive: false });
        this.bindTouch(canvas);
        window.addEventListener("resize", () => this.resize());
    }

    // One finger orbits and a tap hits the view cube. Two fingers pan and pinch to zoom.
    private bindTouch(canvas: HTMLCanvasElement): void {
        let mode: "none" | "orbit" | "pinch" = "none";
        let lastX = 0;
        let lastY = 0;
        let startX = 0;
        let startY = 0;
        let moved = false;
        let span = 1;
        const changed = (event: TouchEvent): void => {
            if (event.cancelable) event.preventDefault();
        };
        const place = (touch: Touch): void => {
            lastX = touch.clientX;
            lastY = touch.clientY;
        };
        canvas.addEventListener("touchstart", (event) => {
            changed(event);
            const first = event.touches[0];
            const second = event.touches[1];
            if (event.touches.length === 1 && first) {
                mode = "orbit";
                moved = false;
                startX = first.clientX;
                startY = first.clientY;
                place(first);
                return;
            }
            if (first && second) {
                mode = "pinch";
                span = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) || 1;
                lastX = (first.clientX + second.clientX) / 2;
                lastY = (first.clientY + second.clientY) / 2;
            }
        }, { passive: false });
        canvas.addEventListener("touchmove", (event) => {
            changed(event);
            const first = event.touches[0];
            const second = event.touches[1];
            if (mode === "orbit" && event.touches.length === 1 && first) {
                const dx = first.clientX - lastX;
                const dy = first.clientY - lastY;
                if (Math.hypot(first.clientX - startX, first.clientY - startY) > 4) moved = true;
                place(first);
                if (!moved) return;
                this.orbit(dx, dy);
                this.scheduleDraw();
                return;
            }
            if (!first || !second) return;
            mode = "pinch";
            const scale = this.pointerScale();
            const midX = (first.clientX + second.clientX) / 2;
            const midY = (first.clientY + second.clientY) / 2;
            this.panX += (midX - lastX) * scale.x;
            this.panY += (midY - lastY) * scale.y;
            lastX = midX;
            lastY = midY;
            const nextSpan = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) || span;
            this.zoom = Math.min(16, Math.max(0.15, this.zoom * (nextSpan / span)));
            span = nextSpan;
            this.scheduleDraw();
        }, { passive: false });
        canvas.addEventListener("touchend", (event) => {
            if (mode === "orbit" && !moved && event.touches.length === 0) {
                const face = this.hitViewCube(this.pointerFromClient(startX, startY));
                if (face) this.snapView(face.name);
            }
            const first = event.touches[0];
            if (!first) {
                mode = "none";
                return;
            }
            mode = "orbit";
            moved = true;
            startX = first.clientX;
            startY = first.clientY;
            place(first);
        });
    }

    setMesh(mesh: Mesh): void {
        this.mesh = mesh;
        this.coveredEdges = coveredFaceEdges(mesh);
        this.radius = this.measureRadius();
        this.resize();
    }

    setSolid(solid: boolean): void {
        this.solid = solid;
        this.scheduleDraw();
    }

    setUpAxis(axis: "Z-up" | "Y-up" | "X-up"): void {
        this.upAxis = axis;
        this.scheduleDraw();
    }

    private scheduleDraw(): void {
        if (this.drawScheduled) return;
        this.drawScheduled = true;
        requestAnimationFrame(() => {
            this.drawScheduled = false;
            this.draw();
        });
    }

    resize(): void {
        const parent = this.canvas.parentElement;
        if (!parent || parent.clientWidth === 0 || parent.clientHeight === 0) return;
        const ratio = window.devicePixelRatio;
        this.pixelRatio = typeof ratio === "number" && ratio > 0 ? ratio : 1;
        this.canvas.width = Math.max(1, Math.round(parent.clientWidth * this.pixelRatio));
        this.canvas.height = Math.max(1, Math.round(parent.clientHeight * this.pixelRatio));
        this.draw();
    }

    private measureRadius(): number {
        let max = 0;
        const positions = this.mesh.positions;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i] ?? 0;
            const y = positions[i + 1] ?? 0;
            const z = positions[i + 2] ?? 0;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
            max = Math.max(max, Math.hypot(x, y, z));
        }
        return max > 0 ? max : 1;
    }

    private orientFromAngles(): void {
        const cosX = Math.cos(this.angleX);
        const sinX = Math.sin(this.angleX);
        const cosY = Math.cos(this.angleY);
        const sinY = Math.sin(this.angleY);
        this.camRight = { x: cosY, y: 0, z: -sinY };
        this.camUp = { x: -sinX * sinY, y: cosX, z: -sinX * cosY };
        this.camForward = { x: sinY * cosX, y: sinX, z: cosY * cosX };
    }

    private cameraOf(x: number, y: number, z: number): Vec3 {
        return {
            x: x * this.camRight.x + y * this.camRight.y + z * this.camRight.z,
            y: x * this.camUp.x + y * this.camUp.y + z * this.camUp.z,
            z: x * this.camForward.x + y * this.camForward.y + z * this.camForward.z
        };
    }

    private orbit(dx: number, dy: number): void {
        const right = this.camRight;
        const up = this.camUp;
        // Screen axes, same feel as the old yaw and pitch: drag right swings +X left, drag down swings +Z down.
        if (dx !== 0) this.turn(up, dx * 0.01);
        if (dy !== 0) this.turn(right, -dy * 0.01);
        this.orthonormalize();
    }

    private turn(axis: Vec3, angle: number): void {
        this.camRight = rotateAround(this.camRight, axis, angle);
        this.camUp = rotateAround(this.camUp, axis, angle);
        this.camForward = rotateAround(this.camForward, axis, angle);
    }

    private orthonormalize(): void {
        this.camForward = unitVec(this.camForward);
        const upDot = dotVec(this.camUp, this.camForward);
        this.camUp = unitVec({
            x: this.camUp.x - this.camForward.x * upDot,
            y: this.camUp.y - this.camForward.y * upDot,
            z: this.camUp.z - this.camForward.z * upDot
        });
        this.camRight = crossVec(this.camUp, this.camForward);
    }

    private perspectiveScale(depth: number): number {
        const limit = this.eyeDistance * 0.08;
        const viewZ = depth + this.eyeDistance;
        return this.eyeDistance / (viewZ > limit ? viewZ : limit);
    }

    // Axes, grid, and the part share this camera, so an arrow stays on the part's edge.
    private rotate(x: number, y: number, z: number): CameraPoint {
        const camera = this.cameraOf(x, y, z);
        const perspective = this.perspectiveScale(camera.z);
        return {
            x: this.canvas.width / 2 + camera.x * this.scale * perspective + this.panX,
            y: this.canvas.height / 2 - camera.y * this.scale * perspective + this.panY,
            depth: camera.z
        };
    }

    private sky(): Vec3 {
        if (this.upAxis === "Y-up") return { x: 0, y: 1, z: 0 };
        if (this.upAxis === "X-up") return { x: 1, y: 0, z: 0 };
        return { x: 0, y: 0, z: 1 };
    }

    // Right, forward, and up are the part's own axes. Z-up is +X, +Y, +Z.
    private partAxes(): { right: Vec3; forward: Vec3; up: Vec3 } {
        const up = this.sky();
        if (this.upAxis === "Y-up") return { right: { x: 1, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 }, up };
        if (this.upAxis === "X-up") return { right: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, up };
        return { right: { x: 1, y: 0, z: 0 }, forward: { x: 0, y: 1, z: 0 }, up };
    }

    // Light stays in the part frame. A camera-space key paints every face that
    // looks at you the same color, so a grazing view loses the floor against the walls.
    private faceShade(world: Vec3): readonly [number, number, number] {
        const { right, forward, up } = this.partAxes();
        const key = frameLight(right, forward, up, 0.85, 0.15, 0.75);
        const fill = frameLight(right, forward, up, -0.7, 0.55, 0.4);
        const keyTerm = Math.max(0, dotVec(world, key));
        const fillTerm = Math.max(0, dotVec(world, fill));
        const value = Math.min(1, Math.max(0, 0.28 + keyTerm * 0.55 + fillTerm * 0.2 + dotVec(world, up) * 0.12));
        const highlight = Math.pow(keyTerm, 24) * 0.18;
        const channel = (shadow: number, lit: number): number =>
            Math.min(255, Math.round(shadow + value * (lit - shadow) + highlight * 70));
        return [channel(42, 236), channel(50, 238), channel(62, 244)];
    }

    private draw(): void {
        const { ctx, canvas } = this;
        if (canvas.width === 0 || canvas.height === 0) return;
        const span = Math.min(canvas.width, canvas.height);
        this.eyeDistance = this.radius * PERSPECTIVE_EYE;
        this.scale = (span * 0.42 * this.zoom) / this.radius;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawGrid();
        this.drawMesh();
        this.drawAxes();
        this.drawViewCube();
    }

    private pointerScale(): { x: number; y: number } {
        const cssW = this.canvas.clientWidth || this.canvas.width || 1;
        const cssH = this.canvas.clientHeight || this.canvas.height || 1;
        return { x: this.canvas.width / cssW, y: this.canvas.height / cssH };
    }

    private pointer(event: MouseEvent): { x: number; y: number } {
        const scale = this.pointerScale();
        return { x: event.offsetX * scale.x, y: event.offsetY * scale.y };
    }

    private pointerFromClient(clientX: number, clientY: number): { x: number; y: number } {
        const rect = typeof this.canvas.getBoundingClientRect === "function"
            ? this.canvas.getBoundingClientRect()
            : { left: 0, top: 0 };
        const scale = this.pointerScale();
        return { x: (clientX - rect.left) * scale.x, y: (clientY - rect.top) * scale.y };
    }

    private setCursor(cursor: string): void {
        if (!this.canvas.style) return;
        this.canvas.style.cursor = cursor;
    }

    // Top looks down the up axis. Front looks at the forward face. Screen up stays the part's up,
    // except on top and bottom, where forward takes that job so the view is not mirrored.
    private snapView(name: ViewName): void {
        const { right, forward, up } = this.partAxes();
        if (name === "top") {
            this.camRight = right;
            this.camUp = scaleVec(forward, -1);
            this.camForward = scaleVec(up, -1);
        } else if (name === "bottom") {
            this.camRight = right;
            this.camUp = forward;
            this.camForward = up;
        } else if (name === "front") {
            this.camRight = right;
            this.camUp = up;
            this.camForward = scaleVec(forward, -1);
        } else if (name === "back") {
            this.camRight = scaleVec(right, -1);
            this.camUp = up;
            this.camForward = forward;
        } else if (name === "right") {
            this.camRight = scaleVec(forward, -1);
            this.camUp = up;
            this.camForward = scaleVec(right, -1);
        } else {
            this.camRight = forward;
            this.camUp = up;
            this.camForward = right;
        }
        this.panX = 0;
        this.panY = 0;
        this.scheduleDraw();
    }

    private viewName(normal: Vec3): ViewName {
        const { right, forward, up } = this.partAxes();
        const upDot = dotVec(normal, up);
        const forwardDot = dotVec(normal, forward);
        const rightDot = dotVec(normal, right);
        const aUp = Math.abs(upDot);
        const aForward = Math.abs(forwardDot);
        const aRight = Math.abs(rightDot);
        if (aUp >= aForward && aUp >= aRight) return upDot > 0 ? "top" : "bottom";
        if (aForward >= aRight) return forwardDot > 0 ? "front" : "back";
        return rightDot > 0 ? "right" : "left";
    }

    private viewLabel(name: ViewName): string {
        if (name === "top") return "Top";
        if (name === "bottom") return "Bottom";
        if (name === "front") return "Front";
        if (name === "back") return "Back";
        if (name === "right") return "Right";
        return "Left";
    }

    private viewFaces(): readonly ViewFace[] {
        const normals: readonly Vec3[] = [
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: -1, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 }
        ];
        return normals.map((normal) => ({
            name: this.viewName(normal),
            normal,
            corners: faceCorners(normal)
        }));
    }

    private widgetProject(point: Vec3): CameraPoint {
        const camera = this.cameraOf(point.x, point.y, point.z);
        const px = this.pixelRatio;
        const size = 26 * px;
        const originX = this.canvas.width - 68 * px;
        const originY = 58 * px;
        const perspective = 4 / (4 + camera.z);
        return {
            x: originX + camera.x * size * perspective,
            y: originY - camera.y * size * perspective,
            depth: camera.z
        };
    }

    private hitViewCube(point: { x: number; y: number }): ViewFace | null {
        let best: ViewFace | null = null;
        let bestDepth = Infinity;
        for (const face of this.viewFaces()) {
            const facing = this.cameraOf(face.normal.x, face.normal.y, face.normal.z).z;
            if (facing > 0.05) continue;
            const [a, b, c, d] = face.corners.map((corner) => this.widgetProject(corner));
            if (!a || !b || !c || !d) continue;
            const depth = this.widgetProject(face.normal).depth;
            if (!pointInTri(point, a, b, c) && !pointInTri(point, a, c, d)) continue;
            if (depth < bestDepth) {
                best = face;
                bestDepth = depth;
            }
        }
        return best;
    }

    private drawViewCube(): void {
        const { ctx } = this;
        const faces = [...this.viewFaces()].sort((left, right) => {
            return this.widgetProject(right.normal).depth - this.widgetProject(left.normal).depth;
        });
        ctx.save();
        ctx.globalAlpha = 1;
        const px = this.pixelRatio;
        ctx.font = `${10 * px}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 1.25 * px;
        ctx.lineJoin = "round";
        for (const face of faces) {
            const facing = this.cameraOf(face.normal.x, face.normal.y, face.normal.z).z;
            if (facing > 0.05) continue;
            const projected = face.corners.map((corner) => this.widgetProject(corner));
            const [a, b, c, d] = projected;
            if (!a || !b || !c || !d) continue;
            const shade = this.faceShade(face.normal);
            const lift = face.name === this.hoverView ? 40 : 0;
            const channel = (value: number): number => Math.min(255, value + lift);
            ctx.strokeStyle = face.name === this.hoverView ? "#d6e9ff" : "#1b242e";
            ctx.fillStyle = `rgb(${channel(shade[0])}, ${channel(shade[1])}, ${channel(shade[2])})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (facing < -0.35) {
                const label = this.widgetProject(face.normal);
                ctx.fillStyle = "#f4f7fb";
                ctx.fillText(this.viewLabel(face.name), label.x, label.y);
            }
        }
        ctx.restore();
    }

    private drawGrid(): void {
        const { ctx } = this;
        const radius = this.radius;
        ctx.strokeStyle = "#2d2d2d";
        ctx.lineWidth = this.pixelRatio;
        const steps = 8;
        for (let i = -steps; i <= steps; i++) {
            const t = (i / steps) * radius;
            const a = this.onFloor(-radius, t);
            const b = this.onFloor(radius, t);
            const c = this.onFloor(t, -radius);
            const d = this.onFloor(t, radius);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
        }
    }

    private onFloor(u: number, v: number): CameraPoint {
        if (this.upAxis === "Y-up") return this.rotate(u, 0, v);
        if (this.upAxis === "X-up") return this.rotate(0, u, v);
        return this.rotate(u, v, 0);
    }

    private drawAxes(): void {
        const length = this.radius * 1.2;
        const up = this.upAxis === "X-up" ? "x" : this.upAxis === "Y-up" ? "y" : "z";
        const origin = this.rotate(0, 0, 0);
        const axes = [
            { name: "x", label: "X", color: "#f14c4c", tip: this.rotate(length, 0, 0) },
            { name: "y", label: "Y", color: "#3dd68c", tip: this.rotate(0, length, 0) },
            { name: "z", label: "Z", color: "#4aa3ff", tip: this.rotate(0, 0, length) }
        ] as const;
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = 1;
        const px = this.pixelRatio;
        ctx.font = `${12 * px}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineCap = "round";
        for (const axis of axes) {
            const isUp = axis.name === up;
            ctx.strokeStyle = axis.color;
            ctx.fillStyle = axis.color;
            ctx.lineWidth = (isUp ? 3 : 1.5) * px;
            ctx.beginPath();
            ctx.moveTo(origin.x, origin.y);
            ctx.lineTo(axis.tip.x, axis.tip.y);
            const dx = axis.tip.x - origin.x;
            const dy = axis.tip.y - origin.y;
            const mag = Math.hypot(dx, dy);
            const ux = mag > px ? dx / mag : 0;
            const uy = mag > px ? dy / mag : -1;
            if (mag > px) {
                const back = 12 * px;
                const wing = 6 * px;
                ctx.moveTo(axis.tip.x, axis.tip.y);
                ctx.lineTo(axis.tip.x - ux * back + uy * wing, axis.tip.y - uy * back - ux * wing);
                ctx.moveTo(axis.tip.x, axis.tip.y);
                ctx.lineTo(axis.tip.x - ux * back - uy * wing, axis.tip.y - uy * back + ux * wing);
            }
            ctx.stroke();
            const text = isUp ? `${axis.label} up` : axis.label;
            ctx.fillText(text, axis.tip.x + ux * 16 * px, axis.tip.y + uy * 16 * px);
        }
        ctx.restore();
    }

    private drawMesh(): void {
        const { ctx } = this;
        const { positions, indices } = this.mesh;
        const projected: CameraPoint[] = [];
        for (let i = 0; i < positions.length; i += 3) {
            projected.push(this.rotate(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0));
        }

        const triangles: ScreenTriangle[] = [];
        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i];
            const ib = indices[i + 1];
            const ic = indices[i + 2];
            if (ia === undefined || ib === undefined || ic === undefined) continue;
            const a = projected[ia];
            const b = projected[ib];
            const c = projected[ic];
            const ax = positions[ia * 3];
            const ay = positions[ia * 3 + 1];
            const az = positions[ia * 3 + 2];
            const bx = positions[ib * 3];
            const by = positions[ib * 3 + 1];
            const bz = positions[ib * 3 + 2];
            const cx = positions[ic * 3];
            const cy = positions[ic * 3 + 1];
            const cz = positions[ic * 3 + 2];
            if (!a || !b || !c) continue;
            if (ax === undefined || ay === undefined || az === undefined) continue;
            if (bx === undefined || by === undefined || bz === undefined) continue;
            if (cx === undefined || cy === undefined || cz === undefined) continue;
            const ux = bx - ax;
            const uy = by - ay;
            const uz = bz - az;
            const vx = cx - ax;
            const vy = cy - ay;
            const vz = cz - az;
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const length = Math.hypot(nx, ny, nz);
            if (length < 1e-8) continue;
            const world = quantizeNormal({ x: nx / length, y: ny / length, z: nz / length });
            const camera = this.cameraOf(world.x, world.y, world.z);
            const corner = (x: number, y: number, z: number, point: CameraPoint): MeshCorner => ({
                x, y, z, sx: point.x, sy: point.y, depth: point.depth
            });
            triangles.push({
                depth: (a.depth + b.depth + c.depth) / 3,
                shade: this.faceShade(world),
                normal: world,
                facesCamera: camera.z <= 0,
                corners: [
                    corner(ax, ay, az, a),
                    corner(bx, by, bz, b),
                    corner(cx, cy, cz, c)
                ]
            });
        }

        if (this.solid) {
            this.drawSolid(triangles);
            this.drawShapeEdges(triangles);
            return;
        }

        triangles.sort((left, right) => right.depth - left.depth);
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = this.pixelRatio;
        for (const triangle of triangles) {
            const [p, q, r] = triangle.corners;
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(q.sx, q.sy);
            ctx.lineTo(r.sx, r.sy);
            ctx.closePath();
            ctx.fillStyle = `rgb(${triangle.shade[0]}, ${triangle.shade[1]}, ${triangle.shade[2]})`;
            ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = "#9cdcfe";
        ctx.lineWidth = this.pixelRatio;
        for (const triangle of triangles) {
            const [p, q, r] = triangle.corners;
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(q.sx, q.sy);
            ctx.lineTo(r.sx, r.sy);
            ctx.closePath();
            ctx.stroke();
        }
    }

    // The canvas has no depth test. Painter's order let cavity edges paint over the
    // walls, so solid mode keeps the nearest surface at each pixel and hides the rest.
    private drawSolid(triangles: readonly ScreenTriangle[]): void {
        const { ctx, canvas } = this;
        const width = canvas.width;
        const height = canvas.height;
        const image = ctx.getImageData(0, 0, width, height);
        const count = width * height;
        if (this.depth.length !== count) this.depth = new Float32Array(count);
        this.depth.fill(Number.POSITIVE_INFINITY);
        for (const triangle of triangles) this.rasterize(triangle, image.data, width, height);
        ctx.putImageData(image, 0, 0);
    }

    private rasterize(triangle: ScreenTriangle, pixels: Uint8ClampedArray, width: number, height: number): void {
        const [a, b, c] = triangle.corners;
        const area = (b.sx - a.sx) * (c.sy - a.sy) - (b.sy - a.sy) * (c.sx - a.sx);
        if (Math.abs(area) < 1) return;
        const inv = 1 / area;
        const eps = 0.8 * Math.max(
            Math.hypot(c.sx - b.sx, c.sy - b.sy),
            Math.hypot(a.sx - c.sx, a.sy - c.sy),
            Math.hypot(b.sx - a.sx, b.sy - a.sy)
        ) * Math.abs(inv);
        const minX = Math.max(0, Math.floor(Math.min(a.sx, b.sx, c.sx) - 1));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(a.sx, b.sx, c.sx) + 1));
        const minY = Math.max(0, Math.floor(Math.min(a.sy, b.sy, c.sy) - 1));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(a.sy, b.sy, c.sy) + 1));
        const axes = faceAxes(triangle.normal);
        const [sr, sg, sb] = triangle.shade;
        const depth = this.depth;
        const px0 = minX + 0.5;
        const py0 = minY + 0.5;
        const weight = (px: number, py: number, ox: number, oy: number, qx: number, qy: number): number =>
            ((ox - px) * (qy - py) - (oy - py) * (qx - px)) * inv;
        let rowA = weight(px0, py0, b.sx, b.sy, c.sx, c.sy);
        let rowB = weight(px0, py0, c.sx, c.sy, a.sx, a.sy);
        const dwAdx = (b.sy - c.sy) * inv;
        const dwBdx = (c.sy - a.sy) * inv;
        const dwAdy = (c.sx - b.sx) * inv;
        const dwBdy = (a.sx - c.sx) * inv;
        const ax = a.x - c.x;
        const ay = a.y - c.y;
        const az = a.z - c.z;
        const ad = a.depth - c.depth;
        const bx = b.x - c.x;
        const by = b.y - c.y;
        const bz = b.z - c.z;
        const bd = b.depth - c.depth;
        const dwx = dwAdx * ax + dwBdx * bx;
        const dwy = dwAdx * ay + dwBdx * by;
        const dwz = dwAdx * az + dwBdx * bz;
        const dwd = dwAdx * ad + dwBdx * bd;
        for (let y = minY; y <= maxY; y++) {
            let wA = rowA;
            let wB = rowB;
            let wx = c.x + wA * ax + wB * bx;
            let wy = c.y + wA * ay + wB * by;
            let wz = c.z + wA * az + wB * bz;
            let z = c.depth + wA * ad + wB * bd;
            const row = y * width;
            for (let x = minX; x <= maxX; x++) {
                const wC = 1 - wA - wB;
                if (wA >= -eps && wB >= -eps && wC >= -eps) {
                    const index = row + x;
                    if (z < (depth[index] ?? Number.POSITIVE_INFINITY)) {
                        depth[index] = z;
                        const grain = sampleGrain(
                            wx * axes.u.x + wy * axes.u.y + wz * axes.u.z,
                            wx * axes.v.x + wy * axes.v.y + wz * axes.v.z
                        );
                        const factor = 0.8 + grain * 0.2;
                        const offset = index * 4;
                        pixels[offset] = sr * factor;
                        pixels[offset + 1] = sg * factor;
                        pixels[offset + 2] = sb * factor;
                        pixels[offset + 3] = 255;
                    }
                }
                wA += dwAdx;
                wB += dwBdx;
                wx += dwx;
                wy += dwy;
                wz += dwz;
                z += dwd;
            }
            rowA += dwAdy;
            rowB += dwBdy;
        }
    }

    private coversEdge(x: number, y: number, edgeDepth: number): boolean {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        let nearest = Number.POSITIVE_INFINITY;
        for (let oy = -1; oy <= 1; oy++) {
            const sy = iy + oy;
            if (sy < 0 || sy >= height) continue;
            for (let ox = -1; ox <= 1; ox++) {
                const sx = ix + ox;
                if (sx < 0 || sx >= width) continue;
                const found = this.depth[sy * width + sx] ?? Number.POSITIVE_INFINITY;
                if (found < nearest) nearest = found;
            }
        }
        return edgeDepth <= nearest + EDGE_DEPTH_BIAS;
    }

    private drawShapeEdges(triangles: readonly ScreenTriangle[]): void {
        interface Edge {
            count: number;
            crease: boolean;
            silhouette: boolean;
            nx: number;
            ny: number;
            nz: number;
            facesCamera: boolean;
            ax: number;
            ay: number;
            az: number;
            bx: number;
            by: number;
            bz: number;
            key: string;
        }
        const edges = new Map<string, Edge>();
        const add = (p: MeshCorner, q: MeshCorner, tri: ScreenTriangle): void => {
            const key = edgeKey(p, q);
            const found = edges.get(key);
            if (!found) {
                edges.set(key, {
                    count: 1,
                    crease: false,
                    silhouette: false,
                    nx: tri.normal.x,
                    ny: tri.normal.y,
                    nz: tri.normal.z,
                    facesCamera: tri.facesCamera,
                    ax: p.sx,
                    ay: p.sy,
                    az: p.depth,
                    bx: q.sx,
                    by: q.sy,
                    bz: q.depth,
                    key
                });
                return;
            }
            found.count += 1;
            const aligned = found.nx * tri.normal.x + found.ny * tri.normal.y + found.nz * tri.normal.z;
            if (aligned < 0.55) found.crease = true;
            if (found.facesCamera !== tri.facesCamera) found.silhouette = true;
        };
        for (const triangle of triangles) {
            const [p, q, r] = triangle.corners;
            add(p, q, triangle);
            add(q, r, triangle);
            add(r, p, triangle);
        }
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = SHAPE_EDGE;
        ctx.lineWidth = 2.5 * this.pixelRatio;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const edge of edges.values()) {
            if (edge.count !== 1 && !edge.crease && !edge.silhouette) continue;
            // A boolean leaves the cylinder's end disk in the plate face. Those edges were
            // marked when the mesh was set, so orbiting does not search the faces again.
            if (edge.count === 1 && !edge.crease && !edge.silhouette && this.coveredEdges.has(edge.key)) continue;
            const span = Math.hypot(edge.bx - edge.ax, edge.by - edge.ay);
            if (span < this.pixelRatio) continue;
            const steps = Math.max(1, Math.ceil(span));
            let run: { x: number; y: number } | null = null;
            let lastX = 0;
            let lastY = 0;
            const flush = (): void => {
                if (!run) return;
                if (Math.hypot(lastX - run.x, lastY - run.y) >= this.pixelRatio) {
                    ctx.beginPath();
                    ctx.moveTo(run.x, run.y);
                    ctx.lineTo(lastX, lastY);
                    ctx.stroke();
                }
                run = null;
            };
            for (let step = 0; step <= steps; step++) {
                const t = step / steps;
                const x = edge.ax + (edge.bx - edge.ax) * t;
                const y = edge.ay + (edge.by - edge.ay) * t;
                const z = edge.az + (edge.bz - edge.az) * t;
                if (this.coversEdge(x, y, z)) {
                    if (!run) run = { x, y };
                    lastX = x;
                    lastY = y;
                } else {
                    flush();
                }
            }
            flush();
        }
        ctx.restore();
    }
}

function scaleVec(v: Vec3, scale: number): Vec3 {
    return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
}

function unitVec(v: Vec3): Vec3 {
    const length = Math.hypot(v.x, v.y, v.z) || 1;
    return scaleVec(v, 1 / length);
}

function quantizeNormal(v: Vec3): Vec3 {
    return unitVec({
        x: Math.round(v.x * 48) / 48,
        y: Math.round(v.y * 48) / 48,
        z: Math.round(v.z * 48) / 48
    });
}

function dotVec(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function rotateAround(v: Vec3, axis: Vec3, angle: number): Vec3 {
    const k = unitVec(axis);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const along = dotVec(v, k);
    const crossed = crossVec(k, v);
    return {
        x: v.x * cos + crossed.x * sin + k.x * along * (1 - cos),
        y: v.y * cos + crossed.y * sin + k.y * along * (1 - cos),
        z: v.z * cos + crossed.z * sin + k.z * along * (1 - cos)
    };
}

function faceCorners(normal: Vec3): [Vec3, Vec3, Vec3, Vec3] {
    const tangent = Math.abs(normal.x) < 0.5 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const u = unitVec(crossVec(normal, tangent));
    const v = crossVec(normal, u);
    const corner = (su: number, sv: number): Vec3 => ({
        x: normal.x + u.x * su + v.x * sv,
        y: normal.y + u.y * su + v.y * sv,
        z: normal.z + u.z * su + v.z * sv
    });
    return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

function pointInTri(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-6) return false;
    const w0 = ((b.x - p.x) * (c.y - p.y) - (b.y - p.y) * (c.x - p.x)) / area;
    const w1 = ((c.x - p.x) * (a.y - p.y) - (c.y - p.y) * (a.x - p.x)) / area;
    const w2 = 1 - w0 - w1;
    return w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02;
}

function frameLight(right: Vec3, forward: Vec3, up: Vec3, rightScale: number, forwardScale: number, upScale: number): Vec3 {
    return unitVec({
        x: right.x * rightScale + forward.x * forwardScale + up.x * upScale,
        y: right.y * rightScale + forward.y * forwardScale + up.y * upScale,
        z: right.z * rightScale + forward.z * forwardScale + up.z * upScale
    });
}

function coveredFaceEdges(mesh: Mesh): Set<string> {
    const { positions, indices } = mesh;
    interface Face {
        a: Vec3;
        b: Vec3;
        c: Vec3;
        bucket: string;
        ka: string;
        kb: string;
        kc: string;
    }
    const faces: Face[] = [];
    const buckets = new Map<string, number[]>();
    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index];
        const ib = indices[index + 1];
        const ic = indices[index + 2];
        if (ia === undefined || ib === undefined || ic === undefined) continue;
        const a = vertexAt(positions, ia);
        const b = vertexAt(positions, ib);
        const c = vertexAt(positions, ic);
        const normal = faceNormal(a, b, c);
        if (!normal) continue;
        const bucket = normalKey(normal);
        const face: Face = { a, b, c, bucket, ka: pointKey(a), kb: pointKey(b), kc: pointKey(c) };
        const list = buckets.get(bucket);
        if (list) list.push(faces.length);
        else buckets.set(bucket, [faces.length]);
        faces.push(face);
    }
    interface OpenEdge {
        count: number;
        a: Vec3;
        b: Vec3;
        bucket: string;
        left: string;
        right: string;
    }
    const edges = new Map<string, OpenEdge>();
    const remember = (face: Face, ka: string, a: Vec3, kb: string, b: Vec3): void => {
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const found = edges.get(key);
        if (found) found.count += 1;
        else edges.set(key, { count: 1, a, b, bucket: face.bucket, left: ka, right: kb });
    };
    for (const face of faces) {
        remember(face, face.ka, face.a, face.kb, face.b);
        remember(face, face.kb, face.b, face.kc, face.c);
        remember(face, face.kc, face.c, face.ka, face.a);
    }
    const covered = new Set<string>();
    for (const [key, edge] of edges) {
        if (edge.count !== 1) continue;
        const candidates = buckets.get(edge.bucket) ?? [];
        const opposite = buckets.get(oppositeNormalKey(edge.bucket));
        const list = opposite === undefined ? candidates : candidates.concat(opposite);
        for (const index of list) {
            const face = faces[index];
            if (!face) continue;
            if (ownsEdge(edge.left, edge.right, face.ka, face.kb)) continue;
            if (ownsEdge(edge.left, edge.right, face.kb, face.kc)) continue;
            if (ownsEdge(edge.left, edge.right, face.kc, face.ka)) continue;
            if (pointOnTriangle(edge.a, face.a, face.b, face.c) && pointOnTriangle(edge.b, face.a, face.b, face.c)) {
                covered.add(key);
                break;
            }
        }
    }
    return covered;
}

function vertexAt(positions: Float32Array, index: number): Vec3 {
    return {
        x: positions[index * 3] ?? 0,
        y: positions[index * 3 + 1] ?? 0,
        z: positions[index * 3 + 2] ?? 0
    };
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | undefined {
    const n = crossVec(
        { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
        { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
    );
    const length = Math.hypot(n.x, n.y, n.z);
    if (length < 1e-8) return undefined;
    return quantizeNormal({ x: n.x / length, y: n.y / length, z: n.z / length });
}

function normalKey(normal: Vec3): string {
    return `${Math.round(normal.x * 48)},${Math.round(normal.y * 48)},${Math.round(normal.z * 48)}`;
}

function oppositeNormalKey(key: string): string {
    return key.split(",").map((part) => String(-Number(part))).join(",");
}

function ownsEdge(left: string, right: string, ka: string, kb: string): boolean {
    return left === ka && right === kb || left === kb && right === ka;
}

function pointOnTriangle(point: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const ap = { x: point.x - a.x, y: point.y - a.y, z: point.z - a.z };
    const n = crossVec(ab, ac);
    const area2 = dotVec(n, n);
    if (area2 < 1e-10) return false;
    if (Math.abs(dotVec(ap, n)) / Math.sqrt(area2) > 0.05) return false;
    const wB = dotVec(crossVec(ap, ac), n) / area2;
    const wC = dotVec(crossVec(ab, ap), n) / area2;
    const wA = 1 - wB - wC;
    return wA >= -0.02 && wB >= -0.02 && wC >= -0.02;
}

function pointKey(point: { x: number; y: number; z: number }): string {
    // 0.05 units welds a BSP crack. A 3 mm wall and an 8 mm facet step stay apart.
    const scale = 20;
    return `${Math.round(point.x * scale)},${Math.round(point.y * scale)},${Math.round(point.z * scale)}`;
}

function edgeKey(a: MeshCorner, b: MeshCorner): string {
    const left = pointKey(a);
    const right = pointKey(b);
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function faceAxes(normal: Vec3): { u: Vec3; v: Vec3 } {
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);
    const base = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 }
        : ay <= az ? { x: 0, y: 1, z: 0 }
        : { x: 0, y: 0, z: 1 };
    const along = dotVec(base, normal);
    const u = unitVec({
        x: base.x - normal.x * along,
        y: base.y - normal.y * along,
        z: base.z - normal.z * along
    });
    return {
        u,
        v: {
            x: normal.y * u.z - normal.z * u.y,
            y: normal.z * u.x - normal.x * u.z,
            z: normal.x * u.y - normal.y * u.x
        }
    };
}

const GRAIN_SIZE = 128;
const GRAIN_MM = 64;

function wrap(value: number, size: number): number {
    const mod = value % size;
    return mod < 0 ? mod + size : mod;
}

function hash2(ix: number, iy: number, period: number): number {
    const x = ((ix % period) + period) % period;
    const y = ((iy % period) + period) % period;
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function periodicNoise(x: number, y: number, period: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2(x0, y0, period);
    const b = hash2(x0 + 1, y0, period);
    const c = hash2(x0, y0 + 1, period);
    const d = hash2(x0 + 1, y0 + 1, period);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function buildGrain(): Float32Array {
    const data = new Float32Array(GRAIN_SIZE * GRAIN_SIZE);
    for (let y = 0; y < GRAIN_SIZE; y++) {
        for (let x = 0; x < GRAIN_SIZE; x++) {
            const u = (x / GRAIN_SIZE) * 4;
            const v = (y / GRAIN_SIZE) * 4;
            const broad = periodicNoise(u, v, 4);
            const fine = periodicNoise(u * 4 + 1.7, v * 4 + 0.4, 16);
            const streak = periodicNoise(u * 8, v * 0.5 + 2.2, 4);
            data[y * GRAIN_SIZE + x] = broad * 0.62 + fine * 0.24 + streak * 0.14;
        }
    }
    return data;
}

const GRAIN = buildGrain();

function sampleGrain(u: number, v: number): number {
    const x = wrap(u / GRAIN_MM * GRAIN_SIZE, GRAIN_SIZE);
    const y = wrap(v / GRAIN_MM * GRAIN_SIZE, GRAIN_SIZE);
    const x0 = Math.floor(x) % GRAIN_SIZE;
    const y0 = Math.floor(y) % GRAIN_SIZE;
    const x1 = (x0 + 1) % GRAIN_SIZE;
    const y1 = (y0 + 1) % GRAIN_SIZE;
    const tx = x - Math.floor(x);
    const ty = y - Math.floor(y);
    const a = GRAIN[y0 * GRAIN_SIZE + x0] ?? 0;
    const b = GRAIN[y0 * GRAIN_SIZE + x1] ?? 0;
    const c = GRAIN[y1 * GRAIN_SIZE + x0] ?? 0;
    const d = GRAIN[y1 * GRAIN_SIZE + x1] ?? 0;
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
