import type { Configuration } from "webpack";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/index.ts",
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
  },
  externals: {
    "@libsql/client": "commonjs @libsql/client",
    libsql: "commonjs libsql",
    "node-llama-cpp": "commonjs node-llama-cpp",
    "sherpa-onnx-node": "commonjs sherpa-onnx-node",
    "@picovoice/pvrecorder-node": "commonjs @picovoice/pvrecorder-node",
  },
};
