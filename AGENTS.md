# AGENTS.md - LLM Working Instructions

This file contains guidance for LLM agents working on the Text Diff Tool codebase.

**Copyright (c) 2026 Jason Tally and contributors** - SPDX-License-Identifier: MIT

## Project Overview

This is a **client-side web application** for comparing two versions of text content with semantic highlighting. The app has:

- **Single-file application**: HTML, CSS, and JavaScript in `index.html`
- **No build process for the app**: Libraries loaded via CDN only
- **Works entirely in the browser**: Text never leaves the client
- **Testing via npm**: Vitest for unit tests, Playwright for E2E tests

## File Structure

```
diff/
├── src/                    # Source modules (extracted for testability)
│   ├── diff-algorithms.js  # Core diff algorithms (environment-agnostic)
│   ├── diff-loader.js      # Cross-environment import helper
├── index.html              # Main application (HTML/CSS/JS)
├── README.md               # User-facing documentation
├── ARCHITECTURE.md         # Detailed architecture & algorithm specs
├── AGENTS.md               # This file - LLM working instructions
├── package.json            # Testing dependencies only
├── vitest.config.js        # Unit test configuration
├── playwright.config.js    # E2E test configuration
└── tests/
    ├── diff.test.js        # Diff algorithm unit tests
    ├── diff-loader.test.js # Import helper tests
    ├── parser.test.js      # Text parser tests (future)
    ├── file-type.test.js   # File type detection tests (future)
    └── e2e/
        ├── compare.spec.js     # E2E tests for comparison flow
        ├── accessibility.spec.js # E2E tests for accessibility
        └── performance.spec.js   # E2E tests for large file handling
```

**Note**: The runtime app (`index.html`) has no npm dependencies. Libraries are loaded via CDN. The `src/` modules enable testing while maintaining single-file deployment capability.

## Architecture Guidelines

### Application Structure

**Modular architecture with single-file deployment**: The app uses extracted ES modules in `src/` for testability, which are then used by unit tests and the main application.

**Main Thread Execution**: The diff pipeline runs directly in the main thread for simplicity:

```javascript
// Main thread in index.html imports from CDN + local modules
import { diffLines, diffWords, diffChars } from 'https://esm.sh/diff@5.1.0';
import { runDiffPipeline } from './src/diff-algorithms.js';

// Run the pipeline
const diffLib = { diffLines, diffWords, diffChars };
const result = await runDiffPipeline(oldText, newText, diffLib, options);
```

**Key Benefits**:
- **No code duplication**: Algorithms in `src/diff-algorithms.js` are the single source of truth
- **Testable**: Same code runs in Node.js (tests) and browser
- **Maintainable**: Single source of truth for all algorithm logic
- **Static site**: No build step required - just serve files via HTTP(S)

**Development Requirement**: Must serve via HTTP(S) - not file:// URLs. Use `python3 -m http.server 8000` or similar.

### CDN-Only Constraint

**The application must not use npm packages or a build step.**

All runtime dependencies must be loaded via CDN:
- esm.sh for ES modules
- jsdelivr or unpkg for global scripts
- Native browser APIs preferred

## Working with This Codebase

### Before Making Changes

1. **Read the relevant documentation:**
   - `README.md` - Features, usage, and deployment guide
   - `ARCHITECTURE.md` - Technical architecture and algorithm specs
   - This file (`AGENTS.md`) - Code conventions and testing

2. **Understand the architecture:**
   - Single-file app with optional JS separation for testing
   - CDN-loaded dependencies only
   - Client-side only - no server components

3. **Verify the change is safe:**
   - Test the application manually after changes
   - Run automated tests: `npm test` and `npm run test:e2e`

### Testing Philosophy

**When to Use Unit Tests vs E2E Tests:**

**Unit Tests are ideal for:**

- Pure functions with deterministic inputs/outputs
- Diff algorithm logic and text parsing (in `src/diff-algorithms.js`)
- File type detection algorithms
- Filter logic (whitespace, comments)
- Functions that don't depend on browser APIs
- The extracted algorithm module (`src/diff-algorithms.js`) is fully testable in Node.js

