"use client";

type Person = { id: string; label: string };

export function UpdatesFilter({
  who,
  query,
  people,
  from,
  to,
  kind,
}: {
  who: string;
  query: string;
  people: Person[];
  from?: string;
  to?: string;
  kind?: string;
}) {
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? people.filter((person) => person.label.toLowerCase().includes(needle))
    : people;

  return (
    <form action="/updates" method="get" className="flex flex-wrap items-end gap-3">
      {from ? <input type="hidden" name="from" value={from} /> : null}
      {to ? <input type="hidden" name="to" value={to} /> : null}
      {kind && kind !== "all" ? <input type="hidden" name="hk" value={kind} /> : null}
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Show</span>
        <select
          name="who"
          defaultValue={shown.some((person) => person.id === who) ? who : "all"}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
          style={{ color: "#14233B" }}
        >
          <option value="all">Everyone</option>
          {shown.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Name</span>
        <input
          name="q"
          defaultValue={query}
          placeholder="Search a name"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
          style={{ color: "#14233B", backgroundColor: "#ffffff" }}
        />
      </label>
      <button type="submit" className="on-navy rounded-lg px-4 py-2 text-sm font-semibold">
        Filter
      </button>
    </form>
  );
}
