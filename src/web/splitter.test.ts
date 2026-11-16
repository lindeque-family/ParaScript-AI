import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPaneSize, paneSizeFromPointer } from "./splitter.js";

test("the splitter follows the pointer and keeps both panes usable", () => {
    assert.equal(paneSizeFromPointer({ start: 0, end: 1000, splitter: 10, pointer: 500, min: 180 }), 495);
    assert.equal(paneSizeFromPointer({ start: 100, end: 1100, splitter: 10, pointer: 150, min: 180 }), 180);
    assert.equal(paneSizeFromPointer({ start: 0, end: 1000, splitter: 10, pointer: 990, min: 180 }), 810);
    assert.equal(clampPaneSize(400, 200, 20, 180), 90);
});
