import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', '.next', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.d.ts', 'node_modules', 'dist'],
    },
    alias: {
      '@': resolve(__dirname, './src'),
    },
    includeSource: ['src/**/*.ts'],
    typecheck: {
      // Enable type checking for test files
      enabled: true,
      tsconfig: './tsconfig.test.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
}); 