**E2E Tests are required for:**

- Browser-specific APIs (Clipboard, FileReader)
- DOM interactions and UI behavior
- Cross-browser compatibility testing
- Integration of multiple systems working together
- Features that rely on browser environment (file upload, downloads)
- **Performance testing** - timing large file operations (10k lines)

**Anti-Pattern to Avoid:**

- **Never modify production code to work around unit test environment limitations**
- If a unit test fails due to missing browser APIs, move the test to E2E
- Don't add mocks for browser-specific functionality - test in real browsers

### Debugging the Diff Pipeline

When content appears to be lost or incorrectly processed, enable detailed debug logging:

**Enable Debug Mode:**

1. **In Browser Console** (temporary):
   ```javascript
   localStorage.setItem('diffDebug', 'true');
   location.reload();
   ```

2. **In Code** (permanent):
   Edit `src/diff-algorithms.js` and change:
   ```javascript
   const DEBUG_PIPELINE = true; // Line ~28
   ```

3. **In Node.js Tests**:
   ```bash
   DEBUG_DIFF=1 npm test
   ```

**What Gets Logged:**
- Pipeline entry/exit points with content statistics
- Each transformation stage (raw → fixed → classified)
- Line counts at each stage to detect content loss
- Specific entries being modified or dropped
- Content search results for targeted debugging

**Debug Functions Available:**
- `debugLog(stage, message, data)` - General logging
- `debugContentStats(stage, results, context)` - Content statistics
- `debugSearchContent(stage, results, searchText)` - Find specific content

**Common Issues to Debug:**
- **Lines disappearing**: Check `fixDiffLinesClassification` - look for "POPPING" messages
- **Incorrect classifications**: Check entry transformations in each stage
- **Content mismatches**: Use `debugSearchContent()` to track specific lines

**Content Preservation Tests:**
When investigating content loss, run the preservation tests:
```bash
npm test -- tests/test-content-preservation.test.js
npm test -- tests/test-missing-lines.test.js
```

These tests verify that all input lines appear in the output and catch regression issues.

### File Type Detection Strategy

**Two-level detection system:**

1. **Extension-based detection** (fast path):
   ```javascript
   const EXTENSION_MAP = {
     '.json': 'json',
     '.yaml': 'yaml', '.yml': 'yaml',
     '.xml': 'xml',
     '.txt': 'text',
     '.md': 'markdown',
     // etc.
   };
   ```

2. **Content-based detection** (for generic extensions or pasted text):
   - **Network configs**: Detect Cisco IOS (`!` comments, `interface` keyword), JunOS (`{ }` blocks, `set` commands), Arista EOS patterns
   - **Code formats**: Detect JSON (starts with `{` or `[`), XML (`<?xml` or `<!DOCTYPE`), YAML (`---` or key-value patterns)
   - Use regex patterns and heuristics, no external libraries needed

**Example detection flow:**
```javascript
function detectFileType(content, filename = '') {
  // Level 1: Extension
  const ext = filename.split('.').pop().toLowerCase();
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
  
  // Level 2: Content analysis for network configs
  if (isCiscoIOS(content)) return 'cisco-ios';
  if (isJuniperJunOS(content)) return 'juniper-junos';
  
  // Level 3: Content analysis for code/data
  if (isJSON(content)) return 'json';
  if (isXML(content)) return 'xml';
  if (isYAML(content)) return 'yaml';
  
  return 'text';
}
```

### Syntax Highlighting

**Recommended approach for no-dependency highlighting:**

Use **speed-highlight** via CDN - lightweight, fast, zero dependencies:

```html
<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/speed-highlight@1.0.0/dist/themes/default.css">

<!-- Core + common languages -->
<script type="module">
  import { highlight } from 'https://cdn.jsdelivr.net/npm/speed-highlight@1.0.0/dist/index.js';
  import 'https://cdn.jsdelivr.net/npm/speed-highlight@1.0.0/dist/languages/javascript.js';
  import 'https://cdn.jsdelivr.net/npm/speed-highlight@1.0.0/dist/languages/json.js';
  // etc.
</script>
```

