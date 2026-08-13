import { RejectionError, type Token } from "./types";
import { REASONS, formatRejection } from "./messages";

const COMPARISON_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);

function reject(line: number, key: keyof typeof REASONS): never {
  const reason = REASONS[key];
  throw new RejectionError(
    line,
    formatRejection(reason.construct, reason.alt, line),
  );
}

function syntaxError(line: number, detail: string): never {
  throw new RejectionError(
    line,
    formatRejection(
      REASONS.syntaxError.construct,
      `${detail} ${REASONS.syntaxError.alt}`,
      line,
    ),
  );
}

/** Two token sequences are "the same expression" if their types and values match one for one.
 * Used to confirm a two-target assignment is textually the reverse of its two values — the one
 * shape swap-syntax is allowed for. Line numbers are ignored. */
function sameTokens(a: Token[], b: Token[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (tok, i) => tok.type === b[i]!.type && tok.value === b[i]!.value,
  );
}

/** Splits a flat token slice into groups at top-level (bracket-depth 0) occurrences of an OP
 * with the given value. Used both for `a = b = c` chaining and for `a, b` comma lists. */
function splitTopLevel(tokens: Token[], opValue: string): Token[][] {
  const groups: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.type === "OP" && "([{".includes(tok.value)) depth++;
    if (tok.type === "OP" && ")]}".includes(tok.value)) depth--;
    if (depth === 0 && tok.type === "OP" && tok.value === opValue) {
      groups.push(current);
      current = [];
      continue;
    }
    current.push(tok);
  }
  groups.push(current);
  return groups;
}

function hasTopLevelOp(tokens: Token[], opValue: string): boolean {
  let depth = 0;
  for (const tok of tokens) {
    if (tok.type === "OP" && "([{".includes(tok.value)) depth++;
    if (tok.type === "OP" && ")]}".includes(tok.value)) depth--;
    if (depth === 0 && tok.type === "OP" && tok.value === opValue) return true;
  }
  return false;
}

export class Parser {
  private pos = 0;
  private functionDepth = 0;

  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token {
    const tok = this.tokens[this.pos + offset];
    if (!tok)
      syntaxError(
        this.tokens[this.tokens.length - 1]?.line ?? 1,
        "The program ends unexpectedly.",
      );
    return tok;
  }

  private advance(): Token {
    const tok = this.peek();
    this.pos++;
    return tok;
  }

  private isName(value: string, offset = 0): boolean {
    const tok = this.peek(offset);
    return tok.type === "NAME" && tok.value === value;
  }

  private isOp(value: string, offset = 0): boolean {
    const tok = this.peek(offset);
    return tok.type === "OP" && tok.value === value;
  }

  private expectOp(value: string): Token {
    if (!this.isOp(value))
      syntaxError(this.peek().line, `Expected '${value}' here.`);
    return this.advance();
  }

  private expectType(type: Token["type"]): Token {
    if (this.peek().type !== type)
      syntaxError(this.peek().line, `Expected ${type.toLowerCase()} here.`);
    return this.advance();
  }

  parseProgram(): void {
    while (this.peek().type !== "EOF") {
      this.parseStatement();
    }
  }

  // ---- statements ----------------------------------------------------

  private parseSuite(): void {
    this.expectOp(":");
    this.expectType("NEWLINE");
    this.expectType("INDENT");
    while (this.peek().type !== "DEDENT" && this.peek().type !== "EOF") {
      this.parseStatement();
    }
    this.expectType("DEDENT");
  }

  private parseStatement(): void {
    const tok = this.peek();

    if (tok.type === "OP" && tok.value === "@") reject(tok.line, "decorator");

    if (tok.type === "NAME") {
      switch (tok.value) {
        case "if":
          return this.parseIf();
        case "for":
          return this.parseFor();
        case "while":
          return this.parseWhile();
        case "def":
          return this.parseDef();
        case "return":
          return this.parseReturn();
        case "break":
        case "continue":
        case "pass":
          this.advance();
          this.expectType("NEWLINE");
          return;
      }
    }

    this.parseSimpleStatement();
  }

