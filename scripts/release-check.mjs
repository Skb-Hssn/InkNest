import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const validationSteps = [
  ["Scaffold, unit, and type checks", "check"],
  ["Production package build", "package"],
  ["Electron acceptance tests", "test:e2e"]
];

for (const [label, script] of validationSteps) {
  console.log(`\nRelease validation: ${label}`);
  const result = spawnSync(npmCommand, ["run", script], {
    cwd: path.resolve(root),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`Could not run npm run ${script}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Release validation stopped after npm run ${script}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nRelease validation passed.");
