import { spawn } from "child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { createWriteStream } from "fs";
import https from "https";
import path from "path";
import { pipeline } from "stream/promises";

const PORT = Number(process.env.PORT || 3108);
const OUT = path.join(process.cwd(), "data", "public-url.json");
const EXTRA_OUT = process.env.PUBLIC_URL_COPY;
const BIN = process.env.CLOUDFLARED_BIN || "/tmp/cloudflared";
const DOWNLOAD =
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64";
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

async function waitForApp() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/check-in-url`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`App is not running on port ${PORT}. Start it with npm run dev first.`);
}

function save(url) {
  const payload = {
    url,
    checkIn: `${url}/check-in`,
    updatedAt: new Date().toISOString(),
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, body);
  if (EXTRA_OUT) {
    mkdirSync(path.dirname(EXTRA_OUT), { recursive: true });
    writeFileSync(EXTRA_OUT, body);
  }
  console.log("Public URL:", payload.url);
  console.log("Check-in link:", payload.checkIn);
  console.log("QR page:", `${payload.url}/qr`);
}

function downloadCloudflared() {
  if (existsSync(BIN)) return Promise.resolve();
  console.log("Downloading cloudflared…");
  return new Promise((resolve, reject) => {
    const follow = (url, hops = 0) => {
      if (hops > 8) {
        reject(new Error("Too many redirects downloading cloudflared"));
        return;
      }
      https
        .get(url, (response) => {
          const location = response.headers.location;
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
            response.resume();
            follow(location, hops + 1);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`cloudflared download failed: ${response.statusCode}`));
            return;
          }
          const file = createWriteStream(BIN);
          pipeline(response, file)
            .then(() => {
              chmodSync(BIN, 0o755);
              resolve();
            })
            .catch(reject);
        })
        .on("error", reject);
    };
    follow(DOWNLOAD);
  });
}

async function startCloudflared() {
  await downloadCloudflared();
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, ["tunnel", "--url", `http://127.0.0.1:${PORT}`, "--no-autoupdate"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    const onData = (buf) => {
      const text = buf.toString();
      process.stderr.write(text);
      const match = text.match(URL_RE);
      if (match && !settled) {
        settled = true;
        save(match[0]);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`cloudflared exited (${code ?? "unknown"})`));
      else process.exit(code ?? 0);
    });
    setTimeout(() => {
      if (!settled) reject(new Error("Timed out waiting for cloudflared URL"));
    }, 45000);
  });
}

async function startLocaltunnel() {
  const { default: localtunnel } = await import("localtunnel");
  const tunnel = await localtunnel({ port: PORT });
  save(tunnel.url.replace(/\/$/, ""));
  tunnel.on("close", () => process.exit(0));
  process.on("SIGINT", () => {
    tunnel.close();
    process.exit(0);
  });
}

async function main() {
  await waitForApp();
  try {
    const child = await startCloudflared();
    process.on("SIGINT", () => {
      child.kill("SIGINT");
      process.exit(0);
    });
  } catch (error) {
    console.error(error.message);
    console.error("Falling back to localtunnel…");
    await startLocaltunnel();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
