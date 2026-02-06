# Arbor Desktop App

The Arbor desktop app is a Tauri v2 application that wraps the Next.js web app in a native window and manages the backend services automatically.

## Features

- **Automatic Service Management**: Starts Docker services (PostgreSQL, Redis, API, Web) on app launch
- **Native Window**: Runs the Next.js app in a native window using Tauri
- **Clean Shutdown**: Stops all services when you quit the app
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Architecture

```
┌─────────────────────────────────────┐
│   Tauri Desktop App (Rust)          │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  WebView (Next.js App)        │ │
│  │  http://app.arbor.local       │ │
│  └───────────────────────────────┘ │
│                                     │
│  Service Manager:                  │
│  - Starts: make up                 │
│  - Stops: make down                │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Docker Services                   │
│  - PostgreSQL (pgvector)            │
│  - Redis                            │
│  - API Server (Fastify + tRPC)      │
│  - Web App (Next.js)                │
│  - pgAdmin                          │
└─────────────────────────────────────┘
```

## Development

### Prerequisites

- Rust (install from https://rustup.rs/)
- Node.js 20+
- pnpm 8+
- Docker Desktop

### Running the Desktop App

From the project root:

```bash
make desktop
```

Or using pnpm:

```bash
pnpm run dev:desktop
```

This will:
1. Start the Tauri development server
2. Automatically run `make up` to start Docker services
3. Wait for services to be ready (~10 seconds)
4. Open the app window with the Next.js app loaded

### Building for Production

```bash
make desktop-build
```

Or:

```bash
pnpm run build:desktop
```

This creates a native installer for your platform in `apps/desktop/src-tauri/target/release/bundle/`.

## How It Works

### Startup Sequence

1. **Tauri App Launches**: The Rust application starts
2. **Service Manager Initializes**: Creates a service manager to track Docker processes
3. **Start Services**: Runs `make up` from the project root
4. **Wait for Ready**: Waits 10 seconds for services to start and be healthy
5. **Load WebView**: Opens the window and loads `http://app.arbor.local`

### Shutdown Sequence

1. **Window Close Event**: User closes the app window
2. **Stop Services**: Runs `make down` to stop all Docker containers
3. **Cleanup**: Clears process handles
4. **Exit**: App terminates

## Configuration

The Tauri configuration is in `src-tauri/tauri.conf.json`:

- **Window Size**: 1400x900 (default)
- **Dev URL**: `http://app.arbor.local`
- **Build Output**: `../../web/dist` (Next.js static export)

## Troubleshooting

### Services Don't Start

If the services fail to start, check:

1. Docker Desktop is running
2. No port conflicts (5432, 6379, 3000, 3001, 5050)
3. Run `make up` manually to see error messages

### WebView Shows Error

If the webview shows an error:

1. Wait a few more seconds for services to be ready
2. Check that `http://app.arbor.local` works in your browser
3. Verify Traefik is routing correctly: `docker ps | grep traefik`

### App Won't Build

If the build fails:

1. Ensure Rust is installed: `rustc --version`
2. Update Rust: `rustup update`
3. Clean and rebuild: `cd apps/desktop && make clean && make build`

## Icons

To generate app icons, place a 1024x1024 PNG icon in the project root and run:

```bash
pnpm tauri icon icon.png
```

This will generate all required icon sizes for macOS, Windows, and Linux.

## Next Steps

Once the desktop app is working, you can:

1. Build the UX in Next.js (the app will hot-reload)
2. Add Tauri commands to expose native functionality
3. Implement file system access for local-first storage
4. Add system tray integration
5. Implement auto-updates

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri v2 Guide](https://v2.tauri.app/start/)
- [Tauri API Reference](https://v2.tauri.app/reference/)

