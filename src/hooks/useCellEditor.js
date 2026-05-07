/**
 * @module hooks/useCellEditor
 * @description Custom hook encapsulating all cell editing logic.
 * Manages editing state, formula autocomplete suggestions,
 * keyboard navigation, and cell reference insertion.
 */

import { useState, useRef, useCallback } from 'react';
import { FORMULA_FUNCTIONS } from '../constants/formulaFunctions';
import {
  generateAllCellIds,
  getPartialRef,
  getCurrentArgumentRange,
  getFunctionHint,
} from '../utils/formulaHelpers';

/**
 * Custom hook for cell editing behavior.
 *
 * @param {Object} params
 * @param {string}   params.cellId    - This cell's ID (e.g. "A1")
 * @param {string}   params.rawValue  - Current raw (user-entered) value
 * @param {Function} params.setCellValue - Update a cell's value
 * @param {Function} params.setActiveEditor - Register this cell as active editor
 * @param {Function} params.clearActiveEditor - Unregister as active editor
 * @param {Function} params.insertReferenceFromClick - Insert ref via click
 * @param {Function} params.getCellValue - Get a cell's computed value
 * @param {Function} params.getRawValue - Get a cell's raw value
 * @param {number}   params.rows - Grid row count
 * @param {number}   params.cols - Grid column count
 * @returns {Object} Editor state and event handlers
 */
