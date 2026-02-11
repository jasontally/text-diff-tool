/**
 * Slider Correction Module
 * 
 * Detects ambiguous diff positions (sliders) where diff alignment could be shifted
 * left or right to produce more natural or semantically correct differences.
 * 
 * Sliders occur when a diff algorithm must choose between multiple valid
 * alignments for changes, particularly around:
 * - Indentation changes
 * - Delimiter shifts (brackets, braces, parentheses)
 * - Line breaks that could be associated with adjacent lines
 * - Repeated patterns where context is ambiguous
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Configuration Constants
// ============================================================================

export const SLIDER_CONFIG = {
  // Threshold for considering a position as ambiguous (0.0-1.0)
  AMBIGUITY_THRESHOLD: 0.15,
  
  // Maximum number of sliders to detect per diff
  MAX_SLIDERS: 50,
  
  // Minimum confidence to mark a slider for correction
  CORRECTION_THRESHOLD: 0.7,
  
  // Performance limits
  MAX_CONTEXT_WINDOW: 5, // Lines to check on each side for scoring
  MAX_LINES_FOR_ANALYSIS: 10000, // Skip slider detection for huge diffs
  
  // Language-specific slider preferences
  LANGUAGE_PREFERENCES: {
    // C-style languages: prefer keeping braces with function signatures
    javascript: {
      braceWeight: 0.3,
      indentWeight: 0.2,
      commentWeight: 0.2,
      delimiterWeight: 0.3
    },
    typescript: {
      braceWeight: 0.3,
      indentWeight: 0.2,
      commentWeight: 0.2,
      delimiterWeight: 0.3
    },
    java: {
      braceWeight: 0.25,
      indentWeight: 0.25,
      commentWeight: 0.2,
      delimiterWeight: 0.3
    },
    c: {
      braceWeight: 0.25,
      indentWeight: 0.25,
      commentWeight: 0.2,
      delimiterWeight: 0.3
    },
    cpp: {
      braceWeight: 0.25,
      indentWeight: 0.25,
      commentWeight: 0.2,
      delimiterWeight: 0.3
    },
    python: {
      braceWeight: 0.0, // Python doesn't use braces
      indentWeight: 0.5, // Indentation is critical
      commentWeight: 0.3,
      delimiterWeight: 0.2
    },
    // Data formats: prefer preserving structure
    json: {
      braceWeight: 0.4,
      indentWeight: 0.3,
      commentWeight: 0.1,
      delimiterWeight: 0.2
    },
    yaml: {
      braceWeight: 0.0,
      indentWeight: 0.6, // Indentation defines structure
      commentWeight: 0.2,
      delimiterWeight: 0.2
    }
  }
};

// ============================================================================
// Main Slider Detection Function
// ============================================================================

/**
 * Detect ambiguous diff positions (sliders) that could be shifted
 * 
 * @param {Array} diffResults - Diff results from detectModifiedLines()
 * @param {Object} options - Configuration options
 * @param {string} options.language - Detected programming language
 * @param {number} options.maxSliders - Maximum sliders to detect
 * @param {number} options.ambiguityThreshold - Threshold for ambiguity detection
 * @returns {Array} Array of slider objects with scoring information
 */
export function detectSliders(diffResults, options = {}) {
  const startTime = performance.now();
  const sliders = [];
  
  // Skip slider detection for very large diffs (performance)
  const totalLines = diffResults.length;
  if (totalLines > SLIDER_CONFIG.MAX_LINES_FOR_ANALYSIS) {
    if (options.debug) {
      console.log(`[SliderCorrection] Skipping detection for large diff (${totalLines} lines)`);
    }
    return sliders;
  }
  
  // Merge options with defaults
  const config = {
    language: options.language || null,
    maxSliders: options.maxSliders || SLIDER_CONFIG.MAX_SLIDERS,
    ambiguityThreshold: options.ambiguityThreshold || SLIDER_CONFIG.AMBIGUITY_THRESHOLD,
    debug: options.debug || false
  };
  
  // Get language-specific preferences
  const langPrefs = getLanguagePreferences(config.language);
  
  // Scan for potential sliders
  for (let i = 0; i < diffResults.length && sliders.length < config.maxSliders; i++) {
    const change = diffResults[i];
    
    // Focus on modified changes - these are most likely to have ambiguous alignment
    if (change.classification === 'modified') {
      const sliderInfo = analyzeSliderPosition(diffResults, i, config, langPrefs);
      
      if (sliderInfo.isAmbiguous) {
        sliders.push({
          index: i,
          type: 'slider',
          ambiguity: sliderInfo.ambiguity,
          currentScore: sliderInfo.currentScore,
          leftScore: sliderInfo.leftScore,
          rightScore: sliderInfo.rightScore,
          alternatives: sliderInfo.alternatives,
          confidence: sliderInfo.confidence,
          recommendation: sliderInfo.recommendation,
          context: sliderInfo.context,
          language: config.language
        });
      }
    }
  }
  
  // Sort by confidence (descending) and ambiguity (descending)
  sliders.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) < 0.05) {
      return b.ambiguity - a.ambiguity;
    }
    return b.confidence - a.confidence;
  });
  
  if (config.debug) {
    const elapsed = performance.now() - startTime;
    console.log(`[SliderCorrection] Found ${sliders.length} sliders in ${elapsed.toFixed(2)}ms`);
  }
  
  return sliders;
}

