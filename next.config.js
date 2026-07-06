/** @type {import('next').NextConfig} */
const nextConfig = {
  // API routes run on the Edge runtime for serverless compatibility
  experimental: {
    // Enable if needed for specific features
  },
  // Ensure API routes handle large request bodies for image uploads
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
