/**
 * Core test suite for SpreadsheetEngine + Parser
 * Run with: node test_engine.mjs
 */
import { SpreadsheetEngine } from './src/engine/SpreadsheetEngine.js';
import { evaluateFormula, extractReferences } from './src/engine/parser.js';

let passed = 0, failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) { passed++; } else { failed++; failures.push(testName); console.log(`  FAIL: ${testName}`); }
}
function assertEq(actual, expected, testName) {
  if (actual === expected) { passed++; } else {
    failed++; failures.push(`${testName} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    console.log(`  FAIL: ${testName} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}

// ============ 1. BASIC VALUE ENTRY ============
console.log('\n=== 1. Basic Value Entry ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');   assertEq(e.getComputedValue('A1'), 5, 'Numeric value stored as number');
  e.setCellValue('A2', 'Hello'); assertEq(e.getComputedValue('A2'), 'Hello', 'Text value stored as string');
  e.setCellValue('A3', '');    assertEq(e.getComputedValue('A3'), '', 'Empty string clears cell');
  e.setCellValue('A4', '3.14'); assertEq(e.getComputedValue('A4'), 3.14, 'Decimal number');
  e.setCellValue('A5', '0');   assertEq(e.getComputedValue('A5'), 0, 'Zero stored as number');
}

// ============ 2. SIMPLE FORMULA EVALUATION ============
console.log('\n=== 2. Simple Formulas ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+3');  assertEq(e.getComputedValue('B1'), 8, '=A1+3 => 8');
  e.setCellValue('C1', '=B1*2');  assertEq(e.getComputedValue('C1'), 16, '=B1*2 => 16');
  e.setCellValue('D1', '=A1*2');  assertEq(e.getComputedValue('D1'), 10, '=A1*2 => 10');
  e.setCellValue('E1', '=(A1+B1)/2'); assertEq(e.getComputedValue('E1'), 6.5, '=(A1+B1)/2 => 6.5');
}

// ============ 3. CASCADING UPDATES ============
console.log('\n=== 3. Cascading Updates ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5'); e.setCellValue('B1', '=A1+3'); e.setCellValue('C1', '=B1*2');
  assertEq(e.getComputedValue('B1'), 8, 'B1 initial'); assertEq(e.getComputedValue('C1'), 16, 'C1 initial');
  e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('B1'), 13, 'B1 cascaded'); assertEq(e.getComputedValue('C1'), 26, 'C1 cascaded');
}

// ============ 4. CIRCULAR REFERENCE DETECTION ============
console.log('\n=== 4. Circular References ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A2', '=B2'); e.setCellValue('B2', '=A2');
  assertEq(e.isCircular('B2'), true, 'B2 circular'); assertEq(e.getComputedValue('B2'), '#CIRCULAR', 'B2 #CIRCULAR');
  const e2 = new SpreadsheetEngine();
  e2.setCellValue('A1', '=A1+1');
  assertEq(e2.isCircular('A1'), true, 'Self-ref circular'); assertEq(e2.getComputedValue('A1'), '#CIRCULAR', 'Self-ref #CIRCULAR');
  const e3 = new SpreadsheetEngine();
  e3.setCellValue('A1', '=C1'); e3.setCellValue('B1', '=A1'); e3.setCellValue('C1', '=B1');
  assertEq(e3.isCircular('C1'), true, '3-way circular');
}

// ============ 5. ERROR HANDLING ============
console.log('\n=== 5. Error Handling ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('C3', '=A1+'); assertEq(e.isError('C3'), true, 'Invalid formula error');
  assertEq(e.getComputedValue('C3'), '#ERROR', '=A1+ => #ERROR');
  e.setCellValue('D1', '=5/0'); assertEq(e.isError('D1'), true, 'Div/0 error');
  e.setCellValue('A1', '42'); assertEq(e.getComputedValue('A1'), 42, 'Valid cell unaffected');
  e.setCellValue('E1', '=FOOBAR(1)'); assertEq(e.isError('E1'), true, 'Unknown function error');
}

// ============ 6-8. EMPTY REFS, PRECEDENCE, UNARY ============
console.log('\n=== 6. Empty Cell References ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1+5'); assertEq(e.getComputedValue('A1'), 5, 'Empty ref treated as 0');
}
console.log('\n=== 7. Operator Precedence ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=2+3*4'); assertEq(e.getComputedValue('A1'), 14, '2+3*4 => 14');
  e.setCellValue('A2', '=(2+3)*4'); assertEq(e.getComputedValue('A2'), 20, '(2+3)*4 => 20');
  e.setCellValue('A3', '=10-2*3'); assertEq(e.getComputedValue('A3'), 4, '10-2*3 => 4');
  e.setCellValue('A4', '=10/2+3'); assertEq(e.getComputedValue('A4'), 8, '10/2+3 => 8');
}
console.log('\n=== 8. Unary Operators ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=-5'); assertEq(e.getComputedValue('A1'), -5, 'Unary minus');
  e.setCellValue('A2', '=+5'); assertEq(e.getComputedValue('A2'), 5, 'Unary plus');
  e.setCellValue('A3', '=-(-3)'); assertEq(e.getComputedValue('A3'), 3, 'Double negative');
}

