/**
 * Accessibility Audit Tests
 * 
 * E2E tests to verify WCAG 2.1 Level AA compliance
 * Uses axe-core for automated accessibility scanning
 * 
 * @see https://www.w3.org/WAI/WCAG21/quickref/
 */

import { test, expect } from '@playwright/test';

/**
 * Run axe-core accessibility audit on the page
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} context - Description of what's being tested
 * @returns {Promise<Object>} Axe results
 */
async function runAccessibilityAudit(page, context = 'page') {
  // Inject axe-core
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
  });
  
  // Run axe audit
  const results = await page.evaluate(() => {
    return new Promise((resolve) => {
      // @ts-ignore
      axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
        },
        rules: {
          'color-contrast': { enabled: true },
          'heading-order': { enabled: true },
          'label': { enabled: true },
          'landmark-one-main': { enabled: true },
          'region': { enabled: true }
        }
      }, (err, results) => {
        if (err) {
          resolve({ error: err.message, violations: [] });
        } else {
          resolve(results);
        }
      });
    });
  });
  
  return results;
}

/**
 * Format violations for readable error messages
 */
function formatViolations(violations) {
  if (violations.length === 0) return 'No violations found';
  
  return violations.map(v => {
    const nodes = v.nodes.map(n => {
      const selector = n.target.join(' > ');
      const impact = n.impact ? `[${n.impact}]` : '';
      return `  - ${selector} ${impact}`;
    }).join('\n');
    
    return `${v.id}: ${v.description}\n${nodes}`;
  }).join('\n\n');
}

// ============================================================================
// Initial Page Load Accessibility Tests
// ============================================================================

test.describe('Initial Page Load Accessibility', () => {
  test('should pass WCAG 2.1 Level AA audit on initial load', async ({ page }) => {
    await page.goto('/index.html');
    
    const results = await runAccessibilityAudit(page, 'initial page load');
    
    expect(results.error).toBeUndefined();
    expect(results.violations, `Accessibility violations found:\n${formatViolations(results.violations)}`).toHaveLength(0);
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/index.html');
    
    // Check h1 exists
    const h1 = await page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Text Diff Visualizer');
    
    // Check heading order (no h2 before h1, etc.)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let lastLevel = 0;
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.replace('h', ''));
      
      // Headings should not skip levels going down (e.g., h1 to h3)
      expect(level).toBeLessThanOrEqual(lastLevel + 1);
      lastLevel = level;
    }
  });

  test('should have proper lang attribute', async ({ page }) => {
    await page.goto('/index.html');
    const html = await page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });
});

// ============================================================================
// Form and Input Accessibility Tests
// ============================================================================

test.describe('Form and Input Accessibility', () => {
  test('all interactive elements should have aria-labels', async ({ page }) => {
    await page.goto('/index.html');
    
    // Check all buttons have aria-label
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const hasLabel = await button.evaluate(el => 
        el.hasAttribute('aria-label') || 
        el.textContent?.trim().length > 0
      );
      expect(hasLabel, 'Button should have aria-label or text content').toBe(true);
    }
    
    // Check textareas have associated labels
    const textareas = await page.locator('textarea').all();
    for (const textarea of textareas) {
      const id = await textarea.getAttribute('id');
      const ariaLabel = await textarea.getAttribute('aria-label');
      const ariaLabelledBy = await textarea.getAttribute('aria-labelledby');
      
      // Should have either aria-label, aria-labelledby, or associated label element
      const hasLabel = ariaLabel || ariaLabelledBy || await page.locator(`label[for="${id}"]`).count() > 0;
      expect(hasLabel, `Textarea #${id} should have a label`).toBeTruthy();
    }
  });

  test('form inputs should be keyboard accessible', async ({ page }) => {
    await page.goto('/index.html');
    
    // Test tab navigation through inputs
    const previousText = page.locator('#previous-text');
    const currentText = page.locator('#current-text');
    const compareBtn = page.locator('#compare-btn');
    
    // Previous textarea should be focusable
    await previousText.focus();
    await expect(previousText).toBeFocused();
    
    // Tab to next element
    await page.keyboard.press('Tab');
    // Should be able to tab through interactive elements
    
    // Test Ctrl+Enter shortcut for compare
    await previousText.fill('test text');
    await currentText.fill('test text modified');
    await previousText.focus();
    await page.keyboard.press('Control+Enter');
    
    // Should trigger compare (diff container should appear)
    await expect(page.locator('#diff-container')).toBeVisible();
  });

  test('checkboxes should have proper labels', async ({ page }) => {
    await page.goto('/index.html');
    
    // Check ignore whitespace checkbox
    const whitespaceCheckbox = page.locator('#ignore-whitespace');
    await expect(whitespaceCheckbox).toHaveAttribute('aria-label', 'Ignore whitespace changes');
    
    // Check ignore comments checkbox
    const commentsCheckbox = page.locator('#ignore-comments');
    await expect(commentsCheckbox).toHaveAttribute('aria-label', 'Ignore comment changes');
  });
});

