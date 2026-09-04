import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source, not a build step. One less thing
  // to keep in sync while the engine is changing daily.
  transpilePackages: ['@atlas/learning', '@atlas/content'],
  reactStrictMode: true,
  typedRoutes: true,
};

export default config;