// ============ 9. FUNCTIONS ============
console.log('\n=== 9. Functions ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1'); e.setCellValue('A2', '2'); e.setCellValue('A3', '3');
  e.setCellValue('B1', '=SUM(A1,A2,A3)'); assertEq(e.getComputedValue('B1'), 6, 'SUM => 6');
  e.setCellValue('B2', '=AVERAGE(A1,A2,A3)'); assertEq(e.getComputedValue('B2'), 2, 'AVERAGE => 2');
  e.setCellValue('B3', '=MIN(A1,A2,A3)'); assertEq(e.getComputedValue('B3'), 1, 'MIN => 1');
  e.setCellValue('B4', '=MAX(A1,A2,A3)'); assertEq(e.getComputedValue('B4'), 3, 'MAX => 3');
  e.setCellValue('B5', '=COUNT(A1,A2,A3)'); assertEq(e.getComputedValue('B5'), 3, 'COUNT => 3');
  e.setCellValue('B6', '=ABS(-10)'); assertEq(e.getComputedValue('B6'), 10, 'ABS => 10');
  e.setCellValue('B7', '=SQRT(16)'); assertEq(e.getComputedValue('B7'), 4, 'SQRT => 4');
  e.setCellValue('B8', '=POWER(2,3)'); assertEq(e.getComputedValue('B8'), 8, 'POWER => 8');
  e.setCellValue('B9', '=ROUND(3.14159,2)'); assertEq(e.getComputedValue('B9'), 3.14, 'ROUND => 3.14');
}

// ============ 10-12. RANGES, LOGIC, STRINGS ============
console.log('\n=== 10. Range References ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10'); e.setCellValue('A2', '20'); e.setCellValue('A3', '30');
  e.setCellValue('B1', '=SUM(A1:A3)'); assertEq(e.getComputedValue('B1'), 60, 'SUM(A1:A3) => 60');
}
console.log('\n=== 11. Logical Functions ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10'); e.setCellValue('B1', '=IF(A1,1,0)');
  assertEq(e.getComputedValue('B1'), 1, 'IF(10) => 1');
  e.setCellValue('A1', '0'); assertEq(e.getComputedValue('B1'), 0, 'IF(0) => 0');
}
console.log('\n=== 12. String Functions ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', 'hello');
  e.setCellValue('B1', '=UPPER(A1)'); assertEq(e.getComputedValue('B1'), 'HELLO', 'UPPER => HELLO');
  e.setCellValue('B2', '=LOWER(A1)'); assertEq(e.getComputedValue('B2'), 'hello', 'LOWER => hello');
  e.setCellValue('B3', '=LEN(A1)'); assertEq(e.getComputedValue('B3'), 5, 'LEN => 5');
}

// ============ 13-15. UNDO/REDO, DEPS, CASE ============
console.log('\n=== 13. Undo/Redo ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5'); e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('A1'), 10, 'Before undo');
  e.undo(); assertEq(e.getComputedValue('A1'), 5, 'After undo');
  e.redo(); assertEq(e.getComputedValue('A1'), 10, 'After redo');
  e.undo(); e.undo(); assertEq(e.getComputedValue('A1'), '', 'Double undo');
}
console.log('\n=== 14. Dependency Cleanup ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5'); e.setCellValue('B1', '=A1+1'); assertEq(e.getComputedValue('B1'), 6, 'B1 dep');
  e.setCellValue('B1', '99'); e.setCellValue('A1', '100');
  assertEq(e.getComputedValue('B1'), 99, 'B1 no longer depends on A1');
}
console.log('\n=== 15. Case Insensitivity ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('a1', '42'); assertEq(e.getComputedValue('A1'), 42, 'Case insensitive set');
  e.setCellValue('B1', '=a1+1'); assertEq(e.getComputedValue('B1'), 43, 'Case insensitive ref');
}

// ============ 16-20. CHAINS, DIAMOND, TEXT-ERR, REFS, FIX-CIRC ============
console.log('\n=== 16. Multi-level Dependencies ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1'); e.setCellValue('B1', '=A1+1'); e.setCellValue('C1', '=B1+1');
  e.setCellValue('D1', '=C1+1'); e.setCellValue('E1', '=D1+1');
  assertEq(e.getComputedValue('E1'), 5, 'Chain = 5');
  e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('B1'), 11, 'B1'); assertEq(e.getComputedValue('C1'), 12, 'C1');
  assertEq(e.getComputedValue('D1'), 13, 'D1'); assertEq(e.getComputedValue('E1'), 14, 'E1');
}
console.log('\n=== 17. Diamond Dependency ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10'); e.setCellValue('B1', '=A1+1'); e.setCellValue('C1', '=A1+2');
  e.setCellValue('D1', '=B1+C1'); assertEq(e.getComputedValue('D1'), 23, 'Diamond=23');
  e.setCellValue('A1', '20');
  assertEq(e.getComputedValue('B1'), 21, 'B1'); assertEq(e.getComputedValue('C1'), 22, 'C1');
  assertEq(e.getComputedValue('D1'), 43, 'Diamond=43');
}
console.log('\n=== 18. Text in Formula ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', 'abc'); e.setCellValue('B1', '=A1+1');
  assertEq(e.isError('B1'), true, 'Text in arithmetic => error');
}
console.log('\n=== 19. extractReferences ===');
{ const refs1 = extractReferences('=A1+B2');
  assert(refs1.has('A1') && refs1.has('B2') && refs1.size === 2, '=A1+B2 refs');
  const refs2 = extractReferences('=SUM(A1:A3)');
  assert(refs2.has('A1') && refs2.has('A2') && refs2.has('A3'), 'Range refs');
  assertEq(extractReferences('hello').size, 0, 'Non-formula'); assertEq(extractReferences('=5+3').size, 0, 'No refs');
}
console.log('\n=== 20. Fix Circular Reference ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1'); e.setCellValue('B1', '=A1');
  assertEq(e.isCircular('B1'), true, 'B1 circular');
  e.setCellValue('B1', '5');
  assertEq(e.isCircular('B1'), false, 'B1 fixed'); assertEq(e.getComputedValue('A1'), 5, 'A1=5');
}

// ============ SUMMARY ============
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) { console.log('\nFailed:'); failures.forEach((f) => console.log(`  - ${f}`)); }
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
