/**
 * @module engine/builtinFunctions
 * @description Built-in spreadsheet function implementations.
 * Each function receives flattened arguments and type conversion helpers.
 *
 * Supported functions: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, SQRT,
 * POWER, IF, AND, OR, NOT, CONCAT, LEFT, RIGHT, LEN, UPPER, LOWER,
 * TODAY, NOW, DATE, YEAR, MONTH, DAY.
 */

import { toNumber, toBoolean, toText, toDate, formatDate } from './typeHelpers.js';

/**
 * Execute a built-in spreadsheet function by name.
 *
 * @param {string} fnName     - Uppercase function name (e.g. "SUM")
 * @param {Array}  flatArgs   - Flattened argument values (ranges already expanded)
 * @returns {number|string|boolean} The computed result
 * @throws {Error} If the function name is unknown
 */
export function executeFunction(fnName, flatArgs) {
  switch (fnName) {
    // --- Math / Aggregate ---
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
      const value = toNumber(flatArgs[0]);
      const digits = flatArgs.length > 1 ? toNumber(flatArgs[1]) : 0;
      const factor = Math.pow(10, digits);
      return Math.round(value * factor) / factor;
    }
    case 'ABS':
      return Math.abs(toNumber(flatArgs[0]));
    case 'SQRT':
      return Math.sqrt(toNumber(flatArgs[0]));
    case 'POWER':
      return Math.pow(toNumber(flatArgs[0]), toNumber(flatArgs[1]));

    // --- Logical ---
    case 'IF':
      return toBoolean(flatArgs[0]) ? flatArgs[1] : flatArgs[2];
    case 'AND':
      return flatArgs.every((val) => toBoolean(val));
    case 'OR':
      return flatArgs.some((val) => toBoolean(val));
    case 'NOT':
      return !toBoolean(flatArgs[0]);

    // --- Text ---
    case 'CONCAT':
      return flatArgs.map((val) => toText(val)).join('');
    case 'LEFT': {
      const text = toText(flatArgs[0]);
      const count = Math.max(0, toNumber(flatArgs[1] ?? 1));
      return text.slice(0, count);
    }
    case 'RIGHT': {
      const text = toText(flatArgs[0]);
      const count = Math.max(0, toNumber(flatArgs[1] ?? 1));
      return count === 0 ? '' : text.slice(-count);
    }
    case 'LEN':
      return toText(flatArgs[0]).length;
    case 'UPPER':
      return toText(flatArgs[0]).toUpperCase();
    case 'LOWER':
      return toText(flatArgs[0]).toLowerCase();

    // --- Date ---
    case 'TODAY':
      return formatDate(new Date(), false);
    case 'NOW':
      return formatDate(new Date(), true);
    case 'DATE': {
      const year = toNumber(flatArgs[0]);
      const month = toNumber(flatArgs[1]);
      const day = toNumber(flatArgs[2]);
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) throw new Error('Invalid DATE');
      return formatDate(date, false);
    }
    case 'YEAR': {
      const date = toDate(flatArgs[0]);
      return date.getFullYear();
    }
    case 'MONTH': {
      const date = toDate(flatArgs[0]);
      return date.getMonth() + 1;
    }
    case 'DAY': {
      const date = toDate(flatArgs[0]);
      return date.getDate();
    }

    default:
      throw new Error(`Unknown function: ${fnName}`);
  }
}
