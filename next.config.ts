import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Keeps the conversations the member opened or the list prefetched for 30 seconds, so going
    // back to one is instant, as on WhatsApp. LiveRefresh brings it up to date as it opens.
    staleTimes: { dynamic: 30, static: 30 },
  },
}

export default nextConfig
