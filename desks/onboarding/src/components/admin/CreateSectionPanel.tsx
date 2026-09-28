"use client";

import CollapsibleForm from "./CollapsibleForm";
import SectionForm from "./SectionForm";

/**
 * Client island for the "New section" collapsible + create form.
 *
 * The render-prop function passed to {@link CollapsibleForm} must live inside a
 * Client Component: RSC forbids passing a function as a prop from a Server
 * Component to a Client Component ("Functions cannot be passed directly to
 * Client Components"). The Sections page is a Server Component, so it renders
 * this island instead of using CollapsibleForm directly.
 */
export default function CreateSectionPanel({
  openLabel,
}: {
  openLabel: string;
}) {
  return (
    <CollapsibleForm openLabel={openLabel}>
      {(close) => <SectionForm mode="create" onDone={close} />}
    </CollapsibleForm>
  );
}
