import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

const SKIP_INTERFACE = /^(tun|tap|wg|docker|veth|br-|lo|vmnet|utun)/i;
const SKIP_IP_PREFIX = ["10.8.", "169.254."];

function shouldSkipIp(address: string, name: string): boolean {
  if (SKIP_INTERFACE.test(name)) return true;
  return SKIP_IP_PREFIX.some((prefix) => address.startsWith(prefix));
}

function isPrivateHost(hostname: string): boolean {
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const [a, b] = hostname.split(".").map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

let cachedPublicUrl: string | null | undefined;
let cachedPublicAt = 0;

function getPublicUrlFromFile(): string | null {
  if (cachedPublicUrl !== undefined && Date.now() - cachedPublicAt < 3000) {
    return cachedPublicUrl;
  }

  const file = path.join(process.cwd(), "data", "public-url.json");
  if (!existsSync(file)) {
    cachedPublicUrl = null;
    cachedPublicAt = Date.now();
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(file, "utf8")) as { url?: string };
    cachedPublicUrl = payload.url?.replace(/\/$/, "") ?? null;
  } catch {
    cachedPublicUrl = null;
  }
  cachedPublicAt = Date.now();
  return cachedPublicUrl;
}

export function getNetworkIps(): string[] {
  const nets = os.networkInterfaces();
  const wifi: string[] = [];
  const other: string[] = [];

  for (const [name, entries] of Object.entries(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (shouldSkipIp(entry.address, name)) continue;
      if (/^(wlo|wlan|wifi|en0|eth)/i.test(name)) {
        wifi.push(entry.address);
      } else {
        other.push(entry.address);
      }
    }
  }

  return [...new Set([...wifi, ...other])];
}

function portFromHost(host?: string): string {
  if (!host) return process.env.PORT || "3108";
  const [, port] = host.split(":");
  return port || process.env.PORT || "3108";
}

/** Public internet URL — used for QR codes (works on any network). */
export function getPublicBaseUrl(host?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const fromFile = getPublicUrlFromFile();
  if (fromFile) return fromFile;

  const hostname = host?.split(":")[0];
  if (hostname && !isPrivateHost(hostname)) {
    const proto = hostname.includes("loca.lt") ? "https" : "http";
    return `${proto}://${host}`;
  }

  return getLocalBaseUrl(host);
}

function getLocalBaseUrl(host?: string): string {
  const hostname = host?.split(":")[0];
  const port = portFromHost(host);

  if (hostname && !isPrivateHost(hostname)) {
    return `http://${host}`;
  }

  const ip = getNetworkIps()[0];
  if (ip) return `http://${ip}:${port}`;

  return `http://localhost:${port}`;
}

export function getAppBaseUrl(host?: string): string {
  return getPublicBaseUrl(host);
}

export function getCheckInUrl(host?: string): string {
  return `${getPublicBaseUrl(host)}/check-in`;
}

export function isLocalHost(host?: string): boolean {
  const hostname = host?.split(":")[0];
  return !hostname || hostname === "localhost" || hostname === "127.0.0.1";
}
