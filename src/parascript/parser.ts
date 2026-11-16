// ============================================================================
// PARASCRIPT AI LAZY STREAMING PARSER CORE (v12.8.0)
// ============================================================================

export type TokenType =

    | "SETUP" | "PARAM" | "DEF" | "FN" | "EXPORT" | "RETURN" | "TRUE" | "FALSE"
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
    ComponentExpression,
    ExportStatement,
    ExposeBlock,
    ExposeProperty,
    ExpressionNode,
    Identifier,
    SmoothOperator,
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
                    export: "EXPORT", return: "RETURN",
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
    private parseComponentExpression(): ComponentExpression {
        this.consume("LPAREN", "Expected '(' after Component.");
        let solid: ExpressionNode | null = null;
        let expose: ExposeBlock | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const nameTok = this.consume("IDENTIFIER", "Expected a Component argument name.");
            this.consume("COLON", "Expected named argument designation operator ':'.");
            if (nameTok.value === "solid" && !solid) {
                solid = this.parseExpression();
            } else if (nameTok.value === "expose" && !expose) {
                if (this.peek().type !== "LBRACE") {
                    const tok = this.peek();
                    throw new Error(`Parser Error: Component expose is a block of anchors. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
                }
                expose = this.parseAnchorBlock();
            } else {
                throw new Error(`Parser Error: Component accepts solid and expose. (Found '${nameTok.value}' at line ${nameTok.line}, col ${nameTok.char})`);
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected ')' after Component arguments.");
        if (!solid || !expose) {
            const tok = this.peek();
            throw new Error(`Parser Error: Component needs solid and expose. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        return { type: "ComponentExpression", solid, expose };
    }
    private parseAnchorBlock(): ExposeBlock {
        this.consume("LBRACE", "Expected '{' to open the expose block.");
        const properties: Array<ExposeProperty> = [];
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const name = this.parseIdentifier();
            this.consume("COLON", "Expected property reference mapping notation operator ':'.");
            const value = this.parseExpression();
            properties.push({ type: "ExposeProperty", name, value });
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RBRACE", "Expected '}' to close the expose block.");
        return { type: "ExposeBlock", properties };
    }
    private parseExpression(): ExpressionNode {
        return this.parsePipeExpression();
    }
    private parsePipeExpression(): ExpressionNode {
        let expr = this.parseConsExpression();
        while (this.match("PIPE")) {
            const right = this.parseConsExpression();
            expr = { type: "ComposeExpression", left: expr, right };
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
            if (tok.value === "Component") {
                this.advance();
                if (this.peek().type === "LPAREN") return this.parseComponentExpression();
                const id: Identifier = { type: "Identifier", name: "Component" };
                if (this.peek().type === "ARROW") {
                    this.advance();
                    return { type: "LambdaExpression", parameter: id, body: this.parseExpression() };
                }
                return id;
            }
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
        let frame: ExpressionNode | null = null;
        let placed: ExpressionNode | null = null;
        let using: ExpressionNode | null = null;
        let combine: ExpressionNode | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const nameTok = this.consume("IDENTIFIER", "Expected a join argument name.");
            this.consume("COLON", "Expected named argument designation operator ':'.");
            const value = this.parseExpression();
            if (nameTok.value === "frame" && !frame) frame = value;
            else if (nameTok.value === "placed" && !placed) placed = value;
            else if (nameTok.value === "using" && !using) using = value;
            else if (nameTok.value === "combine" && !combine) combine = value;
            else {
                throw new Error(`Parser Error: join accepts frame, placed, using, and combine. (Found '${nameTok.value}' at line ${nameTok.line}, col ${nameTok.char})`);
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected ')' after join arguments.");
        if (!frame || !placed || !using || !combine) {
            const tok = this.peek();
            throw new Error(`Parser Error: join needs frame, placed, using, and combine. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        return { type: "JoinDomain", frame, placed, using, combine };
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
        let minV: LambdaExpression | null = null;
        let maxV: LambdaExpression | null = null;
        let formula: LambdaExpression | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const keyTok = this.consume("IDENTIFIER", "Expected variable mapping key in Surface2D initialization.");
            const key = keyTok.value;
            this.consume("COLON", "Expected ':' parameter split notation mapping.");
            if (key === "max_u") maxU = this.parseExpression();
            else if (key === "min_v") minV = this.parseExpression() as LambdaExpression;
            else if (key === "max_v") maxV = this.parseExpression() as LambdaExpression;
            else if (key === "formula") formula = this.parseExpression() as LambdaExpression;
            else {
                throw new Error(`Parser Error: Surface2D accepts max_u, min_v, max_v, and formula. (Found '${key}' at line ${keyTok.line}, col ${keyTok.char})`);
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected close envelope layout bounding surface parameters.");
        if (!maxU || !minV || !maxV || !formula) {
            const tok = this.peek();
            throw new Error(`Parser Error: Surface2D needs max_u, min_v, max_v, and formula. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        return { type: "Surface2DNode", maxU, minV, maxV, formula };
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