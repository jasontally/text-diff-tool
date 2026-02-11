// Test block move detection
import { detectBlockMovesFast } from './src/diff-algorithms.js';
import { diffLines } from 'https://esm.sh/diff@5.1.0';

// Create test data
const before = `function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].value;
    }
    return total;
}

function processData(data) {
    const results = [];
    for (const item of data) {
        if (item.valid) {
            results.push(transform(item));
        }
    }
    return results;
}

function validateInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Invalid input');
    }
    return true;
}`;

const after = `function validateInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Invalid input');
    }
    return true;
}

function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].value;
    }
    return total;
}

function processData(data) {
    const results = [];
    for (const item of data) {
        if (item.valid) {
            results.push(transform(item));
        }
    }
    return results;
}`;

// Run diff
const diffResults = diffLines(before.split('\n'), after.split('\n'));

// Import and run identifyChangeBlocks
import { identifyChangeBlocks } from './src/diff-algorithms.js';

const blocks = identifyChangeBlocks(diffResults);
console.log(`Found ${blocks.length} change blocks`);

// Run block move detection
const moveResult = detectBlockMovesFast(
  blocks,
  (a, b) => [{ value: a, removed: true }, { value: b, added: true }], // Mock diffWords
  (a, b) => [{ value: a, removed: true }, { value: b, added: true }]  // Mock diffChars
);

console.log('\nLine-level moves:', moveResult.moves.size);
console.log('Cross-block modifications:', moveResult.crossBlockModifications.length);
console.log('Block moves:', moveResult.blockMoves?.length || 0);

if (moveResult.blockMoves && moveResult.blockMoves.length > 0) {
  console.log('\nBlock moves detected:');
  moveResult.blockMoves.forEach((move, idx) => {
    console.log(`  ${idx + 1}. Block of ${move.size} lines from line ${move.from + 1} to line ${move.to + 1} (similarity: ${move.similarity.toFixed(3)})`);
  });
}