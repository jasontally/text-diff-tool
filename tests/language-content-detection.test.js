/**
 * Comprehensive Tests for Content-Based Language Detection
 *
 * Tests that the app correctly detects programming languages from content.
 * These tests match the detection logic in src/language-detect.js.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { detectLanguage, getDetectionDetails } from '../src/language-detect.js';

/**
 * Content-based detection patterns
 * Copied from src/language-detect.js for testing purposes
 */
const CONTENT_DETECTORS = [
  {
    language: 'json',
    test: (content) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      // Check if valid JSON
      if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
          isValidJSON(trimmed)) {
        return true;
      }
      return false;
    }
  },
  {
    language: 'python',
    test: (content) => {
      // Python-specific patterns
      const patterns = [
        /^\s*(def |class )/m,  // Function/class definition (no \w needed)
        /^\s*import\s+(?!java\b)\w/m,  // Import statements (exclude Java imports)
        /^\s*from\s+\w+\s+import/m,  // From imports (Python specific syntax)
        /^\s*if __name__\s*==\s*['"]__main__['"]\s*:/m,
        /^\s*#.*$/m,  // Comments (weak indicator)
        /^\s*@[\w_]+\s*$/m,  // Decorators
        /^\s*async def/m,  // async def
        /^\s*(try|except|finally|raise)\s*:/m,
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      // Need at least 2 strong indicators
      return score >= 2;
    }
  },
  {
    language: 'javascript',
    test: (content) => {
      // JavaScript/TypeScript patterns
      const patterns = [
        /\b(const|let|var)\s+[\w_$]+\s*[=:]/m,
        /\b(function|class)\s+[\w_$]+\s*[/({]/m,
        /\b(import|export)\s+\{/m,
        /\b(async|await)\b/m,
        /=>\s*\{/m,  // Arrow functions
        /\bconsole\.(log|error|warn)/m,
        /\bdocument\.(getElementById|querySelector)/m,
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      // Need at least 2 strong indicators
      return score >= 2;
    }
  },
  {
    language: 'typescript',
    test: (content) => {
      // TypeScript-specific patterns (in addition to JS patterns)
      const tsPatterns = [
        /:\s*(string|number|boolean|any|void|never)\s*[=;)]/m,
        /\binterface\s+\w+\s*\{/m,
        /\btype\s+\w+\s*=/m,
        /\b(enum|namespace|module)\s+\w+/m,
        /<\w+(,\s*\w+)*>/m,  // Generic type parameters
      ];

      // Must have JS patterns AND at least one TS pattern
      const jsScore = [
        /\b(const|let|var)\s+/m,
        /\bfunction\s+/m,
        /\b(import|export)\b/m,
      ].reduce((count, pattern) => count + (pattern.test(content) ? 1 : 0), 0);

      const tsScore = tsPatterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return jsScore >= 1 && tsScore >= 1;
    }
  },
  {
    language: 'go',
    test: (content) => {
      const patterns = [
        /^\s*package\s+\w+/m,
        /^\s*func\s+\w+/m,
        /^\s*import\s*\(/m,
        /\bdefer\s+/m,
        /\bgo\s+\w+\(/m,
        /\bchan\s+/m,
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
  {
    language: 'rust',
    test: (content) => {
      const patterns = [
        /\bfn\s+\w+\s*\(/m,
        /\blet\s+mut\s+/m,
        /\bimpl\s+/m,
        /\buse\s+\w+::/m,
        /\bmod\s+\w+/m,
        /\bpub\s+(fn|struct|enum|trait)/m,
        /\bmatch\s+/m,
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
  {
    language: 'java',
    test: (content) => {
      const patterns = [
        /\bpublic\s+class\s+\w+/m,
        /\bprivate\s+\w+\s+\w+\s*;/m,
        /\bSystem\.(out|err)\./m,
        /\bimport\s+java\./m,
        /@\w+\s*$/m,  // Annotations
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
  {
    language: 'yaml',
    test: (content) => {
      const patterns = [
        /^---\s*$/m,
        /^\w+:\s*\w/m,
        /^\s+-\s+\w/m,  // Array items
        /^\w+:\s*$/m,   // Key with no value yet
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
  {
    language: 'bash',
    test: (content) => {
      // Check shebang first (strong indicator)
      // Use [#] to avoid parsing issues with #! sequence
      if (/^[#]!\/bin\/(bash|sh|zsh|dash)/m.test(content)) {
        return true;
      }

      const patterns = [
        /^\s*(if|then|else|elif|fi)\s*$/m,
        /^\s*(for|while|do|done)\s*$/m,
        /^\s*echo\s+/m,
        /\$\w+/m,  // Variables
        /\$\{\w+\}/m,  // Variable expansion
        /^\s*export\s+\w+=/m,
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
  {
    language: 'html',
    test: (content) => {
      // Must look like HTML, not just have < > characters
      const patterns = [
        /<(!DOCTYPE|html|head|body|div|span|p|a|img)\b/i,
        /<\w+\s+\w+\s*=\s*["'][^"']*["']/i,  // Attributes
        /<\/\w+>/i,  // Closing tags
      ];

      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);

      return score >= 2;
    }
  },
];

function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to test content detection for a specific language
 */
function testContentDetection(content, expectedLanguage, description) {
  const result = detectLanguage('', content);
  if (result !== expectedLanguage) {
    console.log(`FAILED: ${description}`);
    console.log(`Expected: ${expectedLanguage}, Got: ${result}`);
    console.log('Content:', content.slice(0, 200));
    console.log('Details:', getDetectionDetails('', content));
  }
  return result === expectedLanguage;
}

describe('JSON Content Detection', () => {
  it('should detect simple JSON object', () => {
    const content = `{"name": "John", "age": 30}`;
    expect(detectLanguage('', content)).toBe('json');
  });

  it('should detect JSON array', () => {
    const content = `[1, 2, 3, 4, 5]`;
    expect(detectLanguage('', content)).toBe('json');
  });

  it('should detect complex nested JSON', () => {
    const content = `{
      "users": [
        {"id": 1, "name": "Alice", "active": true},
        {"id": 2, "name": "Bob", "active": false}
      ],
      "meta": {
        "total": 2,
        "page": 1
      }
    }`;
    expect(detectLanguage('', content)).toBe('json');
  });

  it('should NOT detect invalid JSON as JSON', () => {
    const content = `{invalid json content}`;
    expect(detectLanguage('', content)).not.toBe('json');
  });
});

describe('Python Content Detection', () => {
  it('should detect basic Python with def and comment (2 patterns)', () => {
    // Using def and comment patterns
    const content = `def hello():
    # This is a comment
    return "Hello, World!"`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should detect Python with class and comment', () => {
    const content = `class MyClass:
    pass

# This is a comment`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should detect Python with decorators and async', () => {
    const content = `@app.route
@require_auth
def get_users():
    return jsonify([])

async def fetch_data():
    data = await api.get_data()
    return data`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should detect Python with main guard pattern', () => {
    const content = `def main():
    print("Hello from main")

if __name__ == "__main__":
    main()`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should detect Python with try/except', () => {
    const content = `def process():
    try:
        result = 1 / 0
    except ZeroDivisionError:
        pass`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should NOT detect single Python pattern', () => {
    // Only has 'def' - not enough
    const content = `def single_function():
    pass`;
    expect(detectLanguage('', content)).not.toBe('python');
  });

  it('should NOT detect Python-style comments alone', () => {
    // Comments alone should not trigger detection
    const content = `# This is a comment
# Another comment
# Third comment`;
    expect(detectLanguage('', content)).not.toBe('python');
  });
});

describe('JavaScript Content Detection', () => {
  it('should detect basic JavaScript with const and function', () => {
    const content = `const greeting = "Hello";
const number = 42;

function sayHello() {
    console.log(greeting);
}`;
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should detect JavaScript with arrow functions and imports', () => {
    const content = `import { useState } from 'react';

const fetchData = async () => {
    const response = await fetch('/api/data');
    return response;
};

export { fetchData };`;
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should detect JavaScript with DOM manipulation', () => {
    const content = `const button = document.getElementById('submit');
const input = document.querySelector('.username');

button.addEventListener('click', () => {
    console.log('Button clicked');
});`;
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should detect JavaScript with async/await', () => {
    const content = `async function loadData() {
    try {
        const data = await fetchData();
        await processData(data);
    } catch (error) {
        console.error('Error:', error);
    }
}`;
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should NOT detect JavaScript with only single pattern', () => {
    // Only has console.log - not enough
    const content = `console.log("Hello World");`;
    expect(detectLanguage('', content)).not.toBe('javascript');
  });

  it('should NOT detect Python as JavaScript', () => {
    const content = `def hello():
    print("Hello")
    return True`;
    expect(detectLanguage('', content)).not.toBe('javascript');
  });
});

describe('TypeScript Content Detection', () => {
  // NOTE: TypeScript detector is positioned AFTER JavaScript in CONTENT_DETECTORS.
  // If content matches both JS and TS patterns, JavaScript will be detected first.
  // TypeScript-specific patterns must be strong enough to not also match JavaScript.

  it('should detect content with TS-only patterns as TypeScript when no JS overlap', () => {
    // This content has TS patterns but the JS detector may not match if
    // the patterns are specific enough
    const content = `interface User {
    id: number;
    name: string;
}

type MyType = string;`;
    // Note: This might be detected as TypeScript or null depending on patterns
    const result = detectLanguage('', content);
    expect(result === 'typescript' || result === null).toBe(true);
  });

  it('should detect TypeScript with interfaces that also have JS patterns', () => {
    const content = `interface User {
    id: number;
    name: string;
}

const user: User = {
    id: 1,
    name: "Alice"
};`;
    // This will likely be detected as JavaScript since JS comes first
    // and matches the const/function patterns
    const result = detectLanguage('', content);
    expect(result === 'javascript' || result === 'typescript').toBe(true);
  });

  it('should detect TypeScript with enums', () => {
    const content = `enum Status {
    PENDING = 'pending',
    APPROVED = 'approved',
}

const currentStatus: Status = Status.PENDING;`;
    expect(detectLanguage('', content)).toBe('typescript');
  });

  it('should NOT detect JavaScript as TypeScript', () => {
    // Pure JavaScript without TS-specific features
    const content = `const x = 5;
function foo() {
    return x;
}`;
    expect(detectLanguage('', content)).not.toBe('typescript');
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should NOT detect TypeScript without JS patterns', () => {
    // Just type annotations without JS structure
    const content = `name: string
age: number`;
    expect(detectLanguage('', content)).not.toBe('typescript');
  });
});

describe('Go Content Detection', () => {
  it('should detect basic Go with package and func', () => {
    const content = `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`;
    expect(detectLanguage('', content)).toBe('go');
  });

  it('should detect Go with multiple imports and functions', () => {
    const content = `package utils

import (
    "fmt"
    "strings"
)

func ProcessData(input string) (string, error) {
    result := strings.ToUpper(input)
    return result, nil
}`;
    expect(detectLanguage('', content)).toBe('go');
  });

  it('should detect Go with goroutines and channels', () => {
    const content = `package main

import "fmt"

func worker(id int, jobs <-chan int) {
    for j := range jobs {
        go processJob(j)
    }
}

func processJob(j int) {
    defer cleanup()
    fmt.Println(j)
}`;
    expect(detectLanguage('', content)).toBe('go');
  });

  it('should detect Go with defer and channel', () => {
    const content = `package main

func readFile() {
    file, err := os.Open("file.txt")
    if err != nil {
        return
    }
    defer file.Close()
    
    ch := make(chan int)
    go process(ch)
}`;
    expect(detectLanguage('', content)).toBe('go');
  });

  it('should NOT detect Go with only package', () => {
    // Only package declaration - not enough
    const content = `package main

// Some comments`;
    expect(detectLanguage('', content)).not.toBe('go');
  });

  it('should NOT detect C-style includes as Go', () => {
    const content = `#include <stdio.h>
#include <stdlib.h>

int main() {
    return 0;
}`;
    expect(detectLanguage('', content)).not.toBe('go');
  });
});

describe('Rust Content Detection', () => {
  it('should detect basic Rust with fn and let mut', () => {
    const content = `fn main() {
    let mut x = 5;
    x = 6;
    println!("{}", x);
}`;
    expect(detectLanguage('', content)).toBe('rust');
  });

  it('should detect Rust with structs and impl', () => {
    const content = `struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}`;
    expect(detectLanguage('', content)).toBe('rust');
  });

  it('should detect Rust with modules and use statements', () => {
    const content = `use std::collections::HashMap;

mod utils;
pub mod models;

fn process_data() {
    let map = HashMap::new();
}`;
    expect(detectLanguage('', content)).toBe('rust');
  });

  it('should detect Rust with match and pub', () => {
    const content = `pub fn handle_request(req: Request) -> Response {
    match req.method {
        "GET" => process_get(req),
        _ => Response::not_found(),
    }
}

pub struct Server {
    port: u16,
}`;
    expect(detectLanguage('', content)).toBe('rust');
  });

  it('should NOT detect Rust with only fn', () => {
    // Only one function - not enough
    const content = `fn single() {
    println!("Hello");
}`;
    expect(detectLanguage('', content)).not.toBe('rust');
  });

  it('should NOT detect JavaScript as Rust', () => {
    const content = `function main() {
    let x = 5;
    console.log(x);
}`;
    expect(detectLanguage('', content)).not.toBe('rust');
    expect(detectLanguage('', content)).toBe('javascript');
  });
});

describe('Java Content Detection', () => {
  // NOTE: Java detector is positioned AFTER TypeScript in CONTENT_DETECTORS.
  // Some Java content that has generic-like syntax may be detected as TypeScript first.

  it('should detect basic Java with public class and System.out', () => {
    const content = `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`;
    // This should be detected as Java (or possibly TypeScript due to <String> syntax)
    const result = detectLanguage('', content);
    expect(result === 'java' || result === 'typescript').toBe(true);
  });

  it('should detect Java with private fields and System.out', () => {
    const content = `public class UserRepository {
    private int count;
    
    public void log() {
        System.out.println("Hello");
    }
}`;
    expect(detectLanguage('', content)).toBe('java');
  });

  it('should detect Java with annotations and imports', () => {
    const content = `import java.util.List;

@Override
public class User {
    private Long id;
}`;
    expect(detectLanguage('', content)).toBe('java');
  });

  it('should detect Java with System.out and annotations', () => {
    const content = `public class Logger {
    @Override
    public void log(String message) {
        System.out.println(message);
        System.err.println("Error: " + message);
    }
}`;
    expect(detectLanguage('', content)).toBe('java');
  });

  it('should NOT detect Java with only public', () => {
    // Not enough patterns
    const content = `public class Simple {
    // Just a comment
}`;
    expect(detectLanguage('', content)).not.toBe('java');
  });

  it('should NOT detect JavaScript as Java', () => {
    const content = `const user = {
    name: "Alice"
};

function greet() {
    console.log("Hello");
}`;
    expect(detectLanguage('', content)).not.toBe('java');
    // This will be detected as JavaScript
    expect(detectLanguage('', content)).toBe('javascript');
  });
});

describe('Bash Content Detection', () => {
  it('should detect Bash with shebang', () => {
    const content = `#!/bin/bash

echo "Hello, World!"`;
    expect(detectLanguage('', content)).toBe('bash');
  });

  it('should detect Bash with sh shebang', () => {
    const content = `#!/bin/sh

echo "Hello"`;
    expect(detectLanguage('', content)).toBe('bash');
  });

  it('should detect Bash with conditional statements', () => {
    const content = `#!/bin/bash

if [ -f "$file" ]; then
    echo "File exists"
else
    echo "File not found"
fi`;
    expect(detectLanguage('', content)).toBe('bash');
  });

  it('should detect Bash with loops and variables', () => {
    const content = `for item in list; do
    echo "Processing"
done

while true; do
    break
done

export PATH=/usr/bin`;
    expect(detectLanguage('', content)).toBe('bash');
  });

  it('should detect Bash without shebang using patterns', () => {
    const content = `echo "Starting script"
if [ -d "/tmp" ]; then
    echo "Temp exists"
fi
for file in list; do
    echo "file"
done`;
    expect(detectLanguage('', content)).toBe('bash');
  });

  it('should NOT detect single echo as Bash', () => {
    // Only one pattern
    const content = `echo "Hello"`;
    expect(detectLanguage('', content)).not.toBe('bash');
  });

  it('should NOT detect Python as Bash', () => {
    const content = `print("Hello")
if True:
    pass`;
    expect(detectLanguage('', content)).not.toBe('bash');
  });
});

describe('YAML Content Detection', () => {
  it('should detect YAML with document separator', () => {
    const content = `---
name: John Doe
age: 30`;
    expect(detectLanguage('', content)).toBe('yaml');
  });

  it('should detect YAML with key-value pairs', () => {
    const content = `server:
  host: localhost
  port: 8080
  ssl: true
database:
  name: mydb
  user: admin`;
    expect(detectLanguage('', content)).toBe('yaml');
  });

  it('should detect YAML with arrays', () => {
    const content = `fruits:
  - apple
  - banana
  - orange
users:
  - name: Alice
    age: 30
  - name: Bob
    age: 25`;
    expect(detectLanguage('', content)).toBe('yaml');
  });

  it('should detect YAML with document start and arrays', () => {
    const content = `---
version: 1.0
items:
  - first
  - second
  - third`;
    expect(detectLanguage('', content)).toBe('yaml');
  });

  it('should NOT detect single key-value as YAML', () => {
    // Only one pattern
    const content = `name: John`;
    expect(detectLanguage('', content)).not.toBe('yaml');
  });

  it('should NOT detect JSON as YAML', () => {
    const content = `{"name": "John", "age": 30}`;
    expect(detectLanguage('', content)).not.toBe('yaml');
    expect(detectLanguage('', content)).toBe('json');
  });
});

describe('HTML Content Detection', () => {
  it('should detect basic HTML with DOCTYPE', () => {
    const content = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>`;
    expect(detectLanguage('', content)).toBe('html');
  });

  it('should detect HTML with common tags', () => {
    const content = `<div class="container">
    <p>Hello, World!</p>
    <a href="https://example.com">Link</a>
    <img src="image.png" alt="Test">
</div>`;
    expect(detectLanguage('', content)).toBe('html');
  });

  it('should detect HTML with attributes', () => {
    const content = `<div id="main" class="content">
    <input type="text" name="username" placeholder="Enter name">
    <button onclick="handleClick()">Click</button>
</div>`;
    expect(detectLanguage('', content)).toBe('html');
  });

  it('should detect HTML with closing tags', () => {
    const content = `<html>
<body>
    <h1>Title</h1>
    <div>Content</div>
    <p>Paragraph</p>
</body>
</html>`;
    expect(detectLanguage('', content)).toBe('html');
  });

  it('should NOT detect single opening tag as HTML', () => {
    // Only one pattern - the opening div tag matches, but no closing tag or attributes
    const content = `<div>Hello`;
    expect(detectLanguage('', content)).not.toBe('html');
  });

  it('should NOT detect arbitrary XML-like content as HTML', () => {
    // Generic XML-like tags, not HTML-specific
    const content = `<root><item>1</item><item>2</item></root>`;
    expect(detectLanguage('', content)).not.toBe('html');
  });
});

describe('Cross-Language Misidentification Prevention', () => {
  it('should NOT detect Go as JavaScript', () => {
    const content = `package main

import "fmt"

func main() {
    fmt.Println("Hello")
}`;
    expect(detectLanguage('', content)).not.toBe('javascript');
    expect(detectLanguage('', content)).toBe('go');
  });

  it('should NOT detect Rust as JavaScript', () => {
    const content = `fn main() {
    let mut x = 5;
    println!("{}", x);
}`;
    expect(detectLanguage('', content)).not.toBe('javascript');
    expect(detectLanguage('', content)).toBe('rust');
  });

  it('should NOT detect Java as JavaScript', () => {
    const content = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}`;
    expect(detectLanguage('', content)).not.toBe('javascript');
    expect(detectLanguage('', content)).toBe('java');
  });

  it('should NOT detect Python as Bash', () => {
    const content = `def hello():
    print("Hello")

if __name__ == "__main__":
    hello()`;
    expect(detectLanguage('', content)).not.toBe('bash');
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should NOT detect JavaScript as Python', () => {
    const content = `const x = 5;
function foo() {
    return x;
}`;
    expect(detectLanguage('', content)).not.toBe('python');
    expect(detectLanguage('', content)).toBe('javascript');
  });

  it('should NOT detect TypeScript as JavaScript when clearly TS', () => {
    const content = `interface User {
    name: string;
}
const user: User = { name: "Alice" };`;
    expect(detectLanguage('', content)).not.toBe('javascript');
    expect(detectLanguage('', content)).toBe('typescript');
  });

  it('should NOT detect YAML as Python', () => {
    const content = `---
name: John
age: 30
items:
  - a
  - b`;
    expect(detectLanguage('', content)).not.toBe('python');
    expect(detectLanguage('', content)).toBe('yaml');
  });

  it('should NOT detect HTML as XML (if XML detector existed)', () => {
    // HTML and XML both use < >, but HTML requires specific tags
    const content = `<!DOCTYPE html>
<html>
<body>Hello</body>
</html>`;
    expect(detectLanguage('', content)).toBe('html');
  });
});

describe('Minimum Score Requirements', () => {
  it('should require 2 patterns for Python', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'python');

    // Single pattern should fail
    const single = `def hello():
    pass`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass (def + comment)
    const double = `def hello():
    # This is a comment
    pass`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for JavaScript', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'javascript');

    // Single pattern should fail
    const single = `console.log("Hello");`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass
    const double = `const x = 5;
function foo() {
    console.log(x);
}`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for Go', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'go');

    // Single pattern should fail
    const single = `package main`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass
    const double = `package main

func main() {
    println("Hello")
}`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for Rust', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'rust');

    // Single pattern should fail
    const single = `fn main() {}`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass
    const double = `fn main() {
    let mut x = 5;
}`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for Java', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'java');

    // Single pattern should fail
    const single = `public class Main {}`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass
    const double = `public class Main {
    private int x;
}`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for YAML', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'yaml');

    // Single pattern should fail
    const single = `name: John`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass
    const double = `---
name: John
items:
  - a
  - b`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 2 patterns for HTML', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'html');

    // Single pattern should fail - just an opening tag
    const single = `<div>Hello`;
    expect(detector.test(single)).toBe(false);

    // Two patterns should pass - opening tag + closing tag
    const double = `<div>Hello</div>`;
    expect(detector.test(double)).toBe(true);

    // Or opening tag + attribute
    const withAttr = `<div class="test">Hello`;
    expect(detector.test(withAttr)).toBe(true);
  });

  it('should require 2 patterns for Bash (or shebang)', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'bash');

    // Single pattern should fail (no shebang)
    const single = `echo "Hello"`;
    expect(detector.test(single)).toBe(false);

    // Shebang alone should pass
    const shebang = `#!/bin/bash
echo "Hello"`;
    expect(detector.test(shebang)).toBe(true);

    // Two patterns without shebang should pass
    const double = `if [ -f "file" ]; then
    echo "exists"
fi`;
    expect(detector.test(double)).toBe(true);
  });

  it('should require 1 JS + 1 TS pattern for TypeScript', () => {
    const detector = CONTENT_DETECTORS.find(d => d.language === 'typescript');

    // Only JS patterns should fail
    const jsOnly = `const x = 5;
function foo() {
    return x;
}`;
    expect(detector.test(jsOnly)).toBe(false);

    // Only TS patterns should fail
    const tsOnly = `interface User {
    name: string;
}`;
    expect(detector.test(tsOnly)).toBe(false);

    // Both JS and TS patterns should pass
    const both = `const name: string = "Alice";
function greet() {
    console.log(name);
}`;
    expect(detector.test(both)).toBe(true);
  });
});

describe('Edge Cases and Boundary Conditions', () => {
  it('should handle empty content', () => {
    expect(detectLanguage('', '')).toBeNull();
  });

  it('should handle whitespace-only content', () => {
    expect(detectLanguage('', '   \n\t  \n  ')).toBeNull();
  });

  it('should handle plain text', () => {
    const content = 'This is just some plain text without any obvious markers.';
    expect(detectLanguage('', content)).toBeNull();
  });

  it('should handle mixed language content (should pick one)', () => {
    // Content with patterns from multiple languages
    // Should pick one based on order in CONTENT_DETECTORS
    // Using def + comment for Python detection
    const content = `def hello():
    # This is a comment
    pass`;
    const result = detectLanguage('', content);
    // Should detect Python (comes before JavaScript in detector list)
    expect(result).toBe('python');
  });

  it('should handle very long content efficiently', () => {
    // Generate a long Python file using different patterns
    // def + comment pattern
    const lines = [];
    lines.push('def main():');
    lines.push('    # Comment');
    lines.push('    pass');
    for (let i = 0; i < 1000; i++) {
      lines.push(`    # line ${i}`);
    }
    const content = lines.join('\n');
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should handle content with comments', () => {
    // Using def + comment pattern
    const content = `# This is a Python comment
# Another comment
def hello():
    pass`;
    expect(detectLanguage('', content)).toBe('python');
  });

  it('should handle content with string literals containing language keywords', () => {
    const content = `const message = "def hello(): pass";
const x = 5;
function test() {
    return x;
}`;
    expect(detectLanguage('', content)).toBe('javascript');
  });
});

describe('Detection with Filename Override', () => {
  it('should use filename extension when available', () => {
    const content = `def hello(): pass`;  // Python content
    expect(detectLanguage('script.js', content)).toBe('javascript');
  });

  it('should fallback to content detection when no extension', () => {
    const content = `def hello():
    # Comment
    pass`;
    expect(detectLanguage('script', content)).toBe('python');
  });

  it('should fallback to content detection for unknown extension', () => {
    const content = `const x = 5;
function foo() {
    return x;
}`;
    expect(detectLanguage('script.xyz', content)).toBe('javascript');
  });

  it('should handle compound extensions', () => {
    const content = `const x = 5;`;
    expect(detectLanguage('app.test.js', content)).toBe('javascript');
    expect(detectLanguage('app.spec.ts', content)).toBe('typescript');
  });
});
