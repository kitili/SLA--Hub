import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const PUBLIC_URL_FILE = path.join(ROOT, "data", "public-url.json");

function run(command, args, label) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
    }
  });
  return child;
}

async function waitForFile() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (existsSync(PUBLIC_URL_FILE)) {
      const payload = JSON.parse(readFileSync(PUBLIC_URL_FILE, "utf8"));
      if (payload.url) return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for public tunnel URL.");
}

async function main() {
  const dev = run("npm", ["run", "dev"], "dev");
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const tunnel = run("node", ["scripts/tunnel.mjs"], "tunnel");
  const payload = await waitForFile();
  run("node", ["scripts/seed.mjs"], "seed");

  console.log("\n--- Silverleaf Visitor Log is public ---");
  console.log("Home:     ", payload.url);
  console.log("Check-in: ", payload.checkIn);
  console.log("QR page:  ", `${payload.url}/qr`);
  console.log("Scan the QR on /qr — works on mobile data, no Wi‑Fi needed.\n");

  process.on("SIGINT", () => {
    dev.kill("SIGINT");
    tunnel.kill("SIGINT");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
