/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@crowd-wisdom/eslint-config/base"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/ban-ts-comment": "warn"
  }
}; 