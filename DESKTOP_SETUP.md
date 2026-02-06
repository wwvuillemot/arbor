# Arbor Desktop App Setup

This guide will help you set up and run the Arbor desktop app.

## Prerequisites

### 1. Install Rust

The Tauri desktop app requires Rust. Install it from [rustup.rs](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal and verify:

```bash
rustc --version
cargo --version
```

### 2. Install System Dependencies

#### macOS

```bash
xcode-select --install
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### Windows

Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

### 3. Install Node.js Dependencies

From the project root:

```bash
pnpm install
```

This will install the Tauri CLI and all other dependencies.

## Running the Desktop App

### Option 1: Using Make (Recommended)

```bash
make desktop
```

### Option 2: Using pnpm

```bash
pnpm run dev:desktop
```

### What Happens

1. **Tauri starts**: The Rust application compiles and starts
2. **Services start**: Docker containers are launched automatically
3. **App opens**: A native window opens with the Next.js app

The first run will take longer as Rust dependencies are compiled.

## Building for Production

To create a distributable app:

```bash
make desktop-build
```

The installer will be in `apps/desktop/src-tauri/target/release/bundle/`:

- **macOS**: `.dmg` and `.app` files
- **Windows**: `.msi` and `.exe` files
- **Linux**: `.deb`, `.AppImage`, and other formats

## Troubleshooting

### "Rust not found"

Make sure Rust is installed and in your PATH:

```bash
rustc --version
```

If not found, restart your terminal or run:

```bash
source $HOME/.cargo/env
```

### "Docker not running"

The desktop app requires Docker to be running. Start Docker Desktop and try again.

### "Port already in use"

If you see port conflict errors, stop any running services:

```bash
make down
```

Then try running the desktop app again.

### Compilation Errors

If you see Rust compilation errors, try:

```bash
# Update Rust
rustup update

# Clean and rebuild
cd apps/desktop/src-tauri
cargo clean
cd ../../..
make desktop
```

## Next Steps

Once the desktop app is running:

1. The app window will open automatically
2. Wait ~10 seconds for services to be ready
3. The Next.js app will load at `http://app.arbor.local`
4. Start building the UX!

When you close the app, all services will shut down automatically.

## Development Workflow

### Hot Reload

The desktop app supports hot reload:

1. Run `make desktop`
2. Edit files in `apps/web/src/`
3. Changes will reload automatically in the app window

### Debugging

To see console output:

- **macOS/Linux**: Check the terminal where you ran `make desktop`
- **Windows**: Check the terminal or use the DevTools (F12)

### DevTools

Press `F12` or `Cmd+Option+I` (macOS) to open the browser DevTools.

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Arbor Desktop README](apps/desktop/README.md)

