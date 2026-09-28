import Link from "next/link";
import { AlertList } from "@/components/alert-list";
import { CampusFilter } from "@/components/campus-filter";
import { Badge, Card, Money, PageHeader } from "@/components/ui";
import { clothAlerts, stockAlerts } from "@/lib/alerts";
import { requireUser, type SessionUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { listCampuses } from "@/lib/kpis";
import { prisma } from "@/lib/prisma";

export default async function DeskPage() {
  const user = await requireUser();

  if (user.role === "CEO") {
    return (
      <div>
        <PageHeader
          eyebrow="Leadership"
          title="Leadership desk"
          subtitle="Leadership briefing across five campuses. This seat is read-only."
        />
        <p className="text-sm">
          <Link className="font-semibold text-electric-blue underline" href="/reports">Open the leadership briefing →</Link>
        </p>
      </div>
    );
  }

  if (user.role === "ADMIN" || user.role === "HEAD_TEACHER" || user.role === "PRINCIPAL") {
    return <CampusLanding user={user} />;
  }

  if (user.role === "TAILOR") {
    return <TailorDesk name={user.name} />;
  }

  const year = new Date().getFullYear();
  const [openRequests, fifo, sewingOpen, mainStock, paidWaiting, low, cloth, recentCancellations, budget, spend, sales] =
    await Promise.all([
    prisma.campusRequest.count({ where: { status: "OPEN" } }),
    prisma.parentOrder.count({
      where: { status: { in: ["ORDERED", "PAID", "PARTIAL"] } },
    }),
    prisma.sewingJob.count({ where: { status: { not: "DONE" } } }),
    prisma.stockBalance.aggregate({
      _sum: { qty: true },
      where: { location: { code: "MAIN" } },
    }),
    prisma.parentOrder.count({ where: { status: { in: ["PAID", "PARTIAL"] } } }),
    stockAlerts(),
    clothAlerts(),
    // Answers "where does a parent-cancelled order show up" - there's no
    // push/email notification system, so the audit log is the only
    // broadcast mechanism that exists without a schema change. Once
    // cancelParentOrder (actions/orders.ts) is really implemented and
    // calls writeAudit() as documented there, this card starts showing
    // real data automatically - it's empty today because nothing has
    // actually been cancelled yet (the action is still a draft).
    prisma.auditEvent.findMany({
      where: { action: "CANCEL", entity: "ParentOrder" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.budget.findFirst({ where: { year } }),
    prisma.expense.aggregate({ _sum: { amountTzs: true } }),
    prisma.payment.aggregate({ _sum: { amountTzs: true } }),
  ]);

  const stages = [
    {
      href: "/sewing",
      title: "1 · Tailoring",
      who: "Loveness",
      body: `${sewingOpen} jobs in progress`,
      tone: "pink",
    },
    {
      href: "/stock",
      title: "2 · Central inventory",
      who: "Imani & Loveness",
      body: `${mainStock._sum.qty ?? 0} pieces in MAIN`,
      tone: "leaf",
    },
    {
      href: "/distribution",
      title: "3 · Distribution",
      who: "Imani only",
      body: `${openRequests} open campus requests`,
      tone: "blue",
    },
    {
      href: "/orders",
      title: "4 · Campuses & parents",
      who: "Five campuses",
      body: `${fifo} coupons in FIFO · ${paidWaiting} paid waiting`,
      tone: "gold",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Store & finance"
        title={`Hello, ${user.name}`}
        subtitle="Inventory, distribution, parent orders, purchase orders, and money — one desk."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="text-electric-blue no-underline" href="/finance">
              Finance detail
            </Link>
            <Link className="text-electric-blue no-underline" href="/reports">
              KPI reports
            </Link>
            <Link className="text-electric-blue no-underline" href="/train">
              Usa River walkthrough
            </Link>
          </div>
        }
      />
      <AlertList stock={low} cloth={cloth} />
      {recentCancellations.length ? (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold">Recently cancelled by parents</h2>
          <ul className="grid gap-1 text-sm text-[var(--muted)]">
            {recentCancellations.map((e) => (
              <li key={e.id}>
                {e.createdAt.toISOString().slice(0, 10)} · {e.ref || e.entityId} · {e.actorName}
                {e.note ? ` · ${e.note}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Link href="/finance" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <p className="text-sm text-[var(--muted)]">Budget {year}</p>
            <p className="text-2xl"><Money amount={budget?.allocatedTzs ?? 0} /></p>
          </Card>
        </Link>
        <Link href="/finance" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <p className="text-sm text-[var(--muted)]">Spend recorded</p>
            <p className="text-2xl"><Money amount={spend._sum.amountTzs ?? 0} /></p>
          </Card>
        </Link>
        <Link href="/orders" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <p className="text-sm text-[var(--muted)]">Parent payments</p>
            <p className="text-2xl"><Money amount={sales._sum.amountTzs ?? 0} /></p>
          </Card>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {stages.map((stage) => (
          <Link key={stage.href} href={stage.href} className="no-underline">
            <Card className="h-full transition hover:border-electric-blue">
              <Badge tone={stage.tone}>{stage.who}</Badge>
              <h2 className="mt-3 text-2xl text-electric-blue">{stage.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{stage.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function TailorDesk({ name }: { name: string }) {
  const [sewingOpen, shopStock, low, cloth] = await Promise.all([
    prisma.sewingJob.count({ where: { status: { not: "DONE" } } }),
    prisma.stockBalance.aggregate({
      _sum: { qty: true },
      where: { location: { code: "SHOP_USA" } },
    }),
    stockAlerts({ code: { in: ["MAIN", "SHOP_USA"] } }),
    clothAlerts(),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="Tailor"
        title={`Hello, ${name}`}
        subtitle="Sewing and the Usa River shop only. Distribution stays with Imani."
      />
      <AlertList stock={low} cloth={cloth} />
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/sewing" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <Badge tone="pink">Your jobs</Badge>
            <h2 className="mt-3 text-2xl text-electric-blue">Sew</h2>
            <p className="mt-1 text-sm text-ink-muted">{sewingOpen} jobs in progress</p>
          </Card>
        </Link>
        <Link href="/slm" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <Badge tone="gold">Bought vs need</Badge>
            <h2 className="mt-3 text-2xl text-electric-blue">Cloth</h2>
            <p className="mt-1 text-sm text-ink-muted">Actual metres in, leftover, and how much a size takes</p>
          </Card>
        </Link>
        <Link href="/stock" className="no-underline">
          <Card className="h-full transition hover:border-electric-blue">
            <Badge>Shop + MAIN</Badge>
            <h2 className="mt-3 text-2xl text-electric-blue">Stock</h2>
            <p className="mt-1 text-sm text-ink-muted">{shopStock._sum.qty ?? 0} pieces in the shop</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

async function CampusLanding({ user }: { user: SessionUser }) {
  const picked = await schoolScope(user);
  if (!user.campusId && !isSchoolAdmin(user)) {
    return <PageHeader title="Campus desk" subtitle="Your account is not bound to a campus." />;
  }
  const campusId = picked?.id ?? null;
  const loc = campusId ? { campusId, kind: "CAMPUS" as const } : { kind: "CAMPUS" as const };
  const sites = isSchoolAdmin(user) ? await listCampuses() : [];
  const [stock, requests, dns, orders, low] = await Promise.all([
    prisma.stockBalance.aggregate({
      _sum: { qty: true },
      where: { location: loc },
    }),
    prisma.campusRequest.count({ where: { status: "OPEN", ...(campusId ? { campusId } : {}) } }),
    prisma.distribution.count({ where: campusId ? { toCampusId: campusId } : {} }),
    prisma.parentOrder.count({ where: campusId ? { campusId } : {} }),
    stockAlerts(campusId ? { campusId } : { kind: "CAMPUS" }),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow={isSchoolAdmin(user) ? "School admins" : "Campus only"}
        title={picked?.name ?? (isSchoolAdmin(user) ? "All campuses" : "Your campus")}
        subtitle={
          isSchoolAdmin(user)
            ? picked
              ? "Stock, requests, delivery notes, and parent orders for this school."
              : "All five schools. Filter to one school, then open stock, requests, or orders."
            : "Stock, requests, delivery notes, and parent orders for this site only."
        }
        actions={
          <Link className="text-sm font-semibold text-electric-blue no-underline" href="/reports">
            Campus KPIs
          </Link>
        }
      />
      {isSchoolAdmin(user) ? <div className="mb-4"><CampusFilter sites={sites} active={picked?.code} path="/desk" persist /></div> : null}
      <AlertList stock={low} />
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/stock"><Card><p className="text-sm text-[var(--muted)]">On hand</p><p className="text-3xl">{stock._sum.qty ?? 0}</p></Card></Link>
        {user.role !== "PRINCIPAL" ? (
          <Link href="/requests"><Card><p className="text-sm text-[var(--muted)]">Open requests</p><p className="text-3xl">{requests}</p></Card></Link>
        ) : null}
        <Link href="/distribution"><Card><p className="text-sm text-[var(--muted)]">Incoming DNs</p><p className="text-3xl">{dns}</p></Card></Link>
        <Link href="/orders"><Card><p className="text-sm text-[var(--muted)]">Parent orders</p><p className="text-3xl">{orders}</p></Card></Link>
      </div>
    </div>
  );
}
