/**
 * Online/offline detection and UI hooks.
 */

const listeners = new Set();

export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function onConnectivityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(isOnline());
}

if (typeof window !== "undefined") {
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
}
