import { useEffect, useCallback } from 'react';
import { SpreadsheetProvider, useSpreadsheet } from './context/SpreadsheetContext';
import Toolbar from './components/Toolbar';
import FormulaBar from './components/FormulaBar';
import Grid from './components/Grid';

function SpreadsheetApp() {
  const { undo, redo, rows, cols } = useSpreadsheet();

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  }, [undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app">
      <Toolbar />
      <FormulaBar />
      <Grid />
      <StatusBar rows={rows} cols={cols} />
    </div>
  );
}

function StatusBar({ rows, cols }) {
  return (
    <div className="status-bar">
      <div className="status-bar__left">
        <div className="status-bar__item">
          <span className="status-bar__dot"></span>
          Ready
        </div>
        <div className="status-bar__item">
          {rows} × {cols} grid
        </div>
      </div>
      <div className="status-bar__right">
        Ctrl+Z Undo · Ctrl+Y Redo
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SpreadsheetProvider rows={10} cols={10}>
      <SpreadsheetApp />
    </SpreadsheetProvider>
  );
}
