import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "node_modules",
      ".next",
      "src/db/__tests__/**",
      "src/db/repositories/__tests__/**",
      "src/__tests__/integration/**",
      "src/__tests__/seed.test.ts",
      "src/__tests__/auth.test.ts",
      "src/__tests__/auth-functions.test.ts",
      "src/lib/wiki/__tests__/**",
      "src/mastra/tools/datasource/__tests__/datasource-tools.test.ts",
      "src/__tests__/unit/tools/datasource-query-enhanced.test.ts",
      "src/__tests__/providers.test.ts",
      "src/lib/models.test.ts",
      "src/mastra/agents/**",
      "src/app/api/__tests__/rbac-models.test.ts",
      "src/mastra/tools/datasource/__tests__/datasource-tool.test.ts",
      "src/lib/schema/build-context.test.ts",
      "src/mastra/tools/cross-source/__tests__/batch-query.test.ts",
      "src/__tests__/wiki-schema-extended.test.ts",
      "src/__tests__/wiki-tools-extended.test.ts",
      "src/__tests__/operations-api.test.ts",
      "src/mastra/tools/wiki/__tests__/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
