"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname);
const launch = fs.existsSync(path.join(root, "launch-start-api.cjs"))
  ? path.join(root, "launch-start-api.cjs")
  : path.join(root, "launch-devguide.cjs");
const name = path.basename(launch).includes("start-api")
  ? "nicepay_start_api"
  : "nicepay_devguide";
fs.writeFileSync(
  path.join(root, "mcp-config.json"),
  JSON.stringify({ name, command: "node", args: [launch] }, null, 2) + "\n",
);
console.error("[nicepay-skill] mcp-config.json →", launch);
