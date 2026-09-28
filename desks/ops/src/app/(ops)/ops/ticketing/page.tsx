/**
 * Ticketing dashboard — embeds the Ops Ticket Desk under /ticketing/.
 * Forwards query params so department deep links work from Ops domains.
 */

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toQueryString(params: Record<string, string | string[] | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    } else {
      qs.set(key, value);
    }
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}

export default async function TicketingOpsPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const src = `/ticketing/index.html${toQueryString(params)}`;

  return (
    <iframe
      title="Ops Ticket Desk"
      src={src}
      className="min-h-[calc(100vh-1rem)] w-full flex-1 border-0 bg-transparent"
    />
  );
}
