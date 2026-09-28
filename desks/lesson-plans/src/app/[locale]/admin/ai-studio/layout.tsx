import AiStudioNav from "./AiStudioNav";

/**
 * AI Studio section shell.
 *
 * Auth gating and the outer admin chrome live in the parent
 * {@link ../layout admin layout}; this nested layout only adds the AI Studio
 * sub-navigation above the section's pages — the studio generator plus the
 * Schemes of Work, Textbooks and Prompts management pages that now live under
 * `/admin/ai-studio/*` instead of as top-level admin tabs.
 */
export default function AiStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <AiStudioNav />
      <div style={{ marginTop: "1.5rem" }}>{children}</div>
    </div>
  );
}
