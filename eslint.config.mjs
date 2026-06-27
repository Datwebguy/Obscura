import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      ".reference-anon/**",
      "next-env.d.ts",
      "node_modules/**",
      "public/js/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react/jsx-no-comment-textnodes": "off",
    },
  },
];

export default config;
