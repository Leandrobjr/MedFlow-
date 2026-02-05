import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  // Ignora lixo pesado
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
    ],
  },

  // Base JS
  js.configs.recommended,

  // TypeScript (SEM type-check pesado -> poupa RAM)
  ...tseslint.configs.recommended,

  // Regras globais: foco em “não travar o time” agora
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Estratégia: app funcionando > perfeccionismo
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",

      // Regras leves
      "prefer-const": "warn",
    },
  },

  // WEB (Next/React)
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // React/JSX – vira warning pra não bloquear
      "react/no-unescaped-entities": "warn",

      // Next rules (mantém saneado sem travar)
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "warn",
    },
  },

  // API (Node)
  {
    files: ["apps/api/**/*.{js,ts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Backend normalmente tem integrações e DTOs — não bloqueia por tipagem agora
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Shared (lib)
  {
    files: ["packages/shared/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
