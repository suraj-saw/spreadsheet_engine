/**
 * @module engine/parser
 * @description Recursive descent parser and evaluator for spreadsheet formulas.
 *
 * Parses formulas like "=A1+B2", "=SUM(A1:A3)", "=(C1+D1)/3".
 * Supports: arithmetic (+,-,*,/), parentheses, cell references,
 * range references (A1:C3), and built-in functions.
 *
 * Grammar:
 *   expr     → term (('+' | '-') term)*
 *   term     → unary (('*' | '/') unary)*
 *   unary    → ('-' | '+') unary | primary
 *   primary  → NUMBER | CELL_REF | range | function | '(' expr ')'
 *   range    → CELL_REF ':' CELL_REF
 *   function → NAME '(' (expr (',' expr)*)? ')'
 */

import { TOKEN_TYPES, tokenize } from './tokenizer.js';
import { expandRange } from './rangeUtils.js';
import { executeFunction } from './builtinFunctions.js';

/**
 * Recursive descent parser for spreadsheet formulas.
 * Tracks referenced cells for dependency management.
 */
class Parser {
  /**
   * @param {Array} tokens - Token array from the tokenizer
   * @param {Function} getCellValue - Resolver: cellId → computed value
   */
  constructor(tokens, getCellValue) {
    this.tokens = tokens;
    this.pos = 0;
    this.getCellValue = getCellValue;
    this.referencedCells = new Set();
  }

  peek() { return this.tokens[this.pos]; }
  peekNext() { return this.tokens[this.pos + 1] ?? { type: TOKEN_TYPES.EOF }; }
  peekNextNext() { return this.tokens[this.pos + 2] ?? { type: TOKEN_TYPES.EOF }; }

