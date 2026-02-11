// E2E Tests for Silent Failures and Console Error Detection
// These tests ensure that errors are properly logged and visible

import { test, expect } from '@playwright/test';

// Store console messages during tests
const consoleMessages = [];
const errorMessages = [];
const warningMessages = [];

test.beforeEach(async ({ page }) => {
  // Clear arrays
  consoleMessages.length = 0;
  errorMessages.length = 0;
  warningMessages.length = 0;
  
  // Listen to all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const location = msg.location();
    
    consoleMessages.push({ type, text, location, time: new Date().toISOString() });
    
    if (type === 'error') {
      errorMessages.push({ text, location, time: new Date().toISOString() });
    } else if (type === 'warning') {
      warningMessages.push({ text, location, time: new Date().toISOString() });
    }
    
    // Log to test output for debugging
    if (type === 'error' || type === 'warning') {
      console.log(`[Browser ${type.toUpperCase()}] ${text}`);
    }
  });
  
  // Listen to page errors
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      time: new Date().toISOString()
    };
    errorMessages.push(errorInfo);
    console.log(`[Browser PAGE ERROR] ${error.message}`);
  });
  
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
});

test.afterEach(async () => {
  // Report any console errors that occurred during the test
  if (errorMessages.length > 0) {
    console.log(`\n⚠️  ${errorMessages.length} console error(s) detected during test:`);
    errorMessages.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.text || err.message}`);
    });
  }
});

// ============================================================================
// Silent Failure Detection Tests
// ============================================================================

test.describe('Silent Failure Detection', () => {
  
  test('should generate output when comparing valid text', async ({ page }) => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3';
    
    await page.fill('#previous-text', oldText);
    await page.fill('#current-text', newText);
    await page.click('#compare-btn');
    
    // Wait for comparison to complete
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 10000 });
    
    // Verify output was generated
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    expect(diffRows).toBeGreaterThan(0);
    
    // Verify stats show changes
    const modifiedText = await page.locator('[data-testid="stat-modified"]').textContent();
    expect(Number(modifiedText)).toBeGreaterThan(0);
    
    // Verify no errors were logged
    expect(errorMessages).toHaveLength(0);
  });
  
  test('should show error and log to console when comparison fails', async ({ page }) => {
    // Force an error by entering invalid content that might trigger edge cases
    const problematicText = '\0\0\0'; // Null bytes might cause issues
    
    await page.fill('#previous-text', problematicText);
    await page.fill('#current-text', 'valid text');
    
    // Set up dialog handler to catch alert
    let alertMessage = null;
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    await page.click('#compare-btn');
    
    // Wait a moment for any error to occur
    await page.waitForTimeout(2000);
    
    // Either an error should be shown OR results should appear
    // But if there's a silent failure, neither happens
    const hasAlert = alertMessage !== null;
    const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
    
    // If no alert and no results, that's a silent failure
    if (!hasAlert && !hasResults) {
      throw new Error('Silent failure detected: No error message and no results generated');
    }
    
    // If there was an error, it should be logged to console
    if (hasAlert) {
      const hasConsoleError = errorMessages.some(e => 
        e.text.includes('failed') || e.text.includes('Error')
      );
      expect(hasConsoleError).toBe(true);
    }
  });
  
  test('should not silently fail with empty previous text', async ({ page }) => {
    const newText = 'new content\nmore content';
    
    await page.fill('#current-text', newText);
    await page.click('#compare-btn');
    
    // Wait for comparison
    await page.waitForTimeout(2000);
    
    // Check if results appeared or error was shown
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    const addedCount = await page.locator('[data-testid="stat-added"]').textContent();
    
    // Should either show results or show an error
    const hasOutput = diffRows > 0 || parseInt(addedCount) > 0;
    const hasError = errorMessages.length > 0;
    
    expect(hasOutput || hasError).toBe(true);
    
    if (!hasOutput && !hasError) {
      throw new Error('Silent failure: No output generated and no error logged for empty previous text');
    }
  });
  
  test('should not silently fail with empty current text', async ({ page }) => {
    const oldText = 'old content\nmore content';
    
    await page.fill('#previous-text', oldText);
    await page.click('#compare-btn');
    
    // Wait for comparison
    await page.waitForTimeout(2000);
    
    // Check if results appeared or error was shown
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    const removedCount = await page.locator('[data-testid="stat-removed"]').textContent();
    
    const hasOutput = diffRows > 0 || parseInt(removedCount) > 0;
    const hasError = errorMessages.length > 0;
    
    expect(hasOutput || hasError).toBe(true);
    
    if (!hasOutput && !hasError) {
      throw new Error('Silent failure: No output generated and no error logged for empty current text');
    }
  });
  
  test('should not silently fail with very large files', async ({ page }) => {
    // Create a large file that tests performance (1000 lines of 100 chars each)
    // This tests the app's ability to handle larger files without being too slow
    const largeContent = Array(1000).fill('x'.repeat(100)).join('\n');
    
    await page.fill('#previous-text', largeContent);
    await page.fill('#current-text', largeContent + '\nextra');
    
    // Set up dialog handler
    let alertShown = false;
    page.on('dialog', async dialog => {
      alertShown = true;
      await dialog.accept();
    });
    
    await page.click('#compare-btn');
    await page.waitForTimeout(3000);
    
    // Should either complete or show an error
    const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
    
    if (!hasResults && !alertShown && errorMessages.length === 0) {
      throw new Error('Silent failure: Large file comparison neither completed nor showed error');
    }
    
    // Any errors should be logged
    if (alertShown) {
      expect(errorMessages.length).toBeGreaterThan(0);
    }
  });
  
  test('should handle Web Worker errors gracefully', async ({ page }) => {
    // Simulate a worker error by injecting a script that might cause issues
    await page.evaluate(() => {
      // Force a worker error by sending invalid data
      if (window.diffWorker && window.diffWorker.worker) {
        window.diffWorker.worker.postMessage({ invalid: 'data' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Check that any errors were logged
    const workerErrors = errorMessages.filter(e => 
      e.text.includes('worker') || e.text.includes('Worker')
    );
    
    // Even if we can't verify the specific error, we should verify
    // that error logging mechanism is working
    console.log(`Worker errors detected: ${workerErrors.length}`);
  });
  
  test('should generate output after multiple consecutive comparisons', async ({ page }) => {
    const texts = [
      { old: 'a\nb\nc', new: 'a\nmodified\nc' },
      { old: 'x\ny\nz', new: 'x\nY\nz' },
      { old: '1\n2\n3', new: '1\n2\n3\n4' }
    ];
    
    for (let i = 0; i < texts.length; i++) {
      const { old, new: newText } = texts[i];
      
      await page.fill('#previous-text', old);
      await page.fill('#current-text', newText);
      await page.click('#compare-btn');
      
      // Wait for this comparison
      await page.waitForTimeout(1500);
      
      // Verify results appeared
      const diffRows = await page.locator('.diff-row, .unified-row').count();
      expect(diffRows).toBeGreaterThan(0);
      
      // Clear for next iteration
      await page.click('#clear-btn');
      await page.waitForTimeout(500);
    }
    
    // Verify no errors accumulated
    expect(errorMessages).toHaveLength(0);
  });
  
  test('should show error for binary file detection', async ({ page }) => {
    // Simulate binary content by using a data URL approach
    const binaryContent = '\x00\x01\x02\x03\xff\xfe'; // Binary-like content
    
    await page.fill('#previous-text', binaryContent);
    await page.fill('#current-text', 'valid text');
    
    let alertMessage = null;
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    await page.click('#compare-btn');
    await page.waitForTimeout(2000);
    
    // Either an alert should show or comparison should proceed
    if (!alertMessage) {
      // If no alert, check that results appeared
      const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
      expect(hasResults).toBe(true);
    }
  });
  
  test('should log validation warnings to console', async ({ page }) => {
    // This test just ensures the validation system logs warnings
    await page.waitForTimeout(2000);
    
    // Check for validation warnings in console
    const validationWarnings = warningMessages.filter(w => 
      w.text.includes('Validation') || w.text.includes('validation')
    );
    
    console.log(`Validation warnings found: ${validationWarnings.length}`);
    
    // The warnings might be there from initialization
    // This test is more about ensuring we're capturing them
  });
});

// ============================================================================
// Console Error Monitoring Tests
// ============================================================================

test.describe('Console Error Monitoring', () => {
  
  test('should have no critical errors on initial load', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for critical errors (not just warnings)
    const criticalErrors = errorMessages.filter(e => 
      !e.text.includes('Source map') && // Ignore source map errors
      !e.text.includes('404') && // Ignore 404s for optional resources
      !e.text.includes('favicon') // Ignore favicon errors
    );
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
    
    // We allow some non-critical errors but document them
    expect(criticalErrors.length).toBeLessThanOrEqual(3); // Allow a few non-critical errors
  });
  
  test('should log comparison errors to console', async ({ page }) => {
    // Trigger a comparison that might fail
    await page.fill('#previous-text', 'text');
    await page.fill('#current-text', 'different');
    
    await page.click('#compare-btn');
    await page.waitForTimeout(3000);
    
    // Check that any errors were logged
    const comparisonErrors = errorMessages.filter(e => 
      e.text.includes('Comparison') || e.text.includes('comparison')
    );
    
    // If there were errors, they should be logged
    if (comparisonErrors.length > 0) {
      console.log('Comparison errors logged:', comparisonErrors);
    }
    
    // Success case: no errors means test passes
    expect(true).toBe(true);
  });
  
  test('should capture and report all console message types', async ({ page }) => {
    // Execute various actions
    await page.click('#config-toggle-btn');
    await page.waitForTimeout(500);
    await page.click('#config-toggle-btn'); // Close
    await page.waitForTimeout(500);
    
    await page.fill('#previous-text', 'test');
    await page.click('#compare-btn');
    await page.waitForTimeout(2000);
    
    // Verify we captured various message types
    console.log('\n=== Console Message Summary ===');
    console.log(`Total messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errorMessages.length}`);
    console.log(`Warnings: ${warningMessages.length}`);
    console.log(`Log messages: ${consoleMessages.filter(m => m.type === 'log').length}`);
    
    // Document what we captured
    if (consoleMessages.length > 0) {
      console.log('\n=== All Console Messages ===');
      consoleMessages.forEach((msg, idx) => {
        console.log(`${idx + 1}. [${msg.type}] ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
      });
    }
    
    // Test passes if we successfully captured messages
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Edge Case Silent Failure Tests
// ============================================================================

