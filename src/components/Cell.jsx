/**
 * @module components/Cell
 * @description Individual spreadsheet cell component.
 * Shows the computed value when not focused, raw formula when editing.
 * Includes Excel-like autocomplete for cell references and functions.
 *
 * All editing logic is delegated to the useCellEditor hook.
 * Autocomplete UI is rendered by the CellSuggestions component.
 */

import { memo } from 'react';
import { useSpreadsheet } from '../context/SpreadsheetContext';
import { useCellEditor } from '../hooks/useCellEditor';
import CellSuggestions from './CellSuggestions';

const Cell = memo(function Cell({ cellId, version }) {
  const {
    getCellValue, getRawValue, setCellValue, isError, isCircular,
    rows, cols, setActiveEditor, clearActiveEditor, insertReferenceFromClick,
  } = useSpreadsheet();

  // Read values from engine (version forces re-read)
  const computedValue = getCellValue(cellId);
  const rawValue = getRawValue(cellId);
  const hasError = isError(cellId);
  const hasCircular = isCircular(cellId);

  // All editing state and handlers from custom hook
  const editor = useCellEditor({
    cellId, rawValue, setCellValue, setActiveEditor,
    clearActiveEditor, insertReferenceFromClick,
    getCellValue, getRawValue, rows, cols,
  });

  // Format display value
  let displayValue = computedValue;
  if (displayValue === undefined || displayValue === null) displayValue = '';
  if (typeof displayValue === 'number') {
    displayValue = Number.isInteger(displayValue) ? displayValue : parseFloat(displayValue.toFixed(10));
  }

  // Determine cell styling class
  let cellClass = 'cell';
  if (hasCircular) cellClass += ' cell--circular';
  else if (hasError) cellClass += ' cell--error';
  else if (typeof rawValue === 'string' && rawValue.startsWith('=')) cellClass += ' cell--formula';

  return (
    <div className={cellClass} data-cell-id={cellId} onMouseDown={editor.handleCellMouseDown}>
      <input
        ref={editor.inputRef}
        className="cell__input"
        value={editor.isEditing ? editor.editValue : String(displayValue)}
        onChange={editor.handleChange}
        onFocus={editor.handleFocus}
        onBlur={editor.handleBlur}
        onKeyDown={editor.handleKeyDown}
        onKeyUp={editor.handleCursorUpdate}
        onClick={editor.handleCursorUpdate}
        spellCheck={false}
        autoComplete="off"
        id={`cell-${cellId}`}
      />

      {/* Formula indicator badge */}
      {!editor.isEditing && typeof rawValue === 'string' && rawValue.startsWith('=') && !hasError && !hasCircular && (
        <span className="cell__formula-indicator" title={rawValue}>ƒ</span>
      )}

      {/* Function signature hint */}
      {editor.isEditing && editor.functionHint && (
        <div className="cell__hint">
          <span className="cell__hint-name">{editor.functionHint.name}</span>
          <span className="cell__hint-signature">{editor.functionHint.signature}</span>
          <span className="cell__hint-arg">
            Arg {editor.functionHint.argIndex + 1}
            {editor.functionHint.argName ? `: ${editor.functionHint.argName}` : ''}
          </span>
        </div>
      )}

      {/* Autocomplete dropdown */}
      {editor.showSuggestions && editor.suggestions.length > 0 && (
        <CellSuggestions
          functionSuggestions={editor.functionSuggestions}
          cellSuggestions={editor.cellSuggestions}
          selectedIndex={editor.selectedSuggestion}
          hasHint={!!editor.functionHint}
          onApply={editor.applySuggestion}
          getCellValue={getCellValue}
          getRawValue={getRawValue}
          containerRef={editor.suggestionsRef}
        />
      )}
    </div>
  );
});

export default Cell;
