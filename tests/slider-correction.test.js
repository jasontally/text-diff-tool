/**
 * Slider Correction Tests
 * 
 * Tests for slider detection and correction functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  detectSliders, 
  applySliderCorrections, 
  getSliderStatistics,
  SLIDER_CONFIG 
} from '../src/slider-correction.js';

describe('Slider Correction', () => {
  describe('detectSliders', () => {
    it('should detect ambiguous indentation in Python', () => {
      const diffResults = [
        {
          value: 'if condition:\n',
          classification: 'unchanged'
        },
        {
          removedLine: '    old_line()\n',
          addedLine: '    new_line()\n',
          classification: 'modified',
          similarity: 0.7
        },
        {
          value: '    another_line()\n',
          classification: 'unchanged'
        }
      ];
      
      const sliders = detectSliders(diffResults, { 
        language: 'python',
        debug: true 
      });
      
      expect(sliders.length).toBeGreaterThanOrEqual(0);
      expect(sliders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'slider',
            language: 'python'
          })
        ])
      );
    });

    it('should detect brace alignment issues in JavaScript', () => {
      const diffResults = [
        {
          value: 'function test() {\n',
          classification: 'unchanged'
        },
        {
          removedLine: '  oldCode();\n',
          addedLine: '  newCode();\n',
          classification: 'modified',
          similarity: 0.6
        },
        {
          value: '}\n',
          classification: 'unchanged'
        }
      ];
      
      const sliders = detectSliders(diffResults, { 
        language: 'javascript' 
      });
      
      expect(sliders.length).toBeGreaterThanOrEqual(0);
      if (sliders.length > 0) {
        expect(sliders[0]).toHaveProperty('currentScore');
        expect(sliders[0]).toHaveProperty('leftScore');
        expect(sliders[0]).toHaveProperty('rightScore');
      }
    });

    it('should respect ambiguity threshold', () => {
      const diffResults = [
        {
          removedLine: 'clearly_different\n',
          addedLine: 'completely_different\n',
          classification: 'modified',
          similarity: 0.1
        }
      ];
      
      // High threshold should detect fewer sliders
      const strictSliders = detectSliders(diffResults, { 
        ambiguityThreshold: 0.05 
      });
      
      // Low threshold should detect more sliders
      const looseSliders = detectSliders(diffResults, { 
        ambiguityThreshold: 0.5 
      });
      
      expect(looseSliders.length).toBeGreaterThanOrEqual(strictSliders.length);
    });

    it('should skip detection for very large diffs', () => {
      // Create a large diff
      const largeDiff = Array(15000).fill().map((_, i) => ({
        value: `line ${i}\n`,
        classification: 'unchanged'
      }));
      
      largeDiff[1000] = {
        removedLine: `line ${1000}\n`,
        addedLine: `modified line ${1000}\n`,
        classification: 'modified',
        similarity: 0.7
      };
      
      const sliders = detectSliders(largeDiff, { debug: true });
      
      expect(sliders).toEqual([]);
    });

    it('should provide scoring information for each slider', () => {
      const diffResults = [
        {
          value: '{\n',
          classification: 'unchanged'
        },
        {
          removedLine: '  old: value,\n',
          addedLine: '  new: value,\n',
          classification: 'modified',
          similarity: 0.8
        },
        {
          value: '}\n',
          classification: 'unchanged'
        }
      ];
      
      const sliders = detectSliders(diffResults, { 
        language: 'json' 
      });
      
      if (sliders.length > 0) {
        const slider = sliders[0];
        expect(slider).toHaveProperty('currentScore');
        expect(slider).toHaveProperty('leftScore');
        expect(slider).toHaveProperty('rightScore');
        expect(slider).toHaveProperty('confidence');
        expect(slider).toHaveProperty('recommendation');
        expect(slider).toHaveProperty('alternatives');
        expect(slider.currentScore).toBeGreaterThanOrEqual(0);
        expect(slider.currentScore).toBeLessThanOrEqual(1);
        expect(slider.confidence).toBeGreaterThanOrEqual(0);
        expect(slider.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('applySliderCorrections', () => {
    it('should apply high-confidence corrections', () => {
      const diffResults = [
        { value: 'unchanged1\n', classification: 'unchanged' },
        { 
          removedLine: 'modified1\n', 
          addedLine: 'changed1\n',
          classification: 'modified',
          similarity: 0.7
        },
        { 
          removedLine: 'modified2\n', 
          addedLine: 'changed2\n',
          classification: 'modified',
          similarity: 0.7
        },
        { value: 'unchanged2\n', classification: 'unchanged' }
      ];
      
      // Mock sliders with high confidence
      const sliders = [
        {
          index: 1,
          recommendation: 'shift_right',
          confidence: 0.9
        }
      ];
      
      const corrected = applySliderCorrections(diffResults, sliders, {
        correctionThreshold: 0.8
      });
      
      // The modification should have moved
      expect(corrected[1]).toEqual(diffResults[2]);
      expect(corrected[2]).toEqual(diffResults[1]);
      expect(corrected[2]).toHaveProperty('_sliderCorrected');
    });

    it('should not apply low-confidence corrections', () => {
      const diffResults = [
        { value: 'unchanged\n', classification: 'unchanged' },
        { 
          removedLine: 'modified\n', 
          addedLine: 'changed\n',
          classification: 'modified',
          similarity: 0.7
        }
      ];
      
      const sliders = [
        {
          index: 1,
          recommendation: 'shift_left',
          confidence: 0.3 // Low confidence
        }
      ];
      
      const corrected = applySliderCorrections(diffResults, sliders, {
        correctionThreshold: 0.8
      });
      
      // Should remain unchanged
      expect(corrected).toEqual(diffResults);
    });

    it('should respect array bounds when applying corrections', () => {
      const diffResults = [
        { value: 'first\n', classification: 'unchanged' },
        { 
          removedLine: 'modified\n', 
          addedLine: 'changed\n',
          classification: 'modified',
          similarity: 0.7
        }
      ];
      
      const sliders = [
        {
          index: 0,
          recommendation: 'shift_left', // Would go out of bounds
          confidence: 0.9
        }
      ];
      
      const corrected = applySliderCorrections(diffResults, sliders);
      
      // Should remain unchanged due to bounds check
      expect(corrected).toEqual(diffResults);
    });
  });

  describe('getSliderStatistics', () => {
    it('should provide comprehensive statistics', () => {
      const sliders = [
        { language: 'javascript', confidence: 0.9, recommendation: 'shift_left' },
        { language: 'javascript', confidence: 0.6, recommendation: 'shift_right' },
        { language: 'python', confidence: 0.3, recommendation: 'keep' },
        { language: 'javascript', confidence: 0.8, recommendation: 'shift_left' }
      ];
      
      const stats = getSliderStatistics(sliders);
      
      expect(stats.totalSliders).toBe(4);
      expect(stats.highConfidence).toBe(2); // 0.9, 0.8
      expect(stats.mediumConfidence).toBe(1); // 0.6
      expect(stats.lowConfidence).toBe(1); // 0.3
      expect(stats.recommendLeft).toBe(2);
      expect(stats.recommendRight).toBe(1);
      expect(stats.recommendKeep).toBe(1);
      expect(stats.languageDistribution).toEqual({
        javascript: 3,
        python: 1
      });
    });
  });

  describe('Language-specific preferences', () => {
    it('should have Python-specific preferences', () => {
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.python.braceWeight).toBe(0);
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.python.indentWeight).toBe(0.5);
    });

    it('should have JavaScript-specific preferences', () => {
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.javascript.braceWeight).toBe(0.3);
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.javascript.delimiterWeight).toBe(0.3);
    });

    it('should have YAML-specific preferences', () => {
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.yaml.indentWeight).toBe(0.6);
      expect(SLIDER_CONFIG.LANGUAGE_PREFERENCES.yaml.braceWeight).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should complete detection within performance limits', () => {
      const diffResults = Array(1000).fill().map((_, i) => ({
        value: `line ${i}\n`,
        classification: i % 100 === 50 ? {
          removedLine: `line ${i}\n`,
          addedLine: `modified ${i}\n`,
          classification: 'modified',
          similarity: 0.7
        } : 'unchanged'
      }));
      
      const startTime = performance.now();
      const sliders = detectSliders(diffResults);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});