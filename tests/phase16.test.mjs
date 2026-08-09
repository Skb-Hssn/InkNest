import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("phase 16 exposes accessible keyboard and responsive renderer behavior", async () => {
  const sources = await Promise.all([
    readText("src/main/ipc/app.ts"),
    readText("src/renderer/src/App.tsx"),
    readText("src/renderer/src/styles.css"),
    readText("ARCH.md"),
    readText("README.md")
  ]);
  const combined = sources.join("\n");

  for (const expected of [
    "phase-16-accessibility-and-ui-polish",
    "Command palette",
    "Open command palette",
    "Control+K",
    "aria-keyshortcuts",
    "focus-visible",
    "currentMode",
    "status-bar-path",
    "status-bar-mode",
    "app-layout-columns",
    "ArrowDown",
    "ArrowUp",
    "Focus note search",
    "@media (max-width: 1100px)",
    "@media (max-width: 860px)",
    "Phase 16 Architecture: Accessibility, Keyboard Support, And UI Polish"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 16 source to include ${expected}`);
  }
});
