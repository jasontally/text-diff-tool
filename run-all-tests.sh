#!/bin/bash
# Run all tests and save output to a file for later analysis
# Usage: ./run-all-tests.sh

# Kill any existing servers on port 8000
lsof -ti :8000 | xargs kill -9 2>/dev/null
sleep 2

# Create timestamp for output file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="test-results/all-tests-${TIMESTAMP}.log"

echo "Starting all tests at $(date)" | tee "$OUTPUT_FILE"
echo "Output will be saved to: $OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Run unit tests first
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "Running unit tests..." | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"
npm test 2>&1 | tee -a "$OUTPUT_FILE"

UNIT_EXIT_CODE=${PIPESTATUS[0]}
echo "" | tee -a "$OUTPUT_FILE"
echo "Unit tests exit code: $UNIT_EXIT_CODE" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Kill any servers that might still be running
lsof -ti :8000 | xargs kill -9 2>/dev/null
sleep 2

# Run E2E tests
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "Running E2E tests..." | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"
npm run test:e2e 2>&1 | tee -a "$OUTPUT_FILE"

E2E_EXIT_CODE=${PIPESTATUS[0]}
echo "" | tee -a "$OUTPUT_FILE"
echo "E2E tests exit code: $E2E_EXIT_CODE" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Summary
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "TEST SUMMARY" | tee -a "$OUTPUT_FILE"
echo "========================================" | tee -a "$OUTPUT_FILE"
echo "Unit tests exit code: $UNIT_EXIT_CODE" | tee -a "$OUTPUT_FILE"
echo "E2E tests exit code: $E2E_EXIT_CODE" | tee -a "$OUTPUT_FILE"
echo "Completed at: $(date)" | tee -a "$OUTPUT_FILE"

# Copy to latest for easy access
cp "$OUTPUT_FILE" "test-results/latest-all-tests.log"

echo "" 
echo "Test output saved to: $OUTPUT_FILE"
echo "Also copied to: test-results/latest-all-tests.log"
