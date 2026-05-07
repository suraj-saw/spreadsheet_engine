/**
 * Edge-case test suite for SpreadsheetEngine
 * Run with: node test_edge_cases.mjs
 */
import { SpreadsheetEngine } from './src/engine/SpreadsheetEngine.js';
import { evaluateFormula, extractReferences } from './src/engine/parser.js';

let passed = 0, failed = 0;
const failures = [];
function assertEq(a, b, n) { if (a===b) passed++; else { failed++; failures.push(`${n} (got ${JSON.stringify(a)}, exp ${JSON.stringify(b)})`); console.log(`  FAIL: ${n} | got=${JSON.stringify(a)} exp=${JSON.stringify(b)}`); }}
function assert(c, n) { if (c) passed++; else { failed++; failures.push(n); console.log(`  FAIL: ${n}`); }}

console.log('\n=== 21. Nested Functions ===');
{ const e = new SpreadsheetEngine();
  e.setCellValue('A1','4'); e.setCellValue('A2','9');
  e.setCellValue('B1','=SUM(SQRT(A1),SQRT(A2))'); assertEq(e.getComputedValue('B1'),5,'Nested SUM(SQRT)');
  e.setCellValue('B2','=ROUND(AVERAGE(A1,A2),1)'); assertEq(e.getComputedValue('B2'),6.5,'Nested ROUND(AVG)');
}
console.log('\n=== 22. Empty Formula ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','='); assertEq(e.isError('A1'),true,'Empty = error'); }
console.log('\n=== 23. Formula With Spaces ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=  '); assertEq(e.isError('A1'),true,'Spaces-only error'); }
console.log('\n=== 24. Deep Parentheses ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=((((1+2))))'); assertEq(e.getComputedValue('A1'),3,'Deep parens'); }
console.log('\n=== 25. Large Numbers ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','999999999'); e.setCellValue('B1','=A1*A1');
  assertEq(e.getComputedValue('B1'),999999998000000001,'Large mult'); }
console.log('\n=== 26. Negative Numbers ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','-5'); assertEq(e.getComputedValue('A1'),-5,'Neg stored');
  e.setCellValue('B1','=A1*2'); assertEq(e.getComputedValue('B1'),-10,'-5*2=-10'); }
console.log('\n=== 27. Decimal Arithmetic ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','0.1'); e.setCellValue('A2','0.2');
  e.setCellValue('B1','=A1+A2'); assert(Math.abs(e.getComputedValue('B1')-0.3)<1e-10,'0.1+0.2≈0.3'); }
console.log('\n=== 28. Fan-out Dependencies ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','10');
  e.setCellValue('B1','=A1+1'); e.setCellValue('C1','=A1+2'); e.setCellValue('D1','=A1+3'); e.setCellValue('E1','=A1+4');
  assertEq(e.getComputedValue('B1'),11,'Fan B1'); assertEq(e.getComputedValue('E1'),14,'Fan E1');
  e.setCellValue('A1','100');
  assertEq(e.getComputedValue('B1'),101,'Fan B1 upd'); assertEq(e.getComputedValue('C1'),102,'Fan C1 upd');
  assertEq(e.getComputedValue('D1'),103,'Fan D1 upd'); assertEq(e.getComputedValue('E1'),104,'Fan E1 upd'); }
console.log('\n=== 29. Overwrite Formula ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','5'); e.setCellValue('B1','=A1+1');
  assertEq(e.getComputedValue('B1'),6,'Before'); e.setCellValue('B1','42');
  assertEq(e.getComputedValue('B1'),42,'After'); assertEq(e.isError('B1'),false,'No err'); assertEq(e.isCircular('B1'),false,'No circ'); }
console.log('\n=== 30. Clear Cell With Dependents ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','5'); e.setCellValue('B1','=A1+1');
  assertEq(e.getComputedValue('B1'),6,'Before'); e.setCellValue('A1','');
  assertEq(e.getComputedValue('B1'),1,'After clear 0+1=1'); }
