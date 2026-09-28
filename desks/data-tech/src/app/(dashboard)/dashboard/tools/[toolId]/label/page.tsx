import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";

export default async function ToolLabelPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  await requireModulePage("tech_tools", "view");

  const tool = await db.query.tools.findFirst({ where: eq(tools.id, toolId) });
  if (!tool) notFound();

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-black/10 bg-white p-8 print:border-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/tools/${tool.id}/qr`} alt={`QR code for ${tool.assetTag}`} width={240} height={240} />
      <div className="text-center">
        <div className="text-lg font-medium text-navy">{tool.assetTag}</div>
        <div className="text-sm text-black/60">{tool.name}</div>
      </div>
    </div>
  );
}
