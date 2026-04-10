MINDBRAIN_DIR := $(shell pwd)
CLI := bun run $(MINDBRAIN_DIR)/apps/cli/src/index.ts
DAEMON := bash $(MINDBRAIN_DIR)/scripts/daemon.sh
TEST_PROJECT ?= /Users/kev/Documents/lab/sandbox/instant-grep

.PHONY: help install uninstall update start stop status init test-init test-import test-mine test-dashboard test clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────

install: ## Install mb CLI + hooks into Claude Code
	$(CLI) install
	@echo "\n\033[1mDone.\033[0m Run 'make start' to launch the API."

uninstall: ## Uninstall mb from Claude Code
	$(CLI) uninstall -y

uninstall-purge: ## Uninstall + purge all data
	$(CLI) uninstall -y --purge

update: ## Rebuild after code changes (just restart daemon)
	$(DAEMON) restart

# ── Daemon ─────────────────────────────────────────

start: ## Start the API daemon
	$(DAEMON) start

stop: ## Stop the API daemon
	$(DAEMON) stop

restart: ## Restart the API daemon
	$(DAEMON) restart

status: ## Check daemon status
	$(DAEMON) status

logs: ## Tail daemon logs
	$(DAEMON) logs

# ── Test in target project ─────────────────────────

test-init: start ## Init mindbrain in TEST_PROJECT
	cd $(TEST_PROJECT) && $(CLI) init "$$(basename $(TEST_PROJECT))"
	@echo "\n\033[32m✓\033[0m Project initialized. API key in $(TEST_PROJECT)/.mindbrain.json"
	@cat $(TEST_PROJECT)/.mindbrain.json

test-import: ## Import flat-files from ~/.claude into TEST_PROJECT
	cd $(TEST_PROJECT) && $(CLI) import --from flat-files ~/.claude --dry-run
	@echo "\n--- Remove --dry-run to actually import: make test-import-real ---"

test-import-real: ## Import flat-files for real
	cd $(TEST_PROJECT) && $(CLI) import --from flat-files ~/.claude

test-mine: ## Mine Claude Code conversations (dry run)
	cd $(TEST_PROJECT) && $(CLI) mine --from claude-code --dry-run --since 7d

test-mine-real: ## Mine Claude Code conversations for real
	cd $(TEST_PROJECT) && $(CLI) mine --from claude-code --since 7d

test-search: ## Search notes in TEST_PROJECT
	cd $(TEST_PROJECT) && $(CLI) search "test"

test-context: ## Get contextual notes for TEST_PROJECT
	cd $(TEST_PROJECT) && $(CLI) context -t "testing mindbrain"

test-dashboard: start ## Launch the dashboard
	cd $(MINDBRAIN_DIR)/apps/web && bun run dev

test-sources: ## List import sources
	cd $(TEST_PROJECT) && $(CLI) search --type feedback "." 2>/dev/null || echo "Use test-import-real first"

# ── Multi-platform ────────────────────────────────

install-cursor: ## Install Cursor integration
	cd $(TEST_PROJECT) && $(CLI) install --platform cursor

install-all: ## Install all platform integrations
	cd $(TEST_PROJECT) && $(CLI) install --platform all

# ── Cleanup ────────────────────────────────────────

clean: stop ## Stop daemon + remove test project config
	rm -f $(TEST_PROJECT)/.mindbrain.json
	@echo "\033[32m✓\033[0m Cleaned up"

# ── Quick start ────────────────────────────────────

quickstart: install start test-init ## Full setup: install + start + init test project
	@echo "\n\033[1m🎉 Ready! Try:\033[0m"
	@echo "  make test-import     # preview import"
	@echo "  make test-mine       # preview mining"
	@echo "  make test-dashboard  # launch dashboard"
