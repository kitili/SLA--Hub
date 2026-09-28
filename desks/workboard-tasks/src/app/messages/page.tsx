import { formatDistanceToNow } from "date-fns";
import { getDefaultOrganization, getRecentMessages } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const org = await getDefaultOrganization();
  const messages = await getRecentMessages(org?.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Chat history</h2>
        <p className="mt-1 text-zinc-600">Every inbound and outbound WhatsApp message</p>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-zinc-500">
            No messages yet. Point your WhatsApp webhook here to start logging.
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-xl border px-5 py-4 ${
                message.direction === "INBOUND"
                  ? "border-zinc-200 bg-white"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-zinc-500">
                  {message.direction === "INBOUND" ? "Staff → Bot" : "Bot → Staff"}
                  {message.user?.name ? ` · ${message.user.name}` : message.phone ? ` · ${message.phone}` : ""}
                  {message.parsedCommand ? ` · ${message.parsedCommand}` : ""}
                </div>
                <time className="text-xs text-zinc-400">
                  {formatDistanceToNow(message.createdAt, { addSuffix: true })}
                </time>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-800">
                {message.body}
              </pre>
              {message.processingError ? (
                <p className="mt-2 text-sm text-rose-600">{message.processingError}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
