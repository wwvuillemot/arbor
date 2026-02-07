# Makefile for Arbor Desktop App (Tauri)

.PHONY: help setup install dev build clean

help:
	@echo "========================================="
	@echo "   Arbor Desktop App (Tauri)"
	@echo "========================================="
	@echo ""
	@echo "Available targets:"
	@echo "  make setup      - Initial setup (install Rust dependencies)"
	@echo "  make dev        - Start Tauri in development mode"
	@echo "  make build      - Build Tauri app for production"
	@echo "  make icon       - Generate app icons from source image"
	@echo "  make clean      - Clean build artifacts"

.PHONY: setup dev build icon clean

setup:
	@echo "Setting up Tauri desktop app..."
	@cd ../.. && pnpm install
	@echo "✅ Setup complete"

dev:
	@echo "Starting Tauri in development mode..."
	@cd ../.. && pnpm tauri dev

build:
	@echo "Building Tauri app for production..."
	@cd ../.. && pnpm tauri build && \
	if [ -d "apps/desktop/src-tauri/target/release/bundle/macos/Arbor.app" ]; then \
		echo "Copying app to ~/Applications..."; \
		cp -r apps/desktop/src-tauri/target/release/bundle/macos/Arbor.app ~/Applications/; \
		echo "✅ Arbor.app copied to ~/Applications/"; \
	else \
		echo "⚠️  macOS app bundle not found. Build may have failed or you're not on macOS."; \
	fi

icon:
	@echo "Generate icons using: pnpm tauri icon path/to/icon.png"
	@echo "Place a 1024x1024 PNG icon in the project root and run:"
	@echo "  cd ../.. && pnpm tauri icon icon.png"

clean:
	@echo "Cleaning Tauri build artifacts..."
	@rm -rf src-tauri/target
	@echo "✅ Clean complete"
	@echo ""

setup: install

install:
	@echo "Installing dependencies for desktop app..."
	@cd ../.. && pnpm install
	@echo "Note: Tauri not yet initialized"

dev:
	@echo "Starting Tauri dev server..."
	@echo "Note: Tauri not yet initialized"

build:
	@echo "Building Tauri app..."
	@echo "Note: Tauri not yet initialized"

clean:
	@echo "Cleaning build artifacts..."
	@echo "Note: Tauri not yet initialized"

