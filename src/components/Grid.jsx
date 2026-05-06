import { useMemo } from 'react';
import { useSpreadsheet } from '../context/SpreadsheetContext';
import Cell from './Cell';

/**
 * Generate column label from index: 0->A, 1->B, ..., 25->Z
 */
function colLabel(index) {
  return String.fromCharCode(65 + index);
}

/**
 * The main spreadsheet grid.
 * Renders column headers, row headers, and a Cell for each position.
 */
export default function Grid() {
  const { rows, cols, version } = useSpreadsheet();

  const columns = useMemo(() => {
    return Array.from({ length: cols }, (_, i) => colLabel(i));
  }, [cols]);

  const rowNumbers = useMemo(() => {
    return Array.from({ length: rows }, (_, i) => i + 1);
  }, [rows]);

  return (
    <div className="grid-wrapper">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `48px repeat(${cols}, 1fr)`,
          gridTemplateRows: `36px repeat(${rows}, 1fr)`,
        }}
      >
        {/* Top-left corner */}
        <div className="grid__corner"></div>

        {/* Column headers */}
        {columns.map((col) => (
          <div key={col} className="grid__col-header">
            {col}
          </div>
        ))}

        {/* Rows */}
        {rowNumbers.map((rowNum) => (
          <RowCells key={rowNum} rowNum={rowNum} columns={columns} version={version} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a single row: row header + cells.
 * Passes version to each Cell so they re-render when data changes.
 */
function RowCells({ rowNum, columns, version }) {
  return (
    <>
      <div className="grid__row-header">{rowNum}</div>
      {columns.map((col) => {
        const cellId = `${col}${rowNum}`;
        return <Cell key={cellId} cellId={cellId} version={version} />;
      })}
    </>
  );
}
