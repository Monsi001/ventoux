/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dgalywyr863hv.cloudfront.net',
      },
    ],
  },
}

module.exports = withPWA(nextConfig)
