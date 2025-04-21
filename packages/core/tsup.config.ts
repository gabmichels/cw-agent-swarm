import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  // Instead of type checking, we'll rely on the separate check-types script
  // https://tsup.egoist.dev/#disable-type-checking
  onSuccess: 'echo "Build completed without type checking"',
}); 