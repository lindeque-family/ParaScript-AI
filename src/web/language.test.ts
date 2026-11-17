import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileParaScriptSource } from "../parascript/compile.js";
import { evaluateModelModule, modelMesh } from "./model.js";

test("language reference examples compile and mesh", async () => {
    const markdown = readFileSync(fileURLToPath(new URL("../../src/web/language.md", import.meta.url)), "utf8");
    const examples = [...markdown.matchAll(/```parascript\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
    const sphere = readFileSync(fileURLToPath(new URL("../../examples/sphere.psai", import.meta.url)), "utf8");
    const broom = readFileSync(fileURLToPath(new URL("../../examples/broom.psai", import.meta.url)), "utf8");
    const plate = readFileSync(fileURLToPath(new URL("../../examples/plate.psai", import.meta.url)), "utf8");
    assert.equal(examples.length, 5);
    assert.ok(examples.includes(sphere));
    assert.ok(examples.includes(broom));
    assert.ok(examples.includes(plate));
    for (const source of examples) {
        const result = compileParaScriptSource(source);
        assert.equal(result.success, true, result.errorMessage ?? source.slice(0, 120));
        const mesh = modelMesh(await evaluateModelModule(result.javascriptCode ?? ""));
        assert.ok(mesh.indices.length > 0);
    }
});
