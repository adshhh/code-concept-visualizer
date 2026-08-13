import { RejectionError, type FStringPart, type Token } from "./types";
import { REASONS, formatRejection } from "./messages";

/** Recognized-but-unsupported keywords, each with its own reason in messages.ts. */
const OUT_OF_SCOPE_KEYWORDS: Record<string, keyof typeof REASONS> = {
  class: "class",
  import: "import",
  from: "import",
  try: "tryExcept",
  except: "tryExcept",
  finally: "tryExcept",
  with: "with",
  as: "with",
  lambda: "lambda",
  yield: "yield",
  global: "globalNonlocal",
  nonlocal: "globalNonlocal",
  del: "unsupportedKeyword",
  raise: "unsupportedKeyword",
  assert: "unsupportedKeyword",
  is: "unsupportedKeyword",
};

const MULTI_CHAR_OPS = [
  "**=",
  "//=",
  "==",
  "!=",
  "<=",
  ">=",
  "**",
  "//",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
];
const SINGLE_CHAR_OPS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "<",
  ">",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ":",
  ".",
  "@",
]);

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}
function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
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

/** Reads one string literal (optionally f-prefixed) starting at `quoteIndex`, which must point at
 * the opening quote character. Returns the token and the index just past the closing quote. */
function readString(
  text: string,
  quoteIndex: number,
  quote: string,
  line: number,
  isFString: boolean,
): { token: Token; next: number } {
  let i = quoteIndex + 1;
  let raw = "";
  while (i < text.length && text[i] !== quote) {
    if (text[i] === "\\" && i + 1 < text.length) {
      raw += text[i]! + text[i + 1]!;
      i += 2;
      continue;
    }
    raw += text[i]!;
    i++;
  }
  if (text[i] !== quote) {
    syntaxError(line, "This string is missing its closing quote.");
  }
  i++; // consume closing quote

  const value = unescape(raw);
  const token: Token = { type: "STRING", value, line };
  if (isFString) {
    token.fstringParts = splitFString(raw, line);
  }
  return { token, next: i };
}

function unescape(raw: string): string {
  // A single regex pass, so `\\n` (an escaped backslash followed by the letter n) can't be
  // misread as `\` + `\n` by a later, separate replacement pass over the same text.
  return raw.replace(/\\(.)/g, (_match, ch: string) => {
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "\\":
        return "\\";
      case "'":
        return "'";
      case '"':
        return '"';
      default:
        return `\\${ch}`;
    }
  });
}

/** Splits an f-string body into literal text and `{expr}` parts. Nested brackets inside an
 * expression (e.g. `{nums[i]}`) are tracked so the matching `}` is found correctly. `{{`/`}}`
 * are escaped braces, same as real Python f-strings. */
function splitFString(raw: string, line: number): FStringPart[] {
  const parts: FStringPart[] = [];
  let literal = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "{" && raw[i + 1] === "{") {
      literal += "{";
      i += 2;
      continue;
    }
    if (ch === "}" && raw[i + 1] === "}") {
      literal += "}";
      i += 2;
      continue;
    }
    if (ch === "{") {
      if (literal) {
        parts.push({ kind: "literal", text: literal });
        literal = "";
      }
      let depth = 1;
      let start = i + 1;
      i++;
      while (i < raw.length && depth > 0) {
        if (raw[i] === "{") depth++;
        else if (raw[i] === "}") depth--;
        if (depth > 0) i++;
      }
      if (depth !== 0) {
        syntaxError(
          line,
          "This f-string expression is missing its closing '}'.",
        );
      }
      const exprText = raw.slice(start, i);
      i++; // consume '}'
      const { tokens } = tokenizeLine(exprText, line);
      parts.push({ kind: "expr", tokens, line });
      continue;
    }
    literal += ch;
    i++;
  }
  if (literal) parts.push({ kind: "literal", text: literal });
  return parts;
}

/** Tokenizes the content of one physical line (comments already excluded by the caller isn't
 * required — `#` is handled here too) into NAME/NUMBER/STRING/OP tokens, and reports how much
 * the paren/bracket/brace depth changed, so the caller can detect multi-line continuations. */
