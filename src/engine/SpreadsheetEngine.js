import { evaluateFormula, extractReferences } from './parser.js';

/**
 * SpreadsheetEngine
 * 
 * Manages all cell data, dependency tracking, formula evaluation,
 * circular reference detection, and cascading recalculation.
 */
export class SpreadsheetEngine {
  constructor() {
    // Raw input values (what the user typed): cellId -> string
    this.rawValues = new Map();
    // Computed/displayed values: cellId -> string|number
    this.computedValues = new Map();
    // Dependencies: cellId -> Set of cellIds it depends on
    this.dependencies = new Map();
    // Reverse dependencies (dependents): cellId -> Set of cellIds that depend on it
    this.dependents = new Map();
    // Cells currently flagged as circular
    this.circularCells = new Set();
    // Undo/Redo history
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get a snapshot of the current cell data (includes Maps).
   */
  getSnapshot() {
    return {
      rawValues: new Map(this.rawValues),
      computedValues: new Map(this.computedValues),
    };
  }

  /**
   * Set a cell's raw value and recalculate the graph.
   * Returns the set of cell IDs that were affected.
   */
  setCellValue(cellId, rawValue) {
    cellId = cellId.toUpperCase();

    // Save to undo stack
    this.undoStack.push({
      cellId,
      previousRaw: this.rawValues.get(cellId) ?? '',
    });
    // Clear redo stack on new action
    this.redoStack = [];

    return this._applyValue(cellId, rawValue);
  }

  /**
   * Internal: apply a value without touching undo/redo stacks
   */
  _applyValue(cellId, rawValue) {
    const oldRaw = this.rawValues.get(cellId);
    
    // Remove old dependencies for this cell
    this._clearDependencies(cellId);

    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      this.rawValues.delete(cellId);
      this.computedValues.delete(cellId);
      this.circularCells.delete(cellId);
    } else {
      this.rawValues.set(cellId, rawValue);
    }

    // Recalculate this cell
    this._evaluateCell(cellId);

    // Recalculate all downstream dependents
    const affected = new Set([cellId]);
    this._recalculateDependents(cellId, affected);

    return affected;
  }

  /**
   * Undo the last action. Returns affected cell IDs or null if nothing to undo.
   */
  undo() {
    if (this.undoStack.length === 0) return null;
    
    const action = this.undoStack.pop();
    // Save current state to redo
    this.redoStack.push({
      cellId: action.cellId,
      previousRaw: this.rawValues.get(action.cellId) ?? '',
    });

    return this._applyValue(action.cellId, action.previousRaw);
  }

  /**
   * Redo the last undone action. Returns affected cell IDs or null if nothing to redo.
   */
  redo() {
    if (this.redoStack.length === 0) return null;

    const action = this.redoStack.pop();
    // Save current state to undo
    this.undoStack.push({
      cellId: action.cellId,
      previousRaw: this.rawValues.get(action.cellId) ?? '',
    });

    return this._applyValue(action.cellId, action.previousRaw);
  }

  /**
   * Clear a cell's outgoing dependencies
   */
  _clearDependencies(cellId) {
    const deps = this.dependencies.get(cellId);
    if (deps) {
      for (const dep of deps) {
        const revDeps = this.dependents.get(dep);
        if (revDeps) {
          revDeps.delete(cellId);
          if (revDeps.size === 0) this.dependents.delete(dep);
        }
      }
    }
    this.dependencies.delete(cellId);
  }

  /**
   * Register dependencies for a cell
   */
  _setDependencies(cellId, refs) {
    this.dependencies.set(cellId, refs);
    for (const ref of refs) {
      if (!this.dependents.has(ref)) {
        this.dependents.set(ref, new Set());
      }
      this.dependents.get(ref).add(cellId);
    }
  }

