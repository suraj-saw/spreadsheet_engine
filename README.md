# Spreadsheet Engine

A React-based spreadsheet grid that supports direct data entry and formula evaluation similar to basic Excel functionality. Users can type values or formulas into any cell, reference other cells in formulas, and see all dependent values update automatically.

![Spreadsheet Engine](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Core
- **10×10 editable grid** with columns A–J and rows 1–10
- **Numeric and text** value entry
- **Formula support** — start any cell with `=` to enter a formula

### Formula Engine
- Basic arithmetic: `+`, `-`, `*`, `/`
- Cell references: `=A1+B2`
- Parentheses: `=(C1+D1)/3`
- Multiple cell references: `=A1*2+B3-C4`
- Unary operators: `=-A1`, `=+B2`

### Dependency Management
- Automatic dependency tracking via a directed graph
- Cascading recalculation — updating A1 propagates to B1, C1, etc.
- Topological sort ensures correct evaluation order

### Error Handling
- **`#CIRCULAR`** — displayed when circular references are detected (e.g., A1→B1→A1)
- **`#ERROR`** — displayed for invalid formulas, division by zero, or malformed expressions
- Errors are isolated per-cell and never crash the grid

### Bonus Features
- ✅ **Undo/Redo** — full history with `Ctrl+Z` / `Ctrl+Y`
- ✅ **Formula bar** — view and edit the active cell's formula
- ✅ **Keyboard navigation** — `Tab` to move between cells, `Enter` to confirm, `Esc` to cancel
- ✅ **Optimized recalculation** — only affected downstream cells are recomputed

## Tech Stack

- **React 19** — UI framework
- **Vite 6** — build tool and dev server
- **Vanilla CSS** — custom dark theme with design tokens
- **No external dependencies** — formula parser built from scratch (recursive descent)

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd spreadsheet_engine

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will open at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Usage Examples

| Cell | Input | Displayed Value |
|------|-------|-----------------|
| A1 | `5` | 5 |
| B1 | `=A1+3` | 8 |
| C1 | `=B1*2` | 16 |

Change A1 to `10` → B1 becomes **13**, C1 becomes **26** automatically.

| Cell | Input | Displayed Value |
|------|-------|-----------------|
| A2 | `=B2` | #CIRCULAR |
| B2 | `=A2` | #CIRCULAR |

## Architecture

```
src/
├── engine/
│   ├── parser.js          # Tokenizer + recursive descent parser
│   ├── SpreadsheetEngine.js  # Dependency graph, evaluation, undo/redo
│   └── index.js           # Barrel export
├── context/
│   └── SpreadsheetContext.jsx  # React context + hooks
├── components/
│   ├── Cell.jsx           # Individual cell component (memoized)
│   ├── Grid.jsx           # 10×10 grid layout
│   ├── Toolbar.jsx        # Undo/redo buttons + shortcuts
│   └── FormulaBar.jsx     # Active cell formula display
├── App.jsx                # Main app with keyboard shortcuts
├── main.jsx               # Entry point
└── index.css              # Design system + all styles
```

## License

MIT
