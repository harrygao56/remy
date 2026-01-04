import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import * as path from "path";
import * as fs from "fs";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack:
        "**/node_modules/{sherpa-onnx-node,sherpa-onnx-darwin-*,sherpa-onnx-linux-*,@picovoice/pvrecorder-node,better-sqlite3}/**",
    },
    extraResource: ["./resources"],
    extendInfo: {
      NSMicrophoneUsageDescription:
        "This app needs access to the microphone for voice recognition.",
    },
    afterCopy: [
      (buildPath, _electronVersion, platform, arch, callback) => {
        const getSherpaPackage = (plat: string, ar: string) => {
          if (plat === "darwin") {
            return ar === "arm64"
              ? "sherpa-onnx-darwin-arm64"
              : "sherpa-onnx-darwin-x64";
          } else if (plat === "linux") {
            return ar === "arm64"
              ? "sherpa-onnx-linux-arm64"
              : "sherpa-onnx-linux-x64";
          } else if (plat === "win32") {
            return "sherpa-onnx-win-x64";
          }
          return "sherpa-onnx-darwin-arm64";
        };

        // Copy native modules so they get included in the asar (then unpacked)
        const nativeModules = [
          "sherpa-onnx-node",
          getSherpaPackage(platform, arch),
          "@picovoice/pvrecorder-node",
        ];
        const nodeModulesDest = path.join(buildPath, "node_modules");
        fs.mkdirSync(nodeModulesDest, { recursive: true });

        for (const mod of nativeModules) {
          const src = path.join(__dirname, "node_modules", mod);
          const destDir = mod.startsWith("@")
            ? path.join(nodeModulesDest, mod.split("/")[0])
            : nodeModulesDest;
          const dest = path.join(nodeModulesDest, ...mod.split("/"));

          if (fs.existsSync(src)) {
            fs.mkdirSync(destDir, { recursive: true });
            copyDirSync(src, dest);
            console.log(`Copied ${mod} to app bundle`);
          }
        }
        callback();
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/preload.ts",
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