  /**
   * Check if setting cellId to depend on refs would create a circular dependency.
   * Uses DFS from each ref to see if we can reach cellId.
   */
  _hasCircular(cellId, refs) {
    const visited = new Set();
    const stack = [...refs];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === cellId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const currentDeps = this.dependencies.get(current);
      if (currentDeps) {
        for (const dep of currentDeps) {
          stack.push(dep);
        }
      }
    }
    return false;
  }

  /**
   * Evaluate a single cell and update its computed value
   */
  _evaluateCell(cellId) {
    const raw = this.rawValues.get(cellId);

    // Empty cell
    if (raw === undefined || raw === null || raw === '') {
      this.computedValues.delete(cellId);
      this.circularCells.delete(cellId);
      return;
    }

    // Not a formula — store as-is (try to parse as number)
    if (!raw.startsWith('=')) {
      this.circularCells.delete(cellId);
      const num = Number(raw);
      this.computedValues.set(cellId, isNaN(num) ? raw : num);
      return;
    }

    // It's a formula — first extract references to check circularity
    const refs = extractReferences(raw);
    
    // Check for circular dependency before registering
    if (this._hasCircular(cellId, refs)) {
      this.circularCells.add(cellId);
      this.computedValues.set(cellId, '#CIRCULAR');
      // Still register deps so we can clean them up later
      this._setDependencies(cellId, refs);
      return;
    }

    // Register dependencies
    this._setDependencies(cellId, refs);
    this.circularCells.delete(cellId);

    // Evaluate the formula
    try {
      const getCellValue = (refId) => {
        refId = refId.toUpperCase();
        if (this.circularCells.has(refId)) {
          throw new Error(`Referenced cell ${refId} has a circular reference`);
        }
        return this.computedValues.get(refId) ?? 0;
      };

      const { value } = evaluateFormula(raw, getCellValue);
      
      // Handle NaN and Infinity
      if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) {
        this.computedValues.set(cellId, '#ERROR');
      } else {
        this.computedValues.set(cellId, value);
      }
    } catch (err) {
      this.computedValues.set(cellId, '#ERROR');
    }
  }

  /**
   * Recalculate all cells that depend on the given cell (cascading).
   * Uses topological ordering to ensure correct evaluation order.
   */
  _recalculateDependents(cellId, affected) {
    const directDependents = this.dependents.get(cellId);
    if (!directDependents) return;

    // Get topological order of all downstream cells
    const order = this._topologicalSort(directDependents);

    for (const depId of order) {
      affected.add(depId);
      this._evaluateCell(depId);
    }
  }

  /**
   * Topological sort starting from a set of cells, following the dependents graph.
   * Returns an array of cell IDs in evaluation order.
   */
  _topologicalSort(startCells) {
    const visited = new Set();
    const order = [];

    const visit = (cellId) => {
      if (visited.has(cellId)) return;
      visited.add(cellId);

      // First visit all cells this one depends on (that are also in our subgraph)
      const deps = this.dependencies.get(cellId);
      if (deps) {
        for (const dep of deps) {
          if (this._isDownstreamOf(dep, startCells)) {
            visit(dep);
          }
        }
      }

      order.push(cellId);

      // Then visit dependents
      const depnts = this.dependents.get(cellId);
      if (depnts) {
        for (const d of depnts) {
          visit(d);
        }
      }
    };

    for (const cellId of startCells) {
      visit(cellId);
    }

    return order;
  }

  /**
   * Check if a cell is downstream (transitively) of any cell in the start set
   */
  _isDownstreamOf(cellId, startCells) {
    if (startCells.has(cellId)) return true;
    // Simple BFS from startCells through dependents
    const visited = new Set();
    const queue = [...startCells];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === cellId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = this.dependents.get(current);
      if (deps) {
        for (const d of deps) queue.push(d);
      }
    }
    return false;
  }

  /**
   * Get the computed (displayed) value of a cell
   */
  getComputedValue(cellId) {
    return this.computedValues.get(cellId.toUpperCase()) ?? '';
  }

  /**
   * Get the raw (user-entered) value of a cell
   */
  getRawValue(cellId) {
    return this.rawValues.get(cellId.toUpperCase()) ?? '';
  }

  /**
   * Check if a cell has a circular reference error
   */
  isCircular(cellId) {
    return this.circularCells.has(cellId.toUpperCase());
  }

  /**
   * Check if a cell's computed value is an error
   */
  isError(cellId) {
    const val = this.computedValues.get(cellId.toUpperCase());
    return typeof val === 'string' && val.startsWith('#');
  }

  /**
   * Get the number of items on the undo stack
   */
  get undoCount() {
    return this.undoStack.length;
  }

  /**
   * Get the number of items on the redo stack
   */
  get redoCount() {
    return this.redoStack.length;
  }
}
