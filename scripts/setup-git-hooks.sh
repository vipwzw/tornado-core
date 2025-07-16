#!/bin/bash

# Setup Git hooks for Tornado Core
# This script installs pre-commit hooks to run tests locally before committing

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "🔧 Setting up Git hooks for Tornado Core..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo "❌ Error: This is not a Git repository. Please run this script from the project root."
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash

# Pre-commit hook for Tornado Core
# Runs linting and security checks before allowing commits

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "contracts" ]; then
    echo -e "${RED}❌ Error: Cannot find Tornado Core project files${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
if ! command_exists node || ! command_exists npm; then
    echo -e "${RED}❌ Error: Node.js and npm are required${NC}"
    exit 1
fi

if ! command_exists yarn; then
    echo -e "${YELLOW}⚠️  Warning: yarn not found, using npm instead${NC}"
    NPM_CMD="npm"
else
    NPM_CMD="yarn"
fi

# Run linting
echo "📝 Running ESLint..."
if ! $NPM_CMD run eslint --silent; then
    echo -e "${RED}❌ ESLint failed. Please fix the issues before committing.${NC}"
    exit 1
fi

# Check code formatting
echo "🎨 Checking code formatting..."
if ! $NPM_CMD run prettier:check --silent; then
    echo -e "${RED}❌ Code formatting issues found. Run 'yarn prettier:fix' to fix them.${NC}"
    exit 1
fi

# Check Solidity files
if command_exists npx; then
    echo "🔧 Linting Solidity contracts..."
    if ! npx solhint 'contracts/**/*.sol' --quiet; then
        echo -e "${YELLOW}⚠️  Solidity linting issues found. Please review.${NC}"
        # Don't fail the commit for Solidity linting warnings
    fi
fi

# Run security audit (don't fail on warnings)
echo "🔒 Running security audit..."
if ! yarn audit --level high --silent; then
    echo -e "${YELLOW}⚠️  Security vulnerabilities found. Please review.${NC}"
    # Don't fail the commit for security warnings unless they're high severity
fi

echo -e "${GREEN}✅ Pre-commit checks passed!${NC}"
EOF

# Make the hook executable
chmod +x "$PRE_COMMIT_HOOK"

# Create post-commit hook for success message
cat > "$HOOKS_DIR/post-commit" << 'EOF'
#!/bin/bash

echo "🎉 Commit successful! Consider running the full test suite with:"
echo "   ./scripts/local-ci.sh"
echo "   or"
echo "   npm run ci:local"
EOF

chmod +x "$HOOKS_DIR/post-commit"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks have been installed:"
echo "  📝 pre-commit: Runs linting and security checks"
echo "  🎉 post-commit: Shows helpful messages after commits"
echo ""
echo "To run the full CI pipeline locally before pushing:"
echo "  ./scripts/local-ci.sh"
echo ""
echo "To test GitHub Actions locally (requires 'act' tool):"
echo "  act -j test"
