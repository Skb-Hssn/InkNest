import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("phase 17 exposes the release validation gate and MVP acceptance checklist", async () => {
  const packageJson = JSON.parse(await readText("package.json"));
  const sources = await Promise.all([
    readText("src/main/ipc/app.ts"),
    readText("src/shared/ipc.ts"),
    readText("scripts/release-check.mjs"),
    readText("RELEASE_CHECKLIST.md"),
    readText("README.md"),
    readText("ARCH.md"),
    readText("tests/e2e/phase17.spec.ts")
  ]);
  const combined = sources.join("\n");

  assert.equal(packageJson.scripts["release-check"], "node scripts/release-check.mjs");

  for (const expected of [
    "phase-17-release-validation",
    "npm run check",
    "npm run package",
    "npm run test:e2e",
    "Release validation passed",
    "MVP acceptance criteria",
    "workspace selection",
    "note creation",
    "search",
    "rename",
    "export",
    "restore",
    "Phase 17 Architecture: Release Validation"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 17 source to include ${expected}`);
  }
});
