import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { ClothAlert, StockAlert } from "@/lib/alerts";

export function AlertList({
  stock,
  cloth = [],
}: {
  stock: StockAlert[];
  cloth?: ClothAlert[];
}) {
  if (!stock.length && !cloth.length) return null;
  return (
    <Card className="border-gold">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Alerts</h2>
        <Link className="text-sm font-semibold text-electric-blue no-underline" href="/alerts">
          All →
        </Link>
      </div>
      {stock.slice(0, 6).map((a) => (
        <p key={`${a.location}-${a.sku}-${a.size}`} className="text-sm">
          <Badge tone="gold">Low</Badge> {a.location} · {a.sku} size {a.size} · {a.qty} left (reorder {a.reorder})
        </p>
      ))}
      {cloth.slice(0, 4).map((a) => (
        <p key={a.material} className="text-sm">
          <Badge tone="pink">Cloth</Badge> {a.material} · left {a.remaining} · need {a.need} · buy {a.buy}
        </p>
      ))}
    </Card>
  );
}
