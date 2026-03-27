import { defineConfig } from "vite-plus/pack";

export default defineConfig({
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
});