// ============================================================================
// Slider Analysis Functions
// ============================================================================

/**
 * Analyze a specific position for slider potential
 * 
 * @param {Array} diffResults - Complete diff results
 * @param {number} index - Current index to analyze
 * @param {Object} config - Configuration options
 * @param {Object} langPrefs - Language-specific preferences
 * @returns {Object} Slider analysis information
 */
function analyzeSliderPosition(diffResults, index, config, langPrefs) {
  const context = extractContext(diffResults, index);
  const currentScore = calculateSliderScore(diffResults, index, 0, langPrefs);
  const leftScore = calculateSliderScore(diffResults, index, -1, langPrefs);
  const rightScore = calculateSliderScore(diffResults, index, 1, langPrefs);
  
  // Calculate ambiguity based on score differences
  const scoreDiff = Math.abs(currentScore - Math.max(leftScore, rightScore));
  const isAmbiguous = scoreDiff <= config.ambiguityThreshold;
  
  // Determine alternatives and recommendations
  const alternatives = [];
  let recommendation = 'keep';
  let confidence = 0;
  
  if (leftScore > currentScore && leftScore > rightScore) {
    alternatives.push({ direction: 'left', score: leftScore, improvement: leftScore - currentScore });
    if (leftScore - currentScore > 0.1) {
      recommendation = 'shift_left';
      confidence = Math.min((leftScore - currentScore) * 2, 1.0);
    }
  }
  
  if (rightScore > currentScore && rightScore > leftScore) {
    alternatives.push({ direction: 'right', score: rightScore, improvement: rightScore - currentScore });
    if (rightScore - currentScore > 0.1) {
      recommendation = 'shift_right';
      confidence = Math.min((rightScore - currentScore) * 2, 1.0);
    }
  }
  
  return {
    isAmbiguous,
    ambiguity: isAmbiguous ? (1.0 - scoreDiff / config.ambiguityThreshold) : 0,
    currentScore,
    leftScore,
    rightScore,
    alternatives,
    confidence,
    recommendation,
    context
  };
}

/**
 * Calculate how "natural" a diff position looks with an offset
 * 
 * @param {Array} diffResults - Complete diff results
 * @param {number} index - Center index to evaluate
 * @param {number} offset - Offset to apply (-1, 0, or 1)
 * @param {Object} langPrefs - Language-specific preferences
 * @returns {number} Score 0.0-1.0 indicating positioning quality
 */