console.log('\n=== 31. Undo Restores Dependencies ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','5'); e.setCellValue('B1','=A1*2');
  assertEq(e.getComputedValue('B1'),10,'Init'); e.setCellValue('A1','20');
  assertEq(e.getComputedValue('B1'),40,'Updated'); e.undo();
  assertEq(e.getComputedValue('A1'),5,'Undone'); assertEq(e.getComputedValue('B1'),10,'Recalced'); }
console.log('\n=== 32. Undo After Fixing Circular ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=B1'); e.setCellValue('B1','=A1');
  assertEq(e.isCircular('B1'),true,'Circ'); e.setCellValue('B1','5');
  assertEq(e.isCircular('B1'),false,'Fixed'); assertEq(e.getComputedValue('A1'),5,'A1=5');
  e.undo(); assertEq(e.isCircular('B1'),true,'Circ again after undo'); }
console.log('\n=== 33. Range With Update ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','1'); e.setCellValue('A2','2'); e.setCellValue('A3','3');
  e.setCellValue('B1','=SUM(A1:A3)'); assertEq(e.getComputedValue('B1'),6,'SUM=6');
  e.setCellValue('A2','20'); assertEq(e.getComputedValue('B1'),24,'SUM=24 after update'); }
console.log('\n=== 34. Division By Zero Via Cell ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','0'); e.setCellValue('B1','=10/A1');
  assertEq(e.isError('B1'),true,'Div/0 via ref'); }
console.log('\n=== 35. CONCAT Function ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','Hello'); e.setCellValue('A2','World');
  e.setCellValue('B1','=CONCAT(A1,A2)'); assertEq(e.getComputedValue('B1'),'HelloWorld','CONCAT'); }
console.log('\n=== 36. IF With Cascading ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','1'); e.setCellValue('B1','=IF(A1,100,200)');
  assertEq(e.getComputedValue('B1'),100,'IF(1)=100'); e.setCellValue('A1','0');
  assertEq(e.getComputedValue('B1'),200,'IF(0)=200'); }
console.log('\n=== 37. Three-way Circular ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','1'); e.setCellValue('B1','=A1+1'); e.setCellValue('C1','=B1+1');
  e.setCellValue('A1','=C1+1'); assertEq(e.isCircular('A1'),true,'3-way circ'); }
console.log('\n=== 38. Complex Expression ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','2'); e.setCellValue('A2','3'); e.setCellValue('A3','4');
  e.setCellValue('B1','=A1+A2*A3-1'); assertEq(e.getComputedValue('B1'),13,'2+3*4-1=13'); }
console.log('\n=== 39. POWER/SQRT Combo ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=POWER(3,2)'); assertEq(e.getComputedValue('A1'),9,'POWER=9');
  e.setCellValue('A2','=SQRT(A1)'); assertEq(e.getComputedValue('A2'),3,'SQRT=3'); }
console.log('\n=== 40. Rapid Updates ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=B1+C1+D1');
  for (let i=0;i<100;i++) { e.setCellValue('B1',String(i)); e.setCellValue('C1',String(i*2)); e.setCellValue('D1',String(i*3)); }
  assertEq(e.getComputedValue('B1'),99,'B1=99'); assertEq(e.getComputedValue('A1'),594,'A1=594'); }
console.log('\n=== 41. Reference to Empty Cell ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=Z99+1'); assertEq(e.getComputedValue('A1'),1,'Empty ref+1=1'); }
console.log('\n=== 42. Mismatched Parens ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=(1+2'); assertEq(e.isError('A1'),true,'Missing )');
  e.setCellValue('A2','=1+2)'); assertEq(e.isError('A2'),true,'Extra )'); }
console.log('\n=== 43. Special Characters ===');
{ const e = new SpreadsheetEngine(); e.setCellValue('A1','=1&2'); assertEq(e.isError('A1'),true,'& invalid'); }

console.log('\n========================================');
console.log(`Edge Cases: ${passed} passed, ${failed} failed`);
if (failures.length>0) { console.log('\nFailed:'); failures.forEach(f=>console.log(`  - ${f}`)); }
console.log('========================================');
process.exit(failed>0?1:0);