  private parseIf(): void {
    this.advance(); // 'if'
    this.parseExpression();
    this.parseSuite();
    while (this.isName("elif")) {
      this.advance();
      this.parseExpression();
      this.parseSuite();
    }
    if (this.isName("else")) {
      this.advance();
      this.parseSuite();
    }
  }

  private parseFor(): void {
    this.advance(); // 'for'
    const loopVar = this.peek();
    this.expectType("NAME");
    if (this.isOp(",")) reject(loopVar.line, "tuple");
    if (!this.isName("in"))
      syntaxError(this.peek().line, "Expected 'in' here.");
    this.advance();
    this.parseExpression();
    this.parseSuite();
  }

  private parseWhile(): void {
    this.advance(); // 'while'
    this.parseExpression();
    this.parseSuite();
    if (this.isName("else")) reject(this.peek().line, "whileElse");
  }

  private parseDef(): void {
    const defTok = this.advance(); // 'def'
    if (this.functionDepth > 0) reject(defTok.line, "closure");
    this.expectType("NAME");
    this.expectOp("(");
    while (!this.isOp(")")) {
      if (this.isOp("*") || this.isOp("**"))
        reject(this.peek().line, "starArgs");
      const param = this.expectType("NAME");
      if (this.isOp("=")) reject(param.line, "keywordArgument");
      if (this.isOp(",")) {
        this.advance();
        continue;
      }
      break;
    }
    this.expectOp(")");
    this.functionDepth++;
    this.parseSuite();
    this.functionDepth--;
  }

  private parseReturn(): void {
    this.advance(); // 'return'
    if (this.peek().type !== "NEWLINE") {
      const startLine = this.peek().line;
      const exprTokens = this.collectUntilNewline();
      if (hasTopLevelOp(exprTokens, ",")) reject(startLine, "tuple");
      new Parser([
        ...exprTokens,
        { type: "EOF", value: "", line: startLine },
      ]).parseExpressionEntry();
    }
    this.expectType("NEWLINE");
  }

  /** Collects the remaining tokens of the current logical statement, up to (but not including)
   * the terminating NEWLINE, without consuming NEWLINE itself. */
  private collectUntilNewline(): Token[] {
    const out: Token[] = [];
    while (this.peek().type !== "NEWLINE" && this.peek().type !== "EOF") {
      out.push(this.advance());
    }
    return out;
  }

  private parseSimpleStatement(): void {
    const startLine = this.peek().line;
    const stmtTokens = this.collectUntilNewline();
    this.expectType("NEWLINE");
    this.parseSimpleStatementTokens(stmtTokens, startLine);
  }

  private parseSimpleStatementTokens(
    stmtTokens: Token[],
    startLine: number,
  ): void {
    // augmented assignment: exactly one top-level augmented op, single target on the left
    const AUG_OPS = ["+=", "-=", "*=", "/=", "//=", "%=", "**="];
    for (const op of AUG_OPS) {
      if (hasTopLevelOp(stmtTokens, op)) {
        const [targetTokens, ...rest] = splitTopLevel(stmtTokens, op);
        const valueTokens = rest.flat();
        this.parseAssignmentTargetTokens(targetTokens!, startLine);
        if (hasTopLevelOp(valueTokens, ",")) reject(startLine, "tuple");
        subParse(valueTokens, startLine).parseExpressionEntry();
        return;
      }
    }

    if (!hasTopLevelOp(stmtTokens, "=")) {
      // plain expression statement
      if (hasTopLevelOp(stmtTokens, ",")) reject(startLine, "tuple");
      subParse(stmtTokens, startLine).parseExpressionEntry();
      return;
    }

    const chunks = splitTopLevel(stmtTokens, "=");

    if (
      chunks.length === 2 &&
      hasTopLevelOp(chunks[0]!, ",") &&
      hasTopLevelOp(chunks[1]!, ",")
    ) {
      this.parseSwapOrRejectTuple(chunks[0]!, chunks[1]!, startLine);
      return;
    }

    // chained assignment: every chunk but the last must be a single target
    const value = chunks[chunks.length - 1]!;
    for (let i = 0; i < chunks.length - 1; i++) {
      const targetTokens = chunks[i]!;
      if (hasTopLevelOp(targetTokens, ",")) reject(startLine, "tuple");
      this.parseAssignmentTargetTokens(targetTokens, startLine);
    }
    if (hasTopLevelOp(value, ",")) reject(startLine, "tuple");
    subParse(value, startLine).parseExpressionEntry();
  }

