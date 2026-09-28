import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertDistribution } from "@/lib/visibility";

export default async function DeliveryNotePrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const { id } = await params;
  const dn = await prisma.distribution.findUnique({
    where: { id },
    include: { from: true, toCampus: true, issuer: true, lines: { include: { sku: true } } },
  });
  if (!dn) notFound();
  assertDistribution(user, dn);

  return (
    <article className="mx-auto max-w-xl">
      <Image src={brand.logos.brandmarkElectricBlue} alt={brand.name} width={140} height={62} className="h-12 w-auto" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-electric-blue">{brand.name}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-electric-blue">Delivery note</h1>
      <p>{dn.ref}</p>
      <p>From {dn.from.name} → {dn.toCampus.name}</p>
      <p>Issuer {dn.issuer.name} · Receiver {dn.receiver || "________________"}</p>
      <p>{dn.createdAt.toISOString().slice(0, 10)}</p>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr>
            <th className="border-b py-1 text-left">SKU</th>
            <th className="border-b py-1 text-left">Size</th>
            <th className="border-b py-1 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {dn.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-1">{line.sku.code} · {line.sku.name}</td>
              <td className="py-1">{line.size}</td>
              <td className="py-1 text-right">{line.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-10 text-sm">Receiver sign ________________ · Date ________</p>
    </article>
  );
}
