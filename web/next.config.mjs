/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "langchain",
    "@langchain/core",
    "@langchain/groq",
    "@langchain/anthropic",
    "@langchain/community",
    "@langchain/langgraph",
    "drizzle-orm",
    "postgres",
    "ioredis",
    "@tavily/core",
    "groq-sdk",
  ],
  // CORS headers for widget
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type,X-Campus-Assist-Key,Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
