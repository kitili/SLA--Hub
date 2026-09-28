import Link from "next/link";
import { brand } from "@/lib/brand";
import { weeklyPack } from "@/lib/briefing";
import { requireUser } from "@/lib/auth";
import { buildKpiReport, campusIdForCode } from "@/lib/kpis";
import { Money } from "@/components/ui";

export default async function WeeklyBriefing({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const user = await requireUser(["CEO", "STORE", "FINANCE", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const { campus: campusCode } = await searchParams;
  const campusBound = Boolean(user.campusId) && (user.role === "ADMIN" || user.role === "HEAD_TEACHER" || user.role === "PRINCIPAL");
  const picked = campusBound ? null : await campusIdForCode(campusCode);
  const report = await buildKpiReport({
    campusId: campusBound ? user.campusId : picked?.id,
    includeMoney: true,
    includeProduction: user.role === "CEO" || user.role === "STORE" || user.role === "FINANCE",
  });
  const pack = weeklyPack(report);

  return (
    <article className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric-blue">{brand.name}</p>
      <h1 className="font-display text-3xl font-extrabold text-electric-blue">Weekly pack</h1>
      <p className="mb-4 text-sm text-ink-muted">
        {report.campusName ?? "All five campuses"} · {report.asOf.toISOString().slice(0, 10)}
      </p>
      <pre className="mb-6 whitespace-pre-wrap rounded-[12px] border border-card-border bg-[#f7f9fc] p-4 text-sm">{pack}</pre>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr>
            <th className="border-b py-1 text-left">Campus</th>
            <th className="border-b py-1 text-left">Coverage</th>
            <th className="border-b py-1 text-left">Coupons</th>
            <th className="border-b py-1 text-left">Ready</th>
            <th className="border-b py-1 text-left">Paid</th>
            <th className="border-b py-1 text-left">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {report.campuses.map((row) => (
            <tr key={row.id}>
              <td className="border-b py-1">{row.name}</td>
              <td className="border-b py-1">{row.coveragePct}%</td>
              <td className="border-b py-1">{row.coupons}</td>
              <td className="border-b py-1">{row.ready}</td>
              <td className="border-b py-1"><Money amount={row.paymentsTzs} /></td>
              <td className="border-b py-1"><Money amount={row.outstandingTzs} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.readyList.length ? (
        <section className="mb-6">
          <h2 className="font-semibold">Ready — come collect</h2>
          <ul className="list-disc pl-5 text-sm">
            {report.readyList.map((row) => (
              <li key={row.ref}>
                {row.ref} · {row.studentName} · {row.campusName} · {row.days} days
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="no-print text-sm">
        <Link className="font-semibold text-electric-blue" href={report.campusCode ? `/reports?campus=${report.campusCode}` : "/reports"}>
          Back to briefing
        </Link>
      </p>
    </article>
  );
}
