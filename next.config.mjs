/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Signed-in app pages and APIs must not be indexed. Public pages are exempt.
  async headers() {
    return [
      {
        source: "/:path((?!signup$|login$|warranty-lookup$|video$|robots\\.txt$|sitemap\\.xml$|_next/).+)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ]
  },
}

export default nextConfig