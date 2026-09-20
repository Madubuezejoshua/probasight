import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

/**
 * ESLint flat config.
 *
 * `eslint-config-next` 15.x ships only an eslintrc-style config with no flat
 * subpath exports, so it is bridged through `FlatCompat`. Do not "simplify"
 * this to a direct import unless the project moves to Next 16, whose config
 * package does export real flat arrays, and note that Next 16 also enables
 * `react-hooks/set-state-in-effect`, which this codebase does not currently
 * satisfy. See REPORT.md §15 (Bug 20) for the full reasoning.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"],
  },
];

export default eslintConfig;
