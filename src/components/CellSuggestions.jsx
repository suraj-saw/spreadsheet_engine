/**
 * @module components/CellSuggestions
 * @description Autocomplete dropdown component for formula editing.
 * Shows function suggestions and cell reference suggestions
 * based on what the user is currently typing.
 */

import { memo } from 'react';

/**
 * Renders the autocomplete suggestions dropdown.
 *
 * @param {Object} props
 * @param {Array}    props.functionSuggestions - Matching function suggestions
 * @param {Array}    props.cellSuggestions     - Matching cell reference suggestions
 * @param {number}   props.selectedIndex       - Currently highlighted suggestion index
 * @param {boolean}  props.hasHint             - Whether a function hint is showing above
 * @param {Function} props.onApply             - Callback when a suggestion is selected
 * @param {Function} props.getCellValue        - Get computed value for preview
 * @param {Function} props.getRawValue         - Get raw value for formula indicator
 * @param {React.Ref} props.containerRef       - Ref for the dropdown container
 */
const CellSuggestions = memo(function CellSuggestions({
  functionSuggestions, cellSuggestions, selectedIndex,
  hasHint, onApply, getCellValue, getRawValue, containerRef,
}) {
  return (
    <div
      className={`cell__suggestions ${hasHint ? 'cell__suggestions--with-hint' : ''}`}
      ref={containerRef}
    >
      {/* Function suggestions section */}
      {functionSuggestions.length > 0 && (
        <div className="cell__suggestions-header">Functions</div>
      )}
      {functionSuggestions.map((suggestion, index) => (
        <button
          key={`fn-${suggestion.value}`}
          className={`cell__suggestion ${index === selectedIndex ? 'cell__suggestion--active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onApply(suggestion); }}
          tabIndex={-1}
        >
          <span className="cell__suggestion-id">{suggestion.value}</span>
          <span className="cell__suggestion-desc">{suggestion.signature}</span>
        </button>
      ))}

      {/* Cell reference suggestions section */}
      {cellSuggestions.length > 0 && (
        <div className="cell__suggestions-header">Cell References</div>
      )}
      {cellSuggestions.map((suggestion, index) => {
        const globalIndex = index + functionSuggestions.length;
        const computed = getCellValue(suggestion.value);
        const raw = getRawValue(suggestion.value);
        const hasVal = computed !== '' && computed !== undefined && computed !== null;
        return (
          <button
            key={`cell-${suggestion.value}`}
            className={`cell__suggestion ${globalIndex === selectedIndex ? 'cell__suggestion--active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onApply(suggestion); }}
            tabIndex={-1}
          >
            <span className="cell__suggestion-id">{suggestion.value}</span>
            {hasVal && (
              <span className="cell__suggestion-value">
                {typeof raw === 'string' && raw.startsWith('=') ? (
                  <><span className="cell__suggestion-fx">ƒ</span> {String(computed)}</>
                ) : (
                  String(computed)
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

export default CellSuggestions;
