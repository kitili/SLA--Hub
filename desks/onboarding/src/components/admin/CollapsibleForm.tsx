"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

import styles from "./admin.module.css";

/**
 * A button that reveals a form (e.g. "New section", "Add question"). On the
 * form's success callback it collapses and refreshes the server data.
 *
 * IMPORTANT: `children` is a render-prop function, so this component must only
 * be used from within a Client Component. Rendering it from a Server Component
 * passes a function across the server→client boundary, which RSC forbids
 * ("Functions cannot be passed directly to Client Components"). For Server
 * Component pages, wrap usage in a small `"use client"` island instead — see
 * `CreateSectionPanel` / `CreateMaterialPanel`.
 */
export default function CollapsibleForm({
  openLabel,
  children,
}: {
  openLabel: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function close() {
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen(true)}
      >
        {openLabel}
      </button>
    );
  }

  return <div className={styles.card}>{children(close)}</div>;
}
