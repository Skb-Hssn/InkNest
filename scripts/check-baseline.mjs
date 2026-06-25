import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredPaths = [
  "SPEC.md",
  "PLAN.md",
  "README.md",
  "package.json",
  ".gitignore",
  "src/main/.gitkeep",
  "src/preload/.gitkeep",
  "src/renderer/.gitkeep",
  "src/shared/.gitkeep",
  "tests/.gitkeep"
];

const requiredScripts = ["dev", "check", "test", "build", "package"];

async function assertPathExists(relativePath) {
  await access(path.join(root, relativePath));
}

async function readJson(relativePath) {
  const json = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(json);
}

async function main() {
  await Promise.all(requiredPaths.map(assertPathExists));

  const packageJson = await readJson("package.json");
  const missingScripts = requiredScripts.filter(
    (scriptName) => !packageJson.scripts?.[scriptName]
  );

  if (missingScripts.length > 0) {
    throw new Error(`Missing package scripts: ${missingScripts.join(", ")}`);
  }

  console.log("InkNest phase 0 baseline check passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
