import { Parser } from "./parser.js";
import { TypeInferenceEngine } from "./checker.js";
import { WebCodeGenerator } from "./codegen.js";

export interface CompilationResult {
    success: boolean;
    javascriptCode?: string;
    errorMessage?: string;
    coordinateSystem?: "Z-up" | "Y-up" | "X-up";
    /** The required setup name. Present on a successful compile. */
    name?: string;
}

export function compileParaScriptSource(source: string): CompilationResult {
    try {
        const parser = new Parser(source);
        const ast = parser.parse();
        const checker = new TypeInferenceEngine();
        checker.inferProgram(ast);
        const generator = new WebCodeGenerator();
        return {
            success: true,
            javascriptCode: generator.generate(ast),
            coordinateSystem: ast.setup.coordinateSystem,
            name: ast.setup.name
        };
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown Compilation System Fault.";
        return {
            success: false,
            errorMessage
        };
    }
}