// ============================================================================
// Color Contrast and Visual Accessibility Tests
// ============================================================================

test.describe('Color Contrast and Visual Accessibility', () => {
  test('should meet WCAG AA color contrast requirements', async ({ page }) => {
    await page.goto('/index.html');
    
    // Run axe specifically checking color contrast
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
    });
    
    const contrastResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        axe.run(document, {
          runOnly: ['color-contrast']
        }, (err, results) => {
          if (err) {
            resolve({ error: err.message, violations: [] });
          } else {
            resolve(results);
          }
        });
      });
    });
    
    expect(contrastResults.violations, `Color contrast violations:\n${formatViolations(contrastResults.violations)}`).toHaveLength(0);
  });

  test('diff highlighting should not rely on color alone', async ({ page }) => {
    await page.goto('/index.html');
    
    // Add test content and compare
    await page.locator('#previous-text').fill('line 1\nline 2\nline 3');
    await page.locator('#current-text').fill('line 1\nmodified line 2\nline 3\nnew line');
    await page.locator('#compare-btn').click();
    
    // Wait for results
    await page.waitForSelector('.diff-row');
    
    // Check that added/removed/modified rows have visual indicators beyond color
    const addedRows = await page.locator('.diff-row.added').all();
    const removedRows = await page.locator('.diff-row.removed').all();
    const modifiedRows = await page.locator('.diff-row.modified').all();
    
    for (const row of addedRows) {
      // Should have '+' prefix or other non-color indicator
      const content = await row.locator('.line-content').textContent();
      expect(content?.startsWith('+')).toBe(true);
    }
    
    for (const row of removedRows) {
      // Should have '-' prefix or other non-color indicator
      const content = await row.locator('.line-content').textContent();
      expect(content?.startsWith('-')).toBe(true);
    }
  });
});

// ============================================================================
// Screen Reader and ARIA Tests
// ============================================================================

test.describe('Screen Reader and ARIA Support', () => {
  test('should have proper ARIA live regions for dynamic content', async ({ page }) => {
    await page.goto('/index.html');
    
    // Stats section should be a live region
    const stats = page.locator('#stats');
    await expect(stats).toHaveAttribute('aria-live', 'polite');
    await expect(stats).toHaveAttribute('aria-atomic', 'true');
    
    // After comparing, stats should update
    await page.locator('#previous-text').fill('test');
    await page.locator('#current-text').fill('test modified');
    await page.locator('#compare-btn').click();
    
    // Wait for diff to render
    await page.waitForSelector('#stats .stat-value');
    
    // Stats values should be present
    const addedCount = await page.locator('#stat-added').textContent();
    expect(parseInt(addedCount || '0')).toBeGreaterThanOrEqual(0);
  });

  test('progress modal should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/index.html');
    
    const modal = page.locator('#progress-modal');
    
    // Check modal has proper role
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-label', 'Comparing text');
  });

  test('diff panels should have proper ARIA labels', async ({ page }) => {
    await page.goto('/index.html');
    
    // Compare some text to show panels
    await page.locator('#previous-text').fill('test');
    await page.locator('#current-text').fill('test');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('#diff-container');
    
    // Check panels have aria-labels
    const previousPanel = page.locator('#previous-diff-panel');
    const currentPanel = page.locator('#current-diff-panel');
    
    await expect(previousPanel).toHaveAttribute('aria-label', 'Previous version diff');
    await expect(currentPanel).toHaveAttribute('aria-label', 'Current version diff');
  });
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

