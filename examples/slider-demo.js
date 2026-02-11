/**
 * Slider Detection Demo
 * 
 * Demonstrates slider detection in various scenarios
 */

import { detectSliders, getSliderStatistics } from '../src/slider-correction.js';

console.log('=== Slider Detection Demo ===\n');

// Example 1: Ambiguous brace placement in JavaScript
console.log('1. JavaScript Brace Alignment:');
const jsDiff = [
  { value: 'function test() {\n', classification: 'unchanged' },
  { 
    removedLine: '  oldCode();\n',
    addedLine: '  newCode();\n', 
    classification: 'modified',
    similarity: 0.7
  },
  { value: '}\n', classification: 'unchanged' }
];

const jsSliders = detectSliders(jsDiff, { language: 'javascript' });
console.log(`  Detected: ${jsSliders.length} sliders`);
if (jsSliders.length > 0) {
  console.log(`  Confidence: ${jsSliders[0].confidence.toFixed(3)}`);
  console.log(`  Recommendation: ${jsSliders[0].recommendation}`);
}
console.log();

// Example 2: Indentation ambiguity in Python
console.log('2. Python Indentation:');
const pythonDiff = [
  { value: 'if condition:\n', classification: 'unchanged' },
  { 
    removedLine: '    old_line()\n',
    addedLine: '    new_line()\n',
    classification: 'modified',
    similarity: 0.8
  },
  { value: '    another_line()\n', classification: 'unchanged' }
];

const pythonSliders = detectSliders(pythonDiff, { language: 'python' });
console.log(`  Detected: ${pythonSliders.length} sliders`);
if (pythonSliders.length > 0) {
  console.log(`  Confidence: ${pythonSliders[0].confidence.toFixed(3)}`);
  console.log(`  Indentation weight: ${JSON.parse('{"python":{"braceWeight":0,"indentWeight":0.5,"commentWeight":0.3,"delimiterWeight":0.2}}').python.indentWeight}`);
}
console.log();

// Example 3: JSON structure with delimiter alignment
console.log('3. JSON Delimiter Alignment:');
const jsonDiff = [
  { value: '{\n', classification: 'unchanged' },
  { 
    removedLine: '  "old": "value",\n',
    addedLine: '  "new": "value",\n',
    classification: 'modified',
    similarity: 0.75
  },
  { value: '  "unchanged": true\n', classification: 'unchanged' },
  { value: '}\n', classification: 'unchanged' }
];

const jsonSliders = detectSliders(jsonDiff, { language: 'json' });
console.log(`  Detected: ${jsonSliders.length} sliders`);
if (jsonSliders.length > 0) {
  console.log(`  Confidence: ${jsonSliders[0].confidence.toFixed(3)}`);
  console.log(`  Current score: ${jsonSliders[0].currentScore.toFixed(3)}`);
  console.log(`  Alternatives: ${jsonSliders[0].alternatives.length}`);
}
console.log();

// Example 4: Performance with larger diff
console.log('4. Performance Test (1000 lines):');
const largeDiff = [];
for (let i = 0; i < 1000; i++) {
  if (i % 100 === 50) {
    largeDiff.push({
      removedLine: `line ${i}\n`,
      addedLine: `modified line ${i}\n`,
      classification: 'modified',
      similarity: 0.7
    });
  } else {
    largeDiff.push({
      value: `line ${i}\n`,
      classification: 'unchanged'
    });
  }
}

const startTime = performance.now();
const largeSliders = detectSliders(largeDiff, { language: 'javascript' });
const endTime = performance.now();

console.log(`  Diff size: ${largeDiff.length} lines`);
console.log(`  Sliders detected: ${largeSliders.length}`);
console.log(`  Time: ${(endTime - startTime).toFixed(2)}ms`);
console.log(`  < 100ms requirement: ${(endTime - startTime) < 100 ? '✅' : '❌'}`);
console.log();

// Overall statistics
console.log('5. Overall Statistics:');
const allSliders = [...jsSliders, ...pythonSliders, ...jsonSliders, ...largeSliders];
const stats = getSliderStatistics(allSliders);
console.log(`  Total sliders: ${stats.totalSliders}`);
console.log(`  High confidence: ${stats.highConfidence}`);
console.log(`  Medium confidence: ${stats.mediumConfidence}`);
console.log(`  Low confidence: ${stats.lowConfidence}`);
console.log(`  Recommend shift left: ${stats.recommendLeft}`);
console.log(`  Recommend shift right: ${stats.recommendRight}`);
console.log(`  Recommend keep: ${stats.recommendKeep}`);

console.log('\n=== Demo Complete ===');