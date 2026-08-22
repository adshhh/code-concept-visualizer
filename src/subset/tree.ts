import { tokenize } from "./tokenizer";
import { RejectionError, type Token } from "./types";

export interface SimpleStmt {
  kind: "simple" | "return" | "break" | "continue" | "pass";
  line: number;
  text: string;
}

export interface ElifClause {
  line: number;
  text: string;
  test: string;
  body: Stmt[];
}

export interface IfStmt {
  kind: "if";
  line: number;
  text: string;
  test: string;
  body: Stmt[];
  elifs: ElifClause[];
  orelse: Stmt[] | null;
}

export interface LoopStmt {
  kind: "for" | "while";
  line: number;
  text: string;
  header: string;
  body: Stmt[];
}

export interface DefStmt {
  kind: "def";
  line: number;
  text: string;
  name: string;
  signature: string;
  body: Stmt[];
}

export type Stmt = SimpleStmt | IfStmt | LoopStmt | DefStmt;

/** Strips a leading keyword and trailing ':' from a header's full source text, preserving
 * everything else — including the author's own spacing — exactly. `fullText` is already
 * `.trim()`-ed by `textBetween`, so the keyword is guaranteed to be at its very start. */
function stripHeader(fullText: string, keyword: string): string {
  let s = fullText.startsWith(keyword)
    ? fullText.slice(keyword.length)
    : fullText;
  s = s.trimStart();
  if (s.endsWith(":")) s = s.slice(0, -1);
  return s.trimEnd();
}

/** Finds the column of the first ':' on `line` that sits outside any bracket nesting and outside
 * any string literal, or -1 if there is none — the header terminator for a suite that shares its
 * physical line with the header (`while True: pass`), where token line numbers alone can't
 * separate "header" text from "body" text since both sit on the same line. */
