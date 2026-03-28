import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  pack: {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    clean: true,
    sourcemap: true,
    deps: {
      neverBundle: ['effector'],
    },
    dts: {
      tsgo: true,
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['dist/**', 'examples/**', 'node_modules/**'],
    pool: 'threads',
  },
  lint: {
    ignorePatterns: ['dist/**', 'examples/**', 'node_modules/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ['dist/**', 'examples/**', 'node_modules/**'],
    semi: false,
    singleQuote: true,
    jsxSingleQuote: true,
  },
})
