/**
 * Comprehensive test suite for SpreadsheetEngine + Parser
 * Run with: node test_engine.mjs
 */
// We need to load the files that use extensionless imports (Vite convention).
// Node ESM requires extensions, so we use a workaround with a custom loader.
// Instead, let's import parser directly and then patch SpreadsheetEngine's import.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Import parser directly (it has no further local imports)
import { evaluateFormula, extractReferences } from './src/engine/parser.js';

// Dynamically construct SpreadsheetEngine since it imports './parser' without extension
// We'll just re-implement the import inline:
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

// Read SpreadsheetEngine source and evaluate it with parser already available
const engineSource = readFileSync(path.join(__dirname2, 'src/engine/SpreadsheetEngine.js'), 'utf-8');

// Create a module-like wrapper
const engineCode = engineSource
  .replace(/import\s*\{[^}]+\}\s*from\s*'\.\/parser';\s*/, '');

// Use Function constructor to create the class
const moduleExports = {};
const wrappedCode = `
  ${engineCode.replace('export class SpreadsheetEngine', 'class SpreadsheetEngine')}
  return SpreadsheetEngine;
`;
const SpreadsheetEngine = new Function('evaluateFormula', 'extractReferences', wrappedCode)(evaluateFormula, extractReferences);

let passed = 0, failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(testName);
    console.log(`  FAIL: ${testName}`);
  }
}

