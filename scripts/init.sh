#!/bin/bash

# Inventory App - Initialization and Testing Script
# ===================================================
# This script guides you through server startup and testing with Playwright MCP

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Banner
echo -e "${GREEN}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Inventory App - Grocery Management System                ║
║   Initialization & Testing Guide                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Step 1: Environment Check
print_header "Step 1: Environment Check"

if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_info "Creating .env from .env.example..."

    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Please edit .env and add your Airtable credentials:"
        print_info "  - VITE_AIRTABLE_API_KEY"
        print_info "  - VITE_AIRTABLE_BASE_ID"
        echo ""
        read -p "Press Enter when you've updated .env..."
    else
        print_error ".env.example not found. Creating template..."
        cat > .env << 'ENVFILE'
# Airtable Configuration
VITE_AIRTABLE_API_KEY=your_api_key_here
VITE_AIRTABLE_BASE_ID=your_base_id_here

# Optional: Backend Proxy (Post-MVP)
# VITE_BACKEND_PROXY_URL=
# VITE_PROXY_AUTH_TOKEN=
ENVFILE
        print_warning "Please edit .env and add your credentials, then run this script again."
        exit 1
    fi
else
    print_success ".env file exists"
fi

# Check if credentials are set
if grep -q "your_api_key_here" .env || grep -q "your_base_id_here" .env; then
    print_error "Airtable credentials not set in .env!"
    print_info "Please update VITE_AIRTABLE_API_KEY and VITE_AIRTABLE_BASE_ID"
    exit 1
fi

print_success "Environment variables configured"

# Step 2: Dependencies Check
print_header "Step 2: Dependencies Check"

if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    pnpm install
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

# Step 3: TypeScript Check
print_header "Step 3: TypeScript Validation"

print_info "Running TypeScript compiler..."
if pnpm exec tsc -b --noEmit; then
    print_success "TypeScript compilation successful (no errors)"
else
    print_error "TypeScript errors found. Please fix before proceeding."
    exit 1
fi

# Step 4: Build Check
print_header "Step 4: Production Build Check"

print_info "Building for production..."
if pnpm run build; then
    print_success "Production build successful"
else
    print_error "Build failed. Please fix errors before proceeding."
    exit 1
fi

# Step 5: Development Server
print_header "Step 5: Development Server"

print_info "Starting development server..."
print_warning "The dev server will start on http://localhost:5173"
print_info ""
print_info "To test with Playwright MCP:"
print_info "  1. Open another terminal"
print_info "  2. Use Claude Code with Playwright MCP enabled"
print_info "  3. Run test scenarios from feature_list.json"
print_info ""
print_info "Example Claude prompt:"
print_info '  "Test the barcode scanning feature at http://localhost:5173"'
print_info ""
print_warning "Press Ctrl+C to stop the server when done testing"
echo ""

# Start dev server
pnpm run dev

# Note: The script will wait here until user stops the dev server with Ctrl+C

# Cleanup message (shown after Ctrl+C)
echo ""
print_header "Post-Testing Checklist"
print_info "After testing, ensure you:"
print_info "  1. Mark tested features in feature_list.json"
print_info "  2. Update claude-progress.md with results"
print_info "  3. Commit changes to git:"
print_info "     git add ."
print_info "     git commit -m 'test: Complete testing for [feature name]'"
print_info "  4. Ensure project is in merge-ready state"
echo ""
print_success "Testing session complete!"
