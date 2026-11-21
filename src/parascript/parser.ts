// ============================================================================
// PARASCRIPT AI LAZY STREAMING PARSER CORE (v12.8.0)
// ============================================================================

export type TokenType =

    | "SETUP" | "PARAMETERS" | "PARAM" | "DEF" | "FN" | "EXPORT" | "RETURN" | "TRUE" | "FALSE"
    | "LET" | "IN"
    | "PARAMETER"
    | "MATCH" | "IDENTIFIER" | "FLOAT" | "STRING"
    | "EQUALS" | "PIPE" | "PIPE_FORWARD" | "ARROW" | "COLON" | "CONS" | "COMMA" | "DOT"
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
    BaseNode,
    Program,
    SetupBlock,
    ParametersBlock,
    ParameterEntry,
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
    LetPattern,
    Surface2DNode,
    Solid3DNode,
    TypeNode
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

            if (current === "|" && (this.source[this.cursor + 1] || "") === ">") {
                this.advance(); this.advance();
                yield { type: "PIPE_FORWARD", value: "|>", line: startLine, char: startChar };
                continue;
            }
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

            if (current === "$") {
                this.advance();
                if (!/[a-zA-Z_]/.test(this.peek())) {
                    throw new Error(`Lexer Error: Expected a parameter name after '$' at line ${this.line}, col ${this.char}`);
                }
                let idStr = "";
                while (/[a-zA-Z0-9_]/.test(this.peek())) {
                    idStr += this.advance();
                }
                yield { type: "PARAMETER", value: idStr, line: startLine, char: startChar };
                continue;
            }

            if (/[a-zA-Z_]/.test(current)) {
                let idStr = "";
                while (/[a-zA-Z0-9_]/.test(this.peek())) {
                    idStr += this.advance();
                }

                const keywordMap: Record<string, TokenType> = {
                    setup: "SETUP", parameters: "PARAMETERS", param: "PARAM", def: "DEF", fn: "FN",
                    export: "EXPORT", return: "RETURN", let: "LET", in: "IN",
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

    private place<T extends BaseNode>(token: Token, node: T): T {
        return Object.assign(node, { line: token.line, column: token.char });
    }

    private placeAt<T extends BaseNode>(source: BaseNode, node: T): T {
        if (source.line === undefined || source.column === undefined) return node;
        return Object.assign(node, { line: source.line, column: source.column });
    }

    public parse(): Program {
        this.consume("SETUP", "Scripts must initiate with a global configuration 'setup' block.");
        const setup = this.parseSetupBlock();
        const parameters = this.peek().type === "PARAMETERS" ? this.parseParametersBlock() : null;

        const body: Array<ASTNode> = [];
        while (this.peek().type !== "EOF") {
            body.push(this.parseStructuralStatement());
        }

        return { type: "Program", setup, parameters, body };
    }

    /** `parameters { plate: { size: 100.0 } }`. A `{` after the colon is a nested group. */
    private parseParametersBlock(): ParametersBlock {
        this.consume("PARAMETERS", "Expected 'parameters'.");
        this.consume("LBRACE", "Expected '{' to open parameters.");
        const entries = this.parseParameterEntries();
        this.consume("RBRACE", "Expected '}' to close parameters.");
        return { type: "ParametersBlock", entries };
    }

    private parseParameterEntries(): Array<ParameterEntry> {
        const entries: Array<ParameterEntry> = [];
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const name = this.parseIdentifier();
            this.consume("COLON", "Expected ':' after the parameter name.");
            if (this.peek().type === "LBRACE") {
                this.advance();
                const nested = this.parseParameterEntries();
                this.consume("RBRACE", "Expected '}' to close the parameter group.");
                entries.push({ type: "ParameterGroup", name, entries: nested });
            } else {
                entries.push({ type: "ParameterField", name, value: this.parseExpression() });
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        return entries;
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
        if (tok.type === "PARAMETERS") {
            throw new Error(`Parser Error: parameters belongs after setup. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        if (tok.type === "PARAM") {
            this.advance();
            return this.parseDefinition("ParamDeclaration");
        }
        if (tok.type === "DEF") {
            this.advance();
            return this.parseDefinition("VariableDeclaration");
        }
        if (tok.type === "EXPORT") {
            return this.parseExportStatement();
        }
        return this.parseExpression();
    }
    private parseDefinition(kind: "ParamDeclaration" | "VariableDeclaration"): ASTNode {
        const name = this.parseIdentifier();
        const signature = this.match("COLON") ? this.parseType() : undefined;
        this.consume("EQUALS", "Expected '=' following the definition.");
        const value = this.parseExpression() as ExpressionNode;
        if (kind === "ParamDeclaration") {
            return signature ? { type: kind, name, value, signature } : { type: kind, name, value };
        }
        return signature ? { type: kind, name, value, signature } : { type: kind, name, value };
    }

    /** A signature. `T => T => number` shares one variable across both parameters. */
    private parseType(): TypeNode {
        const parsed = this.parseFunctionType();
        if (parsed.type === "NamedParameter") {
            const tok = this.peek();
            throw new Error(`Parser Error: Expected '=>' after the parameter type. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        return parsed;
    }

    private parseFunctionType(): TypeNode {
        const left = this.parseTypeAtom();
        if (left.type === "TypeName" && this.match("COLON")) {
            const parameter = this.parseTypeAtom();
            if (this.match("ARROW")) {
                return { type: "FunctionType", paramName: left.name, parameter, returnType: this.parseFunctionType() };
            }
            return { type: "NamedParameter", name: left.name, parameter };
        }
        if (left.type === "NamedParameter") {
            this.consume("ARROW", "Expected '=>' after the parameter type.");
            return { type: "FunctionType", paramName: left.name, parameter: left.parameter, returnType: this.parseFunctionType() };
        }
        if (this.match("ARROW")) {
            return { type: "FunctionType", paramName: null, parameter: left, returnType: this.parseFunctionType() };
        }
        return left;
    }

    private parseTypeAtom(): TypeNode {
        if (this.peek().type === "LPAREN") {
            const open = this.advance();
            if (this.peek().type === "RPAREN") {
                throw new Error(`Parser Error: A tuple type needs at least two elements. (Found ')' at line ${open.line}, col ${open.char})`);
            }
            const first = this.parseFunctionType();
            if (this.peek().type === "COMMA") {
                const elements = [this.tupleElementType(first)];
                while (this.peek().type === "COMMA") {
                    this.advance();
                    if (this.peek().type === "RPAREN") break;
                    elements.push(this.tupleElementType(this.parseFunctionType()));
                }
                this.consume("RPAREN", "Expected ')' after the tuple type.");
                if (elements.length < 2) {
                    throw new Error(`Parser Error: A tuple type needs at least two elements. (Found ')' at line ${open.line}, col ${open.char})`);
                }
                return { type: "TupleType", elements };
            }
            this.consume("RPAREN", "Expected ')' after the type.");
            return first;
        }
        if (this.match("LBRACKET")) {
            const element = this.parseFunctionType();
            this.consume("RBRACKET", "Expected ']' after the list type.");
            return { type: "ListType", element };
        }
        if (this.peek().type === "IDENTIFIER") {
            return { type: "TypeName", name: this.advance().value };
        }
        const tok = this.peek();
        throw new Error(`Parser Error: Expected a type. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
    }

    /** A name before a colon is a function parameter, not a tuple element. */
    private tupleElementType(node: TypeNode): TypeNode {
        if (node.type === "NamedParameter") {
            throw new Error(`Parser Error: A tuple type is (number, vector). '${node.name}' names a function parameter.`);
        }
        return node;
    }

    private parseExportStatement(): ExportStatement {
        this.advance();
        this.consume("LPAREN", "Expected '(' after export.");
        const value = this.parseExpression();
        this.consume("RPAREN", "Expected ')' after the exported value.");
        return { type: "ExportStatement", value };
    }
    private parseComponentExpression(keyword: Token): ComponentExpression {
        this.consume("LPAREN", "Expected '(' after Component.");
        let solid: ExpressionNode | null = null;
        let expose: ExpressionNode | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const nameTok = this.consume("IDENTIFIER", "Expected a Component argument name.");
            this.consume("COLON", "Expected named argument designation operator ':'.");
            if (nameTok.value === "solid" && !solid) {
                solid = this.parseExpression();
            } else if (nameTok.value === "expose" && !expose) {
                expose = this.parseExpression();
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
        return this.place(keyword, { type: "ComponentExpression", solid, expose });
    }
    private parseVectorField(name: string, errorMsg: string): ExpressionNode {
        const key = this.consume("IDENTIFIER", errorMsg);
        if (key.value !== name) {
            throw new Error(`Parser Error: ${errorMsg} (Found '${key.value}' at line ${key.line}, col ${key.char})`);
        }
        this.consume("COLON", ": separator");
        return this.parseExpression();
    }
    private parseAnchorBlock(): ExposeBlock {
        const brace = this.consume("LBRACE", "Expected '{' to open the expose block.");
        const properties: Array<ExposeProperty> = [];
        while (this.peek().type !== "RBRACE" && this.peek().type !== "EOF") {
            const name = this.parseIdentifier();
            this.consume("COLON", "Expected property reference mapping notation operator ':'.");
            const value = this.parseExpression();
            properties.push({ type: "ExposeProperty", name, value });
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RBRACE", "Expected '}' to close the expose block.");
        return this.place(brace, { type: "ExposeBlock", properties });
    }
    private parseExpression(): ExpressionNode {
        if (this.peek().type === "LET") return this.parseLetExpression();
        return this.parseForwardExpression();
    }
    /** `let name = value in body`, or `let (x, y) = value in body`. */
    private parseLetExpression(): ExpressionNode {
        const keyword = this.consume("LET", "Expected 'let'.");
        if (this.peek().type === "LPAREN") {
            const pattern = this.parseLetPattern();
            this.consume("EQUALS", "Expected '=' after the let pattern.");
            const value = this.parseExpression();
            this.consume("IN", "Expected 'in' after the let binding.");
            const body = this.parseExpression();
            return this.place(keyword, { type: "TupleLetExpression", pattern, value, body });
        }
        const name = this.parseIdentifier();
        this.consume("EQUALS", "Expected '=' after the let name.");
        const value = this.parseExpression();
        this.consume("IN", "Expected 'in' after the let binding.");
        const body = this.parseExpression();
        return this.place(keyword, { type: "LetExpression", name, value, body });
    }

    /** `(x, y)` or `(x, (y, z))`. One name in parentheses is not a tuple. */
    private parseLetPattern(): LetPattern {
        const open = this.consume("LPAREN", "Expected '(' to open a tuple pattern.");
        const elements: Array<LetPattern> = [];
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            if (this.peek().type === "LPAREN") elements.push(this.parseLetPattern());
            else elements.push({ type: "Name", name: this.parseIdentifier() });
            if (this.peek().type === "COMMA") this.advance();
            else break;
        }
        this.consume("RPAREN", "Expected ')' after the tuple pattern.");
        if (elements.length < 2) {
            throw new Error(`Parser Error: A tuple needs at least two elements. (Found ')' at line ${open.line}, col ${open.char})`);
        }
        return { type: "Tuple", elements, line: open.line, column: open.char };
    }
    // `|>` sends a value into a function. `>>` binds tighter, so `x |> f >> g` pipes into the composition.
    private parseForwardExpression(): ExpressionNode {
        let expr = this.parsePipeExpression();
        while (this.peek().type === "PIPE_FORWARD") {
            const operator = this.advance();
            const right = this.parsePipeExpression();
            expr = this.place(operator, { type: "PipeExpression", leftHandSide: expr, rightHandSide: right });
        }
        return expr;
    }
    private parsePipeExpression(): ExpressionNode {
        let expr = this.parseConsExpression();
        while (this.peek().type === "PIPE") {
            const operator = this.advance();
            const right = this.parseConsExpression();
            expr = this.place(operator, { type: "ComposeExpression", left: expr, right });
        }
        return expr;
    }
    private parseConsExpression(): ExpressionNode {
        let expr = this.parseAdditive();
        while (this.peek().type === "CONS") {
            const operator = this.advance();
            const right = this.parseConsExpression();
            expr = this.place(operator, {
                type: "BinaryExpression",
                operator: "::",
                left: expr,
                right
            });
        }
        return expr;
    }
    private parseAdditive(): ExpressionNode {
        let expr = this.parseMultiplicative();
        while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
            const operator = this.advance();
            const right = this.parseMultiplicative();
            expr = this.place(operator, { type: "BinaryExpression", operator: operator.value as SmoothOperator, left: expr, right });
        }
        return expr;
    }
    private parseMultiplicative(): ExpressionNode {
        let expr = this.parseExponential();
        while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
            const operator = this.advance();
            const right = this.parseExponential();
            expr = this.place(operator, { type: "BinaryExpression", operator: operator.value as SmoothOperator, left: expr, right });
        }
        return expr;
    }
    private parseExponential(): ExpressionNode {
        let expr = this.parsePrimary();
        while (this.peek().type === "CARET") {
            const operator = this.advance();
            const right = this.parsePrimary();
            expr = this.place(operator, { type: "BinaryExpression", operator: "^", left: expr, right });
        }
        return expr;
    }
    private parsePrimary(): ExpressionNode {
        return this.parsePostfix(this.parseAtom());
    }

    private parsePostfix(expr: ExpressionNode): ExpressionNode {
        while (this.peek().type === "DOT") {
            this.advance();
            const property = this.consume("IDENTIFIER", "Expected an anchor name.");
            if (this.peek().type === "LPAREN") {
                this.advance();
                const args = this.parseCallArguments();
                this.consume("RPAREN", "Expected closing parenthesis for a vector method.");
                expr = this.place(property, {
                    type: "MethodCallExpression",
                    object: expr,
                    method: this.place(property, { type: "Identifier", name: property.value }),
                    arguments: args
                });
            } else {
                expr = this.place(property, { type: "MemberExpression", object: expr, property: property.value });
            }
        }
        return expr;
    }

    private parseAtom(): ExpressionNode {
        const tok = this.peek();
        if (tok.type === "PARAMETER") {
            this.advance();
            return this.place(tok, { type: "ParameterReference", name: tok.value });
        }
        if (tok.type === "MATCH") {
            return this.parseArrayMatchExpression();
        }
        if (tok.type === "IDENTIFIER") {
            if (tok.value === "Component") {
                const keyword = this.advance();
                if (this.peek().type === "LPAREN") return this.parseComponentExpression(keyword);
                const id = this.place(keyword, { type: "Identifier" as const, name: "Component" });
                if (this.peek().type === "ARROW") {
                    this.advance();
                    return this.placeAt(id, { type: "LambdaExpression", parameter: id, body: this.parseExpression() });
                }
                return id;
            }
            if (tok.value === "join") {
                const keyword = this.advance();
                if (this.peek().type === "LPAREN") return this.parseJoinDomain(keyword);
                const id = this.place(keyword, { type: "Identifier" as const, name: "join" });
                if (this.peek().type === "ARROW") {
                    this.advance();
                    return this.placeAt(id, { type: "LambdaExpression", parameter: id, body: this.parseExpression() });
                }
                return id;
            }
            if (tok.value === "Vector") {
                const keyword = this.advance();
                this.consume("LPAREN", "Vector coordinates must wrap inner values inside parenthesis.");
                const coords = this.parseVectorField("coords", "Vector needs a coordinate system first.");
                this.consume("COMMA", ", step separator");
                const x = this.parseVectorField("x", "Expected axis label key 'x'.");
                this.consume("COMMA", ", step separator");
                const y = this.parseVectorField("y", "Expected axis label key 'y'.");
                this.consume("COMMA", ", step separator");
                const z = this.parseVectorField("z", "Expected axis label key 'z'.");
                this.consume("RPAREN", "Expected closing tuple parenthesis.");
                return this.place(keyword, { type: "VectorLiteral", coords, x, y, z });
            }
            if (tok.value === "Curve1D") { this.advance(); return this.parseCurve1DNode(); }
            if (tok.value === "Surface2D") { this.advance(); return this.parseSurface2DNode(); }
            if (tok.value === "Solid3D") { this.advance(); return this.parseSolid3DNode(); }
            const id = this.parseIdentifier();
            if (this.peek().type === "ARROW") {
                this.advance();
                const body = this.parseExpression();
                return this.placeAt(id, { type: "LambdaExpression", parameter: id, body });
            }
            if (this.peek().type === "LPAREN") {
                this.advance();
                const args = this.parseCallArguments();
                this.consume("RPAREN", "Expected closing parenthesis for function execution.");
                return this.placeAt(id, { type: "CallExpression", callee: id, arguments: args });
            }
            return id;
        }
        if (tok.type === "TRUE" || tok.type === "FALSE") {
            this.advance();
            return this.place(tok, { type: "BooleanLiteral", value: tok.type === "TRUE" });
        }
        if (tok.type === "FLOAT") {
            this.advance();
            return this.place(tok, { type: "FloatLiteral", value: parseFloat(tok.value) });
        }
        if (tok.type === "STRING") {
            this.advance();
            return this.place(tok, { type: "StringLiteral", value: tok.value });
        }
        if (tok.type === "LBRACE") {
            return this.parseAnchorBlock();
        }
        if (tok.type === "LBRACKET") {
            this.advance();
            const elements: Array<ExpressionNode> = [];
            while (this.peek().type !== "RBRACKET" && this.peek().type !== "EOF") {
                elements.push(this.parseExpression());
                if (this.peek().type === "COMMA") this.advance();
            }
            this.consume("RBRACKET", "Expected closing bracket ']' for array literal.");
            return this.place(tok, { type: "ArrayLiteral", elements });
        }
        if (tok.type === "LPAREN") {
            this.advance();
            if (this.peek().type === "RPAREN") {
                throw new Error(`Parser Error: A tuple needs at least two elements. (Found ')' at line ${tok.line}, col ${tok.char})`);
            }
            const first = this.parseExpression();
            if (this.peek().type !== "COMMA") {
                this.consume("RPAREN", "Mismatched expression parenthesis grouping closure.");
                return first;
            }
            const elements = [first];
            while (this.peek().type === "COMMA") {
                this.advance();
                if (this.peek().type === "RPAREN") break;
                elements.push(this.parseExpression());
            }
            this.consume("RPAREN", "Expected ')' after the tuple.");
            if (elements.length < 2) {
                throw new Error(`Parser Error: A tuple needs at least two elements. (Found ')' at line ${tok.line}, col ${tok.char})`);
            }
            return this.place(tok, { type: "TupleLiteral", elements });
        }
        throw new Error(`Parser Error: Encountered unexpected token element entry '${tok.value}' during active execution parsing loop at line ${tok.line}`);
    }
    private parseJoinDomain(keyword: Token): JoinDomain {
        this.consume("LPAREN", "Expected '(' after join.");
        let frame: ExpressionNode | null = null;
        let placed: ExpressionNode | null = null;
        let using: ExpressionNode | null = null;
        let combine: ExpressionNode | null = null;
        let coords: ExpressionNode | null = null;
        while (this.peek().type !== "RPAREN" && this.peek().type !== "EOF") {
            const nameTok = this.consume("IDENTIFIER", "Expected a join argument name.");
            this.consume("COLON", "Expected named argument designation operator ':'.");
            const value = this.parseExpression();
            if (coords) {
                throw new Error(`Parser Error: join takes the coordinate system last. (Found '${nameTok.value}' at line ${nameTok.line}, col ${nameTok.char})`);
            }
            if (nameTok.value === "frame" && !frame) frame = value;
            else if (nameTok.value === "placed" && !placed) placed = value;
            else if (nameTok.value === "using" && !using) using = value;
            else if (nameTok.value === "combine" && !combine) combine = value;
            else if (nameTok.value === "coords" && !coords) coords = value;
            else {
                throw new Error(`Parser Error: join accepts frame, placed, using, combine, and coords. (Found '${nameTok.value}' at line ${nameTok.line}, col ${nameTok.char})`);
            }
            if (this.peek().type === "COMMA") this.advance();
        }
        this.consume("RPAREN", "Expected ')' after join arguments.");
        if (!frame || !placed || !using || !combine) {
            const tok = this.peek();
            throw new Error(`Parser Error: join needs frame, placed, using, and combine. (Found '${tok.value}' at line ${tok.line}, col ${tok.char})`);
        }
        const join: JoinDomain = { type: "JoinDomain", frame, placed, using, combine };
        return this.place(keyword, coords ? { ...join, coords } : join);
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
                args.push(this.placeAt(name, {
                    type: "NamedArgument",
                    name,
                    value: this.placeAt(name, { type: "LambdaExpression", parameter: name, body })
                }));
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
        return this.place(tok, { type: "Identifier", name: tok.value });
    }
}