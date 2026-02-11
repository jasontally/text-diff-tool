/**
 * Highlight Query Module
 * 
 * Provides Tree-sitter query definitions for syntax highlighting.
 * Maps Tree-sitter node types to CSS class names.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

/**
 * Highlight query definitions for each supported language
 * Maps Tree-sitter node types to highlight names (which map to CSS classes)
 */
const HIGHLIGHT_QUERIES = {
  javascript: `
    ; Keywords
    [
      "if" "else" "for" "while" "do" "switch" "case" "break" "continue" "return"
      "try" "catch" "finally" "throw" "new" "class" "extends"
      "function" "var" "let" "const" "import" "export" "from" "as" "default"
      "async" "await" "yield" "typeof" "instanceof" "in" "of" "void"
      "delete" "with" "debugger"
    ] @keyword
    
    ; Special keywords that are named nodes
    (this) @keyword
    (super) @keyword

    ; Identifiers
    (identifier) @identifier

    ; Properties and methods
    (property_identifier) @identifier
    (shorthand_property_identifier) @identifier

    ; Literals
    (string) @string
    (template_string) @string
    (regex) @string
    (number) @number
    (true) @keyword
    (false) @keyword
    (null) @keyword
    (undefined) @keyword

    ; Comments
    (comment) @comment

    ; Operators
    [
      "===" "!==" "==" "!=" "<=" ">=" "=>" "**" "++" "--"
      "&&" "||" "<<" ">>" "??" "..."
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator
    
    ; Optional chaining operator (parsed as named node)
    (optional_chain) @operator
    
    ; Spread element
    (spread_element) @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." ":"
    ] @delimiter
  `,

  typescript: `
    ; JavaScript keywords (inherited)
    [
      "if" "else" "for" "while" "do" "switch" "case" "break" "continue" "return"
      "try" "catch" "finally" "throw" "new" "class" "extends"
      "function" "var" "let" "const" "import" "export" "from" "as" "default"
      "async" "await" "yield" "typeof" "instanceof" "in" "of" "void"
      "delete" "with" "debugger"
    ] @keyword
    
    ; Special keywords that are named nodes
    (this) @keyword
    (super) @keyword

    ; TypeScript-specific keywords
    [
      "type" "interface" "enum" "namespace" "module" "declare"
      "public" "private" "protected" "readonly" "static" "abstract"
      "override" "implements" "keyof" "infer" "is" "as" "satisfies"
    ] @keyword

    ; Identifiers
    (identifier) @identifier
    (type_identifier) @identifier
    (property_identifier) @identifier
    (shorthand_property_identifier) @identifier

    ; Literals
    (string) @string
    (template_string) @string
    (regex) @string
    (number) @number
    (true) @keyword
    (false) @keyword
    (null) @keyword
    (undefined) @keyword

    ; Comments
    (comment) @comment

    ; Operators
    [
      "===" "!==" "==" "!=" "<=" ">=" "=>" "**" "++" "--"
      "&&" "||" "<<" ">>" "??" "..."
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator
    
    ; Optional chaining operator (parsed as named node)
    (optional_chain) @operator
    
    ; Spread element
    (spread_element) @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." ":"
    ] @delimiter
  `,

  python: `
    ; Keywords
    [
      "if" "elif" "else" "for" "while" "do" "break" "continue" "return"
      "try" "except" "finally" "raise" "with" "as" "def" "class"
      "import" "from" "lambda" "yield" "pass" "assert" "del" "global"
      "nonlocal" "async" "await" "and" "or" "not" "in" "is"
      "True" "False" "None"
    ] @keyword

    ; Identifiers
    (identifier) @identifier

    ; Literals
    (string) @string
    (integer) @number
    (float) @number
    (boolean) @keyword
    (none) @keyword

    ; Comments
    (comment) @comment

    ; Operators
    [
      "===" "!==" "==" "!=" "<=" ">=" "=>" "**" "++" "--"
      "&&" "||" "<<" ">>" "??" "..."
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator
    
    ; Optional chaining operator (parsed as named node)
    (optional_chain) @operator
    
    ; Spread operator (parsed as three dots)
    (spread_element) @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." ":"
    ] @delimiter
  `,

  json: `
    ; String keys and values
    (string (string_content) @string) @string
    (pair key: (string) @string) @string

    ; Numbers
    (number) @number

    ; Boolean and null
    [
      (true) (false) (null)
    ] @keyword

    ; Punctuation
    [ ":" "," "{" "}" "[" "]" ] @delimiter
  `,

  html: `
    ; Tag names
    (element (start_tag (tag_name) @keyword)) @keyword
    (element (end_tag (tag_name) @keyword)) @keyword
    (self_closing_element (tag_name) @keyword) @keyword

    ; Attribute names
    (attribute (attribute_name) @identifier) @identifier

    ; Attribute values
    (attribute (quoted_attribute_value) @string) @string

    ; Text content
    (text) @other

    ; Comments
    (comment) @comment

    ; Doctype
    (doctype) @keyword

    ; Punctuation
    [ "<" ">" "/" "=" ] @delimiter
  `,

  css: `
    ; Selectors
    (selector (tag_name) @keyword) @keyword
    (selector (class_name) @identifier) @identifier
    (selector (id_name) @identifier) @identifier
    (selector (pseudo_class_selector) @identifier) @identifier
    (selector (pseudo_element_selector) @identifier) @identifier

    ; Properties
    (property_name) @identifier

    ; Values
    (string_value) @string
    (color_value) @string
    (integer_value) @number
    (float_value) @number

    ; Important keywords
    (important) @keyword

    ; At-rules
    (at_keyword) @keyword

    ; Comments
    (comment) @comment

    ; Punctuation
    [ ":" ";" "{" "}" "," "(" ")" ] @delimiter
  `,

  go: `
    ; Keywords
    [
      "break" "case" "chan" "const" "continue" "default" "defer" "else"
      "fallthrough" "for" "func" "go" "goto" "if" "import" "interface"
      "map" "package" "range" "return" "select" "struct" "switch"
      "type" "var" "true" "false" "nil" "iota"
    ] @keyword

    ; Identifiers
    (identifier) @identifier
    (package_identifier) @identifier
    (type_identifier) @identifier
    (field_identifier) @identifier

    ; Literals
    (string) @string
    (raw_string) @string
    (rune_literal) @string
    (int_literal) @number
    (float_literal) @number
    (imaginary_literal) @number
    (true) @keyword
    (false) @keyword
    (nil) @keyword

    ; Comments
    (comment) @comment

    ; Operators
    [
      "===" "!==" "==" "!=" "<=" ">=" "=>" "**" "++" "--"
      "&&" "||" "<<" ">>" "??" "..."
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator
    
    ; Optional chaining operator (parsed as named node)
    (optional_chain) @operator
    
    ; Spread operator (parsed as three dots)
    (spread_element) @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." ":"
    ] @delimiter
  `,

  rust: `
    ; Keywords
    [
      "as" "break" "const" "continue" "crate" "else" "enum" "extern"
      "false" "fn" "for" "if" "impl" "in" "let" "loop" "match"
      "mod" "move" "mut" "pub" "ref" "return" "self" "Self"
      "static" "struct" "super" "trait" "true" "type" "unsafe"
      "use" "where" "while" "async" "await" "dyn"
    ] @keyword

    ; Identifiers
    (identifier) @identifier
    (type_identifier) @identifier
    (field_identifier) @identifier
    (lifetime) @identifier

    ; Literals
    (string_literal) @string
    (raw_string_literal) @string
    (char_literal) @string
    (integer_literal) @number
    (float_literal) @number
    (boolean_literal) @keyword

    ; Comments
    (comment) @comment

    ; Macros
    (macro_invocation (identifier) @identifier) @identifier

    ; Operators
    [
      "==" "!=" "<=" ">=" "&&" "||" ".." "..." "+=" "-="
      "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>="
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." ":" "::" "->" "&" "'"
    ] @delimiter
  `,

  java: `
    ; Keywords
    [
      "abstract" "assert" "boolean" "break" "byte" "case" "catch"
      "char" "class" "const" "continue" "default" "do" "double"
      "else" "enum" "extends" "final" "finally" "float" "for"
      "goto" "if" "implements" "import" "instanceof" "int"
      "interface" "long" "native" "new" "package" "private"
      "protected" "public" "return" "short" "static" "strictfp"
      "super" "switch" "synchronized" "this" "throw" "throws"
      "transient" "try" "void" "volatile" "while" "true" "false"
      "null"
    ] @keyword

    ; Identifiers
    (identifier) @identifier

    ; Literals
    (string_literal) @string
    (character_literal) @string
    (integer_literal) @number
    (floating_point_literal) @number
    (boolean_literal) @keyword
    (null_literal) @keyword

    ; Comments
    (comment) @comment

    ; Annotations
    (annotation name: (identifier) @identifier) @identifier

    ; Operators
    [
      "==" "!=" "<=" ">=" "&&" "||" "++" "--" "+=" "-="
      "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>=" ">>>" ">>>"
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." "::" "->"
    ] @delimiter
  `,

  c: `
    ; Keywords
    [
      "auto" "break" "case" "char" "const" "continue" "default" "do"
      "double" "else" "enum" "extern" "float" "for" "goto" "if"
      "int" "long" "register" "return" "short" "signed" "sizeof"
      "static" "struct" "switch" "typedef" "union" "unsigned"
      "void" "volatile" "while" "true" "false" "null"
    ] @keyword

    ; Identifiers
    (identifier) @identifier

    ; Literals
    (string_literal) @string
    (character_literal) @string
    (number_literal) @number
    (true) @keyword
    (false) @keyword

    ; Comments
    (comment) @comment

    ; Preprocessor directives
    (preproc_directive) @keyword
    (preproc_def) @keyword
    (preproc_function_def) @keyword
    (preproc_if) @keyword
    (preproc_ifdef) @keyword
    (preproc_include) @keyword

    ; Operators
    [
      "==" "!=" "<=" ">=" "&&" "||" "++" "--" "+=" "-="
      "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>="
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." "->" "##" "#"
    ] @delimiter
  `,

  cpp: `
    ; C keywords (inherited)
    [
      "auto" "break" "case" "char" "const" "continue" "default" "do"
      "double" "else" "enum" "extern" "float" "for" "goto" "if"
      "int" "long" "register" "return" "short" "signed" "sizeof"
      "static" "struct" "switch" "typedef" "union" "unsigned"
      "void" "volatile" "while" "true" "false" "null"
    ] @keyword

    ; C++-specific keywords
    [
      "alignas" "alignof" "and" "and_eq" "asm" "bitand" "bitor"
      "bool" "catch" "class" "compl" "concept" "const_cast" "constexpr"
      "decltype" "delete" "dynamic_cast" "explicit" "export" "friend"
      "inline" "mutable" "namespace" "new" "noexcept" "not"
      "not_eq" "nullptr" "operator" "or" "or_eq" "private"
      "protected" "public" "reinterpret_cast" "requires" "static_assert"
      "static_cast" "template" "this" "thread_local" "throw" "try"
      "typeid" "typename" "using" "virtual" "wchar_t" "xor" "xor_eq"
    ] @keyword

    ; Identifiers
    (identifier) @identifier
    (type_identifier) @identifier
    (field_identifier) @identifier
    (namespace_identifier) @identifier

    ; Literals
    (string_literal) @string
    (raw_string_literal) @string
    (character_literal) @string
    (number_literal) @number
    (boolean_literal) @keyword
    (null_literal) @keyword

    ; Comments
    (comment) @comment

    ; Preprocessor directives
    (preproc_directive) @keyword
    (preproc_def) @keyword
    (preproc_function_def) @keyword
    (preproc_if) @keyword
    (preproc_ifdef) @keyword
    (preproc_include) @keyword

    ; Operators
    [
      "==" "!=" "<=" ">=" "&&" "||" "++" "--" "+=" "-="
      "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>=" ">>>" ">>>"
      "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" "." "->" "::" "##" "#"
    ] @delimiter
  `,

  yaml: `
    ; Keys
    (block_mapping_pair (flow_node) @identifier) @identifier
    (flow_mapping_pair (flow_node) @identifier) @identifier
    
    ; Values
    (string) @string
    (block_scalar) @string
    (flow_scalar) @string
    
    ; Numbers
    (integer) @number
    (float) @number
    (boolean) @keyword
    (null) @keyword

    ; Comments
    (comment) @comment

    ; Anchors and aliases
    (anchor) @identifier
    (alias) @identifier

    ; Tags
    (tag) @keyword

    ; Punctuation
    [ ":" "-" "," "[" "]" "{" "}" "|" ">" ] @delimiter
  `,

  bash: String.raw`
    ; Keywords
    [
      "if" "then" "else" "elif" "fi" "for" "while" "do" "done"
      "case" "esac" "function" "return" "exit" "break" "continue"
      "declare" "local" "export" "readonly" "typeset" "unset"
      "echo" "printf" "read" "source" "exec" "eval" "test" "[["
      "select" "until" "time" "coproc" "in"
    ] @keyword

    ; Identifiers
    (variable_name) @identifier
    (word) @identifier

    ; Literals
    (string) @string
    (raw_string) @string
    (ansi_c_string) @string
    (number) @number

    ; Comments
    (comment) @comment

    ; Operators
    [
      "==" "!=" "<=" ">=" "&&" "||" "=+" "=-" "=*" "=/"
      "=%" "+=" "-=" "*=" "/=" "%=" "<<=" ">>=" "&=" "|="
      "^=" "+" "-" "*" "/" "%" "=" "<" ">" "!" "~" "&" "|" "^"
    ] @operator

    ; Punctuation
    [
      "(" ")" "[" "]" "{" "}" "," ";" ";;" ";" "|" "&" ">"
      "<" ">>" "<<" "2>" "2>>" "<&" ">&" "<<-" "<<<"
    ] @delimiter

    ; Special variables
    [
      "$?" "$!" "$$" "$#" "$*" "$@" "$0" "$1" "$2" "$3" "$4" "$5"
      "$6" "$7" "$8" "$9"
    ] @identifier
  `
};

