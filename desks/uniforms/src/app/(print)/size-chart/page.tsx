import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";

export default async function SizeChartPrint() {
  await requireUser();
  const fits = await prisma.sizeFit.findMany({
    where: { sku: { kind: "SCHOOL" } },
    include: { sku: true },
    orderBy: [{ className: "asc" }, { gender: "asc" }, { sku: { code: "asc" } }],
  });
  const classes = [...new Set(fits.map((f) => f.className))];

  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric-blue">{brand.name}</p>
      <h1 className="font-display text-3xl font-extrabold text-electric-blue">Size chart / Chati ya ukubwa</h1>
      <p className="mb-4 text-sm">Pin this on the Usa River shop wall. Day uniforms.</p>
      {classes.map((cls) => (
        <section key={cls} className="mb-4">
          <h2 className="font-semibold">{cls}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b py-1 text-left">Child</th>
                <th className="border-b py-1 text-left">Garment</th>
                <th className="border-b py-1 text-left">Size</th>
                <th className="border-b py-1 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {fits
                .filter((f) => f.className === cls)
                .map((f) => (
                  <tr key={f.id}>
                    <td className="border-b py-1">{f.gender === "GIRL" ? "Girl / Msichana" : "Boy / Mvulana"}</td>
                    <td className="border-b py-1">{f.sku.name}</td>
                    <td className="border-b py-1">{f.size}</td>
                    <td className="border-b py-1 text-xs">{f.note}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}
