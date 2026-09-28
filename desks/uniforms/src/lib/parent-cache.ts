export const PARENT_CACHE_KEY = "slu-parent-snapshot-v2";
export const PARENT_QUEUE_KEY = "slu-parent-order-queue-v1";

export type CachedSku = {
  id: string;
  code: string;
  name: string;
  colour: string;
  kind: string;
  gender: string;
  sellTzs: number;
  sizes: string[];
  materialHint: string;
};

export type CachedFit = {
  className: string;
  gender: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  garmentKind: string;
  size: string;
  note: string;
};

export type CachedOrder = {
  id: string;
  ref: string;
  status: string;
  studentName: string;
  className: string;
  gender: string;
  kind: string;
  campusName: string;
  orderedAt: string;
  queuePlace: number;
  totalTzs: number;
  paidTzs: number;
  collect: boolean;
  readyAt: string | null;
  lines: { skuId: string; name: string; size: string; qty: number; issued: number }[];
};

export type CachedChild = {
  id: string;
  regNo: string;
  name: string;
  className: string;
  gender: string;
  campusId: string;
  campusName: string;
};

export type CachedQueueRow = {
  id: string;
  place: number;
  ref: string;
  studentName: string;
  campusName: string;
  className: string;
  status: string;
  orderedAt: string;
  mine: boolean;
};

export type ParentSnapshot = {
  savedAt: string;
  campusId: string;
  campusName: string | null;
  parentName: string;
  phone: string;
  children: CachedChild[];
  skus: CachedSku[];
  fits: CachedFit[];
  orders: CachedOrder[];
  queue: CachedQueueRow[];
};

export type QueuedOrder = {
  id: string;
  createdAt: string;
  campusId: string;
  regNo: string;
  studentName: string;
  className: string;
  gender: string;
  kind: string;
  lines: { skuId: string; size: string; qty: number }[];
};

export function readSnapshot(): ParentSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PARENT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ParentSnapshot) : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(data: ParentSnapshot) {
  localStorage.setItem(PARENT_CACHE_KEY, JSON.stringify(data));
}

export function readQueue(): QueuedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PARENT_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(items: QueuedOrder[]) {
  localStorage.setItem(PARENT_QUEUE_KEY, JSON.stringify(items));
}

export function enqueueOrder(order: QueuedOrder) {
  writeQueue([...readQueue(), order]);
}

export function clearQueue() {
  writeQueue([]);
}