**Alternative**: highlight.js with auto-detection:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/default.min.css">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
```

**Make syntax highlighting optional/toggleable** - it should not block the core diff functionality.

### Accessibility Requirements

**All UI changes must meet WCAG 2.1 Level AA standards.**

**Mandatory for all interactive elements:**

1. **ARIA labels** - Every button and interactive element must have descriptive `aria-label`:

   ```javascript
   const button = document.createElement("button");
   button.ariaLabel = "Compare text versions";
   ```

2. **Form labels** - Use `<label>` elements (never placeholder-only):

   ```javascript
   const label = document.createElement("label");
   label.className = "sr-only";
   label.textContent = "Previous version text";
   label.htmlFor = "previous-text";
   ```

3. **Semantic HTML** - Use proper elements (`<button>`, `<textarea>`, not `<div>`):

   ```javascript
   // Good
   const button = document.createElement("button");
   button.addEventListener("click", handleClick);

   // Bad
   const div = document.createElement("div");
   div.addEventListener("click", handleClick);
   div.setAttribute("role", "button");
   ```

4. **Keyboard support** - All interactions must work via keyboard:
   - Enter/Space to activate buttons
   - Tab to navigate between controls
   - Alt+Up/Alt+Down to navigate between changes
   - Ctrl+Enter to trigger compare
   - Escape to close modals/overlays

5. **ARIA live regions** - Announce comparison results:
   ```javascript
   const liveRegion = document.createElement("div");
   liveRegion.setAttribute("aria-live", "polite");
   liveRegion.setAttribute("aria-atomic", "true");
   liveRegion.textContent = "Found 12 changes";
   ```

6. **Focus management** - Provide visible focus indicators:
   - Don't remove default browser outline
   - Or provide custom focus styles in CSS

**Accessibility Testing Checklist:**

- [ ] All buttons have `aria-label` with context
- [ ] All form inputs have `<label>` elements
- [ ] All interactive elements are keyboard focusable
- [ ] Tab order follows logical visual flow
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text)
- [ ] No color-only indicators for information
- [ ] Dynamic content changes are announced to screen readers

### Mobile Responsive Behavior

**Layout adaptations for small screens:**

- **Portrait orientation**: Switch to inline/unified view by default
- **Side-by-side panels**: Stack vertically instead of horizontally
- **Navigation**: Ensure no horizontal scrolling, controls reflow naturally
- **No special touch gestures**: Standard tap/scroll behavior only

**CSS approach:**
```css
@media (max-width: 768px) {
  .diff-container {
    flex-direction: column;
  }
  .panel {
    width: 100%;
  }
}
```

### Manual Testing

Despite automated tests, manual testing is still recommended after changes.

**Important**: The app uses ES modules and **must be served via HTTP(S)**. It will NOT work from `file://` URLs due to CORS restrictions.

**To test:**
1. Serve the app via HTTP (see Development section below)
2. Paste sample text into both panels
3. Click "Compare" and verify highlighting
4. Test navigation buttons (next/previous change)
5. Test file drag-and-drop
6. Test keyboard shortcuts

**Development Server Options:**
```bash
# Python 3
python3 -m http.server 8000

# Node.js (recommended - better cache control)
npx http-server -p 8000 -c-1 --cors

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000/index.html`

### Dealing with Caching Issues

**Python http.server Caching Problem:**
Python's built-in `http.server` caches files in memory and serves old versions even after file changes. This is especially problematic with ES modules.

**Symptoms:**
- File changes not reflected in browser
- Console shows old error messages
- `curl` shows correct content but browser gets old version
- Response headers show old `last-modified` date

**Solution:**
1. **Kill the server completely** - Ctrl+C or `pkill -f "http.server"`
2. **Wait 2-3 seconds** for port release
3. **Restart the server**
4. **Hard refresh** browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

**Better Alternative - http-server with cache disabled:**
```bash
npx http-server -p 8675 -c-1 --cors
```
- `-c-1` disables caching entirely
- `--cors` enables CORS for module loading
- Updates reflected immediately

**Browser ES Module Caching:**
Once a module is loaded, it's aggressively cached even with query parameters.

