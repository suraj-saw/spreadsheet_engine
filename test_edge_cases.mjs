/**
 * Edge-case test suite for SpreadsheetEngine
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { evaluateFormula, extractReferences } from './src/engine/parser.js';

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const engineSource = readFileSync(path.join(__dirname2, 'src/engine/SpreadsheetEngine.js'), 'utf-8');
const engineCode = engineSource.replace(/import\s*\{[^}]+\}\s*from\s*'\.\/parser';\s*/, '');
const wrappedCode = `
  ${engineCode.replace('export class SpreadsheetEngine', 'class SpreadsheetEngine')}
  return SpreadsheetEngine;
`;
const SpreadsheetEngine = new Function('evaluateFormula', 'extractReferences', wrappedCode)(evaluateFormula, extractReferences);

let passed = 0, failed = 0;
const failures = [];

function assertEq(actual, expected, testName) {
  if (actual === expected) { passed++; }
  else {
    failed++;
    failures.push(`${testName} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    console.log(`  FAIL: ${testName} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}
function assert(cond, name) {
  if (cond) passed++; else { failed++; failures.push(name); console.log(`  FAIL: ${name}`); }
}

// ============ 21. NESTED FUNCTIONS ============
console.log('\n=== 21. Nested Functions ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '4');
  e.setCellValue('A2', '9');
  e.setCellValue('B1', '=SUM(SQRT(A1),SQRT(A2))');
  assertEq(e.getComputedValue('B1'), 5, 'SUM(SQRT(4),SQRT(9)) => 5');

  e.setCellValue('B2', '=ROUND(AVERAGE(A1,A2),1)');
  assertEq(e.getComputedValue('B2'), 6.5, 'ROUND(AVERAGE(4,9),1) => 6.5');
}

// ============ 22. EMPTY FORMULA ============
console.log('\n=== 22. Empty Formula ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=');
  assertEq(e.isError('A1'), true, 'Empty formula "=" is error');
}

// ============ 23. FORMULA WITH ONLY SPACES AFTER = ============
console.log('\n=== 23. Formula With Spaces ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=  ');
  assertEq(e.isError('A1'), true, '"=  " (spaces only) is error');
}

// ============ 24. DEEPLY NESTED PARENTHESES ============
console.log('\n=== 24. Deep Parentheses ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=((((1+2))))');
  assertEq(e.getComputedValue('A1'), 3, '((((1+2)))) => 3');
}

// ============ 25. LARGE NUMBERS ============
console.log('\n=== 25. Large Numbers ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '999999999');
  e.setCellValue('B1', '=A1*A1');
  assertEq(e.getComputedValue('B1'), 999999998000000001, 'Large number multiplication');
}

// ============ 26. NEGATIVE NUMBERS IN CELLS ============
console.log('\n=== 26. Negative Numbers ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '-5');
  assertEq(e.getComputedValue('A1'), -5, 'Negative number stored');
  e.setCellValue('B1', '=A1*2');
  assertEq(e.getComputedValue('B1'), -10, '-5*2 => -10');
}

// ============ 27. DECIMAL ARITHMETIC ============
console.log('\n=== 27. Decimal Arithmetic ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '0.1');
  e.setCellValue('A2', '0.2');
  e.setCellValue('B1', '=A1+A2');
  // JS floating point: 0.1+0.2 = 0.30000000000000004
  const val = e.getComputedValue('B1');
  assert(Math.abs(val - 0.3) < 1e-10, '0.1+0.2 ≈ 0.3');
}

// ============ 28. MULTIPLE CELLS DEPENDING ON SAME SOURCE ============
console.log('\n=== 28. Fan-out Dependencies ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '10');
  e.setCellValue('B1', '=A1+1');
  e.setCellValue('C1', '=A1+2');
  e.setCellValue('D1', '=A1+3');
  e.setCellValue('E1', '=A1+4');
  assertEq(e.getComputedValue('B1'), 11, 'Fan-out B1');
  assertEq(e.getComputedValue('E1'), 14, 'Fan-out E1');

  e.setCellValue('A1', '100');
  assertEq(e.getComputedValue('B1'), 101, 'Fan-out B1 after update');
  assertEq(e.getComputedValue('C1'), 102, 'Fan-out C1 after update');
  assertEq(e.getComputedValue('D1'), 103, 'Fan-out D1 after update');
  assertEq(e.getComputedValue('E1'), 104, 'Fan-out E1 after update');
}

// ============ 29. OVERWRITE FORMULA WITH VALUE ============
console.log('\n=== 29. Overwrite Formula ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+1');
  assertEq(e.getComputedValue('B1'), 6, 'B1=A1+1 => 6');
  e.setCellValue('B1', '42');
  assertEq(e.getComputedValue('B1'), 42, 'B1 overwritten to 42');
  assertEq(e.isError('B1'), false, 'B1 not error');
  assertEq(e.isCircular('B1'), false, 'B1 not circular');
}

// ============ 30. CLEAR A CELL THAT HAS DEPENDENTS ============
console.log('\n=== 30. Clear Cell With Dependents ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1+1');
  assertEq(e.getComputedValue('B1'), 6, 'B1 before clear');
  e.setCellValue('A1', '');
  assertEq(e.getComputedValue('B1'), 1, 'B1 after A1 cleared (0+1=1)');
}

