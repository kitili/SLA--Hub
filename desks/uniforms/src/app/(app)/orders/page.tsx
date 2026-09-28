import Link from "next/link";
import { staffCreateOrder } from "@/actions/orders";
import { LinesEditor, StudentLookup } from "@/components/lines-editor";
import { CampusFilter } from "@/components/campus-filter";
import { Badge, Btn, Card, Field, Money, Pager, PageHeader, Table, inputClass, statusTone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { tzs } from "@/lib/money";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { orderPaid, orderRecordedPaid, orderTotal, waitingAtWindow } from "@/lib/order-status";
import { ACTIVE_SKU } from "@/lib/constants";
import { canWriteOrders, orderWhere } from "@/lib/visibility";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser(["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const query = q?.trim() ?? "";
  const picked = await schoolScope(user);
  const scoped = orderWhere(user, picked?.id);
  const searchFilter = query
    ? {
        OR: [
          { ref: { contains: query } },
          { studentName: { contains: query } },
          { regNo: { contains: query } },
        ],
      }
    : {};
  const where = { AND: [scoped, searchFilter] };

  // "Waiting at window" needs every order (not just the current page) so a
  // paid-but-not-yet-issued order from earlier in the queue is never hidden.
  const [allOrders, orders, total, campuses, skus] = await Promise.all([
    prisma.parentOrder.findMany({
      where: scoped,
      include: { campus: true, lines: true, pays: true },
    }),
    prisma.parentOrder.findMany({
      where,
      include: { campus: true, lines: true, pays: true },
      orderBy: { orderedAt: "asc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.parentOrder.count({ where }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.sku.findMany({ where: ACTIVE_SKU, include: { sizes: true }, orderBy: { code: "asc" } }),
  ]);

  const atWindow = allOrders
    .filter((o) =>
      waitingAtWindow({
        status: o.status,
        paid: orderPaid(o.pays),
        total: orderTotal(o.lines),
      }),
    )
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="FIFO by order date"
        title="Coupons"
        subtitle="Find a student, take payment, then issue. Paying later does not jump the line."
      />
      {isSchoolAdmin(user) ? <CampusFilter sites={campuses} active={picked?.code} path="/orders" persist /> : null}

      <form className="flex flex-wrap gap-2" method="get">
        <input
          className={`${inputClass()} max-w-sm`}
          name="q"
          defaultValue={query}
          placeholder="Name, reg, or coupon ref"
        />
        <Btn type="submit">Find</Btn>
      </form>

      {atWindow.length > 0 && !query ? (
        <Card>
          <h2 className="mb-3 font-semibold">At the window</h2>
          <p className="mb-3 text-sm text-ink-muted">Paid, still waiting for kit.</p>
          <ul className="grid gap-2 text-sm">
            {atWindow.map((order, i) => (
              <li key={order.id}>
                <Link className="font-semibold text-electric-blue" href={`/orders/${order.id}`}>
                  {i + 1}. {order.ref}
                </Link>
                {" · "}
                {order.studentName} · {order.campus.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <Table headers={["#", "Ref", "Student", "Campus", "Ordered", "Paid", "Status", "Balance"]}>
          {orders.map((order, i) => {
            const total = order.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
            const paid = orderPaid(order.pays);
            const pending = orderRecordedPaid(order.pays) - paid;
            return (
              <tr key={order.id}>
                <td className="px-2 py-2">{i + 1}</td>
                <td className="px-2 py-2">
                  <Link className="underline" href={`/orders/${order.id}`}>{order.ref}</Link>
                </td>
                <td className="px-2 py-2">
                  {order.studentName}
                  <div className="text-xs text-[var(--muted)]">
                    {order.className} · {order.gender} · {order.regNo || "no reg"}
                  </div>
                </td>
                <td className="px-2 py-2">{order.campus.name}</td>
                <td className="px-2 py-2 text-xs">{order.orderedAt.toISOString().slice(0, 10)}</td>
                <td className="px-2 py-2 text-xs">{order.paidAt ? order.paidAt.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-2 py-2">
                  <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                  {pending > 0 ? <Badge tone="gold">Pending confirmation</Badge> : null}
                </td>
                <td className="px-2 py-2"><Money amount={total - paid} /></td>
              </tr>
            );
          })}
        </Table>
        <Pager page={page} totalPages={pageCount(total)} params={{ q: query }} />
      </Card>

      {canWriteOrders(user.role) ? (
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Walk-in coupon</h2>
        <form id="order-form" action={staffCreateOrder} className="grid gap-3">
          {user.role === "STORE" || isSchoolAdmin(user) ? (
            <StudentLookup
              showCampus
              campuses={campuses}
              defaultCampusId={picked?.id ?? user.campusId ?? campuses[0]?.id ?? ""}
            />
          ) : (
            <>
              <input type="hidden" name="campusId" value={user.campusId ?? ""} />
              <StudentLookup />
            </>
          )}
          <Field label="Kind">
            <select className={inputClass()} name="kind">
              <option value="SCHOOL">Day / school</option>
              <option value="BOARDING">Boarding</option>
            </select>
          </Field>
          <LinesEditor
            skus={skus.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              sellTzs: s.sellTzs,
              buyTzs: s.buyTzs,
              sizes: s.sizes.map((x) => x.size),
            }))}
          />
          <Btn>Create coupon</Btn>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">Sell prices are catalogue TZS, e.g. polo {tzs(15000)}.</p>
      </Card>
      ) : null}
    </div>
  );
}