function calculateSliderScore(diffResults, index, offset, langPrefs) {
  const shiftedIndex = index + offset;
  
  // Bounds check
  if (shiftedIndex < 0 || shiftedIndex >= diffResults.length) {
    return 0;
  }
  
  let score = 0.5; // Base score
  
  // Extract context around the shifted position
  const context = extractContext(diffResults, shiftedIndex);
  
  // Factor 1: Delimiter alignment (braces, brackets, etc.)
  score += scoreDelimiterAlignment(context, langPrefs) * langPrefs.delimiterWeight;
  
  // Factor 2: Indentation consistency
  score += scoreIndentationConsistency(context, langPrefs) * langPrefs.indentWeight;
  
  // Factor 3: Comment grouping
  score += scoreCommentGrouping(context, langPrefs) * langPrefs.commentWeight;
  
  // Factor 4: Brace placement (for C-style languages)
  score += scoreBracePlacement(context, langPrefs) * langPrefs.braceWeight;
  
  // Normalize to 0.0-1.0 range
  return Math.max(0, Math.min(1, score));
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score delimiter alignment quality
 * 
 * @param {Object} context - Context around the position
 * @param {Object} langPrefs - Language preferences
 * @returns {number} Score 0.0-1.0
 */
function scoreDelimiterAlignment(context, langPrefs) {
  let score = 0;
  let checks = 0;
  
  // Check opening/closing delimiter pairs
  const delimiters = ['()', '[]', '{}'];
  
  for (const [open, close] of delimiters) {
    const hasOpen = context.center.includes(open) || context.before.some(l => l.includes(open));
    const hasClose = context.center.includes(close) || context.after.some(l => l.includes(close));
    
    if (hasOpen || hasClose) {
      checks++;
      
      // Prefer positions that keep delimiters with their content
      if (hasOpen && hasClose) {
        // Both delimiters present - check if they're properly grouped
        score += 0.8; // Good alignment
      } else if (hasOpen !== hasClose) {
        // Unmatched delimiter - less ideal
        score += 0.3;
      }
    }
  }
  
  return checks > 0 ? score / checks : 0.5;
}

/**
 * Score indentation consistency
 * 
 * @param {Object} context - Context around the position
 * @param {Object} langPrefs - Language preferences
 * @returns {number} Score 0.0-1.0
 */
function scoreIndentationConsistency(context, langPrefs) {
  let score = 0;
  let checks = 0;
  
  // Get indentation levels
  const centerIndent = getIndentLevel(context.center);
  const beforeIndents = context.before.map(getIndentLevel);
  const afterIndents = context.after.map(getIndentLevel);
  
  // Check consistency with surrounding lines
  if (beforeIndents.length > 0) {
    const lastBefore = beforeIndents[beforeIndents.length - 1];
    score += centerIndent === lastBefore ? 0.9 : 0.4;
    checks++;
  }
  
  if (afterIndents.length > 0) {
    const firstAfter = afterIndents[0];
    score += centerIndent === firstAfter ? 0.9 : 0.4;
    checks++;
  }
  
  // Bonus for logical indentation patterns
  if (beforeIndents.length > 0 && afterIndents.length > 0) {
    const beforeAvg = beforeIndents.reduce((a, b) => a + b, 0) / beforeIndents.length;
    const afterAvg = afterIndents.reduce((a, b) => a + b, 0) / afterIndents.length;
    
    // Prefer consistent indentation patterns
    const patternConsistency = 1 - Math.abs(centerIndent - (beforeAvg + afterAvg) / 2);
    score += patternConsistency * 0.5;
    checks++;
  }
  
  return checks > 0 ? score / checks : 0.5;
}

/**
 * Score comment grouping quality
 * 
 * @param {Object} context - Context around the position
 * @param {Object} langPrefs - Language preferences
 * @returns {number} Score 0.0-1.0
 */
function scoreCommentGrouping(context, langPrefs) {
  let score = 0;
  let checks = 0;
  
  const isComment = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('#') || 
           trimmed.startsWith('/*') || trimmed.startsWith('*') ||
           trimmed.startsWith('<!--') || trimmed.startsWith('--');
  };
  
  const centerIsComment = isComment(context.center);
  const beforeComments = context.before.filter(isComment).length;
  const afterComments = context.after.filter(isComment).length;
  
  if (centerIsComment) {
    // Prefer keeping comments grouped together
    if (beforeComments > 0 || afterComments > 0) {
      score += 0.9; // Good comment grouping
    } else {
      score += 0.5; // Isolated comment
    }
    checks++;
  } else {
    // Non-comment line - check if it separates comment blocks
    if (beforeComments > 0 && afterComments > 0) {
      score += 0.2; // Not ideal - splits comments
    } else {
      score += 0.8; // Good separation
    }
    checks++;
  }
  
  return checks > 0 ? score / checks : 0.5;
}

/**
 * Score brace placement for C-style languages
 * 
 * @param {Object} context - Context around the position
 * @param {Object} langPrefs - Language preferences
 * @returns {number} Score 0.0-1.0
 */
