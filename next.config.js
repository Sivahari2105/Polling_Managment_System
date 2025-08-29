/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
  // Image optimization
  images: {
    domains: ['bpfmvtjlabaujmlwegxc.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
}

module.exports = nextConfig