function topLevelColonColumn(line: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === "\\") {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if ("([{".includes(ch)) {
      depth++;
    } else if (")]}".includes(ch)) {
      depth--;
    } else if (ch === ":" && depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Builds a statement tree from already-validated source. This is an **additive second pass**
 * over the same token stream `Parser` (`./parser.ts`) walks — `parser.ts` itself is untouched,
 * so milestone 2's fixture contract (the recognizer that gates the worker) carries no risk from
 * this existing. Structure comes from the tokenizer's INDENT/DEDENT/NEWLINE; every label is
 * sliced verbatim from the source lines a statement's own tokens span, never re-rendered from
 * tokens, so a flowchart node's text always matches what the author actually wrote — spacing
 * included.
 *
 * Callers must validate first (`validate(source).ok`) — `buildTree` assumes the subset's grammar
 * already holds and throws `RejectionError` if a token sequence doesn't match any shape it knows
 * how to represent, rather than silently guessing at a plausible-looking tree.
 */
export function buildTree(source: string): Stmt[] {
  const lines = source.split("\n");
  const tokens = tokenize(source);
  return new TreeBuilder(tokens, lines).parseProgram();
}

class TreeBuilder {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private lines: string[],
  ) {}

  private peek(offset = 0): Token {
    const tok = this.tokens[this.pos + offset];
    if (!tok) {
      throw new RejectionError(
        this.lines.length,
        "Flowchart tree builder ran out of tokens unexpectedly.",
      );
    }
    return tok;
  }

  private advance(): Token {
    const tok = this.peek();
    this.pos++;
    return tok;
  }

  private isName(value: string): boolean {
    const tok = this.peek();
    return tok.type === "NAME" && tok.value === value;
  }

  private isOp(value: string): boolean {
    const tok = this.peek();
    return tok.type === "OP" && tok.value === value;
  }

  private expectType(type: Token["type"]): Token {
    if (this.peek().type !== type) {
      throw new RejectionError(
        this.peek().line,
        `Flowchart tree builder expected ${type} here.`,
      );
    }
    return this.advance();
  }

  private expectOp(value: string): void {
    if (!this.isOp(value)) {
      throw new RejectionError(
        this.peek().line,
        `Flowchart tree builder expected '${value}' here.`,
      );
    }
    this.advance();
  }

  /** Source text spanning from `startLine` through `endLine`, inclusive, with the block's own
   * leading/trailing whitespace trimmed (internal lines' own indentation is left alone). */
  private textBetween(startLine: number, endLine: number): string {
    return this.lines
      .slice(startLine - 1, endLine)
      .join("\n")
      .trim();
  }

  /** Like `textBetween`, but for a header (if/for/while/def) — `colonLine` may also carry the
   * suite's own body on the same physical line (`while True: pass`), and token line numbers alone
   * can't separate "header" from "body" text in that case, since both sit on one line. Finds the
   * header-terminating ':' by column instead, so only the header itself is kept. */
  private headerTextUpToColon(startLine: number, colonLine: number): string {
    const raw = this.textBetween(startLine, colonLine);
    const rawLines = raw.split("\n");
    const lastLine = rawLines[rawLines.length - 1]!;
    const col = topLevelColonColumn(lastLine);
    if (col !== -1 && col < lastLine.length - 1) {
      rawLines[rawLines.length - 1] = lastLine.slice(0, col + 1);
    }
    return rawLines.join("\n").trim();
  }

  parseProgram(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek().type !== "EOF") {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  /** Expects to be positioned right after the header's terminating ':'. */
  private parseSuite(): Stmt[] {
    if (this.peek().type === "NEWLINE") {
      this.advance();
      this.expectType("INDENT");
      const stmts: Stmt[] = [];
      while (this.peek().type !== "DEDENT" && this.peek().type !== "EOF") {
        stmts.push(this.parseStatement());
      }
      this.expectType("DEDENT");
      return stmts;
    }
    // The single-statement-on-the-same-line form, e.g. `while True: pass`.
    return [this.parseStatement()];
  }

  private parseStatement(): Stmt {
    const tok = this.peek();
    if (tok.type === "NAME") {
      switch (tok.value) {
        case "if":
          return this.parseIf();
        case "for":
          return this.parseLoop("for");
        case "while":
          return this.parseLoop("while");
        case "def":
          return this.parseDef();
        case "return":
          return this.parseLeaf("return");
        case "break":
          return this.parseLeaf("break");
        case "continue":
          return this.parseLeaf("continue");
        case "pass":
          return this.parseLeaf("pass");
      }
    }
    return this.parseSimple();
  }

  /** Consumes tokens up to and including the terminating NEWLINE. Returns the line range so the
   * caller can slice the statement's own verbatim text — a bracket-continued statement spans more
   * than one physical line, and NEWLINE only appears once bracket depth returns to 0. */
  private consumeToNewline(): { startLine: number; endLine: number } {
    const startLine = this.peek().line;
    while (this.peek().type !== "NEWLINE") {
      this.advance();
    }
    const endLine = this.peek().line;
    this.advance(); // NEWLINE
    return { startLine, endLine };
  }

  private parseLeaf(kind: "return" | "break" | "continue" | "pass"): Stmt {
    const { startLine, endLine } = this.consumeToNewline();
    return {
      kind,
      line: startLine,
      text: this.textBetween(startLine, endLine),
    };
  }

  private parseSimple(): Stmt {
    const { startLine, endLine } = this.consumeToNewline();
    return {
      kind: "simple",
      line: startLine,
      text: this.textBetween(startLine, endLine),
    };
  }

  /** Consumes header tokens up to the ':' that starts the suite, tracking bracket depth so a
   * slice's own ':' (e.g. `nums[1:3]` inside a condition) is never mistaken for the header
   * terminator — the same technique `parser.ts`'s `splitTopLevel` uses for assignment operators. */
  private consumeHeaderToColon(): { colonLine: number } {
    let depth = 0;
    while (true) {
      const tok = this.peek();
      if (tok.type === "OP" && "([{".includes(tok.value)) depth++;
      if (tok.type === "OP" && ")]}".includes(tok.value)) depth--;
      if (depth === 0 && tok.type === "OP" && tok.value === ":") break;
      this.advance();
    }
    const colonLine = this.peek().line;
    this.advance(); // ':'
    return { colonLine };
  }

  private parseIf(): Stmt {
    const line = this.peek().line;
    this.advance(); // 'if'
    const { colonLine } = this.consumeHeaderToColon();
    const text = this.headerTextUpToColon(line, colonLine);
    const test = stripHeader(text, "if");
    const body = this.parseSuite();

    const elifs: ElifClause[] = [];
    while (this.isName("elif")) {
      const elifLine = this.peek().line;
      this.advance();
      const h = this.consumeHeaderToColon();
      const elifText = this.headerTextUpToColon(elifLine, h.colonLine);
      elifs.push({
        line: elifLine,
        text: elifText,
        test: stripHeader(elifText, "elif"),
        body: this.parseSuite(),
      });
    }

    let orelse: Stmt[] | null = null;
    if (this.isName("else")) {
      this.advance();
      this.expectOp(":");
      orelse = this.parseSuite();
    }

    return { kind: "if", line, text, test, body, elifs, orelse };
  }

  /** `for` and `while` differ only in the keyword and the resulting `kind` — found by code
   * review to be otherwise byte-identical, a real divergence hazard (a future header-handling fix
   * applied to one is easy to forget in the other). */
  private parseLoop(keyword: "for" | "while"): Stmt {
    const line = this.peek().line;
    this.advance(); // the keyword
    const { colonLine } = this.consumeHeaderToColon();
    const text = this.headerTextUpToColon(line, colonLine);
    const header = stripHeader(text, keyword);
    const body = this.parseSuite();
    return { kind: keyword, line, text, header, body };
  }

  private parseDef(): Stmt {
    const line = this.peek().line;
    this.advance(); // 'def'
    const nameTok = this.peek();
    const name = nameTok.value;
    const { colonLine } = this.consumeHeaderToColon();
    const text = this.headerTextUpToColon(line, colonLine);
    const signature = stripHeader(text, "def");
    const body = this.parseSuite();
    return { kind: "def", line, text, name, signature, body };
  }
}
