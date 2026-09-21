import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare. Different lengths still take a compare pass. */
export function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.byteLength !== b.byteLength) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