function assertEq(actual, expected, testName) {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${testName} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    failed++;
    console.log(`  FAIL: ${testName} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  } else {
    passed++;
  }
}

// ============ 1. BASIC VALUE ENTRY ============
console.log('\n=== 1. Basic Value Entry ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  assertEq(e.getComputedValue('A1'), 5, 'Numeric value stored as number');

  e.setCellValue('A2', 'Hello');
  assertEq(e.getComputedValue('A2'), 'Hello', 'Text value stored as string');

  e.setCellValue('A3', '');
  assertEq(e.getComputedValue('A3'), '', 'Empty string clears cell');

  e.setCellValue('A4', '3.14');
  assertEq(e.getComputedValue('A4'), 3.14, 'Decimal number');

  e.setCellValue('A5', '0');
  assertEq(e.getComputedValue('A5'), 0, 'Zero stored as number');
}

// ============ 2. SIMPLE FORMULA EVALUATION ============
console.log('\n=== 2. Simple Formulas ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+3');
  assertEq(e.getComputedValue('B1'), 8, '=A1+3 with A1=5 => 8');

  e.setCellValue('C1', '=B1*2');
  assertEq(e.getComputedValue('C1'), 16, '=B1*2 => 16');

  e.setCellValue('D1', '=A1*2');
  assertEq(e.getComputedValue('D1'), 10, '=A1*2 => 10');

  e.setCellValue('E1', '=(A1+B1)/2');
  assertEq(e.getComputedValue('E1'), 6.5, '=(A1+B1)/2 => 6.5');
}

// ============ 3. CASCADING UPDATES ============
console.log('\n=== 3. Cascading Updates ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+3');
  e.setCellValue('C1', '=B1*2');
  assertEq(e.getComputedValue('B1'), 8, 'B1 initial = 8');
  assertEq(e.getComputedValue('C1'), 16, 'C1 initial = 16');

  // Now change A1
  e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('B1'), 13, 'B1 after A1=10 => 13');
  assertEq(e.getComputedValue('C1'), 26, 'C1 after A1=10 => 26');
}

// ============ 4. CIRCULAR REFERENCE DETECTION ============
console.log('\n=== 4. Circular References ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A2', '=B2');
  e.setCellValue('B2', '=A2');
  assertEq(e.isCircular('B2'), true, 'B2 circular detected');
  assertEq(e.getComputedValue('B2'), '#CIRCULAR', 'B2 shows #CIRCULAR');

  // Self-reference
  const e2 = new SpreadsheetEngine();
  e2.setCellValue('A1', '=A1+1');
  assertEq(e2.isCircular('A1'), true, 'Self-reference A1=A1+1 is circular');
  assertEq(e2.getComputedValue('A1'), '#CIRCULAR', 'Self-ref shows #CIRCULAR');

  // Longer chain: A->B->C->A
  const e3 = new SpreadsheetEngine();
  e3.setCellValue('A1', '=C1');
  e3.setCellValue('B1', '=A1');
  e3.setCellValue('C1', '=B1');
  assertEq(e3.isCircular('C1'), true, 'C1 in A->B->C->A cycle');
}

// ============ 5. ERROR HANDLING ============
console.log('\n=== 5. Error Handling ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('C3', '=A1+');
  assertEq(e.isError('C3'), true, 'Invalid formula =A1+ shows error');
  assertEq(e.getComputedValue('C3'), '#ERROR', '=A1+ => #ERROR');

  // Division by zero
  e.setCellValue('D1', '=5/0');
  assertEq(e.isError('D1'), true, 'Division by zero is error');

  // Valid cells still work
  e.setCellValue('A1', '42');
  assertEq(e.getComputedValue('A1'), 42, 'Valid cell unaffected by other errors');

  // Unknown function
  e.setCellValue('E1', '=FOOBAR(1)');
  assertEq(e.isError('E1'), true, 'Unknown function is error');
}

// ============ 6. EMPTY CELL REFERENCES ============
console.log('\n=== 6. Empty Cell References ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1+5');
  assertEq(e.getComputedValue('A1'), 5, 'Empty B1 treated as 0, so =B1+5 => 5');
}

// ============ 7. OPERATOR PRECEDENCE ============
console.log('\n=== 7. Operator Precedence ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=2+3*4');
  assertEq(e.getComputedValue('A1'), 14, '2+3*4 => 14 (not 20)');

  e.setCellValue('A2', '=(2+3)*4');
  assertEq(e.getComputedValue('A2'), 20, '(2+3)*4 => 20');

  e.setCellValue('A3', '=10-2*3');
  assertEq(e.getComputedValue('A3'), 4, '10-2*3 => 4');

  e.setCellValue('A4', '=10/2+3');
  assertEq(e.getComputedValue('A4'), 8, '10/2+3 => 8');
}

// ============ 8. UNARY OPERATORS ============
console.log('\n=== 8. Unary Operators ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=-5');
  assertEq(e.getComputedValue('A1'), -5, 'Unary minus: =-5');

  e.setCellValue('A2', '=+5');
  assertEq(e.getComputedValue('A2'), 5, 'Unary plus: =+5');

  e.setCellValue('A3', '=-(-3)');
  assertEq(e.getComputedValue('A3'), 3, 'Double negative: =-(-3)');
}

// ============ 9. FUNCTIONS ============
console.log('\n=== 9. Functions ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1');
  e.setCellValue('A2', '2');
  e.setCellValue('A3', '3');

  e.setCellValue('B1', '=SUM(A1,A2,A3)');
  assertEq(e.getComputedValue('B1'), 6, 'SUM(1,2,3) => 6');

  e.setCellValue('B2', '=AVERAGE(A1,A2,A3)');
  assertEq(e.getComputedValue('B2'), 2, 'AVERAGE(1,2,3) => 2');

  e.setCellValue('B3', '=MIN(A1,A2,A3)');
  assertEq(e.getComputedValue('B3'), 1, 'MIN(1,2,3) => 1');

  e.setCellValue('B4', '=MAX(A1,A2,A3)');
  assertEq(e.getComputedValue('B4'), 3, 'MAX(1,2,3) => 3');

  e.setCellValue('B5', '=COUNT(A1,A2,A3)');
  assertEq(e.getComputedValue('B5'), 3, 'COUNT(1,2,3) => 3');

  e.setCellValue('B6', '=ABS(-10)');
  assertEq(e.getComputedValue('B6'), 10, 'ABS(-10) => 10');

  e.setCellValue('B7', '=SQRT(16)');
  assertEq(e.getComputedValue('B7'), 4, 'SQRT(16) => 4');

  e.setCellValue('B8', '=POWER(2,3)');
  assertEq(e.getComputedValue('B8'), 8, 'POWER(2,3) => 8');

  e.setCellValue('B9', '=ROUND(3.14159,2)');
  assertEq(e.getComputedValue('B9'), 3.14, 'ROUND(3.14159,2) => 3.14');
}

// ============ 10. RANGE REFERENCES ============
console.log('\n=== 10. Range References ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10');
  e.setCellValue('A2', '20');
  e.setCellValue('A3', '30');
  e.setCellValue('B1', '=SUM(A1:A3)');
  assertEq(e.getComputedValue('B1'), 60, 'SUM(A1:A3) => 60');
}

// ============ 11. IF / AND / OR / NOT ============
console.log('\n=== 11. Logical Functions ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10');
  e.setCellValue('B1', '=IF(A1,1,0)');
  assertEq(e.getComputedValue('B1'), 1, 'IF(10,1,0) => 1 (truthy)');

  e.setCellValue('A1', '0');
  assertEq(e.getComputedValue('B1'), 0, 'IF(0,1,0) => 0 (falsy)');
}

// ============ 12. STRING FUNCTIONS ============
console.log('\n=== 12. String Functions ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', 'hello');

  e.setCellValue('B1', '=UPPER(A1)');
  assertEq(e.getComputedValue('B1'), 'HELLO', 'UPPER("hello") => "HELLO"');

  e.setCellValue('B2', '=LOWER(A1)');
  assertEq(e.getComputedValue('B2'), 'hello', 'LOWER("hello") => "hello"');

  e.setCellValue('B3', '=LEN(A1)');
  assertEq(e.getComputedValue('B3'), 5, 'LEN("hello") => 5');
}

// ============ 13. UNDO / REDO ============
console.log('\n=== 13. Undo/Redo ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('A1'), 10, 'A1 = 10 before undo');

  e.undo();
  assertEq(e.getComputedValue('A1'), 5, 'A1 = 5 after undo');

  e.redo();
  assertEq(e.getComputedValue('A1'), 10, 'A1 = 10 after redo');

  e.undo();
  e.undo();
  assertEq(e.getComputedValue('A1'), '', 'A1 empty after double undo');
}

// ============ 14. DEPENDENCY CLEANUP ============
console.log('\n=== 14. Dependency Cleanup ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+1');
  assertEq(e.getComputedValue('B1'), 6, 'B1=A1+1 => 6');

  // Change B1 to plain value — should no longer depend on A1
  e.setCellValue('B1', '99');
  assertEq(e.getComputedValue('B1'), 99, 'B1 is now 99');

  // Changing A1 should NOT affect B1 anymore
  e.setCellValue('A1', '100');
  assertEq(e.getComputedValue('B1'), 99, 'B1 still 99 after A1 change');
}

// ============ 15. CASE INSENSITIVITY ============
console.log('\n=== 15. Case Insensitivity ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('a1', '42');
  assertEq(e.getComputedValue('A1'), 42, 'a1 and A1 are same cell');

  e.setCellValue('B1', '=a1+1');
  assertEq(e.getComputedValue('B1'), 43, '=a1+1 => 43');
}

// ============ 16. MULTIPLE DEPENDENT CHAINS ============
console.log('\n=== 16. Multi-level Dependencies ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1');
  e.setCellValue('B1', '=A1+1');   // 2
  e.setCellValue('C1', '=B1+1');   // 3
  e.setCellValue('D1', '=C1+1');   // 4
  e.setCellValue('E1', '=D1+1');   // 5
  assertEq(e.getComputedValue('E1'), 5, 'Chain A1->B1->C1->D1->E1 = 5');

  e.setCellValue('A1', '10');
  assertEq(e.getComputedValue('B1'), 11, 'B1 updates to 11');
  assertEq(e.getComputedValue('C1'), 12, 'C1 updates to 12');
  assertEq(e.getComputedValue('D1'), 13, 'D1 updates to 13');
  assertEq(e.getComputedValue('E1'), 14, 'E1 updates to 14');
}

// ============ 17. DIAMOND DEPENDENCY ============
console.log('\n=== 17. Diamond Dependency ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10');
  e.setCellValue('B1', '=A1+1');   // 11
  e.setCellValue('C1', '=A1+2');   // 12
  e.setCellValue('D1', '=B1+C1'); // 23
  assertEq(e.getComputedValue('D1'), 23, 'Diamond: D1=B1+C1=23');

  e.setCellValue('A1', '20');
  assertEq(e.getComputedValue('B1'), 21, 'B1=21');
  assertEq(e.getComputedValue('C1'), 22, 'C1=22');
  assertEq(e.getComputedValue('D1'), 43, 'D1=B1+C1=43');
}

// ============ 18. TEXT IN FORMULA CONTEXT ============
console.log('\n=== 18. Text in Formula ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', 'abc');
  e.setCellValue('B1', '=A1+1');
  assertEq(e.isError('B1'), true, 'Text cell in arithmetic formula => error');
}

// ============ 19. EXTRACT REFERENCES ============
console.log('\n=== 19. extractReferences ===');
{
  const refs1 = extractReferences('=A1+B2');
  assert(refs1.has('A1') && refs1.has('B2') && refs1.size === 2, '=A1+B2 refs');

  const refs2 = extractReferences('=SUM(A1:A3)');
  assert(refs2.has('A1') && refs2.has('A2') && refs2.has('A3'), '=SUM(A1:A3) refs');

  const refs3 = extractReferences('hello');
  assertEq(refs3.size, 0, 'Non-formula has no refs');

  const refs4 = extractReferences('=5+3');
  assertEq(refs4.size, 0, 'Pure arithmetic has no refs');
}

// ============ 20. CIRCULAR THEN FIX ============
console.log('\n=== 20. Fix Circular Reference ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1');
  e.setCellValue('B1', '=A1');
  assertEq(e.isCircular('B1'), true, 'B1 circular');

  // Fix B1
  e.setCellValue('B1', '5');
  assertEq(e.isCircular('B1'), false, 'B1 no longer circular');
  assertEq(e.getComputedValue('A1'), 5, 'A1=B1=5 after fix');
}

// ============ SUMMARY ============
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((f) => console.log(`  - ${f}`));
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
