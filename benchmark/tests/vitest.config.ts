import { defineConfig } from "vitest/config";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read BASE_URL from .env.test if it exists, fallback to env var or default
let baseUrl = process.env.BASE_URL ?? "http://localhost:3097";
try {
  const envContent = readFileSync(resolve(__dirname, ".env.test"), "utf-8");
  const match = envContent.match(/^BASE_URL=(.+)$/m);
  if (match) baseUrl = match[1].trim();
} catch {
  // .env.test doesn't exist, use default
}

export default defineConfig({
  define: {
    "import.meta.env.BASE_URL_OVERRIDE": JSON.stringify(baseUrl),
  },
  test: {
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
