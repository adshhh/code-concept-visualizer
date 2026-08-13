export type TokenType =
  "NAME" | "NUMBER" | "STRING" | "OP" | "NEWLINE" | "INDENT" | "DEDENT" | "EOF";

export interface FStringLiteralPart {
  kind: "literal";
  text: string;
}

export interface FStringExprPart {
  kind: "expr";
  tokens: Token[];
  line: number;
}

export type FStringPart = FStringLiteralPart | FStringExprPart;

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  /** Only set on STRING tokens that are f-strings. */
  fstringParts?: FStringPart[];
}

export interface ValidationOk {
  ok: true;
}

export interface ValidationRejected {
  ok: false;
  line: number;
  message: string;
}

export type ValidationResult = ValidationOk | ValidationRejected;

/** Thrown by the tokenizer or parser the moment an out-of-scope construct (or a plain syntax
 * error) is found. Carries exactly what `validate()` needs to report — nothing more. */
export class RejectionError extends Error {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(message);
    this.name = "RejectionError";
  }
}
