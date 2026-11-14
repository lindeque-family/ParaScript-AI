// ============================================================================
// PARASCRIPT AI LAZY STREAMING PARSER CORE (v12.8.0)
// ============================================================================

export type TokenType =

    | "SETUP" | "PARAM" | "DEF" | "FN" | "COMPONENT" | "EXPORT" | "EXPOSE" | "RETURN" | "TRUE" | "FALSE"
    | "MATCH" | "IDENTIFIER" | "FLOAT" | "STRING"
    | "EQUALS" | "PIPE" | "ARROW" | "COLON" | "CONS" | "COMMA" | "DOT"
    | "PLUS" | "MINUS" | "STAR" | "SLASH" | "CARET"
    | "LPAREN" | "RPAREN" | "LBRACE" | "RBRACE" | "LBRACKET" | "RBRACKET"
    | "EOF";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    char: number;
}

import type {
    ASTNode,
    Program,
    SetupBlock,
    ComponentDeclaration,
    ExportStatement,
    ExposeBlock,
    ExposeProperty,
    ExpressionNode,
    Identifier,
    SmoothOperator,
    NamedArgumentDeclaration,
    NamedArgument,
    ArrayMatchStatement,
    Curve1DNode,
    JoinDomain,
    LambdaExpression,
    Surface2DNode,
    Solid3DNode
} from "./ast.js";

// ============================================================================
// 1. GENERATOR LEXER IMPLEMENTATION
// ============================================================================

export class Lexer {
    private source: string;
    private cursor: number = 0;
    private line: number = 1;
    private char: number = 1;

    constructor(source: string) {
        this.source = source;
    }

    private peek(): string {
        if (this.cursor >= this.source.length) return "";
        return this.source[this.cursor] || "";
    }

    private advance(): string {
        const next = this.source[this.cursor] || "";
        this.cursor++;
        if (next === "\n") {
            this.line++;
            this.char = 1;
        } else {
            this.char++;
        }
        return next;
    }