  private parseSwapOrRejectTuple(
    lhs: Token[],
    rhs: Token[],
    line: number,
  ): void {
    const targets = splitTopLevel(lhs, ",");
    const values = splitTopLevel(rhs, ",");
    if (targets.length !== 2 || values.length !== 2) reject(line, "tuple");
    const [t0, t1] = targets as [Token[], Token[]];
    const [v0, v1] = values as [Token[], Token[]];
    if (!(sameTokens(t0, v1) && sameTokens(t1, v0))) reject(line, "tuple");
    this.parseAssignmentTargetTokens(t0, line);
    this.parseAssignmentTargetTokens(t1, line);
    subParse(v0, line).parseExpressionEntry();
    subParse(v1, line).parseExpressionEntry();
  }

  /** A valid assignment target: NAME, optionally followed by one or more `[expr]` subscripts.
   * A `:` inside the brackets means it's a slice, which cannot be assigned to. */
  private parseAssignmentTargetTokens(tokens: Token[], line: number): void {
    const p = subParse(tokens, line);
    p.expectType("NAME");
    while (p.isOp("[")) {
      p.advance();
      let depth = 1;
      let sawColon = false;
      while (depth > 0) {
        const tok = p.advance();
        if (tok.type === "OP" && tok.value === "[") depth++;
        else if (tok.type === "OP" && tok.value === "]") depth--;
        else if (tok.type === "OP" && tok.value === ":" && depth === 1)
          sawColon = true;
      }
      if (sawColon) reject(line, "sliceAssignment");
    }
    if (p.peek().type !== "EOF")
      syntaxError(line, "This isn't a valid assignment target.");
  }

  // ---- expressions (precedence climbing) ------------------------------

  /** Entry point for parsing a standalone expression token slice down to EOF. */
  parseExpressionEntry(): void {
    this.parseExpression();
    if (this.peek().type !== "EOF")
      syntaxError(this.peek().line, "Unexpected extra tokens here.");
  }

  private parseExpression(): void {
    this.parseOr();
  }

  private parseOr(): void {
    this.parseAnd();
    while (this.isName("or")) {
      this.advance();
      this.parseAnd();
    }
  }

  private parseAnd(): void {
    this.parseNot();
    while (this.isName("and")) {
      this.advance();
      this.parseNot();
    }
  }

  private parseNot(): void {
    if (this.isName("not")) {
      this.advance();
      this.parseNot();
      return;
    }
    this.parseComparison();
  }

  private parseComparison(): void {
    const line = this.peek().line;
    this.parseArith();
    let comparisonCount = 0;
    while (true) {
      if (this.peek().type === "OP" && COMPARISON_OPS.has(this.peek().value)) {
        this.advance();
        this.parseArith();
        comparisonCount++;
        continue;
      }
      if (this.isName("in") || (this.isName("not") && this.isName("in", 1))) {
        if (this.isName("not")) this.advance();
        this.advance(); // 'in'
        this.parseArith();
        comparisonCount++;
        continue;
      }
      break;
    }
    if (comparisonCount > 1) reject(line, "chainedComparison");
  }

  private parseArith(): void {
    this.parseTerm();
    while (this.isOp("+") || this.isOp("-")) {
      this.advance();
      this.parseTerm();
    }
  }