  consume(expectedType) {
    const token = this.tokens[this.pos];
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  /** Parse the full expression and ensure all tokens are consumed. */
  parse() {
    const result = this.expr();
    if (this.peek().type !== TOKEN_TYPES.EOF) {
      throw new Error('Unexpected token after expression');
    }
    return result;
  }

  /** expr → term (('+' | '-') term)* */
  expr() {
    let left = this.term();
    while (this.peek().type === TOKEN_TYPES.PLUS || this.peek().type === TOKEN_TYPES.MINUS) {
      const op = this.consume();
      const right = this.term();
      this.assertNotRange(left);
      this.assertNotRange(right);
      this.assertNumeric(left);
      this.assertNumeric(right);
      left = op.type === TOKEN_TYPES.PLUS ? left + right : left - right;
    }
    return left;
  }

  /** term → unary (('*' | '/') unary)* */
  term() {
    let left = this.unary();
    while (this.peek().type === TOKEN_TYPES.MULTIPLY || this.peek().type === TOKEN_TYPES.DIVIDE) {
      const op = this.consume();
      const right = this.unary();
      this.assertNotRange(left);
      this.assertNotRange(right);
      this.assertNumeric(left);
      this.assertNumeric(right);
      if (op.type === TOKEN_TYPES.MULTIPLY) {
        left = left * right;
      } else {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      }
    }
    return left;
  }

  /** unary → ('-' | '+') unary | primary */
  unary() {
    if (this.peek().type === TOKEN_TYPES.MINUS) { this.consume(); return -this.unary(); }
    if (this.peek().type === TOKEN_TYPES.PLUS) { this.consume(); return this.unary(); }
    return this.primary();
  }

  /** primary → NUMBER | CELL_REF | range | function | '(' expr ')' */
  primary() {
    const token = this.peek();

    if (token.type === TOKEN_TYPES.NUMBER) {
      this.consume();
      return token.value;
    }

    if (token.type === TOKEN_TYPES.CELL_REF) {
      if (this.peekNext().type === TOKEN_TYPES.COLON && this.peekNextNext().type === TOKEN_TYPES.CELL_REF) {
        return this.range();
      }
      return this.cellRef();
    }

    if (token.type === TOKEN_TYPES.NAME && this.peekNext().type === TOKEN_TYPES.LPAREN) {
      return this.functionCall();
    }

    if (token.type === TOKEN_TYPES.LPAREN) {
      this.consume();
      const result = this.expr();
      this.consume(TOKEN_TYPES.RPAREN);
      return result;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  /** Resolve a single cell reference to its value. */
  cellRef() {
    const token = this.consume();
    this.referencedCells.add(token.value);
    const cellVal = this.getCellValue(token.value);

    if (cellVal === null || cellVal === undefined || cellVal === '') return 0;
    if (typeof cellVal === 'string' && cellVal.startsWith('#')) {
      throw new Error(`Referenced cell ${token.value} has error: ${cellVal}`);
    }
    if (typeof cellVal === 'number') return cellVal;
    const num = Number(cellVal);
    return isNaN(num) ? cellVal : num;
  }

  /** range → CELL_REF ':' CELL_REF — returns an array of values. */
  range() {
    const start = this.consume(TOKEN_TYPES.CELL_REF).value;
    this.consume(TOKEN_TYPES.COLON);
    const end = this.consume(TOKEN_TYPES.CELL_REF).value;

    const cells = expandRange(start, end);
    for (const id of cells) this.referencedCells.add(id);

    return cells.map((id) => {
      const val = this.getCellValue(id);
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'string' && val.startsWith('#')) {
        throw new Error(`Referenced cell ${id} has error: ${val}`);
      }
      const num = Number(val);
      if (isNaN(num)) throw new Error(`Cell ${id} contains non-numeric value: "${val}"`);
      return num;
    });
  }

  /** function → NAME '(' (expr (',' expr)*)? ')' */
  functionCall() {
    const fnName = this.consume(TOKEN_TYPES.NAME).value.toUpperCase();
    this.consume(TOKEN_TYPES.LPAREN);

    const args = [];
    if (this.peek().type !== TOKEN_TYPES.RPAREN) {
      args.push(this.expr());
      while (this.peek().type === TOKEN_TYPES.COMMA) {
        this.consume(TOKEN_TYPES.COMMA);
        args.push(this.expr());
      }
    }
    this.consume(TOKEN_TYPES.RPAREN);

    const flatArgs = args.flatMap((val) => Array.isArray(val) ? val : [val]);
    return executeFunction(fnName, flatArgs);
  }

  // --- Assertion helpers ---

  assertNotRange(value) {
    if (Array.isArray(value)) throw new Error('Range can only be used inside functions');
  }

  assertNumeric(value) {
    if (typeof value === 'string' && isNaN(Number(value))) {
      throw new Error(`Cannot use text value "${value}" in arithmetic`);
    }
  }
}

/**
 * Extract cell references from a formula without evaluating it.
 * Used for dependency tracking before evaluation.
 *
 * @param {string} formula - The formula string (starting with '=')
 * @returns {Set<string>} Set of referenced cell IDs (e.g., {"A1", "B2"})
 */
export function extractReferences(formula) {
  const refs = new Set();
  if (!formula || !formula.startsWith('=')) return refs;

  const raw = formula.slice(1).trim();
  if (raw.length === 0) return refs;

  try {
    const tokens = tokenize(raw);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === TOKEN_TYPES.CELL_REF) {
        const next = tokens[i + 1];
        const nextNext = tokens[i + 2];
        if (next?.type === TOKEN_TYPES.COLON && nextNext?.type === TOKEN_TYPES.CELL_REF) {
          const cells = expandRange(token.value, nextNext.value);
          for (const id of cells) refs.add(id);
          i += 2;
        } else {
          refs.add(token.value);
        }
      }
    }
  } catch {
    // If tokenization fails, return whatever refs we found
  }
  return refs;
}

/**
 * Evaluate a formula string and return its computed value.
 *
 * @param {string} formula - The formula (must start with '=')
 * @param {Function} getCellValue - Resolver: cellId → computed value
 * @returns {{ value: number|string, refs: Set<string> }}
 * @throws {Error} If the formula is invalid or evaluation fails
 */
export function evaluateFormula(formula, getCellValue) {
  if (!formula || !formula.startsWith('=')) {
    throw new Error('Not a formula');
  }

  const raw = formula.slice(1).trim();
  if (raw.length === 0) throw new Error('Empty formula');

  const tokens = tokenize(raw);
  const parser = new Parser(tokens, getCellValue);
  const value = parser.parse();
  return { value, refs: parser.referencedCells };
}
