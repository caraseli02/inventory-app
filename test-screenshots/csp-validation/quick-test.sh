#!/bin/bash

# Quick CSP Test Script
# Tests basic functionality and captures console logs

echo "=========================================="
echo "CSP Quick Test - Inventory App"
echo "=========================================="
echo ""

# Check if server is running
echo "1. Checking if dev server is running..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
    echo "   ✓ Server is running at http://localhost:5173"
else
    echo "   ✗ Server is not running. Please run 'pnpm dev' first."
    exit 1
fi

echo ""
echo "2. Server Status: RUNNING"
echo ""
echo "=========================================="
echo "Manual Testing Required"
echo "=========================================="
echo ""
echo "Please open your browser and complete these tests:"
echo ""
echo "TEST 1: Homepage Load"
echo "  • Navigate to http://localhost:5173"
echo "  • Open DevTools Console (F12)"
echo "  • Look for CSP violations or errors"
echo "  • Expected: Zero CSP violations"
echo ""
echo "TEST 2: Font Loading"
echo "  • Open Network tab in DevTools"
echo "  • Filter by 'fonts'"
echo "  • Reload page"
echo "  • Expected: All font requests show Status 200"
echo ""
echo "TEST 3: Service Worker"
echo "  • Open Application tab → Service Workers"
echo "  • Expected: Service Worker is Active"
echo "  • Check Cache Storage for google-fonts-cache"
echo ""
echo "TEST 4: Interactive Features"
echo "  • Click language selector"
echo "  • Navigate to Inventory Management"
echo "  • Click Scan Product"
echo "  • Expected: No console errors"
echo ""
echo "=========================================="
echo "For detailed testing, see:"
echo "  manual-test-guide.md"
echo "=========================================="
echo ""

