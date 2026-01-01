#!/usr/bin/env node
/**
 * Fixes the rpath in sherpa-onnx.node so it can find its .dylib dependencies.
 * The prebuilt binary has a hardcoded path from the CI build machine.
 * We add @loader_path so it looks in the same directory as the .node file.
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Only run on macOS
if (process.platform !== "darwin") {
  console.log("Skipping sherpa rpath fix (not macOS)");
  process.exit(0);
}

const sherpaNode = join(
  projectRoot,
  "node_modules",
  "sherpa-onnx-darwin-arm64",
  "sherpa-onnx.node"
);

if (!existsSync(sherpaNode)) {
  console.log("sherpa-onnx.node not found, skipping rpath fix");
  process.exit(0);
}

// Check if @loader_path is already added
try {
  const rpaths = execSync(`otool -l "${sherpaNode}" | grep -A2 LC_RPATH`, {
    encoding: "utf-8",
  });

  if (rpaths.includes("@loader_path")) {
    console.log("@loader_path already in rpath, skipping");
    process.exit(0);
  }
} catch {
  // grep returns non-zero if no match, ignore
}

// Add @loader_path to rpath
try {
  execSync(`install_name_tool -add_rpath @loader_path "${sherpaNode}"`);
  console.log("✓ Fixed sherpa-onnx.node rpath");
} catch (err) {
  console.error("Failed to fix sherpa-onnx.node rpath:", err.message);
  process.exit(1);
}