    public *tokenizeStream(): Generator<Token, Token, unknown> {
        while (this.cursor < this.source.length) {
            const current = this.peek();

            if (/\s/.test(current)) {
                this.advance();
                continue;
            }

            if (current === "/" && (this.source[this.cursor + 1] || "") === "/") {
                while (this.peek() !== "\n" && this.peek() !== "") {
                    this.advance();
                }
                continue;
            }

            const startLine = this.line;
            const startChar = this.char;

            if (current === ">" && (this.source[this.cursor + 1] || "") === ">") {
                this.advance(); this.advance();
                yield { type: "PIPE", value: ">>", line: startLine, char: startChar };
                continue;
            }
            if (current === "=" && (this.source[this.cursor + 1] || "") === ">") {
                this.advance(); this.advance();
                yield { type: "ARROW", value: "=>", line: startLine, char: startChar };
                continue;
            }
            if (current === ":" && (this.source[this.cursor + 1] || "") === ":") {
                this.advance(); this.advance();
                yield { type: "CONS", value: "::", line: startLine, char: startChar };
                continue;
            }

            if (current === "=") { this.advance(); yield { type: "EQUALS", value: "=", line: startLine, char: startChar }; continue; }
            if (current === ":") { this.advance(); yield { type: "COLON", value: ":", line: startLine, char: startChar }; continue; }
            if (current === ",") { this.advance(); yield { type: "COMMA", value: ",", line: startLine, char: startChar }; continue; }
            if (current === "+") { this.advance(); yield { type: "PLUS", value: "+", line: startLine, char: startChar }; continue; }
            if (current === "-") { this.advance(); yield { type: "MINUS", value: "-", line: startLine, char: startChar }; continue; }
            if (current === "*") { this.advance(); yield { type: "STAR", value: "*", line: startLine, char: startChar }; continue; }
            if (current === "/") { this.advance(); yield { type: "SLASH", value: "/", line: startLine, char: startChar }; continue; }
            if (current === "^") { this.advance(); yield { type: "CARET", value: "^", line: startLine, char: startChar }; continue; }
            if (current === "(") { this.advance(); yield { type: "LPAREN", value: "(", line: startLine, char: startChar }; continue; }
            if (current === ")") { this.advance(); yield { type: "RPAREN", value: ")", line: startLine, char: startChar }; continue; }
            if (current === "{") { this.advance(); yield { type: "LBRACE", value: "{", line: startLine, char: startChar }; continue; }
            if (current === "}") { this.advance(); yield { type: "RBRACE", value: "}", line: startLine, char: startChar }; continue; }
            if (current === "[") { this.advance(); yield { type: "LBRACKET", value: "[", line: startLine, char: startChar }; continue; }
            if (current === "]") { this.advance(); yield { type: "RBRACKET", value: "]", line: startLine, char: startChar }; continue; }

            if (current === '"') {
                this.advance();
                let strVal = "";
                while (this.peek() !== '"' && this.peek() !== "") {
                    strVal += this.advance();
                }
                this.advance();
                yield { type: "STRING", value: strVal, line: startLine, char: startChar };
                continue;
            }

            if (/[0-9]/.test(current) || (current === "." && /[0-9]/.test(this.source[this.cursor + 1] || ""))) {
                let numStr = "";
                while (/[0-9.]/.test(this.peek())) {
                    numStr += this.advance();
                }
                yield { type: "FLOAT", value: numStr, line: startLine, char: startChar };
                continue;
            }

            if (current === ".") {
                this.advance();
                yield { type: "DOT", value: ".", line: startLine, char: startChar };
                continue;
            }

            if (/[a-zA-Z_]/.test(current)) {
                let idStr = "";
                while (/[a-zA-Z0-9_]/.test(this.peek())) {
                    idStr += this.advance();
                }

                const keywordMap: Record<string, TokenType> = {
                    setup: "SETUP", param: "PARAM", def: "DEF", fn: "FN",
                    component: "COMPONENT", export: "EXPORT", expose: "EXPOSE", return: "RETURN",
                    true: "TRUE", false: "FALSE", match: "MATCH"
                };

                const mappedType = keywordMap[idStr];
                if (mappedType) {
                    yield { type: mappedType, value: idStr, line: startLine, char: startChar };
                } else {
                    yield { type: "IDENTIFIER", value: idStr, line: startLine, char: startChar };
                }
                continue;
            }

            throw new Error(`Lexer Error: Unrecognized character token '${current}' at line ${this.line}, col ${this.char}`);
        }

        return { type: "EOF", value: "", line: this.line, char: this.char };
    }
}

// ============================================================================
// 2. PARSER ENGINE IMPLEMENTATION
// ============================================================================

export class Parser {
    private tokenStream: Generator<Token, Token, unknown>;
    private currentToken: Token;

    constructor(source: string) {
        const lexer = new Lexer(source);
        this.tokenStream = lexer.tokenizeStream();
        this.currentToken = this.tokenStream.next().value;
    }

    private peek(): Token {
        return this.currentToken;
    }

    private advance(): Token {
        const previous = this.currentToken;
        const nextResult = this.tokenStream.next();
        this.currentToken = nextResult.value;
        return previous;
    }

    private match(type: TokenType): boolean {
        if (this.peek().type === type) {
            this.advance();
            return true;
        }
        return false;
    }

