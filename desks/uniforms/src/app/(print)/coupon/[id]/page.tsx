import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { tzs } from "@/lib/money";
import { brand } from "@/lib/brand";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { orderRecordedPaid } from "@/lib/order-status";
import { assertOrder } from "@/lib/visibility";

export default async function CouponPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const order = await prisma.parentOrder.findUnique({
    where: { id },
    include: { campus: true, lines: { include: { sku: true } }, pays: true },
  });
  if (!order) notFound();
  await assertOrder(user, order);
  const total = order.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
  const paid = orderRecordedPaid(order.pays);

  return (
    <article className="mx-auto max-w-xl">
      <Image src={brand.logos.brandmarkElectricBlue} alt={brand.name} width={140} height={62} className="h-12 w-auto" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-electric-blue">{brand.name}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-electric-blue">Uniform coupon</h1>
      <p>{order.ref} · {order.campus.name}</p>
      <p>
        {order.studentName} · {order.className} · {order.gender}
        {order.regNo ? ` · ${order.regNo}` : ""}
      </p>
      <p>Ordered {order.orderedAt.toISOString().slice(0, 10)}</p>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr>
            <th className="border-b py-1 text-left">Item</th>
            <th className="border-b py-1 text-left">Size</th>
            <th className="border-b py-1 text-right">Qty</th>
            <th className="border-b py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-1">{line.sku.name}</td>
              <td className="py-1">{line.size}</td>
              <td className="py-1 text-right">{line.qty}</td>
              <td className="py-1 text-right">{tzs(line.qty * line.unitTzs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4">Total {tzs(total)} · Paid {tzs(paid)} · Balance {tzs(total - paid)}</p>
      <p className="mt-8 text-sm">Parent sign ________________ · Staff sign ________________</p>
    </article>
  );
}
