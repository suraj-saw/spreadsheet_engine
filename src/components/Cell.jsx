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

const FORMULA_FUNCTIONS = [
  {
    name: 'SUM',
    signature: 'SUM(number1, ...)',
    description: 'Add numbers together',
  },
  {
    name: 'AVERAGE',
    signature: 'AVERAGE(number1, ...)',
    description: 'Average of numbers',
  },
  {
    name: 'MIN',
    signature: 'MIN(number1, ...)',
    description: 'Smallest value',
  },
  {
    name: 'MAX',
    signature: 'MAX(number1, ...)',
    description: 'Largest value',
  },
  {
    name: 'COUNT',
    signature: 'COUNT(value1, ...)',
    description: 'Count numeric values',
  },
  {
    name: 'ROUND',
    signature: 'ROUND(number, digits)',
    description: 'Round to digits',
  },
  {
    name: 'ABS',
    signature: 'ABS(number)',
    description: 'Absolute value',
  },
  {
    name: 'SQRT',
    signature: 'SQRT(number)',
    description: 'Square root',
  },
  {
    name: 'POWER',
    signature: 'POWER(base, exponent)',
    description: 'Exponentiation',
  },
  {
    name: 'IF',
    signature: 'IF(condition, trueValue, falseValue)',
    description: 'Conditional value',
  },
  {
    name: 'AND',
    signature: 'AND(condition1, ...)',
    description: 'True if all conditions are true',
  },
  {
    name: 'OR',
    signature: 'OR(condition1, ...)',
    description: 'True if any condition is true',
  },
  {
    name: 'NOT',
    signature: 'NOT(condition)',
    description: 'Invert a condition',
  },
  {
    name: 'CONCAT',
    signature: 'CONCAT(text1, ...)',
    description: 'Join text',
  },
  {
    name: 'LEFT',
    signature: 'LEFT(text, count)',
    description: 'Left substring',
  },
  {
    name: 'RIGHT',
    signature: 'RIGHT(text, count)',
    description: 'Right substring',
  },
  {
    name: 'LEN',
    signature: 'LEN(text)',
    description: 'Text length',
  },
  {
    name: 'UPPER',
    signature: 'UPPER(text)',
    description: 'Uppercase text',
  },
  {
    name: 'LOWER',
    signature: 'LOWER(text)',
    description: 'Lowercase text',
  },
  {
    name: 'TODAY',
    signature: 'TODAY()',
    description: 'Current date',
  },
  {
    name: 'NOW',
    signature: 'NOW()',
    description: 'Current date and time',
  },
  {
    name: 'DATE',
    signature: 'DATE(year, month, day)',
    description: 'Create a date',
  },
  {
    name: 'YEAR',
    signature: 'YEAR(date)',
    description: 'Year from date',
  },
  {
    name: 'MONTH',
    signature: 'MONTH(date)',
    description: 'Month from date',
  },
  {
    name: 'DAY',
    signature: 'DAY(date)',
    description: 'Day from date',
  },
];

/**
 * Individual spreadsheet cell component.
 * Shows computed value when not focused, raw formula when editing.
 * Includes Excel-like autocomplete for cell references in formulas.
 */
