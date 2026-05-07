# Spreadsheet Engine

A React-based spreadsheet grid with formula evaluation, dependency management, and circular reference detection — similar to basic Excel functionality.

## Features

- **10×10 editable grid** with columns A–J and rows 1–10
- **Formula support** — arithmetic (`+`, `-`, `*`, `/`), parentheses, cell references
- **25+ built-in functions** — SUM, AVERAGE, IF, UPPER, CONCAT, and more
- **Dependency tracking** — automatic cascading recalculation when referenced cells change
- **Circular reference detection** — displays `#CIRCULAR` instead of freezing
- **Error handling** — invalid formulas show `#ERROR` without breaking the grid
- **Undo / Redo** — Ctrl+Z / Ctrl+Y with full history
- **Autocomplete** — cell references and function names while editing formulas
- **Dark / Light theme** toggle

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

| Action | How |
|---|---|
| Enter a value | Click a cell, type a number or text, press **Enter** |
| Enter a formula | Start with `=` (e.g., `=A1+B2`, `=SUM(A1:A5)`) |
| Confirm | **Enter** (moves down) or **Tab** (moves right) |
| Cancel edit | **Esc** |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |

### Example

1. Set `A1 = 5`
2. Set `B1 = =A1+3` → displays **8**
3. Set `C1 = =B1*2` → displays **16**
4. Change `A1 = 10` → B1 auto-updates to **13**, C1 to **26**

## Project Structure

```
src/
├── engine/                    # Core spreadsheet logic (framework-agnostic)
│   ├── tokenizer.js           # Formula tokenizer
│   ├── parser.js              # Recursive descent parser + evaluator
│   ├── builtinFunctions.js    # Built-in function implementations
│   ├── typeHelpers.js         # Type conversion utilities
│   ├── rangeUtils.js          # Cell range expansion (A1:C3)
│   ├── SpreadsheetEngine.js   # Engine: dependencies, undo/redo, recalculation
│   └── index.js               # Public API re-exports
├── components/
│   ├── Cell.jsx               # Individual cell component
│   ├── CellSuggestions.jsx    # Autocomplete dropdown
│   ├── Grid.jsx               # 10×10 grid layout
│   ├── FormulaBar.jsx         # Formula bar (shows active cell)
│   └── Toolbar.jsx            # Toolbar (undo/redo, theme toggle)
├── hooks/
│   └── useCellEditor.js       # Cell editing logic (autocomplete, keyboard nav)
├── constants/
│   └── formulaFunctions.js    # Function metadata for autocomplete
├── utils/
│   └── formulaHelpers.js      # Pure helpers for formula editing
├── context/
│   └── SpreadsheetContext.jsx  # React context bridging engine ↔ UI
├── App.jsx                    # App shell
├── main.jsx                   # Entry point
└── index.css                  # Styles
```

## Supported Functions

| Category | Functions |
|---|---|
| **Math** | `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `ROUND`, `ABS`, `SQRT`, `POWER` |
| **Logic** | `IF`, `AND`, `OR`, `NOT` |
| **Text** | `CONCAT`, `LEFT`, `RIGHT`, `LEN`, `UPPER`, `LOWER` |
| **Date** | `TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY` |

## Running Tests

```bash
# Core engine tests (71 tests)
node test_engine.mjs

# Edge-case tests (45 tests)
node test_edge_cases.mjs
```

## Architecture

The engine is fully client-side with no backend. The core data flow:

```
User Input → SpreadsheetEngine.setCellValue()
  → Parse formula (tokenizer → parser → evaluator)
  → Update dependency graph
  → Check for circular references
  → Cascade recalculation to dependents
  → React re-renders affected cells
```

## Tech Stack

- **React 19** — UI framework
- **Vite** — Build tool and dev server
- **Vanilla CSS** — Styling (dark/light themes)

## License

MIT
