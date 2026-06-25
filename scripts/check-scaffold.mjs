import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredPaths = [
  "SPEC.md",
  "PLAN.md",
  "README.md",
  "package.json",
  ".gitignore",
  "electron.vite.config.ts",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.web.json",
  "src/main/index.ts",
  "src/preload/index.ts",
  "src/renderer/index.html",
  "src/renderer/src/App.tsx",
  "src/renderer/src/main.tsx",
  "src/renderer/src/styles.css",
  "src/renderer/src/types/window.d.ts",
  "src/shared/preload.ts",
  "tests/.gitkeep"
];

const requiredScripts = ["dev", "check", "test", "build", "package"];
const requiredDependencies = ["lucide-react", "react", "react-dom"];
const requiredDevDependencies = [
  "@vitejs/plugin-react",
  "autoprefixer",
  "electron",
  "electron-vite",
  "postcss",
  "tailwindcss",
  "typescript",
  "vite"
];

async function assertPathExists(relativePath) {
  await access(path.join(root, relativePath));
}

async function readJson(relativePath) {
  const json = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(json);
}

function findMissing(requiredNames, values = {}) {
  return requiredNames.filter((name) => !values[name]);
}

async function main() {
  await Promise.all(requiredPaths.map(assertPathExists));

  const packageJson = await readJson("package.json");
  const missingScripts = findMissing(requiredScripts, packageJson.scripts);
  const missingDependencies = findMissing(
    requiredDependencies,
    packageJson.dependencies
  );
  const missingDevDependencies = findMissing(
    requiredDevDependencies,
    packageJson.devDependencies
  );

  const missing = [
    ...missingScripts.map((name) => `script:${name}`),
    ...missingDependencies.map((name) => `dependency:${name}`),
    ...missingDevDependencies.map((name) => `devDependency:${name}`)
  ];

  if (missing.length > 0) {
    throw new Error(`Missing scaffold entries: ${missing.join(", ")}`);
  }

  console.log("InkNest phase 1 scaffold check passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
