/**
 * @module engine/tokenizer
 * @description Tokenizer for spreadsheet formulas.
 * Converts raw formula strings into token streams for the recursive descent parser.
 */

/** Token type constants used throughout the parser pipeline */
export const TOKEN_TYPES = {
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
 * Tokenize a formula string (without the leading '=').
 *
 * Handles: numbers (int/decimal), cell references (A1, J10),
 * function names (SUM, IF), operators (+,-,*,/), parens, commas, colons.
 *
 * @param {string} input - The formula body (after '=')
 * @returns {Array<{type: string, value?: number|string}>} Array of tokens
 * @throws {Error} If an unexpected character is encountered
 */
export function tokenize(input) {
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

    // Cell references (e.g. A1, J10) or function names (e.g. SUM, IF)
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

    // Operators & punctuation
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
