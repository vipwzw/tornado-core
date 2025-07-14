# Makefile for Tornado Core Local CI
# Provides convenient commands for running CI tasks locally

.PHONY: help setup ci ci-quick ci-coverage lint test build clean docker-ci act-test hooks install
.DEFAULT_GOAL := help

# Colors for output
YELLOW := \033[1;33m
GREEN := \033[0;32m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Tornado Core Local CI Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Quick Start:$(NC)"
	@echo "  make install        # Complete first-time setup"
	@echo "  make status         # Check environment status"
	@echo "  make diagnose       # Diagnose common issues"
	@echo ""
	@echo "$(BLUE)Development Workflow:$(NC)"
	@echo "  make check          # Quick check before commit"
	@echo "  make ci             # Full CI pipeline"
	@echo "  make docker-ci      # Test in Docker"
	@echo "  make act-test       # Local GitHub Actions"
	@echo ""
	@echo "$(BLUE)Troubleshooting:$(NC)"
	@echo "  make diagnose       # Auto-diagnose issues"
	@echo "  make clean          # Clean temporary files"
	@echo "  make emergency-clean # Nuclear option"

setup: ## Install dependencies and setup environment
	@echo "$(YELLOW)🔧 Setting up development environment...$(NC)"
	@echo "$(BLUE)Checking prerequisites...$(NC)"
	@if ! command -v node >/dev/null 2>&1; then \
		echo "$(RED)❌ Node.js is not installed. Please install Node.js first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Node.js: $$(node --version)$(NC)"
	@if ! command -v npm >/dev/null 2>&1; then \
		echo "$(RED)❌ npm is not installed. Please install npm first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)npm: $$(npm --version)$(NC)"
	@if command -v yarn >/dev/null 2>&1; then \
		echo "$(BLUE)yarn: $$(yarn --version)$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  yarn not found, will use npm instead$(NC)"; \
	fi
	@echo "$(BLUE)Setting up environment and installing dependencies...$(NC)"
	@npm run ci:setup || (echo "$(RED)❌ Setup failed. Trying alternative method...$(NC)" && $(MAKE) setup-fallback)
	@chmod +x scripts/*.sh 2>/dev/null || echo "$(YELLOW)⚠️  No script files to make executable$(NC)"
	@echo "$(GREEN)✅ Setup completed!$(NC)"

setup-fallback: ## Fallback setup method
	@echo "$(YELLOW)🔄 Running fallback setup...$(NC)"
	@echo "$(BLUE)Creating environment file...$(NC)"
	@if [ ! -f .env.example ]; then \
		echo "NETWORK=development" > .env.example; \
		echo "RPC_URL=http://localhost:8545" >> .env.example; \
		echo "PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234" >> .env.example; \
	fi
	@cp .env.example .env 2>/dev/null || echo "Environment file created"
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@if command -v yarn >/dev/null 2>&1; then \
		yarn install || npm install; \
	else \
		npm install; \
	fi
	@echo "$(BLUE)Downloading keys (optional)...$(NC)"
	@yarn download 2>/dev/null || npm run download 2>/dev/null || echo "$(YELLOW)⚠️  Key download failed, continuing...$(NC)"

install: setup hooks ## Complete installation (setup + git hooks)
	@echo "$(GREEN)🎉 Tornado Core development environment ready!$(NC)"

hooks: ## Install Git pre-commit hooks
	@echo "$(YELLOW)🔧 Installing Git hooks...$(NC)"
	@./scripts/setup-git-hooks.sh

ci: ## Run full CI pipeline locally
	@echo "$(YELLOW)🚀 Running full CI pipeline...$(NC)"
	@./scripts/local-ci.sh --verbose

ci-quick: ## Run quick CI checks (lint + security)
	@echo "$(YELLOW)⚡ Running quick CI checks...$(NC)"
	@./scripts/local-ci.sh --skip-setup --skip-build --skip-tests

ci-coverage: ## Run CI with coverage analysis
	@echo "$(YELLOW)📊 Running CI with coverage...$(NC)"
	@./scripts/local-ci.sh --coverage

ci-silent: ## Run CI without verbose output
	@echo "$(YELLOW)🤫 Running silent CI...$(NC)"
	@./scripts/local-ci.sh

lint: ## Run linting and code formatting checks
	@echo "$(YELLOW)📝 Running linting...$(NC)"
	@npm run ci:lint

test: ## Run test suite only
	@echo "$(YELLOW)🧪 Running tests...$(NC)"
	@npm run ci:ganache:start
	@npm run migrate:dev
	@npm test
	@npm run ci:ganache:stop

build: ## Build circuits and contracts
	@echo "$(YELLOW)🔨 Building project...$(NC)"
	@npm run ci:build

clean: ## Clean build artifacts and temporary files
	@echo "$(YELLOW)🧹 Cleaning up...$(NC)"
	@rm -rf build/
	@rm -f ganache.pid ganache.log
	@rm -f *.sol
	@rm -f .env
	@echo "$(GREEN)✅ Cleanup completed!$(NC)"

docker-ci: ## Run CI in Docker (like GitHub Actions)
	@echo "$(YELLOW)🐳 Running CI in Docker...$(NC)"
	@docker-compose up --build tornado-ci

docker-performance: ## Run performance tests in Docker
	@echo "$(YELLOW)⚡ Running performance tests in Docker...$(NC)"
	@docker-compose up --build performance-test

act-test: ## Test GitHub Actions locally with act
	@echo "$(YELLOW)🎭 Testing GitHub Actions locally...$(NC)"
	@if ! command -v act >/dev/null 2>&1; then \
		echo "$(RED)❌ 'act' is not installed. Install it from: https://github.com/nektos/act$(NC)"; \
		echo "$(BLUE)💡 Alternative: Use 'make docker-ci' instead$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Setting up act configuration...$(NC)"
	@if [ ! -f .actrc ]; then \
		echo "$(YELLOW)⚠️  .actrc not found, creating default configuration...$(NC)"; \
		echo "--artifact-server-path /tmp/artifacts" > .actrc; \
		echo "-P ubuntu-latest=catthehacker/ubuntu:runner-latest" >> .actrc; \
		echo "--env ACT=true" >> .actrc; \
	fi
	@echo "$(BLUE)Running local GitHub Actions test...$(NC)"
	@if [ -f .github/workflows/local-test.yml ]; then \
		act -W .github/workflows/local-test.yml --container-daemon-socket unix:///var/run/docker.sock || \
		(echo "$(YELLOW)⚠️  Act test failed, trying simplified version...$(NC)" && $(MAKE) act-simple); \
	else \
		echo "$(YELLOW)⚠️  Local test workflow not found, using main workflow...$(NC)"; \
		act -j test --container-daemon-socket unix:///var/run/docker.sock || \
		(echo "$(RED)❌ Act test failed. See troubleshooting below:$(NC)" && $(MAKE) act-troubleshoot); \
	fi

act-simple: ## Run simplified act test (no external dependencies)
	@echo "$(BLUE)🎭 Running simplified act test...$(NC)"
	@echo "$(YELLOW)Note: This runs a minimal test to verify act functionality$(NC)"
	@act --list || echo "$(RED)Act is having issues. Try 'make docker-ci' instead$(NC)"

act-troubleshoot: ## Show troubleshooting information for act
	@echo "$(YELLOW)🔧 Act Troubleshooting Guide:$(NC)"
	@echo ""
	@echo "$(BLUE)Common issues and solutions:$(NC)"
	@echo "1. $(YELLOW)Authentication errors:$(NC) Normal for local testing, use 'make docker-ci'"
	@echo "2. $(YELLOW)Docker issues:$(NC) Ensure Docker is running: 'docker ps'"
	@echo "3. $(YELLOW)Large images:$(NC) Act downloads large images on first run"
	@echo "4. $(YELLOW)Network timeouts:$(NC) Check internet connection"
	@echo ""
	@echo "$(BLUE)Alternative commands:$(NC)"
	@echo "  make docker-ci      # Run full CI in Docker"
	@echo "  make ci             # Run CI scripts locally"
	@echo "  make check          # Quick local checks"
	@echo ""
	@echo "$(BLUE)Act status:$(NC)"
	@act --version 2>/dev/null || echo "Act version check failed"
	@docker --version 2>/dev/null || echo "Docker not available"

act-security: ## Run security workflow locally with act
	@echo "$(YELLOW)🔒 Testing security workflow locally...$(NC)"
	@if command -v act >/dev/null 2>&1; then \
		act -j security --container-daemon-socket unix:///var/run/docker.sock || \
		echo "$(YELLOW)⚠️  Security workflow test failed$(NC)"; \
	else \
		echo "$(RED)❌ 'act' is not installed. Install it from: https://github.com/nektos/act$(NC)"; \
	fi

act-lint: ## Run lint workflow locally with act
	@echo "$(YELLOW)📝 Testing lint workflow locally...$(NC)"
	@if command -v act >/dev/null 2>&1; then \
		act -j lint --container-daemon-socket unix:///var/run/docker.sock || \
		echo "$(YELLOW)⚠️  Lint workflow test failed$(NC)"; \
	else \
		echo "$(RED)❌ 'act' is not installed. Install it from: https://github.com/nektos/act$(NC)"; \
	fi

status: ## Show current environment status
	@echo "$(BLUE)📊 Environment Status:$(NC)"
	@echo "Node.js: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "npm: $$(npm --version 2>/dev/null || echo 'Not installed')"
	@echo "yarn: $$(yarn --version 2>/dev/null || echo 'Not installed')"
	@echo "Docker: $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo "act: $$(act --version 2>/dev/null || echo 'Not installed')"
	@echo ""
	@if [ -f ".env" ]; then echo "$(GREEN)✅ Environment file exists$(NC)"; else echo "$(RED)❌ Environment file missing$(NC)"; fi
	@if [ -f ".env.example" ]; then echo "$(GREEN)✅ Environment template exists$(NC)"; else echo "$(RED)❌ Environment template missing$(NC)"; fi
	@if [ -d "node_modules" ]; then echo "$(GREEN)✅ Dependencies installed$(NC)"; else echo "$(RED)❌ Dependencies not installed$(NC)"; fi
	@if [ -f "package.json" ]; then echo "$(GREEN)✅ Package.json exists$(NC)"; else echo "$(RED)❌ Package.json missing$(NC)"; fi
	@if [ -f "yarn.lock" ]; then echo "$(GREEN)✅ Yarn lockfile exists$(NC)"; elif [ -f "package-lock.json" ]; then echo "$(GREEN)✅ NPM lockfile exists$(NC)"; else echo "$(YELLOW)⚠️  No lockfile found$(NC)"; fi
	@if [ -f ".git/hooks/pre-commit" ]; then echo "$(GREEN)✅ Git hooks installed$(NC)"; else echo "$(RED)❌ Git hooks not installed$(NC)"; fi
	@if [ -d "build" ]; then echo "$(GREEN)✅ Build directory exists$(NC)"; else echo "$(YELLOW)⚠️  Build directory missing$(NC)"; fi
	@if [ -f ".actrc" ]; then echo "$(GREEN)✅ Act configuration exists$(NC)"; else echo "$(YELLOW)⚠️  Act configuration missing$(NC)"; fi

diagnose: ## Diagnose common issues and provide solutions
	@echo "$(BLUE)🔍 Diagnosing Environment Issues...$(NC)"
	@echo ""
	@echo "$(YELLOW)Checking for common problems:$(NC)"
	@echo ""

	@echo "$(BLUE)1. Node.js and npm:$(NC)"
	@if ! command -v node >/dev/null 2>&1; then \
		echo "$(RED)❌ Node.js not found$(NC)"; \
		echo "$(YELLOW)💡 Solution: Install Node.js from https://nodejs.org$(NC)"; \
	else \
		echo "$(GREEN)✅ Node.js found: $$(node --version)$(NC)"; \
	fi

	@if ! command -v npm >/dev/null 2>&1; then \
		echo "$(RED)❌ npm not found$(NC)"; \
		echo "$(YELLOW)💡 Solution: npm usually comes with Node.js$(NC)"; \
	else \
		echo "$(GREEN)✅ npm found: $$(npm --version)$(NC)"; \
	fi
	@echo ""

	@echo "$(BLUE)2. Package manager:$(NC)"
	@if command -v yarn >/dev/null 2>&1; then \
		echo "$(GREEN)✅ yarn found: $$(yarn --version)$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  yarn not found, using npm$(NC)"; \
		echo "$(YELLOW)💡 Optional: Install yarn with 'npm install -g yarn'$(NC)"; \
	fi
	@echo ""

	@echo "$(BLUE)3. Docker and act:$(NC)"
	@if command -v docker >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Docker found: $$(docker --version)$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  Docker not found$(NC)"; \
		echo "$(YELLOW)💡 Install Docker for local container testing$(NC)"; \
	fi

	@if command -v act >/dev/null 2>&1; then \
		echo "$(GREEN)✅ act found: $$(act --version)$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  act not found$(NC)"; \
		echo "$(YELLOW)💡 Install act for GitHub Actions testing: https://github.com/nektos/act$(NC)"; \
	fi
	@echo ""

	@echo "$(BLUE)4. Project files:$(NC)"
	@if [ ! -f "package.json" ]; then \
		echo "$(RED)❌ package.json missing$(NC)"; \
		echo "$(YELLOW)💡 Solution: You might not be in the project directory$(NC)"; \
	else \
		echo "$(GREEN)✅ package.json found$(NC)"; \
	fi

	@if [ ! -f ".env.example" ]; then \
		echo "$(YELLOW)⚠️  .env.example missing$(NC)"; \
		echo "$(YELLOW)💡 Solution: Will be created automatically$(NC)"; \
	else \
		echo "$(GREEN)✅ .env.example found$(NC)"; \
	fi
	@echo ""

	@echo "$(BLUE)5. Lockfile issues:$(NC)"
	@if [ -f "yarn.lock" ] && [ -f "package-lock.json" ]; then \
		echo "$(YELLOW)⚠️  Both yarn.lock and package-lock.json exist$(NC)"; \
		echo "$(YELLOW)💡 Solution: Choose one package manager and delete the other lockfile$(NC)"; \
	else \
		echo "$(GREEN)✅ No conflicting lockfiles$(NC)"; \
	fi
	@echo ""

	@echo "$(BLUE)6. Recommended next steps:$(NC)"
	@if [ ! -d "node_modules" ]; then \
		echo "$(YELLOW)📦 Run: make setup$(NC)"; \
	fi
	@if [ ! -f ".git/hooks/pre-commit" ]; then \
		echo "$(YELLOW)🪝 Run: make hooks$(NC)"; \
	fi
	@if [ ! -f ".env" ]; then \
		echo "$(YELLOW)⚙️  Run: make setup$(NC)"; \
	fi
	@if [ ! -f ".actrc" ]; then \
		echo "$(YELLOW)🎭 Run: make act-test$(NC)"; \
	fi

validate: ## Validate local environment is ready for CI
	@echo "$(YELLOW)🔍 Validating environment...$(NC)"
	@./scripts/local-ci.sh --skip-tests --skip-coverage
	@echo "$(GREEN)✅ Environment validation completed!$(NC)"

# Development shortcuts
dev: setup ## Setup development environment (alias for setup)

check: ci-quick ## Quick check before commit (alias for ci-quick)

full: ci ## Full CI pipeline (alias for ci)

# Emergency commands
emergency-clean: ## Emergency cleanup (removes all generated files)
	@echo "$(RED)🚨 Emergency cleanup - removing all generated files...$(NC)"
	@rm -rf node_modules/ build/ coverage/ .nyc_output/
	@rm -f ganache.pid ganache.log *.sol .env package-lock.json
	@echo "$(YELLOW)⚠️  You'll need to run 'make setup' after this$(NC)"
