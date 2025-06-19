/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "no-case-declarations": "off",
    "no-useless-escape": "off"
  },
  overrides: [
    {
      // Disable TypeScript linter issues for test files
      files: [
        "**/*.test.ts",
        "**/*.test.tsx", 
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/__tests__/**/*.ts",
        "**/__tests__/**/*.tsx"
      ],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/prefer-const": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "prefer-const": "off",
        "no-var": "off"
      }
    }
  ]
}; 