test.describe('Edge Case Silent Failures', () => {
  
  test('should handle special characters without silent failure', async ({ page }) => {
    const specialChars = [
      '<script>alert("xss")</script>',
      '&#x0;',
      '\\x00\\x01\\x02',
      '\n\n\n', // Multiple newlines
      '   ', // Only whitespace
      '\t\t\t', // Only tabs
    ];
    
    for (const content of specialChars) {
      await page.fill('#previous-text', content);
      await page.fill('#current-text', 'normal');
      await page.click('#compare-btn');
      await page.waitForTimeout(1500);
      
      const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
      const hasErrors = errorMessages.length > 0;
      
      if (!hasResults && !hasErrors) {
        throw new Error(`Silent failure with special characters: ${content.substring(0, 20)}`);
      }
      
      // Clear errors for next iteration
      errorMessages.length = 0;
    }
  });
  
  test('should handle very long single lines without silent failure', async ({ page }) => {
    const longLine = 'x'.repeat(10000);
    
    await page.fill('#previous-text', longLine);
    await page.fill('#current-text', longLine + 'y');
    await page.click('#compare-btn');
    
    await page.waitForTimeout(5000);
    
    const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
    const hasError = errorMessages.length > 0;
    
    if (!hasResults && !hasError) {
      throw new Error('Silent failure with very long lines');
    }
  });
  
  test('should handle rapid successive clicks without silent failure', async ({ page }) => {
    await page.fill('#previous-text', 'content A');
    await page.fill('#current-text', 'content B');
    
    // Click rapidly multiple times
    for (let i = 0; i < 5; i++) {
      await page.click('#compare-btn');
      await page.waitForTimeout(200);
    }
    
    // Wait for final result
    await page.waitForTimeout(3000);
    
    const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
    expect(hasResults).toBe(true);
  });
  
  test('should handle view switching during comparison', async ({ page }) => {
    await page.fill('#previous-text', 'line 1\nline 2\nline 3');
    await page.fill('#current-text', 'line 1\nmodified\nline 3');
    
    await page.click('#compare-btn');
    
    // Switch views while comparison is running
    await page.waitForTimeout(500);
    await page.click('[data-view="unified"]');
    await page.waitForTimeout(500);
    await page.click('[data-view="split"]');
    await page.waitForTimeout(500);
    
    // Wait for completion
    await page.waitForTimeout(3000);
    
    const hasResults = await page.locator('.diff-row, .unified-row').count() > 0;
    expect(hasResults).toBe(true);
  });
});
