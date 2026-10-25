import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // VS Code previews use the loopback IP even when Next starts on localhost.
  allowedDevOrigins: ['127.0.0.1', '[::1]'],
};
export default nextConfig;