/**
 * Create a highlight query for the specified language
 * @param {string} language - Language identifier
 * @returns {Promise<Object|null>} - Query object or null if not supported
 */
export async function createHighlightQuery(language) {
  const queryText = HIGHLIGHT_QUERIES[language];
  if (!queryText) {
    return null;
  }

  try {
    // Import tree-sitter loader
    const baseUrl = window.location.origin;
    const { getLanguageParser, getQueryClass } = await import(`${baseUrl}/src/tree-sitter-loader.js?v=12`);
    
    // Get the parser for this language
    const parser = await getLanguageParser(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    // Get the language object
    const languageObj = parser.language;
    if (!languageObj) {
      throw new Error(`No language object available for: ${language}`);
    }

    // Get the Query class
    const Query = getQueryClass();
    if (!Query) {
      throw new Error('Query class not available from web-tree-sitter');
    }

    // Create the query using new constructor API (web-tree-sitter 0.25+)
    const query = new Query(languageObj, queryText);
    
    return {
      query,
      language: languageObj,
      
      /**
       * Get all captures for a given syntax tree node
       * @param {Object} node - Tree-sitter node
       * @returns {Array} - Array of capture objects with {name, node}
       */
      captures(node) {
        const results = [];
        const matches = query.captures(node);
        
        for (const capture of matches) {
          results.push({
            name: capture.name,
            node: capture.node
          });
        }
        
        return results;
      }
    };
  } catch (error) {
    console.error(`[HighlightQuery] Failed to create query for ${language}:`, error);
    return null;
  }
}

/**
 * Check if a language is supported for highlighting
 * @param {string} language - Language identifier
 * @returns {boolean}
 */
export function isLanguageSupported(language) {
  return HIGHLIGHT_QUERIES.hasOwnProperty(language);
}

/**
 * Get list of supported languages
 * @returns {Array<string>}
 */
export function getSupportedLanguages() {
  return Object.keys(HIGHLIGHT_QUERIES);
}

export default {
  createHighlightQuery,
  isLanguageSupported,
  getSupportedLanguages
};