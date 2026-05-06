import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { SpreadsheetEngine } from '../engine';

const SpreadsheetContext = createContext(null);

/**
 * Custom hook that provides the spreadsheet engine and reactive state.
 */
export function SpreadsheetProvider({ children, rows = 10, cols = 10 }) {
  const engineRef = useRef(new SpreadsheetEngine());
  const [version, setVersion] = useState(0); // triggers re-render on changes
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const engine = engineRef.current;

  const setCellValue = useCallback((cellId, value) => {
    engine.setCellValue(cellId, value);
    setVersion((v) => v + 1);
    setUndoCount(engine.undoCount);
    setRedoCount(engine.redoCount);
  }, [engine]);

  const getCellValue = useCallback((cellId) => {
    return engine.getComputedValue(cellId);
  }, [engine]);

  const getRawValue = useCallback((cellId) => {
    return engine.getRawValue(cellId);
  }, [engine]);

  const isError = useCallback((cellId) => {
    return engine.isError(cellId);
  }, [engine]);

  const isCircular = useCallback((cellId) => {
    return engine.isCircular(cellId);
  }, [engine]);

  const undo = useCallback(() => {
    engine.undo();
    setVersion((v) => v + 1);
    setUndoCount(engine.undoCount);
    setRedoCount(engine.redoCount);
  }, [engine]);

  const redo = useCallback(() => {
    engine.redo();
    setVersion((v) => v + 1);
    setUndoCount(engine.undoCount);
    setRedoCount(engine.redoCount);
  }, [engine]);

  const contextValue = {
    setCellValue,
    getCellValue,
    getRawValue,
    isError,
    isCircular,
    undo,
    redo,
    undoCount,
    redoCount,
    version,
    rows,
    cols,
  };

  return (
    <SpreadsheetContext.Provider value={contextValue}>
      {children}
    </SpreadsheetContext.Provider>
  );
}

export function useSpreadsheet() {
  const context = useContext(SpreadsheetContext);
  if (!context) {
    throw new Error('useSpreadsheet must be used within a SpreadsheetProvider');
  }
  return context;
}