export function useCellEditor({
  cellId, rawValue, setCellValue, setActiveEditor,
  clearActiveEditor, insertReferenceFromClick,
  getCellValue, getRawValue, rows, cols,
}) {
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

  // --- Autocomplete ---

  const updateSuggestions = useCallback((value, cursor) => {
    const partial = getPartialRef(value, cursor);
    if (!partial) {
      setSuggestions([]); setShowSuggestions(false); return;
    }

    const functionMatches = FORMULA_FUNCTIONS
      .filter((fn) => fn.name.startsWith(partial.match))
      .map((fn) => ({
        type: 'function', value: fn.name, insert: `${fn.name}(`,
        signature: fn.signature, description: fn.description,
      }));

    const cellMatches = allCellIds.current
      .filter((id) => id.startsWith(partial.match) && id !== cellId)
      .slice(0, 8)
      .map((id) => ({ type: 'cell', value: id, insert: id }));

    const next = partial.kind === 'cell'
      ? cellMatches
      : [...functionMatches, ...cellMatches];

    if (next.length > 0) {
      setSuggestions(next); setSelectedSuggestion(0); setShowSuggestions(true);
    } else {
      setSuggestions([]); setShowSuggestions(false);
    }
  }, [cellId]);

  const applySuggestion = useCallback((suggestion) => {
    const cursor = inputRef.current?.selectionStart ?? editValue.length;
    const partial = getPartialRef(editValue, cursor);
    if (!partial) return;

    const before = editValue.slice(0, partial.startIndex);
    const after = editValue.slice(cursor);
    const insertVal = suggestion.insert ?? suggestion.value;
    const newValue = before + insertVal + after;

    setEditValue(newValue);
    editValueRef.current = newValue;
    lastInsertionRef.current = null;
    setShowSuggestions(false); setSuggestions([]);

    setTimeout(() => {
      const newPos = before.length + insertVal.length;
      setCursorPos(newPos);
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }, [editValue]);

  // --- Cell reference insertion (click-to-insert) ---

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
      lastInsertionRef.current = { start, end: start + rangeText.length, anchorCell };
    } else if (argRange) {
      newValue = value.slice(0, argRange.start) + refCellId + value.slice(argRange.end);
      newCursor = argRange.start + refCellId.length;
      lastInsertionRef.current = { start: argRange.start, end: argRange.start + refCellId.length, anchorCell: refCellId };
    } else {
      newValue = value.slice(0, cursor) + refCellId + value.slice(cursor);
      newCursor = cursor + refCellId.length;
      lastInsertionRef.current = { start: cursor, end: cursor + refCellId.length, anchorCell: refCellId };
    }

    setEditValue(newValue);
    editValueRef.current = newValue;
    setShowSuggestions(false); setSuggestions([]);

    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCursor, newCursor);
      updateSuggestions(newValue, newCursor);
      setCursorPos(newCursor);
    }, 0);
  }, [updateSuggestions]);

  // --- Event handlers ---

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setEditValue(rawValue);
    editValueRef.current = rawValue;
    lastInsertionRef.current = null;
    setActiveEditor(cellId, insertReference, () => editValueRef.current?.startsWith('='));
  }, [rawValue, cellId, insertReference, setActiveEditor]);

  const handleBlur = useCallback((e) => {
    if (suggestionsRef.current?.contains(e.relatedTarget)) return;
    setIsEditing(false); setShowSuggestions(false); setSuggestions([]);
    clearActiveEditor(cellId);
    if (editValue !== rawValue) setCellValue(cellId, editValue);
  }, [editValue, rawValue, cellId, setCellValue, clearActiveEditor]);

  const commitValue = useCallback(() => {
    setIsEditing(false); setShowSuggestions(false); setSuggestions([]);
    clearActiveEditor(cellId);
    if (editValue !== rawValue) setCellValue(cellId, editValue);
  }, [editValue, rawValue, cellId, setCellValue, clearActiveEditor]);

  const handleKeyDown = useCallback((e) => {
    // Suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion((p) => Math.min(p + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion((p) => Math.max(p - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
        if (showSuggestions) { e.preventDefault(); applySuggestion(suggestions[selectedSuggestion]); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowSuggestions(false); return; }
    }

    if (e.key === 'Enter') {
      e.preventDefault(); commitValue();
      const colLetter = cellId.match(/^([A-Z]+)/)?.[1];
      const rowNum = parseInt(cellId.match(/(\d+)$/)?.[1]);
      if (colLetter && rowNum && rowNum < rows) {
        const belowInput = document.getElementById(`cell-${colLetter}${rowNum + 1}`);
        if (belowInput) setTimeout(() => belowInput.focus(), 0);
      }
    } else if (e.key === 'Escape') {
      setEditValue(rawValue); setIsEditing(false); setShowSuggestions(false);
      inputRef.current?.blur();
    } else if (e.key === 'Tab' && !showSuggestions) {
      e.preventDefault(); commitValue();
      const colLetter = cellId.match(/^([A-Z]+)/)?.[1];
      const rowNum = parseInt(cellId.match(/(\d+)$/)?.[1]);
      const colIdx = colLetter.charCodeAt(0) - 65;
      if (e.shiftKey) {
        if (colIdx > 0) {
          const prev = document.getElementById(`cell-${String.fromCharCode(64 + colIdx)}${rowNum}`);
          if (prev) setTimeout(() => prev.focus(), 0);
        }
      } else {
        if (colIdx < cols - 1) {
          const next = document.getElementById(`cell-${String.fromCharCode(66 + colIdx)}${rowNum}`);
          if (next) setTimeout(() => next.focus(), 0);
        }
      }
    }
  }, [showSuggestions, suggestions, selectedSuggestion, applySuggestion, commitValue, cellId, rawValue, rows, cols]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    editValueRef.current = newValue;
    lastInsertionRef.current = null;
    const cursor = e.target.selectionStart;
    setCursorPos(cursor ?? 0);
    setTimeout(() => updateSuggestions(newValue, cursor), 0);
  }, [updateSuggestions]);

  const handleCursorUpdate = useCallback((e) => {
    setCursorPos(e.target.selectionStart ?? 0);
  }, []);

  const handleCellMouseDown = useCallback((e) => {
    if (insertReferenceFromClick(cellId, { shiftKey: e.shiftKey })) {
      e.preventDefault(); e.stopPropagation();
    }
  }, [cellId, insertReferenceFromClick]);

  // --- Derived state ---

  const functionSuggestions = suggestions.filter((s) => s.type === 'function');
  const cellSuggestions = suggestions.filter((s) => s.type === 'cell');
  const functionHint = isEditing ? getFunctionHint(editValue, cursorPos) : null;

  return {
    isEditing, editValue, showSuggestions,
    suggestions, selectedSuggestion, functionSuggestions, cellSuggestions,
    functionHint, inputRef, suggestionsRef,
    handleFocus, handleBlur, handleKeyDown, handleChange,
    handleCursorUpdate, handleCellMouseDown, applySuggestion,
    getCellValue, getRawValue,
  };
}
