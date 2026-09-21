export async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 402 || res.status >= 500) return false;
    return true;
  } catch {
    return false;
  }
}
