#!/usr/bin/env bun
import { spawn } from "child_process";

// Run the app with mock adapter
const proc = spawn("bun", ["run", "src/index.tsx", "--adapter", "mock"], {
  stdio: "inherit"
});

// Exit after 2 seconds for testing
setTimeout(() => {
  proc.kill("SIGTERM");
  process.exit(0);
}, 2000);

