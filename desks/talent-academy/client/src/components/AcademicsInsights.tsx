import { useQuery } from "@tanstack/react-query";

type Topic = {
  topic: string;
  campus: string;
  count: number;
  relevance: number | null;
  confidence: number | null;
  impact: number | null;
};

export function AcademicsInsights() {
  const query = useQuery<{ topics: Topic[] }>({
    queryKey: ["/api/insights/academics"],
  });
  const topics = query.data?.topics ?? [];
  if (!topics.length) return null;

  return (
    <section className="mb-8 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">From Academics</h2>
      <p className="text-sm text-muted-foreground mt-1">
        What teachers said after professional development.
      </p>
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
