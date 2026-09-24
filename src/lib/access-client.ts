export function noteDeskOpen(departmentId: string) {
  if (!departmentId || typeof fetch === "undefined") return;
  void fetch("/api/access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ departmentId }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
}
