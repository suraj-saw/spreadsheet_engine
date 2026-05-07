/**
 * @module engine/typeHelpers
 * @description Type conversion utilities for formula evaluation.
 * Provides safe conversions between numbers, booleans, strings, and dates
 * with descriptive error messages for invalid conversions.
 */

/**
 * Convert a value to a number. Booleans become 0/1.
 * @param {*} value
 * @returns {number}
 * @throws {Error} If the value cannot be converted to a number
 */
export function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Expected number but got "${value}"`);
  }
  return num;
}

/**
 * Convert a value to a boolean.
 * Numbers: 0 → false, non-zero → true.
 * Strings: empty or "false" → false, otherwise → true.
 * @param {*} value
 * @returns {boolean}
 */
export function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '' && value.toLowerCase() !== 'false';
  return Boolean(value);
}

/**
 * Convert a value to a string.
 * @param {*} value
 * @returns {string}
 */
export function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Convert a value to a Date object.
 * @param {*} value
 * @returns {Date}
 * @throws {Error} If the value cannot be parsed as a date
 */
export function toDate(value) {
  if (value instanceof Date) return value;
  const date = new Date(toText(value));
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${value}"`);
  }
  return date;
}

/**
 * Format a Date as a string.
 * @param {Date} date
 * @param {boolean} withTime - If true, include HH:MM:SS
 * @returns {string} Formatted date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
 */
export function formatDate(date, withTime) {
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
