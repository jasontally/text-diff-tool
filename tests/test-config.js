/**
 * Shared Test Configuration
 * 
 * This file provides standard test configurations to ensure consistency
 * across all test files. By default, tests should use DISABLED fast mode
 * to ensure they're testing the full algorithm, not the fast mode fallback.
 * 
 * Only tests specifically testing fast mode behavior should use the
 * ENABLED configuration.
 */

import { CONFIG } from '../src/diff-algorithms.js';

/**
 * Standard test configuration with fast mode DISABLED.
 * Use this for all tests that aren't specifically testing fast mode.
 * This ensures tests run the full algorithm and produce detailed results.
 */
export const TEST_CONFIG = {
  ...CONFIG,
  ENABLE_FAST_MODE: false,  // Ensure tests use full algorithm, not fast mode
  // Keep production limits to test realistic scenarios
  MAX_LINES: 50000,
  MAX_GRAPH_VERTICES: 100000
};

/**
 * Test configuration with fast mode ENABLED.
 * Use this only for tests specifically testing fast mode behavior.
 * Reduces limits for faster testing of limit-triggering scenarios.
 */
export const TEST_CONFIG_FAST_MODE_ENABLED = {
  ...CONFIG,
  ENABLE_FAST_MODE: true,
  MAX_LINES: 100,  // Lower threshold for testing
  MAX_GRAPH_VERTICES: 1000
};

/**
 * Default options to pass to runDiffPipeline in tests.
 * Ensures consistent behavior across test files.
 */
export const DEFAULT_TEST_OPTIONS = {
  config: TEST_CONFIG,
  modeToggles: { lines: true, words: true, chars: true }
};
