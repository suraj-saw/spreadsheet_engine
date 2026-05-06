import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useSpreadsheet } from '../context/SpreadsheetContext';

/**
 * Generate all valid cell IDs for autocomplete
 */
function generateAllCellIds(rows, cols) {
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
 * Individual spreadsheet cell component.
 * Shows computed value when not focused, raw formula when editing.
 * Includes Excel-like autocomplete for cell references in formulas.
 */
const Cell = memo(function Cell({ cellId, version }) {
  const { getCellValue, getRawValue, setCellValue, isError, isCircular, rows, cols } = useSpreadsheet();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const allCellIds = useRef(generateAllCellIds(rows, cols));

  // Read latest values from engine (version forces re-read)
  const computedValue = getCellValue(cellId);
  const rawValue = getRawValue(cellId);
  const hasError = isError(cellId);
  const hasCircular = isCircular(cellId);

  /**
   * Extract the partial cell reference being typed at the cursor position.
   * Returns { match, startIndex } or null.
   */
  const getPartialRef = useCallback((value, cursorPos) => {
    if (!value.startsWith('=')) return null;
    // Look backwards from cursor for a letter sequence (possibly followed by digits)
    const beforeCursor = value.slice(0, cursorPos);
    // Match a partial cell reference at the end: e.g. "=A", "=A1", "=B1+C"
    const match = beforeCursor.match(/([A-Za-z][A-Za-z0-9]*)$/);
    if (!match) return null;
    return {
      match: match[1].toUpperCase(),
      startIndex: match.index,
    };
  }, []);

  /**
   * Get filtered suggestions based on partial input
   */
  const updateSuggestions = useCallback((value, cursorPos) => {
    const partial = getPartialRef(value, cursorPos);
    if (!partial) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = allCellIds.current.filter(
      (id) => id.startsWith(partial.match) && id !== cellId
    );

    if (filtered.length > 0 && partial.match !== filtered[0]) {
      // Don't show if already a complete exact match
      setSuggestions(filtered.slice(0, 8));
      setSelectedSuggestion(0);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [cellId, getPartialRef]);

  /**
   * Apply a suggestion by replacing the partial ref in the formula
   */
  const applySuggestion = useCallback((suggestion) => {
    const cursorPos = inputRef.current?.selectionStart ?? editValue.length;
    const partial = getPartialRef(editValue, cursorPos);
    if (!partial) return;

    const before = editValue.slice(0, partial.startIndex);
    const after = editValue.slice(cursorPos);
    const newValue = before + suggestion + after;
    setEditValue(newValue);
    setShowSuggestions(false);
    setSuggestions([]);

    // Restore focus and cursor position
    setTimeout(() => {
      const newPos = before.length + suggestion.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }, [editValue, getPartialRef]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setEditValue(rawValue);
  }, [rawValue]);

  const handleBlur = useCallback((e) => {
    // Don't blur if clicking on a suggestion
    if (suggestionsRef.current?.contains(e.relatedTarget)) {
      return;
    }
    setIsEditing(false);
    setShowSuggestions(false);
    setSuggestions([]);
    if (editValue !== rawValue) {
      setCellValue(cellId, editValue);
    }
  }, [editValue, rawValue, cellId, setCellValue]);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    setShowSuggestions(false);
    setSuggestions([]);
    if (editValue !== rawValue) {
      setCellValue(cellId, editValue);
    }
  }, [editValue, rawValue, cellId, setCellValue]);

  const handleKeyDown = useCallback((e) => {
    // Handle suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
        // If suggestions are showing and we press Tab or Enter, accept suggestion
        if (showSuggestions) {
          e.preventDefault();
          applySuggestion(suggestions[selectedSuggestion]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      // Move to cell below
      const colLetter = cellId.match(/^([A-Z]+)/)?.[1];
      const rowNum = parseInt(cellId.match(/(\d+)$/)?.[1]);
      if (colLetter && rowNum && rowNum < rows) {
        const belowId = `${colLetter}${rowNum + 1}`;
        const belowInput = document.getElementById(`cell-${belowId}`);
        if (belowInput) {
          setTimeout(() => belowInput.focus(), 0);
        }
      }
    } else if (e.key === 'Escape') {
      setEditValue(rawValue);
      setIsEditing(false);
      setShowSuggestions(false);
      inputRef.current?.blur();
    } else if (e.key === 'Tab' && !showSuggestions) {
      e.preventDefault();
      commitValue();
      // Move to next/prev cell
      const colLetter = cellId.match(/^([A-Z]+)/)?.[1];
      const rowNum = parseInt(cellId.match(/(\d+)$/)?.[1]);
      const colIdx = colLetter.charCodeAt(0) - 65;
      if (e.shiftKey) {
        // Move left
        if (colIdx > 0) {
          const prevId = `${String.fromCharCode(64 + colIdx)}${rowNum}`;
          const prevInput = document.getElementById(`cell-${prevId}`);
          if (prevInput) setTimeout(() => prevInput.focus(), 0);
        }
      } else {
        // Move right
        if (colIdx < cols - 1) {
          const nextId = `${String.fromCharCode(66 + colIdx)}${rowNum}`;
          const nextInput = document.getElementById(`cell-${nextId}`);
          if (nextInput) setTimeout(() => nextInput.focus(), 0);
        }
      }
    }
  }, [showSuggestions, suggestions, selectedSuggestion, applySuggestion, commitValue, cellId, rawValue, rows, cols]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setEditValue(newValue);

    // Update autocomplete suggestions
    const cursorPos = e.target.selectionStart;
    setTimeout(() => updateSuggestions(newValue, cursorPos), 0);
  }, [updateSuggestions]);

  // Determine display value
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
    <div className={cellClass} data-cell-id={cellId}>
      <input
        ref={inputRef}
        className="cell__input"
        value={isEditing ? editValue : String(displayValue)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        id={`cell-${cellId}`}
      />
      {!isEditing && typeof rawValue === 'string' && rawValue.startsWith('=') && !hasError && !hasCircular && (
        <span className="cell__formula-indicator" title={rawValue}>ƒ</span>
      )}

      {/* Autocomplete suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="cell__suggestions" ref={suggestionsRef}>
          <div className="cell__suggestions-header">Cell References</div>
          {suggestions.map((suggestion, index) => {
            const sugComputedVal = getCellValue(suggestion);
            const sugRawVal = getRawValue(suggestion);
            const hasVal = sugComputedVal !== '' && sugComputedVal !== undefined && sugComputedVal !== null;
            return (
              <button
                key={suggestion}
                className={`cell__suggestion ${index === selectedSuggestion ? 'cell__suggestion--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(suggestion);
                }}
                tabIndex={-1}
              >
                <span className="cell__suggestion-id">{suggestion}</span>
                {hasVal && (
                  <span className="cell__suggestion-value">
                    {typeof sugRawVal === 'string' && sugRawVal.startsWith('=') ? (
                      <><span className="cell__suggestion-fx">ƒ</span> {String(sugComputedVal)}</>
                    ) : (
                      String(sugComputedVal)
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default Cell;
