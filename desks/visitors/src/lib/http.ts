import { NextResponse } from "next/server";

type AppError = Error & { status?: number };

function readStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as AppError).status;
  return typeof status === "number" ? status : null;
}

export function jsonError(error: unknown) {
  const status = readStatus(error);
  if (status && error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
