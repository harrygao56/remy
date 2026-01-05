#!/usr/bin/env node
/**
 * Start script that sets LD_LIBRARY_PATH before launching Electron.
 * This is necessary because the dynamic linker needs LD_LIBRARY_PATH
 * to be set BEFORE the process starts to find shared libraries.
 */

import { spawn } from "child_process";
import { resolve, join } from "path";
import { platform, arch } from "os";

// Set LD_LIBRARY_PATH for Linux before spawning Electron
if (platform() === "linux") {
  const sherpaDir = resolve(
    join("node_modules", `sherpa-onnx-linux-${arch()}`)
  );
  const currentLdPath = process.env.LD_LIBRARY_PATH || "";
  process.env.LD_LIBRARY_PATH = sherpaDir + (currentLdPath ? `:${currentLdPath}` : "");
  console.log(`Set LD_LIBRARY_PATH to: ${process.env.LD_LIBRARY_PATH}`);
}

// Spawn electron-forge with the updated environment
const child = spawn("npx", ["electron-forge", "start"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
