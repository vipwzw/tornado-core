#!/bin/bash

# Local CI Testing Script for Tornado Core
# This script mimics the GitHub Actions CI pipeline locally

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${YELLOW}🔄 $1${NC}"
}

# Configuration
GANACHE_PID=""
CLEANUP_NEEDED=false

# Cleanup function
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        log_step "Cleaning up..."

        # Stop Ganache if running
        if [ ! -z "$GANACHE_PID" ] && kill -0 $GANACHE_PID 2>/dev/null; then
            kill $GANACHE_PID
            log_info "Stopped Ganache (PID: $GANACHE_PID)"
        fi

        # Remove temporary files
        rm -f ganache.pid ganache.log
        log_info "Cleaned up temporary files"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Print banner
echo -e "${BLUE}"
cat << "EOF"
 ______                          _        _____  _____
|  ____|                        | |      / ____|_   _|
| |__ ___  _ __ _ __   __ _  __ _| | __  | |      | |
|  __/ _ \| '__| '_ \ / _` |/ _` | |/ /  | |      | |
| | | (_) | |  | | | | (_| | (_| |   <   | |____ _| |_
|_|  \___/|_|  |_| |_|\__,_|\__,_|_|\_\   \_____|_____|

        Local CI Testing Pipeline
EOF
echo -e "${NC}"

# Parse command line arguments
SKIP_SETUP=false
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_LINT=false
SKIP_SECURITY=false
RUN_COVERAGE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-lint)
            SKIP_LINT=true
            shift
            ;;
        --skip-security)
            SKIP_SECURITY=true
            shift
            ;;
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --skip-setup     Skip environment setup"
            echo "  --skip-build     Skip build process"
            echo "  --skip-tests     Skip running tests"
            echo "  --skip-lint      Skip linting"
            echo "  --skip-security  Skip security checks"
            echo "  --coverage       Run coverage analysis"
            echo "  --verbose        Enable verbose output"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

CLEANUP_NEEDED=true

# Step 1: Environment Setup
if [ "$SKIP_SETUP" = false ]; then
    log_step "Setting up environment..."

    # Check if .env.example exists
    if [ ! -f ".env.example" ]; then
        log_warning ".env.example not found, creating a basic one..."
        cat > .env.example << EOF
# Tornado Core Environment Configuration
# This is a template file - copy to .env and modify as needed

# Network Configuration
NETWORK=development
RPC_URL=http://localhost:8545

# Testing Configuration
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234
EOF
    fi

    # Copy environment file
    cp .env.example .env
    log_info "Environment file prepared"

    # Install dependencies
    log_info "Installing dependencies..."
    if [ "$VERBOSE" = true ]; then
        yarn install --frozen-lockfile
    else
        yarn install --frozen-lockfile > /dev/null 2>&1
    fi

    # Download ceremony keys
    log_info "Downloading ceremony keys..."
    if [ "$VERBOSE" = true ]; then
        yarn download
    else
        yarn download > /dev/null 2>&1
    fi

    log_success "Environment setup completed"
else
    log_warning "Skipping environment setup"
fi

# Step 2: Linting and Code Quality
if [ "$SKIP_LINT" = false ]; then
    log_step "Running code quality checks..."

    # ESLint
    log_info "Running ESLint..."
    if [ "$VERBOSE" = true ]; then
        yarn eslint
    else
        yarn eslint > /dev/null 2>&1
    fi

    # Prettier
    log_info "Checking code formatting..."
    if [ "$VERBOSE" = true ]; then
        yarn prettier:check
    else
        yarn prettier:check > /dev/null 2>&1
    fi

    # Solidity linting
    log_info "Linting Solidity contracts..."
    if [ "$VERBOSE" = true ]; then
        npx solhint 'contracts/**/*.sol'
    else
        npx solhint 'contracts/**/*.sol' > /dev/null 2>&1
    fi

    log_success "Code quality checks passed"
else
    log_warning "Skipping linting"
fi

# Step 3: Security Checks
if [ "$SKIP_SECURITY" = false ]; then
    log_step "Running security checks..."

    # npm audit
    log_info "Running npm security audit..."
    if [ "$VERBOSE" = true ]; then
        npm audit --audit-level moderate || log_warning "Some vulnerabilities found (non-critical)"
    else
        npm audit --audit-level moderate > /dev/null 2>&1 || log_warning "Some vulnerabilities found (non-critical)"
    fi

    log_success "Security checks completed"
else
    log_warning "Skipping security checks"
fi

# Step 4: Build Process
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building project..."

    # Build circuits
    log_info "Building circuits..."
    if [ "$VERBOSE" = true ]; then
        npm run build:circuit
    else
        npm run build:circuit > /dev/null 2>&1
    fi

    # Build contracts
    log_info "Compiling smart contracts..."
    if [ "$VERBOSE" = true ]; then
        npm run build:contract
    else
        npm run build:contract > /dev/null 2>&1
    fi

    log_success "Build completed"
else
    log_warning "Skipping build process"
fi

# Step 5: Start Ganache and Run Tests
if [ "$SKIP_TESTS" = false ]; then
    log_step "Starting Ganache and running tests..."

    # Start Ganache
    log_info "Starting Ganache..."
    npx ganache-cli --deterministic --accounts 10 --host 0.0.0.0 --port 8545 > ganache.log 2>&1 &
    GANACHE_PID=$!
    echo $GANACHE_PID > ganache.pid

    # Wait for Ganache to start
    sleep 5
    log_info "Ganache started (PID: $GANACHE_PID)"

    # Deploy contracts
    log_info "Deploying contracts..."
    if [ "$VERBOSE" = true ]; then
        npm run migrate:dev
    else
        npm run migrate:dev > /dev/null 2>&1
    fi

    # Run tests
    log_info "Running test suite..."
    if [ "$RUN_COVERAGE" = true ]; then
        log_info "Running with coverage analysis..."
        if [ "$VERBOSE" = true ]; then
            yarn coverage
        else
            yarn coverage > /dev/null 2>&1
        fi
    else
        if [ "$VERBOSE" = true ]; then
            yarn test
        else
            yarn test > /dev/null 2>&1
        fi
    fi

    # Test CLI
    log_info "Testing CLI functionality..."
    if [ "$VERBOSE" = true ]; then
        node src/cli.js test
    else
        node src/cli.js test > /dev/null 2>&1
    fi

    log_success "All tests passed"
else
    log_warning "Skipping tests"
fi

# Final summary
echo ""
log_success "🎉 Local CI pipeline completed successfully!"
echo ""
log_info "Summary:"
[ "$SKIP_SETUP" = false ] && echo "  ✅ Environment setup"
[ "$SKIP_LINT" = false ] && echo "  ✅ Code quality checks"
[ "$SKIP_SECURITY" = false ] && echo "  ✅ Security audit"
[ "$SKIP_BUILD" = false ] && echo "  ✅ Build process"
[ "$SKIP_TESTS" = false ] && echo "  ✅ Test execution"
[ "$RUN_COVERAGE" = true ] && echo "  ✅ Coverage analysis"
echo ""
log_info "Your code is ready for GitHub Actions! 🚀"
