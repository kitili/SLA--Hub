import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolCategories } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { generateToolQrDataUrl } from "@/lib/qrcode";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default async function ToolLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  await requireModulePage("tech_tools", "view");
  const { categoryId } = await searchParams;

  const [categories, rows] = await Promise.all([
    db.select().from(toolCategories).orderBy(asc(toolCategories.name)),
    db.query.tools.findMany({
      where: categoryId ? eq(tools.categoryId, categoryId) : undefined,
      orderBy: asc(tools.assetTag),
      limit: 300,
    }),
  ]);

  const labels = await Promise.all(
    rows.map(async (tool) => ({
      id: tool.id,
      assetTag: tool.assetTag,
      name: tool.name,
      qr: await generateToolQrDataUrl(tool.id),
    })),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-medium text-navy">Print labels</h1>
          <p className="mt-1 text-sm text-black/60">{labels.length} device{labels.length === 1 ? "" : "s"} selected.</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <Select name="categoryId" defaultValue={categoryId ?? ""} className="w-auto">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
      </div>

      <p className="mb-4 text-xs text-black/50 print:hidden">Use your browser&apos;s Print (Ctrl/Cmd+P) to print this sheet.</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {labels.map((label) => (
          <div key={label.id} className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-white p-4 print:break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={label.qr} alt={`QR code for ${label.assetTag}`} width={140} height={140} />
            <div className="text-center">
              <div className="text-sm font-medium text-navy">{label.assetTag}</div>
              <div className="text-xs text-black/60">{label.name}</div>
            </div>
          </div>
        ))}
        {labels.length === 0 && <p className="col-span-full py-12 text-center text-sm text-black/50">No devices found.</p>}
      </div>
    </div>
  );
}
