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
  NAME: 'NAME',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  MULTIPLY: 'MULTIPLY',
  DIVIDE: 'DIVIDE',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  COLON: 'COLON',
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
        tokens.push({ type: TOKEN_TYPES.NAME, value: ref });
      } else {
        tokens.push({ type: TOKEN_TYPES.CELL_REF, value: ref + digits });
      }
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
      case ',': tokens.push({ type: TOKEN_TYPES.COMMA }); break;
      case ':': tokens.push({ type: TOKEN_TYPES.COLON }); break;
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
 *   primary    -> NUMBER | CELL_REF | function | '(' expr ')'
 *   function   -> NAME '(' (expr (',' expr)*)? ')'
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

  peekNext() {
    return this.tokens[this.pos + 1] ?? { type: TOKEN_TYPES.EOF };
  }

  peekNextNext() {
    return this.tokens[this.pos + 2] ?? { type: TOKEN_TYPES.EOF };
  }

  expr() {
    let left = this.term();
    while (
      this.peek().type === TOKEN_TYPES.PLUS ||
      this.peek().type === TOKEN_TYPES.MINUS
    ) {
      const op = this.consume();
      const right = this.term();
      this.assertNotRange(left);
      this.assertNotRange(right);
      this.assertNumeric(left);
      this.assertNumeric(right);
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
      this.assertNotRange(left);
      this.assertNotRange(right);
      this.assertNumeric(left);
      this.assertNumeric(right);
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
      if (this.peekNext().type === TOKEN_TYPES.COLON && this.peekNextNext().type === TOKEN_TYPES.CELL_REF) {
        return this.range();
      }
      this.consume();
      this.referencedCells.add(token.value);
      const cellVal = this.getCellValue(token.value);
      if (cellVal === null || cellVal === undefined || cellVal === '') {
        return 0; // Empty cells treated as 0
      }
      if (typeof cellVal === 'string' && cellVal.startsWith('#')) {
        throw new Error(`Referenced cell ${token.value} has error: ${cellVal}`);
      }
      // Return as-is: numbers stay numbers, strings stay strings.
      // This allows string functions (UPPER, LOWER, LEN, etc.) to work
      // with text cells. Arithmetic operators will coerce via JS semantics,
      // and toNumber() in function calls handles explicit conversion.
      if (typeof cellVal === 'number') {
        return cellVal;
      }
      const num = Number(cellVal);
      return isNaN(num) ? cellVal : num;
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

  range() {
    const start = this.consume(TOKEN_TYPES.CELL_REF).value;
    this.consume(TOKEN_TYPES.COLON);
    const end = this.consume(TOKEN_TYPES.CELL_REF).value;

    const cells = expandRange(start, end);
    for (const cellId of cells) {
      this.referencedCells.add(cellId);
    }

    return cells.map((cellId) => {
      const cellVal = this.getCellValue(cellId);
      if (cellVal === null || cellVal === undefined || cellVal === '') {
        return 0;
      }
      if (typeof cellVal === 'string' && cellVal.startsWith('#')) {
        throw new Error(`Referenced cell ${cellId} has error: ${cellVal}`);
      }
      const num = Number(cellVal);
      if (isNaN(num)) {
        throw new Error(`Cell ${cellId} contains non-numeric value: "${cellVal}"`);
      }
      return num;
    });
  }

  functionCall() {
    const nameToken = this.consume(TOKEN_TYPES.NAME);
    const fnName = nameToken.value.toUpperCase();

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

    switch (fnName) {
      case 'SUM':
        return flatArgs.reduce((total, val) => total + val, 0);
      case 'AVERAGE':
        if (flatArgs.length === 0) return 0;
        return flatArgs.reduce((total, val) => total + val, 0) / flatArgs.length;
      case 'MIN':
        if (flatArgs.length === 0) return 0;
        return Math.min(...flatArgs);
      case 'MAX':
        if (flatArgs.length === 0) return 0;
        return Math.max(...flatArgs);
      case 'COUNT':
        return flatArgs.filter((val) => typeof val === 'number' && !isNaN(val)).length;
      case 'ROUND': {
        const value = this.toNumber(flatArgs[0]);
        const digits = flatArgs.length > 1 ? this.toNumber(flatArgs[1]) : 0;
        const factor = Math.pow(10, digits);
        return Math.round(value * factor) / factor;
      }
      case 'ABS':
        return Math.abs(this.toNumber(flatArgs[0]));
      case 'SQRT':
        return Math.sqrt(this.toNumber(flatArgs[0]));
      case 'POWER':
        return Math.pow(this.toNumber(flatArgs[0]), this.toNumber(flatArgs[1]));
      case 'IF':
        return this.toBoolean(flatArgs[0]) ? flatArgs[1] : flatArgs[2];
      case 'AND':
        return flatArgs.every((val) => this.toBoolean(val));
      case 'OR':
        return flatArgs.some((val) => this.toBoolean(val));
      case 'NOT':
        return !this.toBoolean(flatArgs[0]);
      case 'CONCAT':
        return flatArgs.map((val) => this.toText(val)).join('');
      case 'LEFT': {
        const text = this.toText(flatArgs[0]);
        const count = Math.max(0, this.toNumber(flatArgs[1] ?? 1));
        return text.slice(0, count);
      }
      case 'RIGHT': {
        const text = this.toText(flatArgs[0]);
        const count = Math.max(0, this.toNumber(flatArgs[1] ?? 1));
        return count === 0 ? '' : text.slice(-count);
      }
      case 'LEN':
        return this.toText(flatArgs[0]).length;
      case 'UPPER':
        return this.toText(flatArgs[0]).toUpperCase();
      case 'LOWER':
        return this.toText(flatArgs[0]).toLowerCase();
      case 'TODAY':
        return this.formatDate(new Date(), false);
      case 'NOW':
        return this.formatDate(new Date(), true);
      case 'DATE': {
        const year = this.toNumber(flatArgs[0]);
        const month = this.toNumber(flatArgs[1]);
        const day = this.toNumber(flatArgs[2]);
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) throw new Error('Invalid DATE');
        return this.formatDate(date, false);
      }
      case 'YEAR': {
        const date = this.toDate(flatArgs[0]);
        return date.getFullYear();
      }
      case 'MONTH': {
        const date = this.toDate(flatArgs[0]);
        return date.getMonth() + 1;
      }
      case 'DAY': {
        const date = this.toDate(flatArgs[0]);
        return date.getDate();
      }
      default:
        throw new Error(`Unknown function: ${fnName}`);
    }
  }

  assertNotRange(value) {
    if (Array.isArray(value)) {
      throw new Error('Range can only be used inside functions');
    }
  }

  assertNumeric(value) {
    if (typeof value === 'string' && isNaN(Number(value))) {
      throw new Error(`Cannot use text value "${value}" in arithmetic`);
    }
  }

  toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Expected number but got "${value}"`);
    }
    return num;
  }

  toText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.trim() !== '' && value.toLowerCase() !== 'false';
    return Boolean(value);
  }

  toDate(value) {
    if (value instanceof Date) return value;
    const date = new Date(this.toText(value));
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: "${value}"`);
    }
    return date;
  }

  formatDate(date, withTime) {
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    if (!withTime) return `${year}-${month}-${day}`;
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === TOKEN_TYPES.CELL_REF) {
        const next = tokens[i + 1];
        const nextNext = tokens[i + 2];
        if (next?.type === TOKEN_TYPES.COLON && nextNext?.type === TOKEN_TYPES.CELL_REF) {
          const cells = expandRange(token.value, nextNext.value);
          for (const cellId of cells) refs.add(cellId);
          i += 2;
        } else {
          refs.add(token.value);
        }
      }
    }
  } catch {
    // If tokenization fails, still return whatever we found
  }
  return refs;
}

function splitCellId(cellId) {
  const match = cellId.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: "${cellId}"`);
  return { col: match[1], row: Number(match[2]) };
}

function colToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

function indexToCol(index) {
  let n = index + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function expandRange(start, end) {
  const startParts = splitCellId(start);
  const endParts = splitCellId(end);
  const startCol = colToIndex(startParts.col);
  const endCol = colToIndex(endParts.col);
  const startRow = startParts.row;
  const endRow = endParts.row;

  const colMin = Math.min(startCol, endCol);
  const colMax = Math.max(startCol, endCol);
  const rowMin = Math.min(startRow, endRow);
  const rowMax = Math.max(startRow, endRow);

  const cells = [];
  for (let c = colMin; c <= colMax; c++) {
    for (let r = rowMin; r <= rowMax; r++) {
      cells.push(`${indexToCol(c)}${r}`);
    }
  }
  return cells;
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
