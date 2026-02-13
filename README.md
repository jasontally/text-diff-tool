# Text Diff Tool

A free, private text comparison tool for developers, network engineers, and writers. Compare code, config files, and any text content with semantic highlighting - 100% client-side, no signup required.

**Production URL**: [https://diff.jasontally.com](https://diff.jasontally.com) - Use it instantly, no install required  
**License**: MIT (Copyright (c) 2026 Jason Tally and contributors)  
**Version**: 0.2.0

---

## Documentation Quick Links

| **[Quick Start](#quick-start)** | **[How-To Guides](#how-to-guides)** | **[Reference](#reference)** | **[Explanation](#explanation)** |
|:---:|:---:|:---:|:---:|
| Learning | Doing | Information | Understanding |

---

## Quick Start

### Option 1: Use the Production Version (Fastest)

Just visit the production deployment at **[https://diff.jasontally.com](https://diff.jasontally.com)** and start comparing immediately. No installation or setup required.

### Option 2: Run Locally

Clone and serve locally if you want to customize or self-host:

```bash
# 1. Clone or download this repository
git clone https://github.com/jasontally/text-diff-tool.git
cd text-diff-tool

# 2. Serve locally (any static server works)
python3 -m http.server 8000
# Or: npx http-server -p 8000 -c-1 --cors

# 3. Open in browser
# http://localhost:8000/index.html
```

**Basic usage:**
1. Paste or drop text files into the left and right panels
2. Click **Compare** to see differences
3. Use **Next/Previous** buttons to navigate changes
4. Toggle between **Split** and **Unified** views

> **Note**: This tool requires HTTP(S) - it will not work from `file://` URLs due to ES module Web Worker restrictions.

---

## How-To Guides

### Deploy with Cloudflare Workers Assets

Deploy to Cloudflare's edge network in seconds:

```bash
npx wrangler deploy \
  --assets . \
  --compatibility-date 2026-02-11 \
  --name text-diff-tool
```

**Prerequisites:**
- Cloudflare account with Workers enabled
- `wrangler` CLI authenticated (`npx wrangler login`)

**No build step required** - deploy the source files directly.

### Deploy to Other Static Hosts

Any static hosting works (GitHub Pages, Netlify, Vercel, S3, etc.). The production deployment at [diff.jasontally.com](https://diff.jasontally.com) runs on Cloudflare Workers Assets.

Simply upload:

- `index.html` (main application)
- `src/` directory (JavaScript modules for Web Workers)

Ensure your server:
- Serves files over HTTPS
- Sets correct MIME type for `.js` files (`application/javascript`)
- Enables CORS headers for module loading

### Run Tests

```bash
# Install test dependencies (npm only used for testing)
npm install

# Unit tests (algorithms, parsers)
npm test

# E2E tests (browser features, performance)
npm run test:e2e
```

### Export and Share Results

- **Copy to clipboard**: Click the copy button to get unified diff format
- **Download .patch**: Export as standard patch file for version control
- **Print**: Use browser print for hard copies (print-friendly stylesheet included)

### Handle Large Files

For files approaching limits:
- Files >50,000 lines: Disable advanced features in settings
- Files >5MB: Consider comparing sections separately
- Enable "Fast Mode" in settings for large diffs

---

## Reference

### Supported File Types

**Network Configurations**: Cisco IOS/IOS-XE/NX-OS, Juniper JunOS, Arista EOS

**Programming**: JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, and more with syntax highlighting

**Structured Data**: JSON, YAML, XML, CSV, TOML

**Generic Text**: Plain text (.txt), logs, documentation

File type is auto-detected from content and extension.

### Browser Requirements

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 80+ | ES module workers supported |
| Firefox | 114+ | ES module workers supported |
| Safari | 15+ | ES module workers supported |
| Edge | 80+ | ES module workers supported |

Requires ES Module Web Workers. Will not work in IE11 or older browsers.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+↑` | Previous change |
| `Alt+↓` | Next change |
| `Ctrl+Enter` | Trigger comparison |
| `Escape` | Close modals |
| `Ctrl+L` | Toggle line highlighting |
| `Ctrl+W` | Toggle word highlighting |
| `Ctrl+C` | Toggle character highlighting |

### Performance Limits

| Metric | Limit |
|--------|-------|
| Max file size | 5MB per file (hard limit) |
| Max lines | 50,000 lines (warning at 50k) |
| Processing time | <1 second for 10,000 lines |
| Memory usage | ~50MB for 50,000 lines |

### Technical Stack

- **Frontend**: Vanilla HTML/CSS/JS (single file: `index.html`)
- **Diff Engine**: `diff` library via CDN (esm.sh)
- **Architecture**: ES Module Web Workers with modular source
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Accessibility**: WCAG 2.1 Level AA compliant

---

## Explanation

### Why Client-Side Only?

**Privacy**: Your text never leaves your browser. No server sees your code, configs, or documents.

**Security**: No external APIs, no tracking, no analytics. Just HTML, CSS, and JavaScript.

**Reliability**: Works offline after initial load. No service dependencies.

### Architecture Overview

**Single-file application**: All UI code in `index.html`, loaded via CDN (no build step).

**Modular algorithms**: Core diff logic extracted to `src/` modules for:
- Testability (same code runs in Node.js tests)
- Worker compatibility (Web Workers import from CDN + local modules)
- Maintainability (single source of truth)

**Worker pipeline**: Heavy computation runs in Web Worker to keep UI responsive:
1. Main thread: Get text → Show progress → Send to worker
2. Web Worker: Run diff → Calculate similarities → Detect moves
3. Main thread: Render results → Update UI

### Algorithm Concepts

**Multi-tiered similarity detection** for accurate code comparison:

1. **Content Hash Cache**: O(1) exact duplicate detection
2. **Signature Prefiltering**: SimHash-like signatures for fast fuzzy matching
3. **Token-Based Comparison**: Understands code structure (keywords, identifiers)
4. **AST-Aware Analysis**: Language-aware structural comparison (optional)

**Block move detection**: Identifies when code was moved (not just changed) using LSH (Locality-Sensitive Hashing) indexing for performance.

**Slider correction**: Automatically fixes ambiguous diff alignment boundaries that can create unnatural "slides" in the output.

### Design Decisions

**CDN-only dependencies**: All runtime libraries loaded from CDN (esm.sh, jsdelivr). No npm install for users. Testing uses npm only for dev dependencies.

**No build step**: `index.html` runs directly without compilation. This enables rapid deployment and easy auditing.

**Static site deployment**: Works on any static host (Cloudflare Workers, GitHub Pages, Netlify, S3, etc.). No server-side processing required.

---

## Troubleshooting

### Debug Mode

If you encounter issues with content disappearing or incorrect diff results, you can enable detailed debug logging:

**For Developers**:
1. Open browser DevTools console
2. Run: `localStorage.setItem('diffDebug', 'true')`
3. Reload the page
4. Check the console for detailed pipeline logging

**Running Tests with Debug Output**:
```bash
npm test -- tests/test-content-preservation.test.js
```

This will run tests that verify all input lines appear in the output.

**Common Issues**:
- **Lines missing**: Usually indicates a bug in the diff pipeline classification logic
- **Incorrect move detection**: Check if content has different surrounding context (comments/whitespace)
- **Performance issues**: Large files (>10k lines) may use fast mode with reduced accuracy

For detailed debugging information, see:
- `AGENTS.md` - Section on "Debugging the Diff Pipeline"
- `ARCHITECTURE.md` - Section on "Debugging and Diagnostics"

---

## Contributing

Contributions welcome! Please read the code conventions and testing guidelines in the source.

**Copyright (c) 2026 Jason Tally and contributors**  
**License**: MIT (see [LICENSE](./LICENSE))

Created by Jason Tally | [MIT License](./LICENSE) | Version 0.2.0