function scoreBracePlacement(context, langPrefs) {
  if (langPrefs.braceWeight === 0) {
    return 0.5; // Not applicable for this language
  }
  
  let score = 0;
  let checks = 0;
  
  const hasOpenBrace = context.center.includes('{');
  const hasCloseBrace = context.center.includes('}');
  
  if (hasOpenBrace || hasCloseBrace) {
    checks++;
    
    // Check function/class signature alignment for opening braces
    if (hasOpenBrace) {
      const beforeLine = context.before.length > 0 ? context.before[context.before.length - 1] : '';
      
      // Prefer braces after function signatures, control structures
      const signaturePatterns = [
        /\b(function\s+\w+|class\s+\w+|if\s*\(|for\s*\(|while\s*\(|else\s*if)/,
        /\)\s*$/, // Function signature ending
      ];
      
      const hasSignature = signaturePatterns.some(pattern => pattern.test(beforeLine));
      score += hasSignature ? 0.9 : 0.4;
    }
    
    // Check closing brace alignment
    if (hasCloseBrace) {
      // Prefer closing braces to be aligned with opening structure
      score += 0.7;
    }
  }
  
  return checks > 0 ? score / checks : 0.5;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract context around a specific position
 * 
 * @param {Array} diffResults - Complete diff results
 * @param {number} index - Center index
 * @returns {Object} Context with before, center, after arrays
 */
function extractContext(diffResults, index) {
  const window = SLIDER_CONFIG.MAX_CONTEXT_WINDOW;
  
  const before = [];
  const after = [];
  let center = '';
  
  // Extract lines before
  for (let i = Math.max(0, index - window); i < index; i++) {
    const change = diffResults[i];
    const line = change.removedLine || change.addedLine || change.value || '';
    before.push(line.replace(/\n$/, '')); // Remove trailing newline
  }
  
  // Extract center line
  const centerChange = diffResults[index];
  center = centerChange.removedLine || centerChange.addedLine || centerChange.value || '';
  center = center.replace(/\n$/, '');
  
  // Extract lines after
  for (let i = index + 1; i <= Math.min(diffResults.length - 1, index + window); i++) {
    const change = diffResults[i];
    const line = change.removedLine || change.addedLine || change.value || '';
    after.push(line.replace(/\n$/, '')); // Remove trailing newline
  }
  
  return { before, center, after };
}

/**
 * Get indentation level of a line
 * 
 * @param {string} line - Line to analyze
 * @returns {number} Indentation level (number of leading spaces/tabs)
 */
function getIndentLevel(line) {
  const match = line.match(/^[\s]*/);
  if (!match) return 0;
  
  // Count tabs as 4 spaces for consistency
  const spaces = match[0].replace(/\t/g, '    ').length;
  return spaces;
}

/**
 * Get language-specific preferences for slider scoring
 * 
 * @param {string} language - Detected language
 * @returns {Object} Language preference weights
 */
function getLanguagePreferences(language) {
  return SLIDER_CONFIG.LANGUAGE_PREFERENCES[language] || {
    braceWeight: 0.25,
    indentWeight: 0.25,
    commentWeight: 0.25,
    delimiterWeight: 0.25
  };
}

// ============================================================================
// Slider Correction Functions
// ============================================================================

/**
 * Apply recommended slider corrections
 * 
 * @param {Array} diffResults - Original diff results
 * @param {Array} sliders - Detected sliders from detectSliders()
 * @param {Object} options - Correction options
 * @returns {Array} Modified diff results with corrections applied
 */
export function applySliderCorrections(diffResults, sliders, options = {}) {
  const correctedResults = [...diffResults];
  const threshold = options.correctionThreshold || SLIDER_CONFIG.CORRECTION_THRESHOLD;
  
  // Sort sliders by confidence (highest first)
  const sortedSliders = sliders
    .filter(slider => slider.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
  
  for (const slider of sortedSliders) {
    if (slider.recommendation === 'keep') {
      continue; // No correction needed
    }
    
    // Apply the correction based on recommendation
    const offset = slider.recommendation === 'shift_left' ? -1 : 1;
    const newIndex = slider.index + offset;
    
    // Validate the new position
    if (newIndex >= 0 && newIndex < correctedResults.length) {
      // Swap the positions
      const temp = correctedResults[slider.index];
      correctedResults[slider.index] = correctedResults[newIndex];
      correctedResults[newIndex] = temp;
      
      // Mark as corrected
      correctedResults[newIndex]._sliderCorrected = {
        originalIndex: slider.index,
        recommendation: slider.recommendation,
        confidence: slider.confidence
      };
    }
  }
  
  return correctedResults;
}

/**
 * Correct sliders based on optimal position selection and language-aware heuristics
 * 
 * @param {Array} diffResults - Diff results from detectModifiedLines()
 * @param {Array} sliders - Detected sliders from detectSliders()
 * @param {Object} options - Correction options
 * @param {boolean} options.correctSliders - Whether to apply corrections
 * @param {string} options.language - Detected programming language
 * @param {number} options.correctionThreshold - Minimum confidence for correction
 * @returns {Array} Corrected diff results
 */
export function correctSliders(diffResults, sliders, options = {}) {
  if (!options.correctSliders) {
    return diffResults;
  }
  
  const corrected = [...diffResults];
  const threshold = options.correctionThreshold || SLIDER_CONFIG.CORRECTION_THRESHOLD;
  
  // Sort sliders by confidence (highest first) to avoid conflicts
  const sortedSliders = sliders
    .filter(slider => slider.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
  
  // Keep track of adjusted indices to avoid conflicts
  const adjustedIndices = new Set();
  
  for (const slider of sortedSliders) {
    // Skip if this index or adjacent indices have already been adjusted
    if (adjustedIndices.has(slider.index) || 
        adjustedIndices.has(slider.index - 1) || 
        adjustedIndices.has(slider.index + 1)) {
      continue;
    }
    
    // Choose best position based on scores
    let bestOffset = 0;
    let bestScore = slider.currentScore;
    
    if (slider.leftScore > bestScore) {
      bestOffset = -1;
      bestScore = slider.leftScore;
    }
    if (slider.rightScore > bestScore) {
      bestOffset = 1;
      bestScore = slider.rightScore;
    }
    
    // Apply correction if we found a better position
    if (bestOffset !== 0 && slider.confidence >= threshold) {
      const adjustedIndex = slider.index + bestOffset;
      
      // Validate bounds
      if (adjustedIndex >= 0 && adjustedIndex < corrected.length) {
        // Apply language-aware adjustment
        const adjustedChange = adjustChangePosition(
          corrected[slider.index],
          corrected[adjustedIndex],
          bestOffset,
          options.language
        );
        
        if (adjustedChange) {
          // Swap the changes
          const temp = corrected[slider.index];
          corrected[slider.index] = adjustedChange.primary;
          corrected[adjustedIndex] = adjustedChange.secondary;
          
          // Mark both positions as corrected
          corrected[slider.index]._sliderCorrected = {
            originalIndex: slider.index,
            newIndex: slider.index,
            recommendation: 'adjusted_primary',
            confidence: slider.confidence,
            originalScore: slider.currentScore,
            newScore: bestScore
          };
          
          corrected[adjustedIndex]._sliderCorrected = {
            originalIndex: slider.index,
            newIndex: adjustedIndex,
            recommendation: bestOffset > 0 ? 'shifted_right' : 'shifted_left',
            confidence: slider.confidence,
            originalScore: slider.currentScore,
            newScore: bestScore
          };
          
          // Mark indices as adjusted to prevent conflicts
          adjustedIndices.add(slider.index);
          adjustedIndices.add(adjustedIndex);
        }
      }
    }
  }
  
  return corrected;
}

/**
 * Adjust change position based on offset and language preferences
 * 
 * @param {Object} primaryChange - The primary change to adjust
 * @param {Object} secondaryChange - The adjacent change to swap with
 * @param {number} offset - Direction of adjustment (-1 for left, 1 for right)
 * @param {string} language - Programming language for heuristics
 * @returns {Object|null} Adjusted changes or null if adjustment not possible
 */
function adjustChangePosition(primaryChange, secondaryChange, offset, language) {
  // Don't adjust if either change is not a modified line
  if (primaryChange.classification !== 'modified' || 
      (secondaryChange && secondaryChange.classification !== 'modified')) {
    return null;
  }
  
  // Extract line content
  const primaryLine = primaryChange.removedLine || primaryChange.addedLine || primaryChange.value || '';
  const secondaryLine = secondaryChange ? 
    (secondaryChange.removedLine || secondaryChange.addedLine || secondaryChange.value || '') : '';
  
  // Apply language-aware boundary adjustments
  const adjustedPrimary = adjustTokenBoundaries(primaryLine, offset, language);
  const adjustedSecondary = adjustTokenBoundaries(secondaryLine, -offset, language);
  
  // Create new change objects with adjusted content
  const newPrimary = {
    ...primaryChange,
    removedLine: adjustedPrimary.removed || primaryChange.removedLine,
    addedLine: adjustedPrimary.added || primaryChange.addedLine,
    value: adjustedPrimary.value || primaryChange.value
  };
  
  const newSecondary = secondaryChange ? {
    ...secondaryChange,
    removedLine: adjustedSecondary.removed || secondaryChange.removedLine,
    addedLine: adjustedSecondary.added || secondaryChange.addedLine,
    value: adjustedSecondary.value || secondaryChange.value
  } : null;
  
  return {
    primary: newPrimary,
    secondary: newSecondary
  };
}

/**
 * Adjust token boundaries for cleaner display based on language
 * 
 * @param {string} line - Line content to adjust
 * @param {number} offset - Adjustment direction
 * @param {string} language - Programming language
 * @returns {Object} Adjusted line components
 */
function adjustTokenBoundaries(line, offset, language) {
  if (!line) {
    return { removed: line, added: line, value: line };
  }
  
  const adjusted = { ...line };
  
  // Language-specific adjustments
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'java':
    case 'c':
    case 'cpp':
    case 'csharp':
      // C-style languages: prefer keeping braces with function signatures
      adjusted.value = adjustCStyleBoundaries(line, offset);
      break;
      
    case 'python':
      // Python: preserve indentation structure
      adjusted.value = adjustPythonBoundaries(line, offset);
      break;
      
    case 'lisp':
    case 'scheme':
    case 'clojure':
      // Lisp-style: preserve S-expression structure
      adjusted.value = adjustLispBoundaries(line, offset);
      break;
      
    case 'json':
    case 'yaml':
      // Data formats: preserve structure
      adjusted.value = adjustDataFormatBoundaries(line, offset);
      break;
      
    default:
      // Generic adjustment
      adjusted.value = adjustGenericBoundaries(line, offset);
      break;
  }
  
  return adjusted;
}

/**
 * Adjust boundaries for C-style languages
 */
function adjustCStyleBoundaries(line, offset) {
  // Preserve function signatures with opening braces
  if (line.includes('{') && !line.trim().endsWith('{')) {
    // Move opening brace to end if it's not already there
    const hasOpeningBrace = line.includes('{');
    const hasClosingBrace = line.includes('}');
    
    if (hasOpeningBrace && !hasClosingBrace) {
      // Extract the brace and move it to the end
      const withoutBrace = line.replace(/\s*\{\s*/, '');
      return withoutBrace.trim() + ' {';
    }
  }
  
  return line;
}

/**
 * Adjust boundaries for Python code
 */
function adjustPythonBoundaries(line, offset) {
  // Preserve indentation levels
  const indent = line.match(/^[\s]*/)?.[0] || '';
  const content = line.slice(indent.length);
  
  // For Python, we mainly want to preserve the indentation structure
  return indent + content;
}

/**
 * Adjust boundaries for Lisp-style languages
 */
function adjustLispBoundaries(line, offset) {
  // Preserve parenthesis structure
  const openCount = (line.match(/\(/g) || []).length;
  const closeCount = (line.match(/\)/g) || []).length;
  
  // If we have unmatched parentheses, try to balance them
  if (openCount !== closeCount) {
    // This is a simplified heuristic - in practice, more sophisticated
    // parsing would be needed for proper S-expression handling
    return line;
  }
  
  return line;
}

/**
 * Adjust boundaries for data formats (JSON, YAML)
 */
function adjustDataFormatBoundaries(line, offset) {
  // Preserve JSON/YAML structure
  return line;
}

/**
 * Generic boundary adjustment
 */
function adjustGenericBoundaries(line, offset) {
  // Basic adjustments that work for most text
  return line;
}

/**
 * Get statistics about detected sliders
 * 
 * @param {Array} sliders - Results from detectSliders()
 * @returns {Object} Statistics object
 */
export function getSliderStatistics(sliders) {
  return {
    totalSliders: sliders.length,
    highConfidence: sliders.filter(s => s.confidence >= 0.8).length,
    mediumConfidence: sliders.filter(s => s.confidence >= 0.5 && s.confidence < 0.8).length,
    lowConfidence: sliders.filter(s => s.confidence < 0.5).length,
    recommendLeft: sliders.filter(s => s.recommendation === 'shift_left').length,
    recommendRight: sliders.filter(s => s.recommendation === 'shift_right').length,
    recommendKeep: sliders.filter(s => s.recommendation === 'keep').length,
    languageDistribution: sliders.reduce((dist, s) => {
      dist[s.language || 'unknown'] = (dist[s.language || 'unknown'] || 0) + 1;
      return dist;
    }, {})
  };
}

export default {
  detectSliders,
  applySliderCorrections,
  getSliderStatistics,
  SLIDER_CONFIG
};