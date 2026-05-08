"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const pkg = path.join(__dirname, "vendor", "nicepay-devguide-mcp");
const bundle = path.join(pkg, "dist", "cli.bundle.js");
/** Prefer Git clone beside the skill; override with NICEPAY_MANUAL_PATH. */
const manualDir = process.env.NICEPAY_MANUAL_PATH || path.join(__dirname, "nicepay-manual");
const child = spawn(process.execPath, [bundle], {
  cwd: pkg,
  stdio: "inherit",
  env: {
    ...process.env,
    NICEPAY_MANUAL_PATH: manualDir,
  },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
