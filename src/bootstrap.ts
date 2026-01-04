/**
 * Bootstrap entry point for the Electron main process.
 *
 * This file sets up the environment (e.g., LD_LIBRARY_PATH for native modules on Linux)
 * BEFORE any native modules are loaded. This is necessary because ES6 imports are hoisted,
 * so we need a separate entry point that runs first.
 */

import { app } from "electron";
import * as path from "path";

// Set up LD_LIBRARY_PATH for Linux before loading any native modules
if (process.platform === "linux") {
  // Determine the path to sherpa-onnx native libraries
  let sherpaLibPath: string;

  if (app.isPackaged) {
    // In production: libraries are in app.asar.unpacked/node_modules/sherpa-onnx-linux-arm64
    // The path is relative to the resources directory
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    sherpaLibPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      `sherpa-onnx-linux-${arch}`
    );
  } else {
    // In development: libraries are in node_modules
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    sherpaLibPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      `sherpa-onnx-linux-${arch}`
    );
  }

  // Prepend to LD_LIBRARY_PATH
  const currentLdPath = process.env.LD_LIBRARY_PATH || "";
  process.env.LD_LIBRARY_PATH =
    sherpaLibPath + (currentLdPath ? `:${currentLdPath}` : "");

  console.log(`Set LD_LIBRARY_PATH to include: ${sherpaLibPath}`);
}

// Now load the main application
require("./index");
