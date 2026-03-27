import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    clean: true,
    sourcemap: true,
    deps: {
      neverBundle: ["effector"],
    },
    dts: {
      tsgo: true,
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["dist/**", "examples/**", "node_modules/**"],
    pool: "threads",
  },
});
