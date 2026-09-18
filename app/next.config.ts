import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