// ============ 31. UNDO RESTORES DEPENDENTS ============
console.log('\n=== 31. Undo Restores Dependencies ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '5');
  e.setCellValue('B1', '=A1*2');
  assertEq(e.getComputedValue('B1'), 10, 'B1 initial');
  e.setCellValue('A1', '20');
  assertEq(e.getComputedValue('B1'), 40, 'B1 after A1=20');
  e.undo();
  assertEq(e.getComputedValue('A1'), 5, 'A1 undone to 5');
  assertEq(e.getComputedValue('B1'), 10, 'B1 recalculated after undo');
}

// ============ 32. UNDO CIRCULAR FIX ============
console.log('\n=== 32. Undo After Fixing Circular ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1');
  e.setCellValue('B1', '=A1');  // Circular!
  assertEq(e.isCircular('B1'), true, 'B1 circular');
  e.setCellValue('B1', '5');    // Fix it
  assertEq(e.isCircular('B1'), false, 'B1 fixed');
  assertEq(e.getComputedValue('A1'), 5, 'A1=B1=5');
  e.undo(); // Should go back to circular
  assertEq(e.isCircular('B1'), true, 'B1 circular again after undo');
}

// ============ 33. RANGE SUM WITH UPDATE ============
console.log('\n=== 33. Range With Update ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1');
  e.setCellValue('A2', '2');
  e.setCellValue('A3', '3');
  e.setCellValue('B1', '=SUM(A1:A3)');
  assertEq(e.getComputedValue('B1'), 6, 'SUM(A1:A3)=6');
  e.setCellValue('A2', '20');
  assertEq(e.getComputedValue('B1'), 24, 'SUM(A1:A3) after A2=20 => 24');
}

// ============ 34. DIVISION BY ZERO ============
console.log('\n=== 34. Division By Zero Via Cell ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '0');
  e.setCellValue('B1', '=10/A1');
  assertEq(e.isError('B1'), true, '10/0 via cell ref is error');
}

// ============ 35. CONCAT FUNCTION ============
console.log('\n=== 35. CONCAT Function ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', 'Hello');
  e.setCellValue('A2', 'World');
  e.setCellValue('B1', '=CONCAT(A1,A2)');
  assertEq(e.getComputedValue('B1'), 'HelloWorld', 'CONCAT => HelloWorld');
}

// ============ 36. IF WITH UPDATE ============
console.log('\n=== 36. IF With Cascading Update ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1');
  e.setCellValue('B1', '=IF(A1,100,200)');
  assertEq(e.getComputedValue('B1'), 100, 'IF(1,100,200) => 100');
  e.setCellValue('A1', '0');
  assertEq(e.getComputedValue('B1'), 200, 'IF(0,100,200) => 200');
}

// ============ 37. THREE-WAY CIRCULAR ============
console.log('\n=== 37. Three-way Circular ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '1');
  e.setCellValue('B1', '=A1+1');
  e.setCellValue('C1', '=B1+1');
  // Now make A1 depend on C1 => circular
  e.setCellValue('A1', '=C1+1');
  assertEq(e.isCircular('A1'), true, 'A1 circular in 3-way');
}

// ============ 38. EXPRESSION WITH MULTIPLE OPS ============
console.log('\n=== 38. Complex Expression ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '2');
  e.setCellValue('A2', '3');
  e.setCellValue('A3', '4');
  e.setCellValue('B1', '=A1+A2*A3-1');
  assertEq(e.getComputedValue('B1'), 13, '2+3*4-1 => 13');
}

// ============ 39. POWER AND SQRT ============
console.log('\n=== 39. POWER/SQRT Combo ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=POWER(3,2)');
  assertEq(e.getComputedValue('A1'), 9, 'POWER(3,2) => 9');
  e.setCellValue('A2', '=SQRT(A1)');
  assertEq(e.getComputedValue('A2'), 3, 'SQRT(9) => 3');
}

// ============ 40. RAPID SUCCESSIVE UPDATES ============
console.log('\n=== 40. Rapid Updates ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=B1+C1+D1');
  for (let i = 0; i < 100; i++) {
    e.setCellValue('B1', String(i));
    e.setCellValue('C1', String(i * 2));
    e.setCellValue('D1', String(i * 3));
  }
  assertEq(e.getComputedValue('B1'), 99, 'B1 after rapid updates');
  assertEq(e.getComputedValue('A1'), 99 + 198 + 297, 'A1=99+198+297=594');
}

// ============ 41. CELL REFERENCING NON-EXISTENT (BUT VALID ID) ============
console.log('\n=== 41. Reference to Empty Cell ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=Z99+1');
  assertEq(e.getComputedValue('A1'), 1, 'Empty Z99 treated as 0, so 0+1=1');
}

// ============ 42. MISMATCHED PARENS ============
console.log('\n=== 42. Mismatched Parentheses ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=(1+2');
  assertEq(e.isError('A1'), true, 'Missing closing paren => error');

  e.setCellValue('A2', '=1+2)');
  assertEq(e.isError('A2'), true, 'Extra closing paren => error');
}

// ============ 43. SPECIAL CHARACTERS IN FORMULA ============
console.log('\n=== 43. Special Characters ===');
{
  const e = new SpreadsheetEngine();
  e.setCellValue('A1', '=1&2');
  assertEq(e.isError('A1'), true, '& is invalid => error');
}

// ============ SUMMARY ============
console.log('\n========================================');
console.log(`Edge Cases: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach((f) => console.log(`  - ${f}`));
}
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
