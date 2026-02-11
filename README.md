# Text Diff Tool

A free, private text comparison tool for developers, network engineers, and writers. Compare code, config files, and any text content with semantic highlighting - 100% client-side, no signup required.

**Status**: Production Ready with Enhanced Algorithms  
**License**: MIT (Copyright (c) 2025 Jason Tally and contributors)  
**Version**: 0.1.3  
**URL**: [https://diff.jasontally.com](https://diff.jasontally.com)

## Overview

This tool handles three primary use cases:

1. **Network Engineering**: Compare device configurations (Cisco IOS, Juniper JunOS, Arista EOS, etc.)
2. **Software Development**: Compare code files, JSON configs, XML, YAML with syntax-aware diffing  
3. **Generic Text**: Compare any text content - documentation, prose, logs, or unstructured data

### Key Features

- **Side-by-side & unified diff visualization** with line-by-line comparison
- **Semantic highlighting** (additions in green, removals in red, modifications in yellow)
- **Client-side only** - text never leaves your browser
- **Multiple diff modes** - line, word, or character-level comparison
- **File type awareness** - smart parsing for configs, code, and structured data
- **Enhanced similarity detection** - Token-based, AST-aware, and structural comparison
- **Block move detection** - Identifies moved code blocks with visual indicators
- **Performance optimized** - Handles files up to 50,000 lines efficiently
- **Advanced configuration** - Adjustable thresholds, AST parsing, delimiter normalization
- **Slider correction** - Automatically fixes ambiguous diff alignment
- **Nested diffs** - Shows word/char changes inside comments and strings

## Features

### Core Diff Engine
- [x] Side-by-side text comparison
- [x] Unified diff view
- [x] Line number display in both panels
- [x] Add/remove/modify highlighting
- [x] Support for all text file types
- [x] Enhanced similarity detection algorithms
- [x] Token-based comparison for code
- [x] AST-aware semantic comparison
- [x] Content hashing and caching

### Advanced Capabilities
- [x] Block move detection (3-10 line sequences)
- [x] Cross-block modification detection
- [x] Hierarchical inline highlighting (char/word/line)
- [x] Delimiter normalization
- [x] Slider correction for ambiguous alignment
- [x] Nested diffs for comments/strings
- [x] Complexity-based performance scaling
- [x] Large file optimization (50k+ lines)

### User Experience
- [x] File drag-and-drop import
- [x] Next/previous change navigation
- [x] Ignore whitespace/comments toggle
- [x] Copy to clipboard
- [x] Export as .patch file
- [x] Print-friendly stylesheet
- [x] Keyboard shortcuts
- [x] Configuration panel with advanced settings
- [x] Mobile responsive design
- [x] Full accessibility support (WCAG 2.1 AA)

### Performance & Quality
- [x] Handles files up to 10MB
- [x] Processes 10,000+ lines in <1 second
- [x] Memory-efficient processing
- [x] Web Worker for non-blocking UI
- [x] Comprehensive error handling
- [x] Browser compatibility validation

## Supported File Types

**Network Configurations**: 
- Cisco IOS/IOS-XE/NX-OS
- Juniper JunOS 
- Arista EOS
- Generic network configs (auto-detected)

**Programming Languages**:
- JavaScript, TypeScript, Python, Java, C/C++, Go, Rust
- All major languages with syntax highlighting

**Structured Data**:
- JSON, YAML, XML, CSV, TOML
- Config files and documents

**Generic Text**: 
- Plain text, logs, documentation
- Any text-based format

### Enhanced Detection Features
- **Smart language detection** - Auto-identifies file type from content
- **Extension-based detection** - Fast path for known extensions  
- **Content-based detection** - Analyzes patterns for ambiguous files
- **Code structure awareness** - Understands comments, strings, keywords

**Generic Text**: Plain text (.txt), logs, documentation, and unstructured content

## Performance & Capabilities

### Benchmarks
- **Small files** (< 100 lines): <10ms processing time
- **Medium files** (1,000 lines): <50ms processing time  
- **Large files** (10,000 lines): <500ms processing time
- **Very large files** (50,000 lines): <2s processing time

### Advanced Algorithms
- **Multi-tiered similarity**: Content hash → Signature → Token/Word/AST comparison
- **Block move detection**: LSH-based similarity with sliding window for 3-10 line blocks
- **Cross-block modification**: Detects moved lines that also changed content
- **Slider correction**: Automatic alignment fixing for ambiguous diff boundaries
- **Complexity protection**: Automatic fallback to fast mode for large files

### Memory Efficiency
- **Content hashing**: O(1) duplicate detection with cached line hashes
- **Streaming processing**: Processes files in chunks to limit memory usage
- **Worker isolation**: Heavy computation runs in separate thread to keep UI responsive
- **Cache management**: Automatic cleanup to prevent memory leaks

## Technical Stack

- **Frontend**: Vanilla HTML/CSS/JS (single file architecture)
- **Diff Engine**: `diff` library from esm.sh with jsdelivr fallback
- **State Management**: URL hash with CompressionStream (optional feature)
- **Testing**: Vitest + Playwright
- **Accessibility**: WCAG 2.1 Level AA compliance

## Browser Support

Requires browsers that support ES Module Web Workers (type="module"):

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 80+ | ES module workers supported |
| Firefox | 114+ | ES module workers supported |
| Safari | 15+ | ES module workers supported |
| Edge | 80+ | ES module workers supported |

## Usage

1. Serve the app via HTTP(S) (required for ES module Web Workers)
2. Open `http://localhost:8000/index.html` (or your server URL)
3. Paste or drop text files into left/right panels
4. Click "Compare" to see differences
5. Navigate changes with next/previous buttons
6. Share via URL or export as needed

**Note**: The app will NOT work from `file://` URLs due to CORS restrictions on ES module Web Workers.

## File Size Limits

- Maximum file size: 5MB per file
- Maximum lines: 50,000 lines
- Maximum URL state: 50KB compressed (if URL sharing implemented)

## Development

### Running Tests

This project uses npm only for testing. The app itself has no dependencies and runs directly in the browser.

**Install testing dependencies:**
```bash
npm install
```

**Run unit tests:**
```bash
npm test
```

**Run E2E tests:**
```bash
npm run test:e2e
```

**Run E2E tests in headed mode (for debugging):**
```bash
npm run test:e2e -- --headed
```

**Run specific E2E test file:**
```bash
npm run test:e2e -- tests/e2e/performance.spec.js
```

### Test Structure

- **Unit Tests** (`tests/*.test.js`): Test pure functions, diff algorithms, parsers
- **E2E Tests** (`tests/e2e/*.spec.js`): Test browser features, UI interactions, performance
-   - `compare.spec.js` - Core comparison flow
-   - `export.spec.js` - Export functionality
-   - `accessibility.spec.js` - Accessibility compliance
-   - `performance.spec.js` - Large file handling (10k lines must process in <1s)

### Architecture Notes

- **CDN-Only**: The app loads all runtime libraries via CDN (esm.sh, jsdelivr)
- **No Build Step**: `index.html` runs directly without compilation
- **Single File**: All HTML, CSS, and JavaScript in one file
- **ES Module Workers**: Uses Blob URLs to create workers that import from CDN
- **HTTP(S) Required**: Must be served over HTTP(S), not file://
- **Client-Side Only**: No server components, text never leaves the browser

### Performance Requirements

- 10,000 line files must process in under 1 second
- Performance is tested via E2E test in `tests/e2e/performance.spec.js`

## Deployment

### Prerequisites

- **Static hosting**: The application is a single-page application that works entirely in the browser
- **HTTP(S) required**: Must be served via HTTP or HTTPS, not `file://` protocols
- **No build step**: Direct deployment of source files
- **CDN dependencies**: All external dependencies loaded from CDNs

### Files to Deploy

**Core Application:**
- `index.html` - Main application (HTML, CSS, JavaScript)
- `src/` directory - JavaScript modules (required for worker functionality)

**Optional Files:**
- `README.md` - User documentation
- `ARCHITECTURE.md` - Architecture documentation
- `AGENTS.md` - LLM working instructions

### Web Server Configuration

#### Apache HTTP Server
```apache
# Enable CORS for module loading
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type"

# Set correct MIME types
<Files "*.js">
    ForceType application/javascript
</Files>

# Enable compression
<Location "/">
    SetOutputFilter DEFLATE
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</Location>
```

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/diff;
    index index.html;

    # Enable CORS
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Content-Type';

    # Correct MIME types
    location ~* \.js$ {
        add_header Content-Type application/javascript;
    }

    # Enable compression
    gzip on;
    gzip_types text/html text/css application/javascript;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
}
```

#### Simple HTTP Server (for testing)
```bash
# Python 3
python3 -m http.server 8000

