/**
 * @module engine/rangeUtils
 * @description Utilities for cell range operations.
 * Handles parsing cell IDs and expanding range references (e.g., A1:C3)
 * into arrays of individual cell IDs.
 */

/**
 * Split a cell ID into its column and row parts.
 * @param {string} cellId - e.g. "A1", "BC23"
 * @returns {{ col: string, row: number }}
 * @throws {Error} If the cell reference format is invalid
 */
export function splitCellId(cellId) {
  const match = cellId.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: "${cellId}"`);
  return { col: match[1], row: Number(match[2]) };
}

/**
 * Convert a column letter string to a 0-based index.
 * @param {string} col - e.g. "A" → 0, "B" → 1, "Z" → 25, "AA" → 26
 * @returns {number}
 */
export function colToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert a 0-based column index to a letter string.
 * @param {number} index - e.g. 0 → "A", 25 → "Z", 26 → "AA"
 * @returns {string}
 */
export function indexToCol(index) {
  let n = index + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

/**
 * Expand a cell range into an array of individual cell IDs.
 * Handles ranges in any direction (e.g., C3:A1 works the same as A1:C3).
 *
 * @param {string} start - Start cell ID (e.g. "A1")
 * @param {string} end   - End cell ID (e.g. "C3")
 * @returns {string[]} Array of cell IDs in the range
 */
export function expandRange(start, end) {
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
