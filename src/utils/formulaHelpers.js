/**
 * @module utils/formulaHelpers
 * @description Pure utility functions for formula editing assistance.
 * Used by the cell editor hook for autocomplete and inline hints.
 */

import { FORMULA_FUNCTIONS } from '../constants/formulaFunctions';

/**
 * Generate all valid cell IDs for the grid.
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @returns {string[]} Array of cell IDs (e.g., ["A1", "A2", ..., "J10"])
 */
export function generateAllCellIds(rows, cols) {
  const ids = [];
  for (let c = 0; c < cols; c++) {
    const col = String.fromCharCode(65 + c);
    for (let r = 1; r <= rows; r++) {
      ids.push(`${col}${r}`);
    }
  }
  return ids;
}

/**
 * Extract the partial cell reference or function name at the cursor position.
 * Used to determine what autocomplete suggestions to show.
 *
 * @param {string} value - Current input value
 * @param {number} cursorPos - Current cursor position
 * @returns {{ match: string, startIndex: number, kind: 'cell'|'word' } | null}
 */
export function getPartialRef(value, cursorPos) {
  if (!value.startsWith('=')) return null;
  const beforeCursor = value.slice(0, cursorPos);
  const match = beforeCursor.match(/([A-Za-z][A-Za-z0-9]*)$/);
  if (!match) return null;
  const matchValue = match[1].toUpperCase();
  const kind = /\d/.test(matchValue) ? 'cell' : 'word';
  return { match: matchValue, startIndex: match.index, kind };
}

/**
 * Find the range of the current function argument at the cursor position.
 * Used to determine which argument slot to replace when clicking a cell reference.
 *
 * @param {string} value - Current input value
 * @param {number} cursor - Current cursor position
 * @returns {{ start: number, end: number } | null}
 */
export function getCurrentArgumentRange(value, cursor) {
  if (!value.startsWith('=')) return null;
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/([A-Za-z][A-Za-z0-9]*)\([^()]*$/);
  if (!match) return null;

  const fnStart = match.index + match[1].length + 1;
  let depth = 1;
  let endIndex = fnStart;
  for (let i = fnStart; i < value.length; i++) {
    if (value[i] === '(') depth += 1;
    if (value[i] === ')') depth -= 1;
    if (depth === 0) { endIndex = i; break; }
  }
  if (depth !== 0) return null;

  const segment = value.slice(fnStart, endIndex);
  const relCursor = Math.max(0, cursor - fnStart);
  let currentStart = 0;
  for (let i = 0; i <= segment.length; i++) {
    if (i === segment.length || segment[i] === ',') {
      if (relCursor >= currentStart && relCursor <= i) {
        return { start: fnStart + currentStart, end: fnStart + i };
      }
      currentStart = i + 1;
    }
  }
  return null;
}

/**
 * Get the function hint (name, signature, current argument) for inline display.
 *
 * @param {string} value - Current input value
 * @param {number} cursor - Current cursor position
 * @returns {{ name: string, signature: string, argIndex: number, argName: string } | null}
 */
export function getFunctionHint(value, cursor) {
  if (!value.startsWith('=')) return null;
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/([A-Za-z][A-Za-z0-9]*)\([^()]*$/);
  if (!match) return null;

  const name = match[1].toUpperCase();
  const fn = FORMULA_FUNCTIONS.find((item) => item.name === name);
  if (!fn) return null;

  const argsText = beforeCursor.slice(match.index + name.length + 1);
  const argIndex = argsText.length === 0 ? 0 : argsText.split(',').length - 1;
  const argList = fn.signature
    .slice(fn.signature.indexOf('(') + 1, fn.signature.lastIndexOf(')'))
    .split(',')
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);
  const argName = argList[argIndex] ?? argList[argList.length - 1] ?? '';

  return { name, signature: fn.signature, argIndex, argName };
}