    private consume(type: TokenType, errorMsg: string): Token {
        if (this.peek().type === type) {
            return this.advance();
        }
        const tok = this.peek();
        throw new Error(`Parser Error: ${errorMsg} (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
    }

    public parse(): Program {
        this.consume("SETUP", "Scripts must initiate with a global configuration 'setup' block.");
        const setup = this.parseSetupBlock();

        const body: Array<ASTNode> = [];
        while (this.peek().type !== "EOF") {
            body.push(this.parseStructuralStatement());
        }

        return { type: "Program", setup, body };
    }

    private parseSetupBlock(): SetupBlock {
        this.consume("LBRACE", "Expected '{' to encapsulate setup conditions.");

        let units: "mm" | "inch" = "mm";
        let coordinateSystem: "Z-up" | "Y-up" | "X-up" = "Z-up";

        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const key = this.consume("IDENTIFIER", "Expected property layout identifier key in setup.").value;
            this.consume("COLON", "Expected ':' configuration splitter.");

            if (key === "units") {
                const uVal = this.consume("STRING", "Units must be declared as a string.").value;
                if (uVal === "mm" || uVal === "inch") units = uVal;
            } else if (key === "coordinate_system") {
                const cVal = this.consume("STRING", "Coordinate system orientation must be a string.").value;
                if (cVal === "Z-up" || cVal === "Y-up" || cVal === "X-up") coordinateSystem = cVal;
            }
            if (this.peek().type === "COMMA") this.advance();
        }

        this.consume("RBRACE", "Expected '}' to seal configuration limits.");
        return { type: "SetupBlock", units, coordinateSystem };
    }

    private parseStructuralStatement(): ASTNode {
        const tok = this.peek();
        if (tok.type === "PARAM") {
            this.advance();
            const name = this.parseIdentifier();
            this.consume("EQUALS", "Expected '=' following param allocation.");
            const value = this.parseExpression();
            return { type: "ParamDeclaration", name, value: value as any };
        }
        if (tok.type === "DEF") {
            this.advance();
            const name = this.parseIdentifier();
            this.consume("EQUALS", "Expected '=' following def allocation.");
            const value = this.parseExpression();
            return { type: "VariableDeclaration", name, value: value as any };
        }
        if (tok.type === "COMPONENT") {
            return this.parseComponentDeclaration();
        }
        if (tok.type === "EXPORT") {
            return this.parseExportStatement();
        }
        return this.parseExpression();
    }
    private parseExportStatement(): ExportStatement {
        this.advance();
        this.consume("LPAREN", "Expected '(' after export.");
        const value = this.parseExpression();
        this.consume("RPAREN", "Expected ')' after the exported value.");
        return { type: "ExportStatement", value };
    }
    private parseComponentDeclaration(): ComponentDeclaration {
        this.advance(); // consume component keyword
        const name = this.parseIdentifier();
        this.consume("LPAREN", "Expected open parameter envelope '(' for component mapping.");
        const parameters: Array<NamedArgumentDeclaration> = [];
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const pName = this.parseIdentifier();
            this.consume("COLON", "Expected ':' type notation splitter.");
            const tAnnot = this.consume("IDENTIFIER", "Expected explicit nominal topological type token.").value;
            parameters.push({
                type: "NamedArgument",
                name: pName,
                typeAnnotation: tAnnot as any
            });
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected close parameter layout block ')'.");
        this.consume("LBRACE", "Expected open structural block token '{'.");
        const body: Array<ASTNode> = [];
        let rootGeometry: ExpressionNode | null = null;
        let expose: ExposeBlock | null = null;
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            if (this.peek().type === "EXPOSE") {
                expose = this.parseExposeBlock();
            } else if (
                this.peek().type === "IDENTIFIER" &&
                ["Solid3D", "Cube", "Sphere", "Surface2D", "Curve1D", "join"].includes(this.peek().value)
            ) {
                rootGeometry = this.parseExpression();
            } else {
                body.push(this.parseStructuralStatement());
            }
        }
        this.consume("RBRACE", "Expected close structural envelope block '}'.");
        if (!rootGeometry) {
            throw new Error("Parser Error: Components must evaluate exactly one active baseline geometry root node.");
        }
        if (!expose) {
            throw new Error("Parser Error: Components must export an explicit 'expose' interface block layout.");
        }
        return { type: "ComponentDeclaration", name, parameters, body, rootGeometry, expose };
    }
    private parseExposeBlock(): ExposeBlock {
        this.advance();
        this.consume("LBRACE", "Expected open bracket '{' for interface exposure properties.");
        const properties: Array<ExposeProperty> = [];
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const name = this.parseIdentifier();
            this.consume("COLON", "Expected property reference mapping notation operator ':'.");
            const value = this.parseExpression();
            properties.push({ type: "ExposeProperty", name, value });
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RBRACE", "Expected close block '}' for exposed properties.");
        return { type: "ExposeBlock", properties };
    }
    private parseExpression(): ExpressionNode {
        return this.parsePipeExpression();
    }
    private parsePipeExpression(): ExpressionNode {
        let expr = this.parseConsExpression();
        while (this.match("PIPE")) {
            const rhs = this.parsePrimary();
            if (rhs.type !== "CallExpression") {
                throw new Error("Parser Error: The destination layout block downstream of a Pipe '>>' must evaluate into a function CallExpression.");
            }
            expr = {
                type: "PipeExpression",
                leftHandSide: expr,
                rightHandSide: rhs
            };
        }
        return expr;
    }
    private parseConsExpression(): ExpressionNode {
        let expr = this.parseAdditive();
        while (this.match("CONS")) {
            const right = this.parseConsExpression();
            expr = {
                type: "BinaryExpression",
                operator: "::",
                left: expr,
                right
            };
        }
        return expr;
    }
    private parseAdditive(): ExpressionNode {
        let expr = this.parseMultiplicative();
        while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
            const op = this.advance().value as SmoothOperator;
            const right = this.parseMultiplicative();
            expr = { type: "BinaryExpression", operator: op, left: expr, right };
        }
        return expr;
    }
    private parseMultiplicative(): ExpressionNode {
        let expr = this.parseExponential();
        while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
            const op = this.advance().value as SmoothOperator;
            const right = this.parseExponential();
            expr = { type: "BinaryExpression", operator: op, left: expr, right };
        }
        return expr;
    }
    private parseExponential(): ExpressionNode {
        let expr = this.parsePrimary();
        while (this.match("CARET")) {
            const right = this.parsePrimary();
            expr = { type: "BinaryExpression", operator: "^", left: expr, right };
        }
        return expr;
    }
    private parsePrimary(): ExpressionNode {
        return this.parsePostfix(this.parseAtom());
    }

    private parsePostfix(expr: ExpressionNode): ExpressionNode {
        while (this.match("DOT")) {
            const property = this.consume("IDENTIFIER", "Expected an anchor name.").value;
            expr = { type: "MemberExpression", object: expr, property };
        }
        return expr;
    }

    private parseAtom(): ExpressionNode {
        const tok = this.peek();
        if (tok.type === "MATCH") {
            return this.parseArrayMatchExpression();
        }
        if (tok.type === "IDENTIFIER") {
            if (tok.value === "join") {
                this.advance();
                if (this.peek().type === "LPAREN") return this.parseJoinDomain();
                const id: Identifier = { type: "Identifier", name: "join" };
                if (this.peek().type === "ARROW") {
                    this.advance();
                    return { type: "LambdaExpression", parameter: id, body: this.parseExpression() };
                }
                return id;
            }
            if (tok.value === "Vector") {
                this.advance();
                this.consume("LPAREN", "Vector coordinates must wrap inner values inside parenthesis.");
                this.consume("IDENTIFIER", "Expected axis label key 'x'."); this.consume("COLON", ": separator");
                const x = this.parseExpression(); this.consume("COMMA", ", step separator");
                this.consume("IDENTIFIER", "Expected axis label key 'y'."); this.consume("COLON", ": separator");
                const y = this.parseExpression(); this.consume("COMMA", ", step separator");
                this.consume("IDENTIFIER", "Expected axis label key 'z'."); this.consume("COLON", ": separator");
                const z = this.parseExpression();
                this.consume("RPAREN", "Expected closing tuple parenthesis.");
                return { 
                    type: "VectorLiteral", 
                    x,
                    y,
                    z
                };
            }
            if (tok.value === "Curve1D") { this.advance(); return this.parseCurve1DNode(); }
            if (tok.value === "Surface2D") { this.advance(); return this.parseSurface2DNode(); }
            if (tok.value === "Solid3D") { this.advance(); return this.parseSolid3DNode(); }
            const id = this.parseIdentifier();
            if (this.peek().type === "ARROW") {
                this.advance();
                const body = this.parseExpression();
                return { type: "LambdaExpression", parameter: id, body };
            }
            if (this.peek().type === "LPAREN") {
                this.advance();
                const args = this.parseCallArguments();
                this.consume("RPAREN", "Expected closing parenthesis for function execution.");
                return { type: "CallExpression", callee: id, arguments: args };
            }
            return id;
        }
        if (tok.type === "FLOAT") {
            this.advance();
            return { type: "FloatLiteral", value: parseFloat(tok.value) };
        }
        if (tok.type === "STRING") {
            this.advance();
            return { type: "StringLiteral", value: tok.value };
        }
        if (tok.type === "LBRACKET") {
            this.advance();
            const elements: Array<ExpressionNode> = [];
            while (this.peek().type !== "RBRACKET" && this.peek().type !== "EOF") {
                elements.push(this.parseExpression());
                if (this.peek().type === "COMMA") this.advance();
            }
            this.consume("RBRACKET", "Expected closing bracket ']' for array literal.");
            return { type: "ArrayLiteral", elements };
        }
        if (tok.type === "LPAREN") {
            this.advance();
            const expr = this.parseExpression();
            this.consume("RPAREN", "Mismatched expression parenthesis grouping closure.");
            return expr;
        }
        throw new Error(`Parser Error: Encountered unexpected token element entry '${tok.value}' during active execution parsing loop at line ${tok.line}`);
    }
    private parseJoinDomain(): JoinDomain {
        this.consume("LPAREN", "Expected '(' after join.");
        let fixed: ExpressionNode | null = null;
        let moving: ExpressionNode | null = null;
        let using: ExpressionNode | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const nameTok = this.consume("IDENTIFIER", "Expected a join argument name.");
            this.consume("COLON", "Expected named argument designation operator ':'.");
            const value = this.parseExpression();
            if (nameTok.value === "fixed" && !fixed) fixed = value;
            else if (nameTok.value === "moving" && !moving) moving = value;
            else if (nameTok.value === "using" && !using) using = value;
            else {
                throw new Error(`Parser Error: join accepts fixed, moving, and using. (Found '${nameTok.value}' at line ${nameTok.line}, col ${nameTok.char})`);
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected ')' after join arguments.");
        if (!fixed || !moving || !using) {
            const tok = this.peek();
            throw new Error(`Parser Error: join needs fixed, moving, and using. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        if (this.peek().type !== "LBRACE") {
            const tok = this.peek();
            throw new Error(`Parser Error: join domain needs a body. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        this.advance();
        const body: Array<ASTNode> = [];
        let result: ExpressionNode | null = null;
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const kind = this.peek().type;
            if (kind === "DEF" || kind === "PARAM" || kind === "COMPONENT" || kind === "EXPORT") {
                body.push(this.parseStructuralStatement());
                continue;
            }
            const expr = this.parseExpression();
            if (this.peek().type === "RBRACE" || this.peek().type === "EOF") {
                result = expr;
                break;
            }
            body.push(expr);
        }
        if (!result) {
            const tok = this.peek();
            const message = body.length === 0 ? "join domain needs a body" : "join domain needs a result";
            throw new Error(`Parser Error: ${message}. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        this.consume("RBRACE", "Expected '}' to close the join domain.");
        return { type: "JoinDomain", fixed, moving, using, body, result };
    }
    private parseArrayMatchExpression(): ArrayMatchStatement {
        this.consume("MATCH", "Expected 'match' keyword initiation sequence.");
        const targetArray = this.parseExpression();
        this.consume("LBRACE", "Expected open layout block '{' enclosing pattern branches.");
        this.consume("LBRACKET", "Expected open bracket '[' for empty match branch condition.");
        this.consume("RBRACKET", "Expected close bracket ']' matching empty pattern.");
        this.consume("ARROW", "Expected '=>' branch consequence execution tracker.");
        const onEmpty = this.parseExpression();
        this.consume("COMMA", "Expected ',' separating matching branches.");
        const headIdentifier = this.parseIdentifier();
        this.consume("CONS", "Expected '::' structural split operator splitting head from tail.");
        const tailIdentifier = this.parseIdentifier();
        this.consume("ARROW", "Expected '=>' branch split consequence logic mapping.");
        const onSplit = this.parseExpression();
        this.consume("RBRACE", "Expected close frame block '}' sealing array destructuring constraints.");
        return {
            type: "ArrayMatchStatement",
            targetArray,
            onEmpty,
            headIdentifier,
            tailIdentifier,
            onSplit
        };
    }
    private parseCurve1DNode(): Curve1DNode {
        this.consume("LPAREN", "Expected open parenthesis for Curve1D specification.");
        let maxT: ExpressionNode | null = null;
        let formula: LambdaExpression | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const key = this.consume("IDENTIFIER", "Expected key in Curve1D initialization.").value;
            this.consume("COLON", "Expected ':' separation boundary.");
            if (key === "max_t") maxT = this.parseExpression();
            else if (key === "formula") formula = this.parseExpression() as LambdaExpression;
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected close parenthesis mapping Curve1D profile boundary.");
        if (!maxT || !formula) {
            throw new Error("Parser Error: Curve1D primitives require continuous fields for both 'max_t' and 'formula' equations.");
        }
        return { type: "Curve1DNode", maxT, formula };
    }
    private parseSurface2DNode(): Surface2DNode {
        this.consume("LPAREN", "Expected open parameter envelope tracking Surface2D generation constraints.");
        let maxU: ExpressionNode | null = null;
        let maxV: LambdaExpression | null = null;
        let formula: LambdaExpression | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const key = this.consume("IDENTIFIER", "Expected variable mapping key in Surface2D initialization.").value;
            this.consume("COLON", "Expected ':' parameter split notation mapping.");
            if (key === "max_u") maxU = this.parseExpression();
            else if (key === "max_v") maxV = this.parseExpression() as LambdaExpression;
            else if (key === "formula") formula = this.parseExpression() as LambdaExpression;
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected close envelope layout bounding surface parameters.");
        if (!maxU || !maxV || !formula) {
            throw new Error("Parser Error: Surface2D primitives require fields mapping 'max_u', a dynamic 'max_v' lambda boundary region function, and a continuous spatial mapping 'formula' equation logic.");
        }
        return { type: "Surface2DNode", maxU, maxV, formula };
    }
    private parseSolid3DNode(): Solid3DNode {
        this.consume("LPAREN", "Expected open parenthesis for Solid3D specification.");
        this.consume("IDENTIFIER", "Expected 'faces' keyword in Solid3D constructor.");
        this.consume("COLON", "Expected ':' separator.");
        const faces = this.parseExpression();
        this.consume("RPAREN", "Expected close parenthesis for Solid3D constructor.");
        return { type: "Solid3DNode", faces };
    }
    private parseCallArguments(): NamedArgument[] {
        const args: NamedArgument[] = [];
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const name = this.parseIdentifier();
            if (this.match("ARROW")) {
                const body = this.parseExpression();
                args.push({
                    type: "NamedArgument",
                    name,
                    value: { type: "LambdaExpression", parameter: name, body }
                });
            } else {
                this.consume("COLON", "Expected named argument designation operator ':'.");
                const value = this.parseExpression();
                args.push({ type: "NamedArgument", name, value });
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        return args;
    }
    private parseIdentifier(): Identifier {
        const tok = this.consume("IDENTIFIER", "Expected a lowercase snake_case identifier variable label mapping context.");
        return { type: "Identifier", name: tok.value };
    }
}