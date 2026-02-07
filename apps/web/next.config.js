/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Enable Turbopack for faster development builds
    turbo: {},
  },
};

// Only use next-intl plugin if @parcel/watcher is available (not in Docker ARM64)
let finalConfig = nextConfig;
try {
  require.resolve("@parcel/watcher");
  const withNextIntl = require("next-intl/plugin")("./next-intl.config.ts");
  finalConfig = withNextIntl(nextConfig);
} catch (e) {
  console.warn(
    "⚠️  @parcel/watcher not available, running without next-intl plugin (translations will still work)",
  );
}

module.exports = finalConfig;
