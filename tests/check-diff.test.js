import { test } from 'vitest';
import { diffLines } from 'diff';

test('Check exact diff output', () => {
  const original = `line 1
line 2
function movedFunction() {
    console.log('test');
    return true;
}
line 6
line 7`;

  const modified = `line 1
line 2
line 6
line 7
function movedFunction() {
    console.log('test');
    return true;
}`;

  const result = diffLines(original, modified);

  console.log('\nFull diff output:');
  result.forEach((r, i) => {
    const lines = r.value.split('\n').filter(l => l.length > 0);
    console.log(`\n[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}, lines: ${lines.length}`);
    lines.forEach((l, li) => {
      console.log(`    line ${li}: "${l}"`);
    });
  });
});
