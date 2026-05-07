/**
 * @module constants/formulaFunctions
 * @description Metadata for all built-in spreadsheet functions.
 * Used by the autocomplete dropdown to show function names,
 * signatures, and descriptions while editing formulas.
 */

export const FORMULA_FUNCTIONS = [
  // --- Math / Aggregate ---
  { name: 'SUM',     signature: 'SUM(number1, ...)',              description: 'Add numbers together' },
  { name: 'AVERAGE', signature: 'AVERAGE(number1, ...)',          description: 'Average of numbers' },
  { name: 'MIN',     signature: 'MIN(number1, ...)',              description: 'Smallest value' },
  { name: 'MAX',     signature: 'MAX(number1, ...)',              description: 'Largest value' },
  { name: 'COUNT',   signature: 'COUNT(value1, ...)',             description: 'Count numeric values' },
  { name: 'ROUND',   signature: 'ROUND(number, digits)',          description: 'Round to digits' },
  { name: 'ABS',     signature: 'ABS(number)',                    description: 'Absolute value' },
  { name: 'SQRT',    signature: 'SQRT(number)',                   description: 'Square root' },
  { name: 'POWER',   signature: 'POWER(base, exponent)',          description: 'Exponentiation' },

  // --- Logical ---
  { name: 'IF',      signature: 'IF(condition, trueVal, falseVal)', description: 'Conditional value' },
  { name: 'AND',     signature: 'AND(condition1, ...)',           description: 'True if all conditions are true' },
  { name: 'OR',      signature: 'OR(condition1, ...)',            description: 'True if any condition is true' },
  { name: 'NOT',     signature: 'NOT(condition)',                 description: 'Invert a condition' },

  // --- Text ---
  { name: 'CONCAT',  signature: 'CONCAT(text1, ...)',            description: 'Join text' },
  { name: 'LEFT',    signature: 'LEFT(text, count)',              description: 'Left substring' },
  { name: 'RIGHT',   signature: 'RIGHT(text, count)',             description: 'Right substring' },
  { name: 'LEN',     signature: 'LEN(text)',                      description: 'Text length' },
  { name: 'UPPER',   signature: 'UPPER(text)',                    description: 'Uppercase text' },
  { name: 'LOWER',   signature: 'LOWER(text)',                    description: 'Lowercase text' },

  // --- Date ---
  { name: 'TODAY',   signature: 'TODAY()',                        description: 'Current date' },
  { name: 'NOW',     signature: 'NOW()',                          description: 'Current date and time' },
  { name: 'DATE',    signature: 'DATE(year, month, day)',         description: 'Create a date' },
  { name: 'YEAR',    signature: 'YEAR(date)',                     description: 'Year from date' },
  { name: 'MONTH',   signature: 'MONTH(date)',                    description: 'Month from date' },
  { name: 'DAY',     signature: 'DAY(date)',                      description: 'Day from date' },
];
