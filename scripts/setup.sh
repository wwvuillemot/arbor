#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Arbor Development Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local cmd=$1
    local min_version=$2
    local current_version=$($cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    
    if [ -z "$current_version" ]; then
        return 1
    fi
    
    # Simple version comparison (works for most cases)
    if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
        return 0
    else
        return 1
    fi
}

# Check and install Homebrew (macOS/Linux)
echo -e "${YELLOW} Checking Homebrew...${NC}"
if ! command_exists brew; then
    echo -e "${RED}✗ Homebrew not found${NC}"
    echo -e "${YELLOW}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo -e "${GREEN}✓ Homebrew installed${NC}"
else
    echo -e "${GREEN}✓ Homebrew found${NC}"
fi

# Check and install Node.js
echo -e "${YELLOW}Checking Node.js (>= 20.0.0)...${NC}"
if ! command_exists node; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "${YELLOW}Installing Node.js via Homebrew...${NC}"
    brew install node@20
    echo -e "${GREEN}✓ Node.js installed${NC}"
elif ! check_version node 20.0.0; then
    echo -e "${RED}✗ Node.js version too old (need >= 20.0.0)${NC}"
    echo -e "${YELLOW}Upgrading Node.js...${NC}"
    brew upgrade node
    echo -e "${GREEN}✓ Node.js upgraded${NC}"
else
    echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"
fi

# Check and install pnpm
echo -e "${YELLOW}Checking pnpm (>= 8.0.0)...${NC}"
if ! command_exists pnpm; then
    echo -e "${RED}✗ pnpm not found${NC}"
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm@latest
    echo -e "${GREEN}✓ pnpm installed${NC}"
elif ! check_version pnpm 8.0.0; then
    echo -e "${RED}✗ pnpm version too old (need >= 8.0.0)${NC}"
    echo -e "${YELLOW}Upgrading pnpm...${NC}"
    npm install -g pnpm@latest
    echo -e "${GREEN}✓ pnpm upgraded${NC}"
else
    echo -e "${GREEN}✓ pnpm $(pnpm --version) found${NC}"
fi

# Check and install Docker
echo -e "${YELLOW}Checking Docker...${NC}"
if ! command_exists docker; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo -e "${YELLOW}Please install Docker Desktop from: https://www.docker.com/products/docker-desktop${NC}"
    echo -e "${YELLOW}After installation, run this setup script again.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Docker found${NC}"
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker daemon is not running${NC}"
        echo -e "${YELLOW}Please start Docker Desktop and run this setup script again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
fi

# Check and install Rust (for Tauri)
echo -e "${YELLOW}Checking Rust...${NC}"

# Source cargo env if it exists (in case Rust is installed but not in PATH)
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

if ! command_exists rustc; then
    echo -e "${RED}✗ Rust not found${NC}"
    echo -e "${YELLOW}Installing Rust...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo -e "${GREEN}✓ Rust installed${NC}"
else
    echo -e "${GREEN}✓ Rust $(rustc --version | cut -d' ' -f2) found${NC}"
fi

# Check and install Tauri CLI
echo -e "${YELLOW}Checking Tauri CLI...${NC}"
if ! command_exists cargo-tauri; then
    echo -e "${RED}✗ Tauri CLI not found${NC}"
    echo -e "${YELLOW}Installing Tauri CLI...${NC}"
    cargo install tauri-cli
    echo -e "${GREEN}✓ Tauri CLI installed${NC}"
else
    echo -e "${GREEN}✓ Tauri CLI found${NC}"
fi

# Install system dependencies for Tauri (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Checking macOS system dependencies...${NC}"
    echo -e "${GREEN}✓ macOS has all required dependencies${NC}"
fi

# Install project dependencies
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Installing Project Dependencies${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Installing npm packages...${NC}"
pnpm install
echo -e "${GREEN}✓ npm packages installed${NC}"

echo -e "${YELLOW}Installing Redis client package...${NC}"
pnpm add redis
echo -e "${GREEN}✓ Redis client installed${NC}"

# Start Docker services
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Starting Docker Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Starting Docker services via make up...${NC}"
make up
echo -e "${GREEN}✓ Docker services started${NC}"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo -e "${YELLOW}Creating .env.local file...${NC}"
    cat > .env.local << EOF
# Database
DATABASE_URL=postgresql://arbor:local_dev_only@localhost:5432/arbor

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI (required for AI features)
OPENAI_API_KEY=

# Optional: Anthropic Claude
ANTHROPIC_API_KEY=

# Optional: Local LLM (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
EOF
    echo -e "${GREEN}✓ .env.local created${NC}"
    echo -e "${YELLOW}⚠ Please add your API keys to .env.local${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}   Setup Complete! 🎉${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Run ${YELLOW}make desktop${NC} to start the Tauri desktop app"
echo -e "  2. Or run ${YELLOW}make dev${NC} to start development servers"
echo -e "  3. Add your API keys to ${YELLOW}.env.local${NC} (optional)"
echo ""
echo -e "Useful commands:"
echo -e "  ${YELLOW}make help${NC}        - Show all available commands"
echo -e "  ${YELLOW}make desktop${NC}     - Start Tauri desktop app"
echo -e "  ${YELLOW}make test${NC}        - Run tests"
echo -e "  ${YELLOW}make down${NC}        - Stop Docker services"
echo ""

