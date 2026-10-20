import { useQuery } from "@tanstack/react-query";

type Handoff = {
  id: string;
  from: string;
  title: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
};

type Topic = {
  topic: string;
  campus: string;
  count: number;
  relevance: number | null;
  confidence: number | null;
  impact: number | null;
};

export function AcademicsInsights() {
  const query = useQuery<{ topics: Topic[]; handoffs?: Handoff[] }>({
    queryKey: ["/api/insights/academics"],
  });
  const topics = query.data?.topics ?? [];
  const handoffs = query.data?.handoffs ?? [];
  if (!topics.length && !handoffs.length) return null;

  return (
    <section className="mb-8 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">From other desks</h2>
      {topics.length > 0 ? (
        <p className="text-sm text-muted-foreground mt-1">
          What teachers said after professional development.
        </p>
      ) : null}
      {handoffs.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {handoffs.map((row) => (
            <li key={row.id}>
              {row.from}: {row.title}. {row.facts.map((fact) => `${fact.label} ${fact.value}`).join(" · ")}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {topics.map((topic) => (
          <li key={`${topic.topic}-${topic.campus}`}>
            {topic.topic}
            {topic.campus ? ` · ${topic.campus}` : ""} · {topic.count} responses
            {topic.confidence != null ? ` · confidence ${topic.confidence}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
