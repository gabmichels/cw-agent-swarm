export default {
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['cjs', 'esm'],
  dts: false,
  onSuccess: 'echo "Build completed without type checking"',
}; 