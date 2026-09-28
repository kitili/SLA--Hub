import { cancelCampusRequest, createCampusRequest, updateCampusRequest } from "@/actions/requests";
import { ConfirmModal } from "@/components/confirm-modal";
import { CampusFilter } from "@/components/campus-filter";
import { LinesEditor } from "@/components/lines-editor";
import { Badge, Btn, Card, Field, Pager, PageHeader, Table, inputClass, statusTone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { ACTIVE_SKU } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requestWhere } from "@/lib/visibility";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER"]);
  const page = parsePage((await searchParams).page);
  const picked = await schoolScope(user);
  const where = requestWhere(user, picked?.id);
  const [requests, total, skus, campuses] = await Promise.all([
    prisma.campusRequest.findMany({
      where,
      include: { campus: true, requester: true, lines: { include: { sku: true } } },
      orderBy: { createdAt: "desc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.campusRequest.count({ where }),
    prisma.sku.findMany({ where: ACTIVE_SKU, include: { sizes: true }, orderBy: { code: "asc" } }),
    isSchoolAdmin(user) ? prisma.campus.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Campus requests"
        subtitle="Usa River and AM admins request for their campus. Kijenge, Ilboru, and Boma head teachers request for theirs. School admins can filter by school. Imani sees everyone."
      />
      {isSchoolAdmin(user) ? <CampusFilter sites={campuses} active={picked?.code} path="/requests" persist /> : null}
      <Card>
        <Table headers={["Ref", "Campus", "By", "Needed", "Status", "Lines", "Why", ""]}>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-2">{r.ref}</td>
              <td className="px-2 py-2">{r.campus.name}</td>
              <td className="px-2 py-2">{r.requester.name}</td>
              <td className="px-2 py-2">{r.neededBy || "—"}</td>
              <td className="px-2 py-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              <td className="px-2 py-2 text-xs">
                {r.lines.map((l) => `${l.sku.code} ${l.size}×${l.qty}`).join(", ")}
              </td>
              <td className="px-2 py-2 text-xs text-ink-muted">{r.note || "—"}</td>
              <td className="px-2 py-2 text-right">
                {user.role !== "STORE" && r.status === "OPEN" ? (
                  <div className="flex justify-end gap-2">
                    <ConfirmModal
                      triggerLabel="Edit"
                      triggerTone="ghost"
                      tone="primary"
                      wide
                      title={`Edit ${r.ref}`}
                      description="Change the items or quantities on this request. Only works while it's still OPEN."
                      confirmLabel="Save changes"
                      action={updateCampusRequest}
                      hiddenFields={{ requestId: r.id }}
                    >
                      <LinesEditor
                        skus={skus.map((s) => ({
                          id: s.id,
                          code: s.code,
                          name: s.name,
                          sellTzs: s.sellTzs,
                          buyTzs: s.buyTzs,
                          sizes: s.sizes.map((x) => x.size),
                        }))}
                        initialRows={r.lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty }))}
                      />
                    </ConfirmModal>
                    <ConfirmModal
                      triggerLabel="Cancel"
                      title={`Cancel ${r.ref}?`}
                      description="This request will be marked cancelled and Imani won't be able to fulfill it. This can't be undone."
                      confirmLabel="Yes, cancel it"
                      action={cancelCampusRequest}
                      hiddenFields={{ requestId: r.id }}
                    />
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(total)} />
      </Card>

      {user.role !== "STORE" ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Request for {isSchoolAdmin(user) ? (picked?.name ?? "a school") : user.campusName}</h2>
          <form action={createCampusRequest} className="grid gap-3">
            {isSchoolAdmin(user) ? (
              <Field label="School">
                <select className={inputClass()} name="campusId" defaultValue={picked?.id ?? ""} required>
                  <option value="">Pick a school</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>{campus.name}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Needed by">
              <input className={inputClass()} name="neededBy" type="date" />
            </Field>
            <Field label="Why (optional)">
              <input className={inputClass()} name="note" placeholder="e.g. Baraka Ally's order is paid and waiting on this" />
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
            <Btn>Send to Imani</Btn>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
