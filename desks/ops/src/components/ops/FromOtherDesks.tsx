import { readHubHandoffs } from "@/lib/hub-bridge";

export async function FromOtherDesks({ to }: { to: string }) {
  const handoffs = await readHubHandoffs(to);
  if (handoffs.length === 0) return null;
  return (
    <section className="mb-8 rounded-[var(--radius)] border border-card-border bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-electric-blue">From other desks</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {handoffs.map((row) => (
          <li key={row.id}>
            <p className="font-semibold text-ink">{row.from}: {row.title}</p>
            <p className="text-sm text-ink-muted">{row.summary}</p>
            <p className="text-sm text-ink">
              {row.facts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
