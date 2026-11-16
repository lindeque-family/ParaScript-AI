export interface SplitterPointer {
    /** Leading edge of the script pane. */
    readonly start: number;
    /** Trailing edge of the workspace, after the model pane. */
    readonly end: number;
    readonly splitter: number;
    readonly pointer: number;
    readonly min: number;
}

/** Keep both panes at least `min` pixels, shrinking that floor when the workspace is smaller. */
export function clampPaneSize(size: number, span: number, splitter: number, min: number): number {
    const usable = Math.max(0, span - splitter);
    const floor = Math.min(Math.max(0, min), usable / 2);
    return Math.max(floor, Math.min(usable - floor, size));
}

/** Script-pane size that puts the pointer on the middle of the splitter. */
export function paneSizeFromPointer(measure: SplitterPointer): number {
    return clampPaneSize(
        measure.pointer - measure.start - measure.splitter / 2,
        measure.end - measure.start,
        measure.splitter,
        measure.min
    );
}