  private parseTerm(): void {
    this.parseUnary();
    while (
      this.isOp("*") ||
      this.isOp("/") ||
      this.isOp("//") ||
      this.isOp("%")
    ) {
      this.advance();
      this.parseUnary();
    }
  }

  private parseUnary(): void {
    if (this.isOp("-") || this.isOp("+")) {
      this.advance();
      this.parseUnary();
      return;
    }
    this.parsePower();
  }

  private parsePower(): void {
    this.parsePostfix();
    if (this.isOp("**")) {
      this.advance();
      this.parseUnary();
    }
  }

  private parsePostfix(): void {
    this.parseAtom();
    while (true) {
      if (this.isOp("[")) {
        this.advance();
        this.parseSliceOrIndex();
        this.expectOp("]");
        continue;
      }
      if (this.isOp("(")) {
        this.advance();
        this.parseArgs();
        this.expectOp(")");
        continue;
      }
      if (this.isOp(".")) {
        this.advance();
        this.expectType("NAME");
        continue;
      }
      break;
    }
  }

  private parseSliceOrIndex(): void {
    if (!this.isOp(":")) this.parseExpression();
    if (this.isOp(":")) {
      this.advance();
      if (!this.isOp("]")) this.parseExpression();
    }
  }

  private parseArgs(): void {
    while (!this.isOp(")")) {
      if (this.isOp("*") || this.isOp("**"))
        reject(this.peek().line, "starArgs");
      const argLine = this.peek().line;
      this.parseExpression();
      if (this.isOp("=")) reject(argLine, "keywordArgument");
      if (this.isOp(",")) {
        this.advance();
        continue;
      }
      break;
    }
  }

  private parseAtom(): void {
    const tok = this.peek();

    if (tok.type === "NUMBER") {
      this.advance();
      return;
    }
    if (tok.type === "STRING") {
      this.advance();
      for (const part of tok.fstringParts ?? []) {
        if (part.kind === "expr") {
          new Parser([
            ...part.tokens,
            { type: "EOF", value: "", line: part.line },
          ]).parseExpressionEntry();
        }
      }
      return;
    }
    if (tok.type === "NAME") {
      if (tok.value === "lambda") reject(tok.line, "lambda");
      this.advance();
      return;
    }
    if (this.isOp("(")) {
      this.advance();
      const start = this.pos;
      this.parseExpression();
      if (this.isOp(",")) {
        reject(tok.line, "tuple");
      }
      this.expectOp(")");
      void start;
      return;
    }
    if (this.isOp("[")) {
      this.advance();
      this.parseListBody(tok.line);
      this.expectOp("]");
      return;
    }
    if (this.isOp("{")) {
      this.advance();
      this.parseBraceBody(tok.line);
      this.expectOp("}");
      return;
    }

    syntaxError(tok.line, "Expected a value here.");
  }

  private parseListBody(line: number): void {
    if (this.isOp("]")) return; // empty list
    let count = 1;
    this.parseExpression();
    if (this.isName("for")) reject(line, "comprehension");
    while (this.isOp(",")) {
      this.advance();
      if (this.isOp("]")) break; // trailing comma
      count++;
      if (count > 25) reject(line, "literalTooLarge");
      this.parseExpression();
    }
  }

  private parseBraceBody(line: number): void {
    if (this.isOp("}")) return; // empty dict
    let count = 1;
    this.parseExpression();
    if (this.isName("for")) reject(line, "comprehension");
    if (this.isOp(":")) {
      // dict literal
      this.advance();
      this.parseExpression();
      if (this.isName("for")) reject(line, "comprehension");
      while (this.isOp(",")) {
        this.advance();
        if (this.isOp("}")) break;
        count++;
        if (count > 25) reject(line, "literalTooLarge");
        this.parseExpression();
        this.expectOp(":");
        this.parseExpression();
      }
      return;
    }
    // no colon after the first element — it's a set literal, out of scope
    reject(line, "set");
  }
}

function subParse(tokens: Token[], line: number): Parser {
  return new Parser([...tokens, { type: "EOF", value: "", line }]);
}
