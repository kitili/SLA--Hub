import { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

export function assertApiSecret(request: NextRequest): void {
  const env = getEnv();
  if (!env.API_SECRET) {
    return;
  }

  const header = request.headers.get("x-api-secret");
  if (header !== env.API_SECRET) {
    throw new Error("Unauthorized");
  }
}