**Solution:**
We've added cache busting to all module imports:
```javascript
// In index.html
import { runDiffPipeline } from './src/diff-algorithms.js?v=2';
import { detectCommonLanguage } from './src/language-detect.js?v=2';
```

When making changes, increment version numbers in the imports.

**Cache Clearing Checklist:**
- [ ] Kill and restart server (Python http.server must be fully restarted)
- [ ] Clear browser Application Storage (DevTools → Application → Clear storage)
- [ ] Hard refresh browser (Cmd/Ctrl + Shift + R)
- [ ] Verify with `curl http://localhost:8000/src/your-file.js` before testing

**Common test cases:**
- Small text files (< 100 lines)
- Large text files (10,000+ lines) - verify performance
- Files with different line counts
- Files with only additions or only deletions
- Binary file handling (graceful error)
- Unicode and special characters
- Very long single lines

**Edge cases:**
- Empty files
- Files with only whitespace differences
- Identical files
- Files with 50,000+ lines (warning should show)
- Files > 5MB (should reject)

## Validation Philosophy

**Permissive validation:**

- Accept any text content
- Do NOT reject based on file type
- Only reject:
  - Binary files (detect and show warning)
  - Files exceeding size limits (5MB)

### Module Validation System

The application includes a comprehensive module validation system (`src/module-validator.js`) that ensures modules are syntactically correct and browser-compatible.

**Key Features:**
- **Browser Compatibility Detection**: Checks for ES modules, dynamic imports
- **Syntax Validation**: Validates import/export statements, detects CommonJS patterns
- **Import Path Validation**: Validates CDN URLs, relative paths, and local file paths
- **Cache Management**: Automatic cache busting for development
- **Graceful Degradation**: Provides fallback strategies when features aren't supported

**When to Use Module Validation:**

- **Module loading**: Validate modules before use
- **During development**: Use cache busting to avoid stale module issues
- **Error handling**: Use `createEnhancedErrorMessage()` for user-friendly error messages
- **Browser compatibility**: Check `getBrowserCompatibility()` before using advanced features

**Validation Guidelines:**

1. **Validate module syntax** before using:
   ```javascript
   const validation = validateModuleSyntax(moduleCode);
   if (!validation.isValid) {
     console.error('Module validation failed:', validation.errors);
     return;
   }
   ```

2. **Handle degradation gracefully** when features aren't supported:
   ```javascript
   const strategy = getGracefulDegradationStrategy({ isWorker: false });
   if (!strategy.canProceed) {
     showErrorMessage(strategy.message);
     return;
   }
   ```

3. **Use cache busting** during development to avoid stale modules:
   ```javascript
   const moduleUrl = addCacheBusting(originalUrl, Date.now());
   ```

4. **Test in both browsers and Node.js** - the validation system works in both environments with appropriate fallbacks.

**Common Validation Issues:**

- **file:// URLs**: ES modules require HTTP(S) protocol
- **CORS errors**: All modules must be served from same origin or with proper CORS headers
- **MIME type errors**: Server must serve .js files with correct MIME type
- **Browser compatibility**: Older browsers may not support ES modules

**Testing Module Validation:**

- Unit tests: `npm test` includes comprehensive validation tests
- Browser testing: Load `test-browser-validation.js` in browser and run `window.testModuleValidation()`
- Standalone testing: Run `node test-module-validator.js` for Node.js validation tests

## Enhanced Algorithms Guidelines

### Multi-Tiered Similarity Detection

The application now uses a 4-tier similarity approach for optimal performance and accuracy:

**Tier 0: Content Hash Cache**
- Use `getLineHash()` for O(1) duplicate detection
- Cache automatically managed with `clearContentHashCache()`
- Hit rates: 99%+ for duplicate-heavy content

**Tier 1: Signature-Based Prefiltering**  
- Use `generateLineSignature()` for 32-bit SimHash-like signatures
- Fast Hamming distance with `signatureHammingDistance()`
- Threshold: 30% minimum before expensive comparison

**Tier 2: Enhanced Similarity**
- `calculateSimilarityEnhanced()` combines token + word similarity
- Token-based comparison via `compareLines()` from tokenizer.js
- Weighted: Token (70%) + Word (30%)

