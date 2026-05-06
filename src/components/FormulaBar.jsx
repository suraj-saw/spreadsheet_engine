import { useState, useCallback } from 'react';
import { useSpreadsheet } from '../context/SpreadsheetContext';

/**
 * FormulaBar shows the currently focused cell's ID and raw formula/value.
 * Also allows editing the formula from the bar.
 */
export default function FormulaBar() {
  const { getCellValue, getRawValue, setCellValue, isError } = useSpreadsheet();
  const [activeCellId, setActiveCellId] = useState(null);
  const [barValue, setBarValue] = useState('');

  // Listen for focus events on cells
  const handleGridFocus = useCallback((e) => {
    const cellEl = e.target.closest('[data-cell-id]');
    if (cellEl) {
      const id = cellEl.dataset.cellId;
      setActiveCellId(id);
      setBarValue(getRawValue(id));
    }
  }, [getRawValue]);

  const handleBarChange = useCallback((e) => {
    setBarValue(e.target.value);
  }, []);

  const handleBarKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && activeCellId) {
      setCellValue(activeCellId, barValue);
    }
  }, [activeCellId, barValue, setCellValue]);

  const computedDisplay = activeCellId ? getCellValue(activeCellId) : '';
  const hasErr = activeCellId ? isError(activeCellId) : false;

  return (
    <div className="formula-bar" onFocusCapture={handleGridFocus}>
      <div className="formula-bar__cell-id">
        {activeCellId || '—'}
      </div>
      <div className="formula-bar__fx">ƒx</div>
      <input
        className="formula-bar__input"
        value={barValue}
        onChange={handleBarChange}
        onKeyDown={handleBarKeyDown}
        placeholder="Select a cell to see its formula..."
        spellCheck={false}
      />
      {activeCellId && (
        <div className={`formula-bar__result ${hasErr ? 'formula-bar__result--error' : ''}`}>
          = {String(computedDisplay)}
        </div>
      )}
    </div>
  );
}
