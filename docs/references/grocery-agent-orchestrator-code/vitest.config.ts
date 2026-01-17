import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use a separate test database
    env: {
      GROCERY_DB_PATH: ":memory:",
    },
    // Run tests sequentially (SQLite doesn't like parallel writes)
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
