/**
 * @module engine
 * @description Public API for the spreadsheet engine.
 * Re-exports the engine class and formula utilities.
 */
export { SpreadsheetEngine } from './SpreadsheetEngine.js';
export { evaluateFormula, extractReferences } from './parser.js';
