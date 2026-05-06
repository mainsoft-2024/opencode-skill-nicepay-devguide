"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const pkg = path.join(__dirname, "vendor", "nicepay-devguide-mcp");
const bundle = path.join(pkg, "dist", "cli.bundle.js");
const child = spawn(process.execPath, [bundle], {
  cwd: pkg,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
