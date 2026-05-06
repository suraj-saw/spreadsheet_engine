import { useSpreadsheet } from '../context/SpreadsheetContext';

/**
 * Toolbar with undo/redo buttons and formula bar info.
 */
export default function Toolbar() {
  const { undo, redo, undoCount, redoCount } = useSpreadsheet();

  return (
    <div className="toolbar">
      <div className="toolbar__left">
        <div className="toolbar__logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#6C63FF" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#44D7B6" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#44D7B6" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#6C63FF" />
          </svg>
          <h1 className="toolbar__title">Spreadsheet Engine</h1>
        </div>
      </div>

      <div className="toolbar__center">
        <div className="toolbar__hint">
          <span className="toolbar__hint-key">Enter</span> to confirm
          <span className="toolbar__hint-divider">·</span>
          <span className="toolbar__hint-key">Esc</span> to cancel
          <span className="toolbar__hint-divider">·</span>
          <span className="toolbar__hint-key">Tab</span> to move right
          <span className="toolbar__hint-divider">·</span>
          Start with <span className="toolbar__hint-key">=</span> for formulas
        </div>
      </div>

      <div className="toolbar__right">
        <button
          className="toolbar__btn"
          onClick={undo}
          disabled={undoCount === 0}
          title="Undo (Ctrl+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Undo
        </button>
        <button
          className="toolbar__btn"
          onClick={redo}
          disabled={redoCount === 0}
          title="Redo (Ctrl+Y)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
          Redo
        </button>
      </div>
    </div>
  );
}
