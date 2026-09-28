"use client";

import { useEffect, useMemo, useState } from "react";
import { useOffline } from "next/offline";
import { addSiblingAction, removeSiblingAction } from "@/actions/auth";
import { saveFamilyPhone } from "@/actions/ops";
import { cancelParentOrder, parentCreateOrder, updateOrderLines } from "@/actions/orders";
import { PARENT_COPY, type Lang } from "@/lib/i18n";
import { ConfirmModal } from "@/components/confirm-modal";
import { LinesEditor } from "@/components/lines-editor";
import { InstallAppButton } from "@/components/pwa";
import { Badge, Btn, Card, Field, inputClass, statusTone } from "@/components/ui";
import { tzs } from "@/lib/money";
import {
  clearQueue,
  enqueueOrder,
  readQueue,
  readSnapshot,
  writeQueue,
  writeSnapshot,
  type CachedFit,
  type ParentSnapshot,
  type QueuedOrder,
} from "@/lib/parent-cache";
import { CLASSES, fitsFor } from "@/lib/size-fit";

type Tab = "orders" | "queue" | "shop" | "sizes" | "new";

export function ParentDesk({ initial }: { initial: ParentSnapshot }) {
  const offline = useOffline();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("orders");
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [guideClass, setGuideClass] = useState("P4");
  const [guideGender, setGuideGender] = useState("GIRL");
  const [flushNote, setFlushNote] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const t = PARENT_COPY[lang];

  useEffect(() => {
    const saved = localStorage.getItem("slu-lang");
    if (saved === "sw" || saved === "en") setLang(saved);
  }, []);

  useEffect(() => {
    // Resync local state whenever the server gives us a fresh snapshot (e.g.
    // after add/remove-sibling or any other action revalidates this route) —
    // without this, `data` stays stuck at whatever `initial` was on first
    // mount, and the Mine tab silently shows stale children/orders until a
    // manual reload.
    setData(initial);
    writeSnapshot(initial);
    setQueue(readQueue());
  }, [initial]);

  useEffect(() => {
    if (offline) {
      const cached = readSnapshot();
      if (cached) setData(cached);
    }
  }, [offline]);

  useEffect(() => {
    if (offline || queue.length === 0) return;
    let cancelled = false;
    (async () => {
      const leftover: QueuedOrder[] = [];
      for (const item of queue) {
        const fd = new FormData();
        fd.set("campusId", item.campusId);
        fd.set("regNo", item.regNo);
        fd.set("studentName", item.studentName);
        fd.set("className", item.className);
        fd.set("gender", item.gender);
        fd.set("kind", item.kind);
        for (const line of item.lines) {
          fd.append("skuId", line.skuId);
          fd.append("size", line.size);
          fd.append("qty", String(line.qty));
        }
        try {
          await parentCreateOrder(fd);
        } catch {
          leftover.push(item);
        }
      }
      if (cancelled) return;
      writeQueue(leftover.length ? leftover : []);
      if (leftover.length === 0) clearQueue();
      setQueue(leftover);
      setFlushNote(leftover.length ? "Some queued orders still waiting." : "Queued orders sent.");
    })();
    return () => {
      cancelled = true;
    };
  }, [offline, queue]);

  const guide = useMemo(
    () => fitsFor(data.fits as CachedFit[], guideClass, guideGender),
    [data.fits, guideClass, guideGender],
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-light-blue">{t.app}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-electric-blue">
            {t.hello}, {data.parentName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data.campusName ? `${data.campusName} · ` : ""}
            {offline ? t.offline : t.kids(data.children.length)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-card-border bg-white px-3 py-2 text-sm font-semibold text-electric-blue"
            onClick={() => {
              const next = lang === "en" ? "sw" : "en";
              setLang(next);
              localStorage.setItem("slu-lang", next);
            }}
          >
            {t.lang}
          </button>
          <InstallAppButton className="rounded-full bg-electric-blue px-4 py-2 text-sm font-semibold text-white" />
        </div>
      </div>

      {flushNote ? <p className="text-sm text-success">{flushNote}</p> : null}
      {queue.length ? (
        <p className="rounded-[10px] bg-gold-15 px-3 py-2 text-sm">
          {t.queued(queue.length)}
        </p>
      ) : null}

      <nav className="grid grid-cols-5 gap-1 rounded-[14px] bg-white p-1 shadow-[var(--shadow)]">
        {(
          [
            ["orders", t.tabs.orders],
            ["queue", t.tabs.queue],
            ["shop", t.tabs.shop],
            ["sizes", t.tabs.sizes],
            ["new", t.tabs.new],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-[10px] px-2 py-2 text-sm font-semibold ${
              tab === id ? "bg-electric-blue text-white" : "text-electric-blue"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "orders" ? (
        <OrdersTab orders={data.orders} children={data.children} phone={data.phone} skus={data.skus} t={t} />
      ) : null}
      {tab === "queue" ? <QueueTab rows={data.queue} t={t} /> : null}
      {tab === "shop" ? <ShopTab skus={data.skus} /> : null}
      {tab === "sizes" ? (
        <SizesTab
          guide={guide}
          guideClass={guideClass}
          guideGender={guideGender}
          setGuideClass={setGuideClass}
          setGuideGender={setGuideGender}
          t={t}
        />
      ) : null}
      {tab === "new" ? (
        <NewOrderTab
          snapshot={data}
          offline={offline}
          t={t}
          onQueued={(item) => {
            enqueueOrder(item);
            setQueue(readQueue());
            setTab("orders");
          }}
          onPlaced={(ref) => {
            setFlushNote(`Order ${ref} placed — see it below.`);
            setTab("orders");
          }}
        />
      ) : null}
    </div>
  );
}

function QueueTab({ rows, t }: { rows: ParentSnapshot["queue"]; t: (typeof PARENT_COPY)[Lang] }) {
  return (
    <Card>
      <h2 className="mb-2 font-semibold">{t.tabs.queue}</h2>
      <p className="mb-3 text-sm text-ink-muted">{t.fifo}</p>
      {rows.length === 0 ? <p className="text-sm text-ink-muted">No open coupons.</p> : null}
      <ul className="grid gap-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`flex flex-wrap justify-between gap-2 rounded-[10px] px-3 py-2 ${row.mine ? "bg-light-blue-30" : "bg-[#f7f9fc]"}`}
          >
            <span>
              <strong>{row.place}.</strong> {row.studentName}
              <span className="text-ink-muted"> · {row.campusName} · {row.className}</span>
            </span>
            <span className="text-ink-muted">
              {row.mine ? "Your family · " : ""}
              {row.ref} · {row.status} · {row.orderedAt}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OrdersTab({
  orders,
  children,
  phone,
  skus,
  t,
}: {
  orders: ParentSnapshot["orders"];
  children: ParentSnapshot["children"];
  phone: string;
  skus: ParentSnapshot["skus"];
  t: (typeof PARENT_COPY)[Lang];
}) {
  const ready = orders.filter((o) => o.collect);
  return (
    <div className="grid gap-3">
      {ready.map((order) => (
        <Card key={`ready-${order.id}`} className="border-gold bg-gold-15">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-electric-blue">{t.collectTitle}</p>
          <h2 className="text-xl font-bold text-electric-blue">{order.studentName}</h2>
          <p className="text-sm">{t.collectBody}</p>
          <p className="text-sm text-ink-muted">{order.ref} · {order.campusName}</p>
        </Card>
      ))}
      <Card>
        <h2 className="mb-2 font-semibold">{t.children}</h2>
        {children.length === 0 ? (
          <p className="text-sm text-ink-muted">No children linked yet.</p>
        ) : (
          <ul className="mb-3 grid gap-1 text-sm">
            {children.map((child) => (
              <li key={child.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{child.name}</strong>
                  <span className="text-ink-muted">
                    {" "}
                    · {child.campusName} · {child.className} · {child.regNo}
                  </span>
                </span>
                <ConfirmModal
                  triggerLabel="Remove"
                  triggerTone="ghost"
                  tone="danger"
                  title={`Remove ${child.name} from your account?`}
                  description="This unlinks them from your family — it doesn't delete their record or any past orders. You (or they) can link back to any family later using their registration number."
                  confirmLabel="Yes, remove"
                  action={removeSiblingAction}
                  hiddenFields={{ studentId: child.id }}
                />
              </li>
            ))}
          </ul>
        )}
        <form action={addSiblingAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className={inputClass()} name="regNo" required placeholder="Sibling registration number" />
          <Btn type="submit">{t.addSibling}</Btn>
        </form>
        <p className="mt-2 text-xs text-ink-muted">{t.siblingHint}</p>
        <form action={saveFamilyPhone} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Field label={t.phone}>
            <input className={inputClass()} name="phone" type="tel" defaultValue={phone} placeholder="07XXXXXXXX" />
          </Field>
          <div className="self-end">
            <Btn type="submit">{t.savePhone}</Btn>
          </div>
        </form>
      </Card>
      {orders.length === 0 ? (
        <Card><p className="text-sm text-ink-muted">No coupons yet. Open New to place one.</p></Card>
      ) : null}
      {orders.map((order) => (
        <Card key={order.id}>
          <div className="flex justify-between gap-2">
            <strong>{order.ref}</strong>
            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          </div>
          <p className="text-sm text-ink-muted">
            {order.studentName} · {order.className} · {order.kind === "BOARDING" ? "Boarding" : "Day"}
          </p>
          <p className="text-sm">
            Queue place {order.queuePlace || "—"} · {tzs(order.totalTzs)} · paid {tzs(order.paidTzs)}
            {order.paidTzs < order.totalTzs ? ` · balance ${tzs(order.totalTzs - order.paidTzs)}` : ""}
          </p>
          <p className="mt-2 text-sm">
            <a className="font-semibold text-electric-blue" href={`/coupon/${order.id}`}>
              {t.printCoupon}
            </a>
          </p>
          <ul className="mt-2 text-sm">
            {order.lines.map((l, i) => (
              <li key={`${order.id}-${i}`}>
                {l.name} size {l.size} × {l.qty}
                {l.issued ? ` · issued ${l.issued}` : ""}
              </li>
            ))}
          </ul>
          {order.paidTzs === 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmModal
                triggerLabel="Edit order"
                triggerTone="ghost"
                tone="primary"
                wide
                title={`Edit ${order.ref}`}
                description="Change the items, sizes, or quantities. You can only edit before you've paid anything."
                confirmLabel="Save changes"
                action={updateOrderLines}
                hiddenFields={{ orderId: order.id }}
              >
                <LinesEditor
                  skus={skus.map((s) => ({
                    id: s.id,
                    code: s.code,
                    name: s.name,
                    sellTzs: s.sellTzs,
                    buyTzs: 0,
                    sizes: s.sizes,
                  }))}
                  initialRows={order.lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty }))}
                />
              </ConfirmModal>
              <ConfirmModal
                triggerLabel="Cancel order"
                triggerTone="danger"
                title={`Cancel ${order.ref}?`}
                description="You haven't paid anything on this order yet, so it can be cancelled freely. Once you start paying, cancelling needs to go through the school."
                confirmLabel="Yes, cancel it"
                action={cancelParentOrder}
                hiddenFields={{ orderId: order.id }}
              />
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function ShopTab({ skus }: { skus: ParentSnapshot["skus"] }) {
  return (
    <div className="grid gap-3">
      {skus.map((sku) => (
        <Card key={sku.id}>
          <div className="flex justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-light-blue">{sku.code}</p>
              <h2 className="text-lg font-bold text-electric-blue">{sku.name}</h2>
            </div>
            <Badge tone={sku.kind === "BOARDING" ? "gold" : "blue"}>{sku.kind === "BOARDING" ? "Boarding" : "Day"}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {sku.colour} · {sku.gender === "UNISEX" ? "Girls & boys" : sku.gender} · {sku.materialHint}
          </p>
          <p className="mt-2 font-semibold">{tzs(sku.sellTzs)}</p>
          <p className="text-xs text-ink-muted">Sizes: {sku.sizes.join(", ")}</p>
        </Card>
      ))}
    </div>
  );
}

function SizesTab({
  guide,
  guideClass,
  guideGender,
  setGuideClass,
  setGuideGender,
  t,
}: {
  guide: CachedFit[];
  guideClass: string;
  guideGender: string;
  setGuideClass: (v: string) => void;
  setGuideGender: (v: string) => void;
  t: (typeof PARENT_COPY)[Lang];
}) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{t.sizeFits}</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={t.class}>
          <select className={inputClass()} value={guideClass} onChange={(e) => setGuideClass(e.target.value)}>
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={t.child}>
          <select className={inputClass()} value={guideGender} onChange={(e) => setGuideGender(e.target.value)}>
            <option value="GIRL">{t.girl}</option>
            <option value="BOY">{t.boy}</option>
          </select>
        </Field>
      </div>
      {guide.length === 0 ? (
        <p className="text-sm text-ink-muted">No chart for that class yet.</p>
      ) : (
        <ul className="grid gap-2">
          {guide.map((row) => (
            <li key={`${row.skuId}-${row.gender}`} className="rounded-[10px] bg-[#f7f9fc] px-3 py-2 text-sm">
              <strong>{row.skuName}</strong> → size <strong>{row.size}</strong>
              {row.note ? <span className="block text-ink-muted">{row.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChildPicker({ children }: { children: ParentSnapshot["children"] }) {
  const first = children[0];
  const [id, setId] = useState(first?.id ?? "");
  const child = children.find((c) => c.id === id) ?? first;
  if (!child) {
    return <p className="text-sm text-ink-muted">Link a child on Mine before ordering.</p>;
  }
  return (
    <div className="grid gap-2">
      <Field label="Child">
        <select className={inputClass()} value={child.id} onChange={(e) => setId(e.target.value)}>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.campusName} · {c.regNo}
            </option>
          ))}
        </select>
      </Field>
      <input type="hidden" name="regNo" value={child.regNo} />
      <input type="hidden" name="studentName" value={child.name} />
      <input type="hidden" name="className" value={child.className} />
      <input type="hidden" name="gender" value={child.gender} />
      <input type="hidden" name="campusId" value={child.campusId} />
    </div>
  );
}

type PendingOrder = {
  fd: FormData;
  studentName: string;
  kind: string;
  lines: { name: string; size: string; qty: number; sellTzs: number }[];
  total: number;
  duplicates: string[];
};

function NewOrderTab({
  snapshot,
  offline,
  onQueued,
  onPlaced,
  t,
}: {
  snapshot: ParentSnapshot;
  offline: boolean;
  campusId?: string;
  onQueued: (item: QueuedOrder) => void;
  onPlaced: (ref: string) => void;
  t: (typeof PARENT_COPY)[Lang];
}) {
  // Bumping this key forces the form (and LinesEditor's internal row state)
  // to fully remount after a successful submit — the plain "reset the DOM"
  // approach doesn't touch LinesEditor's own React state, which would leave
  // stale rows visible even after the underlying inputs cleared.
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [placing, setPlacing] = useState(false);
  const skuById = useMemo(() => Object.fromEntries(snapshot.skus.map((s) => [s.id, s])), [snapshot.skus]);

  return (
    <Card>
      <h2 className="mb-3 font-semibold">{t.newOrder}</h2>
      {offline ? (
        <p className="mb-3 text-sm text-ink-muted">
          No signal — this order stays on the phone and sends when you are back.
        </p>
      ) : null}
      <form
        key={formKey}
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const skuIds = fd.getAll("skuId").map(String);
          const sizes = fd.getAll("size").map(String);
          const qtys = fd.getAll("qty").map((v) => Number.parseInt(String(v), 10));
          const lines = skuIds
            .map((skuId, i) => ({ skuId, size: sizes[i] ?? "", qty: qtys[i] ?? 0 }))
            .filter((l) => l.skuId && l.size && l.qty > 0);
          if (lines.length === 0) return;

          if (offline) {
            onQueued({
              id: `local-${Date.now()}`,
              createdAt: new Date().toISOString(),
              campusId: String(fd.get("campusId") ?? ""),
              regNo: String(fd.get("regNo") ?? ""),
              studentName: String(fd.get("studentName") ?? ""),
              className: String(fd.get("className") ?? ""),
              gender: String(fd.get("gender") ?? ""),
              kind: String(fd.get("kind") ?? "SCHOOL"),
              lines,
            });
            setFormKey((k) => k + 1);
            return;
          }

          // Online: don't submit yet — show what's about to be sent and wait
          // for an explicit second confirmation before it actually goes out.
          const studentName = String(fd.get("studentName") ?? "");
          // Same warning staff already get on their order screen, surfaced
          // here too — a parent could otherwise order the same item for the
          // same child twice with no indication an open order already covers it.
          const openOrdersForChild = snapshot.orders.filter(
            (o) => o.studentName === studentName && (o.status === "ORDERED" || o.status === "PAID" || o.status === "PARTIAL"),
          );
          const duplicates = lines
            .filter((l) => openOrdersForChild.some((o) => o.lines.some((ol) => ol.skuId === l.skuId && ol.size === l.size)))
            .map((l) => (skuById[l.skuId] ? `${skuById[l.skuId].code} · ${skuById[l.skuId].name} size ${l.size}` : `${l.skuId} size ${l.size}`));
          setPending({
            fd,
            studentName,
            kind: String(fd.get("kind") ?? "SCHOOL"),
            lines: lines.map((l) => ({
              name: skuById[l.skuId] ? `${skuById[l.skuId].code} · ${skuById[l.skuId].name}` : l.skuId,
              size: l.size,
              qty: l.qty,
              sellTzs: skuById[l.skuId]?.sellTzs ?? 0,
            })),
            total: lines.reduce((sum, l) => sum + l.qty * (skuById[l.skuId]?.sellTzs ?? 0), 0),
            duplicates,
          });
        }}
      >
        <ChildPicker children={snapshot.children} />
        <Field label="Kind">
          <select className={inputClass()} name="kind">
            <option value="SCHOOL">Day</option>
            <option value="BOARDING">Boarding</option>
          </select>
        </Field>
        <LinesEditor
          skus={snapshot.skus.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            sellTzs: s.sellTzs,
            buyTzs: 0,
            sizes: s.sizes,
          }))}
        />
        <Btn>{offline ? t.saveOffline : "Review order"}</Btn>
      </form>

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          {/* A long order (many lines) can grow taller than the viewport —
              without a scroll boundary here, "Yes, place order" ends up
              permanently off-screen with no way to reach it. */}
          <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[14px] border border-card-border bg-white p-5 shadow-lg">
            <h2 className="font-display text-lg font-bold text-electric-blue">Place this order?</h2>
            <p className="mt-2 text-sm text-ink-muted">
              For {pending.studentName} · {pending.kind === "BOARDING" ? "Boarding" : "Day"}
            </p>
            {pending.duplicates.length > 0 ? (
              <p className="mt-2 rounded-[10px] border border-gold bg-gold-15 px-3 py-2 text-sm">
                {pending.studentName} already has an open order for {pending.duplicates.join(", ")} — check it isn&apos;t a duplicate before continuing.
              </p>
            ) : null}
            <ul className="mt-3 grid gap-1 text-sm">
              {pending.lines.map((l, i) => (
                <li key={i}>
                  {l.name} size {l.size} × {l.qty} · {(l.qty * l.sellTzs).toLocaleString()} TZS
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold">Total {pending.total.toLocaleString()} TZS</p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn
                type="button"
                tone="ghost"
                onClick={() => {
                  if (!placing) setPending(null);
                }}
              >
                Go back
              </Btn>
              <Btn
                type="button"
                onClick={async () => {
                  if (placing) return;
                  setPlacing(true);
                  try {
                    const result = await parentCreateOrder(pending.fd);
                    setPending(null);
                    setFormKey((k) => k + 1);
                    if (result && "ref" in result) onPlaced(result.ref);
                  } finally {
                    setPlacing(false);
                  }
                }}
              >
                {placing ? "Placing…" : "Yes, place order"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
