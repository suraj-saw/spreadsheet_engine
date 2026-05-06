/**
 * Formula Parser & Evaluator
 * 
 * Parses formulas like "=A1+B2", "=A1*2", "=(C1+D1)/3"
 * Supports: +, -, *, /, parentheses, cell references, numbers
 * 
 * Uses a recursive descent parser for correct operator precedence.
 */

// Tokenizer
const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  CELL_REF: 'CELL_REF',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  MULTIPLY: 'MULTIPLY',
  DIVIDE: 'DIVIDE',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF',
};

/**
 * Tokenize a formula string (without the leading '=')
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (integers and decimals)
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      let num = '';
      while (i < input.length && (/[0-9]/.test(input[i]) || input[i] === '.')) {
        num += input[i];
        i++;
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) });
      continue;
    }

    // Cell references like A1, J10, AA1 etc. (letters followed by digits)
    if (/[A-Za-z]/.test(ch)) {
      let ref = '';
      while (i < input.length && /[A-Za-z]/.test(input[i])) {
        ref += input[i].toUpperCase();
        i++;
      }
      let digits = '';
      while (i < input.length && /[0-9]/.test(input[i])) {
        digits += input[i];
        i++;
      }
      if (digits.length === 0) {
        throw new Error(`Invalid reference: "${ref}" — expected a row number`);
      }
      tokens.push({ type: TOKEN_TYPES.CELL_REF, value: ref + digits });
      continue;
    }

    // Operators & parens
    switch (ch) {
      case '+': tokens.push({ type: TOKEN_TYPES.PLUS }); break;
      case '-': tokens.push({ type: TOKEN_TYPES.MINUS }); break;
      case '*': tokens.push({ type: TOKEN_TYPES.MULTIPLY }); break;
      case '/': tokens.push({ type: TOKEN_TYPES.DIVIDE }); break;
      case '(': tokens.push({ type: TOKEN_TYPES.LPAREN }); break;
      case ')': tokens.push({ type: TOKEN_TYPES.RPAREN }); break;
      default:
        throw new Error(`Unexpected character: "${ch}"`);
    }
    i++;
  }

  tokens.push({ type: TOKEN_TYPES.EOF });
  return tokens;
}

/**
 * Recursive descent parser
 * 
 * Grammar:
 *   expr       -> term (('+' | '-') term)*
 *   term       -> unary (('*' | '/') unary)*
 *   unary      -> ('-' | '+') unary | primary
 *   primary    -> NUMBER | CELL_REF | '(' expr ')'
 */
class Parser {
  constructor(tokens, getCellValue) {
    this.tokens = tokens;
    this.pos = 0;
    this.getCellValue = getCellValue;
    this.referencedCells = new Set();
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expectedType) {
    const token = this.tokens[this.pos];
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  parse() {
    const result = this.expr();
    if (this.peek().type !== TOKEN_TYPES.EOF) {
      throw new Error('Unexpected token after expression');
    }
    return result;
  }

  expr() {
    let left = this.term();
    while (
      this.peek().type === TOKEN_TYPES.PLUS ||
      this.peek().type === TOKEN_TYPES.MINUS
    ) {
      const op = this.consume();
      const right = this.term();
      if (op.type === TOKEN_TYPES.PLUS) {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    return left;
  }

  term() {
    let left = this.unary();
    while (
      this.peek().type === TOKEN_TYPES.MULTIPLY ||
      this.peek().type === TOKEN_TYPES.DIVIDE
    ) {
      const op = this.consume();
      const right = this.unary();
      if (op.type === TOKEN_TYPES.MULTIPLY) {
        left = left * right;
      } else {
        if (right === 0) {
          throw new Error('Division by zero');
        }
        left = left / right;
      }
    }
    return left;
  }

  unary() {
    if (this.peek().type === TOKEN_TYPES.MINUS) {
      this.consume();
      return -this.unary();
    }
    if (this.peek().type === TOKEN_TYPES.PLUS) {
      this.consume();
      return this.unary();
    }
    return this.primary();
  }

  primary() {
    const token = this.peek();

    if (token.type === TOKEN_TYPES.NUMBER) {
      this.consume();
      return token.value;
    }

    if (token.type === TOKEN_TYPES.CELL_REF) {
      this.consume();
      this.referencedCells.add(token.value);
      const cellVal = this.getCellValue(token.value);
      if (cellVal === null || cellVal === undefined || cellVal === '') {
        return 0; // Empty cells treated as 0
      }
      if (typeof cellVal === 'string' && cellVal.startsWith('#')) {
        throw new Error(`Referenced cell ${token.value} has error: ${cellVal}`);
      }
      const num = Number(cellVal);
      if (isNaN(num)) {
        throw new Error(`Cell ${token.value} contains non-numeric value: "${cellVal}"`);
      }
      return num;
    }

    if (token.type === TOKEN_TYPES.LPAREN) {
      this.consume();
      const result = this.expr();
      this.consume(TOKEN_TYPES.RPAREN);
      return result;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }
}

/**
 * Extract cell references from a formula without evaluating it.
 * Returns a Set of cell IDs (e.g., {"A1", "B2"}).
 */
export function extractReferences(formula) {
  const refs = new Set();
  if (!formula || !formula.startsWith('=')) return refs;

  const raw = formula.slice(1).trim();
  if (raw.length === 0) return refs;

  try {
    const tokens = tokenize(raw);
    for (const token of tokens) {
      if (token.type === TOKEN_TYPES.CELL_REF) {
        refs.add(token.value);
      }
    }
  } catch {
    // If tokenization fails, still return whatever we found
  }
  return refs;
}

/**
 * Evaluate a formula string.
 * @param {string} formula - The formula (starting with '=')
 * @param {Function} getCellValue - Function that returns a cell's computed value given its ID
 * @returns {{ value: number|string, refs: Set<string> }}
 */
export function evaluateFormula(formula, getCellValue) {
  if (!formula || !formula.startsWith('=')) {
    throw new Error('Not a formula');
  }

  const raw = formula.slice(1).trim();
  if (raw.length === 0) {
    throw new Error('Empty formula');
  }

  const tokens = tokenize(raw);
  const parser = new Parser(tokens, getCellValue);
  const value = parser.parse();
  return { value, refs: parser.referencedCells };
}
