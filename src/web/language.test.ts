import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileParaScriptSource } from "../parascript/compile.js";
import { evaluateModelModule, modelMesh } from "./model.js";

test("language reference examples compile and mesh", async () => {
    const markdown = readFileSync(fileURLToPath(new URL("../../src/web/language.md", import.meta.url)), "utf8");
    const examples = [...markdown.matchAll(/```parascript\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
    const files = ["sphere", "box", "broom", "plate", "screw", "remote", "car", "desk-set", "m"];
    const scripts = files.map((name) => readFileSync(fileURLToPath(new URL(`../../examples/${name}.psai`, import.meta.url)), "utf8"));
    assert.equal(examples.length, scripts.length);
    for (const script of scripts) assert.ok(examples.includes(script));
    for (const source of examples) {
        const result = compileParaScriptSource(source);
        assert.equal(result.success, true, result.errorMessage ?? source.slice(0, 120));
        const mesh = modelMesh(await evaluateModelModule(result.javascriptCode ?? ""));
        assert.ok(mesh.indices.length > 0);
    }
});
