import { createSku, reactivateSku, retireSku, updateSku } from "@/actions/catalog";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, Btn, Card, Field, Money, PageHeader, Table, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CatalogPage() {
  const user = await requireUser(["STORE", "FINANCE", "CEO"]);
  const canEdit = user.role !== "CEO";
  const skus = await prisma.sku.findMany({ include: { sizes: true }, orderBy: { code: "asc" } });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Uniform items"
        subtitle="Every SKU in the system: code, colour, kind, gender, sizes, and pricing. Buy/sell price alone is still editable on Plan — this is the full record."
      />
      <Card>
        <Table headers={canEdit ? ["Code", "Name", "Colour", "Kind", "Gender", "Sizes", "Buy", "Sell", ""] : ["Code", "Name", "Colour", "Kind", "Gender", "Sizes", "Buy", "Sell"]}>
          {skus.map((sku) => {
            const sizeList = sku.sizes.map((s) => s.size).join(", ");
            return (
              <tr key={sku.id} className={sku.active ? undefined : "opacity-60"}>
                <td className="px-2 py-2">
                  {sku.code}
                  {sku.active ? null : <Badge tone="grey"> Retired</Badge>}
                </td>
                <td className="px-2 py-2">{sku.name}</td>
                <td className="px-2 py-2">{sku.colour}</td>
                <td className="px-2 py-2"><Badge tone="blue">{sku.kind}</Badge></td>
                <td className="px-2 py-2">{sku.gender}</td>
                <td className="px-2 py-2 text-xs">{sizeList}</td>
                <td className="px-2 py-2"><Money amount={sku.buyTzs} /></td>
                <td className="px-2 py-2"><Money amount={sku.sellTzs} /></td>
                {canEdit ? (
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <ConfirmModal
                        triggerLabel="Edit"
                        triggerTone="ghost"
                        tone="primary"
                        wide
                        title={`Edit ${sku.code}`}
                        description="Change any detail of this uniform item."
                        confirmLabel="Save changes"
                        action={updateSku}
                        hiddenFields={{ skuId: sku.id }}
                      >
                        <Field label="Name">
                          <input className={inputClass()} name="name" defaultValue={sku.name} required />
                        </Field>
                        <Field label="Colour">
                          <input className={inputClass()} name="colour" defaultValue={sku.colour} required />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Kind">
                            <input className={inputClass()} name="kind" defaultValue={sku.kind} required />
                          </Field>
                          <Field label="Gender">
                            <select className={inputClass()} name="gender" defaultValue={sku.gender}>
                              <option value="UNISEX">Unisex</option>
                              <option value="GIRL">Girl</option>
                              <option value="BOY">Boy</option>
                            </select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Buy TZS">
                            <input className={inputClass()} name="buyTzs" type="number" min={0} defaultValue={sku.buyTzs} required />
                          </Field>
                          <Field label="Sell TZS">
                            <input className={inputClass()} name="sellTzs" type="number" min={0} defaultValue={sku.sellTzs} required />
                          </Field>
                        </div>
                        <Field label="Sizes (comma-separated)">
                          <input className={inputClass()} name="sizes" defaultValue={sizeList} required />
                        </Field>
                      </ConfirmModal>
                      {sku.active ? (
                        <ConfirmModal
                          triggerLabel="Retire"
                          triggerTone="danger"
                          title={`Retire ${sku.code}?`}
                          description="Hides this item from new orders/requests/POs going forward. Existing history (past orders, stock, moves) is never touched or deleted."
                          confirmLabel="Yes, retire it"
                          action={retireSku}
                          hiddenFields={{ skuId: sku.id }}
                        />
                      ) : (
                        <ConfirmModal
                          triggerLabel="Reactivate"
                          triggerTone="ghost"
                          tone="primary"
                          title={`Reactivate ${sku.code}?`}
                          description="Makes this item selectable again in new orders/requests/POs."
                          confirmLabel="Yes, reactivate"
                          action={reactivateSku}
                          hiddenFields={{ skuId: sku.id }}
                        />
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </Table>
      </Card>

      {canEdit ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Add uniform item</h2>
          <form action={createSku} className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Code">
                <input className={inputClass()} name="code" placeholder="e.g. RT3" required />
              </Field>
              <Field label="Name">
                <input className={inputClass()} name="name" placeholder="e.g. Red round-neck" required />
              </Field>
              <Field label="Colour">
                <input className={inputClass()} name="colour" required />
              </Field>
              <Field label="Kind">
                <input className={inputClass()} name="kind" placeholder="e.g. TOP, TROUSER, DRESS" required />
              </Field>
              <Field label="Gender">
                <select className={inputClass()} name="gender" defaultValue="UNISEX">
                  <option value="UNISEX">Unisex</option>
                  <option value="GIRL">Girl</option>
                  <option value="BOY">Boy</option>
                </select>
              </Field>
              <Field label="Sizes (comma-separated)">
                <input className={inputClass()} name="sizes" placeholder="18, 20, 22, 24, 26, 28, 30, 36" required />
              </Field>
              <Field label="Buy TZS">
                <input className={inputClass()} name="buyTzs" type="number" min={0} required />
              </Field>
              <Field label="Sell TZS">
                <input className={inputClass()} name="sellTzs" type="number" min={0} required />
              </Field>
            </div>
            <div>
              <Btn>Add item</Btn>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
