import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pact/design-tokens', '@pact/types'],
};

export default config;