# Node.js (recommended for production)
npx http-server -p 8000 -c-1 --cors
```

### Security Considerations

- **100% client-side**: No data sent to external servers
- **Text processing happens entirely in browser**
- **No analytics or tracking included**
- **Use HTTPS in production** for enhanced security

### Deployment Checklist

- [ ] All files deployed to web server
- [ ] Correct MIME types configured (.js files)
- [ ] CORS headers enabled (for module loading)
- [ ] HTTPS configured (recommended)
- [ ] Compression enabled (recommended)
- [ ] Application loads without JavaScript errors
- [ ] Basic diff functionality works
- [ ] Large file handling tested (> 10,000 lines)
- [ ] Mobile responsiveness verified

## Advanced Features Guide

### Intelligent Similarity Detection

The diff engine uses a multi-tiered approach to understand code similarity:

1. **Content Hash Cache** - Instant duplicate detection
2. **Signature Prefiltering** - Fast fuzzy matching using character patterns
3. **Token-Based Comparison** - Understands code structure (keywords, identifiers, operators)
4. **AST Semantic Analysis** - Language-aware structural comparison

### Block Move Detection

Automatically identifies moved code blocks with visual indicators:

**What it detects:**
- Function blocks moved to different locations
- Configuration sections reordered in files
- Code sequences that changed position but stayed similar

**Visual indicators:**
- Blue highlighting for moved blocks
- Arrow indicators showing movement direction
- Tooltips with block move information

### Slider Correction

Automatically fixes ambiguous diff alignment that can create unnatural "slides":

**Problem solved:**
- When diff algorithms misalign boundaries
- Creating artificial insert/delete patterns
- Making simple moves look complex

**Automatic correction:**
- Detects A→B, C→D patterns where A≈D and B≈C
- Swaps to more natural A→C, B→D alignment
- Shows count of corrections applied

### Hierarchical Highlighting

Three levels of inline diff for better change visibility:

1. **Character Level** (darkest) - Individual character changes
2. **Word Level** (medium) - Word/token changes
3. **Line Level** (lightest) - Whole line changes

### Delimiter Normalization

Smart whitespace handling inside code delimiters:

**What it normalizes:**
- Spaces inside parentheses: `( arg1, arg2 )` → `(arg1,arg2)`
- Brackets and braces: `[ item1, item2 ]` → `[item1,item2]`
- Maintains code structure while improving comparison accuracy

### Keyboard Shortcuts

- **Alt+↑**: Go to previous change
- **Alt+↓**: Go to next change
- **Ctrl+Enter**: Trigger comparison
- **Escape**: Close modals/dialogs
- **Ctrl+L**: Toggle line highlighting
- **Ctrl+W**: Toggle word highlighting
- **Ctrl+C**: Toggle character highlighting

### Export Options

**Unified Patch Format:**
```
--- original.txt
+++ modified.txt
@@ -1,5 +1,5 @@
 function oldFunc() {
+function newFunc() {
    return calculate();
+}
```

**Clipboard Copy:**
- Copies unified diff to clipboard
- Preserves formatting and syntax highlighting
- Includes line numbers for reference

### Performance Tips

**Optimize for Speed:**
1. Use appropriate settings for your file size
2. Disable AST for very large files (>50,000 lines)
3. Use line highlighting for quick scans
4. Enable word/character for detailed reviews

**Memory Efficiency:**
- The tool automatically manages memory
- Large files are processed in chunks
- Web Workers prevent UI blocking

---

Created by Jason Tally | [MIT License](./LICENSE) | Version 0.1.0