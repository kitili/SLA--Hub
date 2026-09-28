/**
 * Node 20 lacks a global WebSocket; @supabase/supabase-js still constructs Realtime.
 * Scripts never subscribe — stub is enough so createClient() can boot.
 */
export function ensureNodeWebSocket() {
  if (typeof globalThis.WebSocket !== "undefined") return;

  class StubWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = StubWebSocket.CLOSED;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }

  globalThis.WebSocket = StubWebSocket;
}