**Tier 3: AST-Aware Comparison**
- `calculateSimilarityFull()` includes AST similarity when available
- Tree-sitter integration for semantic understanding
- Language-specific structural comparison

### Block Move Detection

**Algorithm: LSH-based with Sliding Windows**
- `detectBlockMovesFast()` handles cross-block moves
- Sliding window for 3-10 line block detection
- Configurable via `CONFIG.LSH_BANDS` and `CONFIG.MOVE_THRESHOLD`

**Performance Considerations:**
- Enable only for files < 50,000 lines (`CONFIG.MAX_LINES_FOR_MOVE_DETECTION`)
- Minimum 10 changes required (`CONFIG.MIN_LINES_FOR_MOVE_DETECTION`)
- Block detection disabled for very large files to maintain performance

### Slider Correction

**Automatic Alignment Fixing**
- `detectSliders()` identifies A→B, C→D patterns where A≈D and B≈C
- `correctSliders()` swaps alignment for more natural diffs
- Toggle via UI checkbox (`correct-sliders`)

**Usage Guidelines:**
1. Enable by default for better user experience
2. Show correction count in UI (`updateSliderStats()`)
3. Provide option to disable if correction is unwanted

### Nested Diffs and Hierarchical Highlighting

**Three-Level Highlighting System:**
- **Line level**: `inline-added-line`/`inline-removed-line` (lightest)
- **Word level**: `inline-added-word`/`inline-removed-word` (medium) 
- **Char level**: `inline-added-char`/`inline-removed-char` (darkest)

**Special Region Handling:**
- `detectRegions()` identifies comments, strings, code
- `computeNestedDiffs()` processes regions separately
- Nested classes: `.nested` for comment/string diffs

### Configuration Management

**Advanced Settings Panel:**
- `max-lines`: Performance limit (1,000-200,000)
- `max-graph-vertices`: Memory limit (1,000-1,000,000)  
- `enable-ast`: Tree-sitter parsing toggle
- `normalize-delimiters`: Whitespace normalization in delimiters
- `correct-sliders`: Automatic alignment correction

**Best Practices:**
1. Validate all user inputs against min/max ranges
2. Store settings in localStorage with key `textDiffTool_config`
3. Apply settings immediately when changed
4. Reset to `DEFAULT_CONFIG` when requested

### Performance Optimization

**When Testing Performance:**
1. Use `CONFIG.ENABLE_FAST_MODE` for automatic degradation
2. Monitor cache stats with `getCacheStats()` 
3. Test with various file sizes (100, 1k, 10k, 50k lines)
4. Verify UI responsiveness during processing

**Memory Management:**
1. Call `clearContentHashCache()` after each diff operation
2. Use optimized algorithms for heavy computation to avoid UI blocking
3. Implement streaming for very large files if needed

### Error Handling

**Enhanced Error Messages:**
- Use `createEnhancedErrorMessage()` for detailed user feedback
- Include validation results, browser compatibility, and context
- Provide actionable guidance for common issues

**Graceful Degradation:**
- Check `getGracefulDegradationStrategy()` when features fail
- Always provide core functionality even with reduced features

## Common Mistakes to Avoid

1. **Using npm packages in the app**: All runtime deps must be CDN
2. **Not handling large files**: Always check file size before processing
3. **Missing error handling**: Binary files, encoding errors, file too large
4. **XSS vulnerabilities**: Use `textContent`, never `innerHTML` for user text
5. **Not sanitizing file names**: Clean displayed filenames
6. **Wrong button colors**: Follow the color palette defined in index.html CSS variables
7. **Missing ARIA labels**: Every interactive element needs context
8. **No keyboard navigation**: All features must work with keyboard
9. **Performance issues with large files**: Use chunking or other optimization strategies when needed

## When Adding Features

1. **Maintain CDN-only constraint** - no npm packages for runtime
2. **Add JSDoc comments** to new functions
3. **Update documentation** if changing features or architecture (README.md, ARCHITECTURE.md)
4. **Test thoroughly** - manual testing is essential

## Performance Considerations