const Cell = memo(function Cell({ cellId, version }) {
  const {
    getCellValue,
    getRawValue,
    setCellValue,
    isError,
    isCircular,
    rows,
    cols,
    setActiveEditor,
    clearActiveEditor,
    insertReferenceFromClick,
  } = useSpreadsheet();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const allCellIds = useRef(generateAllCellIds(rows, cols));
  const editValueRef = useRef(editValue);
  const lastInsertionRef = useRef(null);

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
    const matchValue = match[1].toUpperCase();
    const kind = /\d/.test(matchValue) ? 'cell' : 'word';
    return {
      match: matchValue,
      startIndex: match.index,
      kind,
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

    const functionMatches = FORMULA_FUNCTIONS.filter((fn) =>
      fn.name.startsWith(partial.match)
    ).map((fn) => ({
      type: 'function',
      value: fn.name,
      insert: `${fn.name}(`,
      signature: fn.signature,
      description: fn.description,
    }));

    const cellMatches = allCellIds.current.filter(
      (id) => id.startsWith(partial.match) && id !== cellId
    ).slice(0, 8).map((id) => ({
      type: 'cell',
      value: id,
      insert: id,
    }));

    const nextSuggestions = partial.kind === 'cell'
      ? cellMatches
      : [...functionMatches, ...cellMatches];

    if (nextSuggestions.length > 0) {
      setSuggestions(nextSuggestions);
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
    const insertValue = suggestion.insert ?? suggestion.value;
    const newValue = before + insertValue + after;
    setEditValue(newValue);
    editValueRef.current = newValue;
    lastInsertionRef.current = null;
    setShowSuggestions(false);
    setSuggestions([]);

    // Restore focus and cursor position
    setTimeout(() => {
      const newPos = before.length + insertValue.length;
      setCursorPos(newPos);
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }, [editValue, getPartialRef]);

  const getCurrentArgumentRange = useCallback((value, cursor) => {
    if (!value.startsWith('=')) return null;
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/([A-Za-z][A-Za-z0-9]*)\([^()]*$/);
    if (!match) return null;
    const fnStart = match.index + match[1].length + 1;
    let depth = 1;
    let endIndex = fnStart;
    for (let i = fnStart; i < value.length; i++) {
      const ch = value[i];
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
    if (depth !== 0) return null;
    const segment = value.slice(fnStart, endIndex);
    const relCursor = Math.max(0, cursor - fnStart);
    let currentStart = 0;
    for (let i = 0; i <= segment.length; i++) {
      const ch = segment[i];
      if (i === segment.length || ch === ',') {
        const argEnd = i;
        if (relCursor >= currentStart && relCursor <= argEnd) {
          return {
            start: fnStart + currentStart,
            end: fnStart + argEnd,
          };
        }
        currentStart = i + 1;
      }
    }
    return null;
  }, []);

  const insertReference = useCallback((refCellId, { shiftKey } = {}) => {
    const value = editValueRef.current ?? '';
    if (!value.startsWith('=')) return;

    let newValue = value;
    let newCursor = value.length;
    const cursor = inputRef.current?.selectionStart ?? value.length;

    const argRange = getCurrentArgumentRange(value, cursor);

    if (shiftKey && lastInsertionRef.current?.anchorCell) {
      const { start, end, anchorCell } = lastInsertionRef.current;
      const rangeText = `${anchorCell}:${refCellId}`;
      newValue = value.slice(0, start) + rangeText + value.slice(end);
      newCursor = start + rangeText.length;
      lastInsertionRef.current = {
        start,
        end: start + rangeText.length,
        anchorCell,
      };
    } else if (argRange) {
      newValue = value.slice(0, argRange.start) + refCellId + value.slice(argRange.end);
      newCursor = argRange.start + refCellId.length;
      lastInsertionRef.current = {
        start: argRange.start,
        end: argRange.start + refCellId.length,
        anchorCell: refCellId,
      };
    } else {
      newValue = value.slice(0, cursor) + refCellId + value.slice(cursor);
      newCursor = cursor + refCellId.length;
      lastInsertionRef.current = {
        start: cursor,
        end: cursor + refCellId.length,
        anchorCell: refCellId,
      };
    }

    setEditValue(newValue);
    editValueRef.current = newValue;
    setShowSuggestions(false);
    setSuggestions([]);

    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCursor, newCursor);
      updateSuggestions(newValue, newCursor);
      setCursorPos(newCursor);
    }, 0);
  }, [getCurrentArgumentRange, updateSuggestions]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setEditValue(rawValue);
    editValueRef.current = rawValue;
    lastInsertionRef.current = null;
    setActiveEditor(cellId, insertReference, () => editValueRef.current?.startsWith('='));
  }, [rawValue, cellId, insertReference, setActiveEditor]);

  const handleBlur = useCallback((e) => {
    // Don't blur if clicking on a suggestion
    if (suggestionsRef.current?.contains(e.relatedTarget)) {
      return;
    }
    setIsEditing(false);
    setShowSuggestions(false);
    setSuggestions([]);
    clearActiveEditor(cellId);
    if (editValue !== rawValue) {
      setCellValue(cellId, editValue);
    }
  }, [editValue, rawValue, cellId, setCellValue, clearActiveEditor]);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    setShowSuggestions(false);
    setSuggestions([]);
    clearActiveEditor(cellId);
    if (editValue !== rawValue) {
      setCellValue(cellId, editValue);
    }
  }, [editValue, rawValue, cellId, setCellValue, clearActiveEditor]);

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
    editValueRef.current = newValue;
    lastInsertionRef.current = null;

    // Update autocomplete suggestions
    const cursorPos = e.target.selectionStart;
    setCursorPos(cursorPos ?? 0);
    setTimeout(() => updateSuggestions(newValue, cursorPos), 0);
  }, [updateSuggestions]);

  const handleCursorUpdate = useCallback((e) => {
    setCursorPos(e.target.selectionStart ?? 0);
  }, []);

  const handleCellMouseDown = useCallback((e) => {
    if (insertReferenceFromClick(cellId, { shiftKey: e.shiftKey })) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [cellId, insertReferenceFromClick]);

  const getFunctionHint = useCallback((value, cursor) => {
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
    return {
      name,
      signature: fn.signature,
      argIndex,
      argName,
    };
  }, []);


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

  const functionSuggestions = suggestions.filter((item) => item.type === 'function');
  const cellSuggestions = suggestions.filter((item) => item.type === 'cell');
  const functionHint = isEditing ? getFunctionHint(editValue, cursorPos) : null;

  return (
    <div className={cellClass} data-cell-id={cellId} onMouseDown={handleCellMouseDown}>
      <input
        ref={inputRef}
        className="cell__input"
        value={isEditing ? editValue : String(displayValue)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={handleCursorUpdate}
        onClick={handleCursorUpdate}
        spellCheck={false}
        autoComplete="off"
        id={`cell-${cellId}`}
      />
      {!isEditing && typeof rawValue === 'string' && rawValue.startsWith('=') && !hasError && !hasCircular && (
        <span className="cell__formula-indicator" title={rawValue}>ƒ</span>
      )}

      {/* Autocomplete suggestions dropdown */}
      {isEditing && functionHint && (
        <div className="cell__hint">
          <span className="cell__hint-name">{functionHint.name}</span>
          <span className="cell__hint-signature">{functionHint.signature}</span>
          <span className="cell__hint-arg">
            Arg {functionHint.argIndex + 1}{functionHint.argName ? `: ${functionHint.argName}` : ''}
          </span>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          className={`cell__suggestions ${functionHint ? 'cell__suggestions--with-hint' : ''}`}
          ref={suggestionsRef}
        >
          {functionSuggestions.length > 0 && (
            <div className="cell__suggestions-header">Functions</div>
          )}
          {functionSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.value}`}
              className={`cell__suggestion ${index === selectedSuggestion ? 'cell__suggestion--active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(suggestion);
              }}
              tabIndex={-1}
            >
              <span className="cell__suggestion-id">{suggestion.value}</span>
              <span className="cell__suggestion-desc">
                {suggestion.signature}
              </span>
            </button>
          ))}
          {cellSuggestions.length > 0 && (
            <div className="cell__suggestions-header">Cell References</div>
          )}
          {cellSuggestions.map((suggestion, index) => {
            const suggestionIndex = index + functionSuggestions.length;
            const sugComputedVal = getCellValue(suggestion.value);
            const sugRawVal = getRawValue(suggestion.value);
            const hasVal = sugComputedVal !== '' && sugComputedVal !== undefined && sugComputedVal !== null;
            return (
              <button
                key={`${suggestion.type}-${suggestion.value}`}
                className={`cell__suggestion ${suggestionIndex === selectedSuggestion ? 'cell__suggestion--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(suggestion);
                }}
                tabIndex={-1}
              >
                <span className="cell__suggestion-id">{suggestion.value}</span>
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
