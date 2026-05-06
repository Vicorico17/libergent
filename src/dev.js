import { spawn } from "node:child_process";

const processes = [
  spawn(process.execPath, ["src/server.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      HOST: process.env.HOST || "127.0.0.1",
      PORT: process.env.PORT || "8787"
    }
  }),
  spawn("npm", ["--prefix", "ui", "run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      LIBERGENT_API_BASE: process.env.LIBERGENT_API_BASE || "http://127.0.0.1:8787"
    }
  })
];

function shutdown(signal) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      shutdown(signal || "SIGTERM");
      process.exit(code);
    }
  });
}
