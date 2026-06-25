const command = process.argv[2] ?? "command";

const nextSteps = {
  dev: "Phase 1 will replace this with the Electron/Vite development command.",
  build: "Phase 1 will replace this with the production build command.",
  package: "Release packaging will be wired after the app scaffold exists."
};

console.log(nextSteps[command] ?? "This project command is not wired yet.");