- **10,000 lines should process in < 1 second** (test with E2E)
- Optimized diff algorithms handle large files efficiently while maintaining UI responsiveness
- Progress modal displayed during calculation (minimum 1 second, extends while processing)
- Warn users at 50,000+ lines
- Reject files at 5MB
- DOM rendering is synchronous and complete - no virtual scrolling

## Summary Checklist for Changes

- [ ] Read ARCHITECTURE.md for technical context
- [ ] Added JSDoc comments to new/modified functions
- [ ] Tested manually in browser
- [ ] Run unit tests: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] No npm packages added to app (CDN only)
- [ ] Updated documentation (if API/architecture changed)
- [ ] Checked accessibility requirements (if UI changed):
  - [ ] ARIA labels on all interactive elements
  - [ ] Form labels for all inputs
  - [ ] Keyboard navigation works
  - [ ] Focus indicators visible
  - [ ] Color contrast meets WCAG AA
- [ ] Mobile responsive design verified
- [ ] Performance tested with large files

---

## Testing Selectors Reference

### Overview

The application uses a standardized set of `data-testid` attributes for reliable element selection in tests. These attributes are stable and semantic, making tests more resilient to UI changes.

### Statistics Display

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|
| `diff-stats` | `[data-testid="diff-stats"]` | Container for all statistics |
| `stat-added` | `[data-testid="stat-added"]` | Added lines count value |
| `stat-removed` | `[data-testid="stat-removed"]` | Removed lines count value |
| `stat-modified` | `[data-testid="stat-modified"]` | Modified lines count value |
| `stat-moved` | `[data-testid="stat-moved"]` | Moved blocks count value |
| `stat-sliders` | `[data-testid="stat-sliders"]` | Slider corrections count |

### Navigation Controls

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|
| `navigation-section` | `[data-testid="navigation-section"]` | Navigation container |
| `prev-change-btn` | `[data-testid="prev-change-btn"]` | Previous change button |
| `next-change-btn` | `[data-testid="next-change-btn"]` | Next change button |
| `change-counter` | `[data-testid="change-counter"]` | Change counter display |

### Mode & View Toggles

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|
| `mode-btn-lines` | `[data-testid="mode-btn-lines"]` | Line-level highlighting toggle |
| `mode-btn-words` | `[data-testid="mode-btn-words"]` | Word-level highlighting toggle |
| `mode-btn-chars` | `[data-testid="mode-btn-chars"]` | Character-level highlighting toggle |
| `view-btn-split` | `[data-testid="view-btn-split"]` | Side-by-side view button |
| `view-btn-unified` | `[data-testid="view-btn-unified"]` | Unified view button |

### Input Areas

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|
| `previous-text` | `#previous-text` | Previous version textarea |
| `current-text` | `#current-text` | Current version textarea |

### Diff Results

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|
| `diff-container` | `[data-testid="diff-container"]` | Split view container |
| `previous-diff-panel` | `[data-testid="previous-diff-panel"]` | Previous panel container |
| `current-diff-panel` | `[data-testid="current-diff-panel"]` | Current panel container |
| `diff-row` | `[data-testid="diff-row"]` | Individual diff row |
| `unified-row` | `[data-testid="unified-row"]` | Individual unified row |

### Export Controls

| Test Selector | Actual Selector | Description |
|--------------|-----------------|-------------|

### Playwright Examples

```javascript
// Check statistics
await expect(page.locator('[data-testid="stat-added"]')).toHaveText('1');

// Navigate through changes
await page.click('[data-testid="next-change-btn"]');

// Switch views
await page.click('[data-testid="view-btn-unified"]');

// Count diff rows
const rowCount = await page.locator('[data-testid="diff-row"]').count();
```

### CSS Classes for Block Moves

- `.block-moved-from` - Source of block move (pure move, blue)
- `.block-moved-from-modified` - Source of modified block move (purple)
- `.block-moved-to` - Destination of block move (pure move, blue)
- `.block-moved-to-modified` - Destination of modified block move (purple)

### Symbols

- `<` - Block moved from (pure)
- `≤` - Block moved from (modified)
- `>` - Block moved to (pure)
- `≥` - Block moved to (modified)
