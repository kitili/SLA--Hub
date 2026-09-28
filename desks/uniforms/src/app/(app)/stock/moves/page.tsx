import { reverseStockAdjust } from "@/actions/stock";
import { ConfirmModal } from "@/components/confirm-modal";
import { CampusFilter } from "@/components/campus-filter";
import { Card, Pager, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { listCampuses } from "@/lib/kpis";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { locationWhere } from "@/lib/visibility";

export default async function MovesPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; reason?: string; page?: string }>;
}) {
  const user = await requireUser(["STORE", "TAILOR", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const { location, reason, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const picked = await schoolScope(user);
  const scope = locationWhere(user, picked?.id);
  const allowed = await prisma.location.findMany({ where: scope, orderBy: { code: "asc" } });
  const allowedIds = new Set(allowed.map((l) => l.id));
  const locationId = location && allowedIds.has(location) ? location : undefined;
  const where = {
    location: scope,
    ...(locationId ? { locationId } : {}),
    ...(reason ? { reason } : {}),
  };
  const [moves, total, locations, sites] = await Promise.all([
    prisma.stockMove.findMany({
      where,
      include: { location: true, sku: true },
      orderBy: { createdAt: "desc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.stockMove.count({ where }),
    Promise.resolve(allowed),
    isSchoolAdmin(user) ? listCampuses() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-4">
      <PageHeader title="Stock movements" subtitle="Receive, sew-in, transfer, distribute, parent issue, adjust." />
      {isSchoolAdmin(user) ? <CampusFilter sites={sites} active={picked?.code} path="/stock/moves" persist /> : null}
      <Card>
        <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
          <select name="location" defaultValue={location ?? ""} className="rounded-[10px] border border-[#d8dee8] bg-[#f7f9fc] px-3 py-2">
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select name="reason" defaultValue={reason ?? ""} className="rounded-[10px] border border-[#d8dee8] bg-[#f7f9fc] px-3 py-2">
            <option value="">All reasons</option>
            {["RECEIVE", "SEW_IN", "TRANSFER_OUT", "TRANSFER_IN", "DISTRIBUTE", "PARENT_ISSUE", "ADJUST"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="rounded-[10px] bg-electric-blue px-3 py-2 font-semibold text-white" type="submit">
            Filter
          </button>
        </form>
        <Table headers={["When", "Location", "SKU", "Size", "Qty", "Reason", "Ref", "Note", ""]}>
          {moves.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-2 text-xs">{m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="px-2 py-2">{m.location.code}</td>
              <td className="px-2 py-2">{m.sku.code}</td>
              <td className="px-2 py-2">{m.size}</td>
              <td className="px-2 py-2 tabular-nums">{m.qty}</td>
              <td className="px-2 py-2">{m.reason}</td>
              <td className="px-2 py-2">{m.ref}</td>
              <td className="px-2 py-2 max-w-xs break-all text-[var(--muted)]">{m.note}</td>
              <td className="px-2 py-2 text-right">
                {user.role === "STORE" && m.reason === "ADJUST" ? (
                  <ConfirmModal
                    triggerLabel="Reverse"
                    title={`Reverse this adjustment?`}
                    description={`Posts an equal-and-opposite entry for ${m.sku.code} ${m.size} at ${m.location.code} (${m.qty > 0 ? "-" : "+"}${Math.abs(m.qty)}). The original entry stays in history.`}
                    confirmLabel="Yes, reverse it"
                    action={reverseStockAdjust}
                    hiddenFields={{ moveId: m.id }}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(total)} params={{ location, reason }} />
      </Card>
    </div>
  );
}
