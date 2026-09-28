import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolCategories } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { ImportToolsForm } from "@/components/tools/import-tools-form";

const COLUMNS = [
  { name: "Asset Tag", required: true, description: "Unique ID for the device, e.g. LAP-0042" },
  { name: "Name", required: true, description: "e.g. Dell Latitude 5420" },
  { name: "Category", required: true, description: "Must match an existing category name exactly (see below)" },
  { name: "Brand", required: false, description: "e.g. Dell" },
  { name: "Model", required: false, description: "e.g. Latitude 5420" },
  { name: "Specifications", required: false, description: "e.g. 16GB RAM, 512GB SSD, i7" },
  { name: "Serial Number", required: false, description: "Manufacturer serial number" },
  { name: "Purchase Date", required: false, description: "Format: YYYY-MM-DD, e.g. 2025-01-15" },
  { name: "Purchase Price", required: false, description: "Number only, no currency symbol, e.g. 1200.50" },
];

export default async function ImportToolsPage() {
  await requireModulePage("tech_tools", "manage");

  const categories = await db.select().from(toolCategories).orderBy(asc(toolCategories.name));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-medium text-navy">Import devices from a spreadsheet</h1>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-black/60">How to prepare your spreadsheet</h2>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-black/80">
          <li>Use a .xlsx file with one device per row, starting from row 2 (row 1 is the header).</li>
          <li>Row 1 must contain the exact column names listed below — order doesn&apos;t matter.</li>
          <li>Category names must match one of your existing categories exactly (not case-sensitive).</li>
          <li>Leave optional columns blank if you don&apos;t have the information yet.</li>
        </ol>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left text-black/60">
              <tr>
                <th className="py-2 pr-4 font-medium">Column</th>
                <th className="py-2 pr-4 font-medium">Required</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-4 font-medium text-navy">{c.name}</td>
                  <td className="py-2 pr-4 text-black/70">{c.required ? "Yes" : "No"}</td>
                  <td className="py-2 text-black/70">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-black/10 pt-4 text-sm">
          <p className="mb-1 text-black/60">Existing categories you can use:</p>
          {categories.length > 0 ? (
            <p className="text-black/80">{categories.map((c) => c.name).join(", ")}</p>
          ) : (
            <p className="text-black/50">No categories yet.</p>
          )}
          <Link href="/dashboard/tools/categories" className="mt-1 inline-block text-xs text-navy underline">
            Manage categories
          </Link>
        </div>
      </Card>

      <ImportToolsForm />
    </div>
  );
}
