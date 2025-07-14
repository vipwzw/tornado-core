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
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(YELLOW)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Examples:$(NC)"
	@echo "  make setup     # First-time setup"
	@echo "  make ci-quick  # Quick CI check before commit"
	@echo "  make ci        # Full CI pipeline"
	@echo "  make act-test  # Test with GitHub Actions locally"

setup: ## Install dependencies and setup environment
	@echo "$(YELLOW)🔧 Setting up development environment...$(NC)"
	@npm run ci:setup
	@chmod +x scripts/*.sh
	@echo "$(GREEN)✅ Setup completed!$(NC)"

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
	@if command -v act >/dev/null 2>&1; then \
		act -j test; \
	else \
		echo "$(RED)❌ 'act' is not installed. Install it from: https://github.com/nektos/act$(NC)"; \
		echo "$(BLUE)💡 Alternative: Use 'make docker-ci' instead$(NC)"; \
	fi

act-security: ## Run security workflow locally with act
	@echo "$(YELLOW)🔒 Testing security workflow locally...$(NC)"
	@if command -v act >/dev/null 2>&1; then \
		act -j security; \
	else \
		echo "$(RED)❌ 'act' is not installed. Install it from: https://github.com/nektos/act$(NC)"; \
	fi

act-lint: ## Run lint workflow locally with act
	@echo "$(YELLOW)📝 Testing lint workflow locally...$(NC)"
	@if command -v act >/dev/null 2>&1; then \
		act -j lint; \
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
	@if [ -d "node_modules" ]; then echo "$(GREEN)✅ Dependencies installed$(NC)"; else echo "$(RED)❌ Dependencies not installed$(NC)"; fi
	@if [ -f ".git/hooks/pre-commit" ]; then echo "$(GREEN)✅ Git hooks installed$(NC)"; else echo "$(RED)❌ Git hooks not installed$(NC)"; fi

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