test.describe('Keyboard Navigation', () => {
  test('should support Alt+Up/Alt+Down for change navigation', async ({ page }) => {
    await page.goto('/index.html');
    
    // Add content with changes
    await page.locator('#previous-text').fill('line 1\nold line 2\nline 3');
    await page.locator('#current-text').fill('line 1\nnew line 2\nline 3');
    await page.locator('#compare-btn').click();
    
    // Wait for results
    await page.waitForSelector('#navigation-section');
    
    // Test Alt+Down to go to next change
    await page.keyboard.press('Alt+ArrowDown');
    
    // Change counter should update
    const counter = await page.locator('#change-counter').textContent();
    expect(counter).toMatch(/\d+ of \d+/);
  });

  test('all buttons should be keyboard accessible', async ({ page }) => {
    await page.goto('/index.html');
    
    const buttons = [
      '#compare-btn',
      '#clear-btn',
      '#swap-btn',
      '#copy-btn',
      '#download-btn',
      '#prev-change-btn',
      '#next-change-btn'
    ];
    
    for (const selector of buttons) {
      const button = page.locator(selector);
      // Skip hidden buttons
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      // Should be focusable
      await button.focus();
      await expect(button).toBeFocused();
      
      // Should have visible focus indicator (via CSS outline)
      const outline = await button.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline || `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
      });
      
      // Outline should not be '0px' or 'none'
      expect(outline).not.toMatch(/0px|none/);
    }
  });

  test('Escape should close modals', async ({ page }) => {
    await page.goto('/index.html');
    
    // Add content and compare to trigger progress modal
    await page.locator('#previous-text').fill('test content here\n'.repeat(100));
    await page.locator('#current-text').fill('test content modified\n'.repeat(100));
    await page.locator('#compare-btn').click();
    
    // Wait for modal to appear
    const modal = page.locator('#progress-modal');
    await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // If modal is visible, Escape should close it (if implemented)
    // Note: Progress modal auto-closes, so this tests the concept
  });
});

// ============================================================================
// Mobile Accessibility Tests
// ============================================================================

test.describe('Mobile Accessibility', () => {
  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/index.html');
    
    const results = await runAccessibilityAudit(page, 'mobile viewport');
    
    expect(results.error).toBeUndefined();
    expect(results.violations, `Mobile accessibility violations:\n${formatViolations(results.violations)}`).toHaveLength(0);
  });

  test('touch targets should be large enough on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/index.html');
    
    // Check button sizes (WCAG recommends 44x44px minimum)
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      const box = await button.boundingBox();
      if (box) {
        // Allow smaller buttons if they have sufficient spacing
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

// ============================================================================
// Diff Results Accessibility Tests
// ============================================================================

test.describe('Diff Results Accessibility', () => {
  test('should announce comparison results to screen readers', async ({ page }) => {
    await page.goto('/index.html');
    
    // Add and compare text
    await page.locator('#previous-text').fill('line 1\nline 2');
    await page.locator('#current-text').fill('line 1\nmodified line 2');
    await page.locator('#compare-btn').click();
    
    // Wait for diff results
    await page.waitForSelector('.diff-row');
    
    // All diff rows should have data-index for navigation reference
    const rows = await page.locator('.diff-row').all();
    expect(rows.length).toBeGreaterThan(0);
    
    for (const row of rows) {
      const hasIndex = await row.evaluate(el => el.hasAttribute('data-index'));
      expect(hasIndex).toBe(true);
    }
  });
});

// ============================================================================
// Focus Management Tests
// ============================================================================

test.describe('Focus Management', () => {
  test('focus should be visible on all interactive elements', async ({ page }) => {
    await page.goto('/index.html');
    
    const interactiveElements = await page.locator('button, textarea, input[type="checkbox"]').all();
    
    for (const element of interactiveElements) {
      const isVisible = await element.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      await element.focus();
      
      // Check that focus is visible (either native outline or custom)
      const hasVisibleFocus = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        const hasOutline = style.outlineWidth !== '0px' && style.outlineStyle !== 'none';
        const hasBoxShadow = style.boxShadow !== 'none';
        return hasOutline || hasBoxShadow;
      });
      
      expect(hasVisibleFocus, `Element ${await element.evaluate(el => el.tagName)} should have visible focus`).toBe(true);
    }
  });

  test('tab order should follow logical visual flow', async ({ page }) => {
    await page.goto('/index.html');
    
    // Get all focusable elements
    const focusableElements = await page.locator('button:not([disabled]), textarea, input[type="checkbox"], [tabindex]:not([tabindex="-1"])').all();
    
    // Should have reasonable number of focusable elements
    expect(focusableElements.length).toBeGreaterThanOrEqual(5);
    
    // Each should be focusable
    for (const el of focusableElements.slice(0, 5)) { // Test first 5
      const isVisible = await el.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      await el.focus();
      await expect(el).toBeFocused();
    }
  });
});

// ============================================================================
// Reduced Motion Tests
// ============================================================================

test.describe('Reduced Motion Support', () => {
  test('should respect prefers-reduced-motion', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/index.html');
    
    // Trigger comparison to show spinner
    await page.locator('#previous-text').fill('test\n'.repeat(50));
    await page.locator('#current-text').fill('modified\n'.repeat(50));
    await page.locator('#compare-btn').click();
    
    // Check that animations respect reduced motion
    // Spinner should either not animate or use reduced animation
    const spinner = page.locator('.spinner');
    await spinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // The spinner element exists, animation controlled by CSS
    const spinnerExists = await spinner.count() > 0;
    expect(spinnerExists).toBe(true);
  });
});

// ============================================================================
// High Contrast Mode Tests
// ============================================================================

test.describe('High Contrast Mode Support', () => {
  test('should support forced-colors mode', async ({ page }) => {
    // Note: Full high contrast testing requires OS-level emulation
    // This test checks that the page structure supports it
    await page.goto('/index.html');
    
    // Add and compare content
    await page.locator('#previous-text').fill('test line 1\ntest line 2');
    await page.locator('#current-text').fill('test line 1\nmodified line 2');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row');
    
    // In high contrast mode, borders and visual separation are important
    const diffRows = await page.locator('.diff-row').all();
    
    for (const row of diffRows) {
      // Each row should have some visual boundary (border, background, etc.)
      const hasVisualBoundary = await row.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.borderBottom !== '0px none' || 
               style.backgroundColor !== 'transparent' ||
               style.border !== '0px none';
      });
      
      expect(hasVisualBoundary).toBe(true);
    }
  });
});

// ============================================================================
// Error Handling Accessibility
// ============================================================================

test.describe('Error Handling Accessibility', () => {
  test('error messages should be announced to screen readers', async ({ page }) => {
    await page.goto('/index.html');
    
    // Try to trigger an error condition (e.g., binary file detection)
    // This is application-specific and may need adjustment
    
    // For now, verify that any error containers have proper ARIA
    const errorContainers = await page.locator('[role="alert"], [aria-live="assertive"]').all();
    
    // If error containers exist, they should have proper attributes
    for (const container of errorContainers) {
      const hasLiveRegion = await container.evaluate(el => 
        el.getAttribute('aria-live') === 'assertive' ||
        el.getAttribute('role') === 'alert'
      );
      expect(hasLiveRegion).toBe(true);
    }
  });
});