export function tokenizeLine(
  text: string,
  line: number,
): { tokens: Token[]; depthDelta: number } {
  const tokens: Token[] = [];
  let i = 0;
  let depthDelta = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "#") break;

    if (isDigit(ch) || (ch === "." && isDigit(text[i + 1] ?? ""))) {
      const start = i;
      while (i < text.length && isDigit(text[i]!)) i++;
      if (text[i] === ".") {
        i++;
        while (i < text.length && isDigit(text[i]!)) i++;
      }
      tokens.push({ type: "NUMBER", value: text.slice(start, i), line });
      continue;
    }

    if (isIdentStart(ch)) {
      if (
        (ch === "f" || ch === "F") &&
        (text[i + 1] === "'" || text[i + 1] === '"')
      ) {
        const { token, next } = readString(
          text,
          i + 1,
          text[i + 1]!,
          line,
          true,
        );
        tokens.push(token);
        i = next;
        continue;
      }
      const start = i;
      while (i < text.length && isIdentPart(text[i]!)) i++;
      const value = text.slice(start, i);
      if (value in OUT_OF_SCOPE_KEYWORDS) {
        const reason = REASONS[OUT_OF_SCOPE_KEYWORDS[value]!];
        const construct =
          OUT_OF_SCOPE_KEYWORDS[value] === "unsupportedKeyword"
            ? `'${value}'`
            : reason.construct;
        throw new RejectionError(
          line,
          formatRejection(construct, reason.alt, line),
        );
      }
      tokens.push({ type: "NAME", value, line });
      continue;
    }

    if (ch === "'" || ch === '"') {
      const { token, next } = readString(text, i, ch, line, false);
      tokens.push(token);
      i = next;
      continue;
    }

    const three = text.slice(i, i + 3);
    const two = text.slice(i, i + 2);
    if (MULTI_CHAR_OPS.includes(three)) {
      tokens.push({ type: "OP", value: three, line });
      i += 3;
      continue;
    }
    if (MULTI_CHAR_OPS.includes(two)) {
      tokens.push({ type: "OP", value: two, line });
      i += 2;
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") depthDelta++;
    if (ch === ")" || ch === "]" || ch === "}") depthDelta--;

    if (SINGLE_CHAR_OPS.has(ch)) {
      tokens.push({ type: "OP", value: ch, line });
      i++;
      continue;
    }

    syntaxError(line, `The character '${ch}' isn't recognized.`);
  }

  return { tokens, depthDelta };
}

/** Tokenizes a full program: indentation-aware, bracket-continuation-aware. Produces INDENT/
 * DEDENT/NEWLINE tokens the way Python's own tokenizer does, so the parser can rely on them for
 * block structure instead of re-deriving indentation itself. */
export function tokenize(source: string): Token[] {
  const lines = source.split("\n");
  const tokens: Token[] = [];
  const indentStack = [0];
  let depth = 0;
  let atLineStart = true;

  for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
    const rawLine = lines[lineNo - 1]!;

    if (atLineStart) {
      const withoutIndent = rawLine.replace(/^[ \t]*/, "");
      const isBlankOrComment =
        withoutIndent === "" || withoutIndent.startsWith("#");
      if (isBlankOrComment) {
        continue;
      }
      if (rawLine.includes("\t")) {
        syntaxError(lineNo, "Use spaces for indentation, not tabs.");
      }
      const indent = rawLine.length - withoutIndent.length;
      const top = indentStack[indentStack.length - 1]!;
      if (indent > top) {
        indentStack.push(indent);
        tokens.push({ type: "INDENT", value: "", line: lineNo });
      } else if (indent < top) {
        while (
          indentStack.length > 1 &&
          indentStack[indentStack.length - 1]! > indent
        ) {
          indentStack.pop();
          tokens.push({ type: "DEDENT", value: "", line: lineNo });
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          syntaxError(
            lineNo,
            "This line's indentation doesn't match any earlier block.",
          );
        }
      }

      const { tokens: lineTokens, depthDelta } = tokenizeLine(
        withoutIndent,
        lineNo,
      );
      tokens.push(...lineTokens);
      depth += depthDelta;
      if (depth < 0)
        syntaxError(lineNo, "There's an extra closing bracket here.");
      if (depth === 0) {
        tokens.push({ type: "NEWLINE", value: "", line: lineNo });
      } else {
        atLineStart = false;
      }
    } else {
      // continuation line inside an open bracket — indentation doesn't apply
      const { tokens: lineTokens, depthDelta } = tokenizeLine(rawLine, lineNo);
      tokens.push(...lineTokens);
      depth += depthDelta;
      if (depth < 0)
        syntaxError(lineNo, "There's an extra closing bracket here.");
      if (depth === 0) {
        tokens.push({ type: "NEWLINE", value: "", line: lineNo });
        atLineStart = true;
      }
    }
  }

  if (depth > 0) {
    syntaxError(lines.length, "A bracket opened here is never closed.");
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: "DEDENT", value: "", line: lines.length + 1 });
  }
  tokens.push({ type: "EOF", value: "", line: lines.length + 1 });
  return tokens;
}
